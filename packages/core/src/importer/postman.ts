import type { RequestConfig, HttpMethod, KeyValue, AuthConfig } from '../types'
import type { ImportedCollection, ImportSource, ImportError } from './types'

/**
 * Parse a Postman v2.1 collection JSON into OmniAPI collections + requests.
 *
 * Handles:
 *   - Folders (ItemGroup via nested `item[]`)
 *   - URL as string or parsed URL object
 *   - Body modes: raw, urlencoded, formdata
 *   - Auth: bearer, basic, api-key
 *   - Pre-request / test scripts (event[].script.exec)
 */
export function parsePostmanCollection(json: unknown): {
  collections: ImportedCollection[]
  source: ImportSource
  errors: ImportError[]
} {
  const errors: ImportError[] = []
  const root = json as Record<string, unknown> | undefined
  if (!root) {
    return { collections: [], source: emptySource(), errors: [{ type: 'parse', message: 'Root is empty' }] }
  }

  const info = root.info as Record<string, unknown> | undefined
  const collectionName = (info?.name as string) ?? 'Imported Postman Collection'

  const items = root.item as unknown[] | undefined
  if (!Array.isArray(items) || items.length === 0) {
    return {
      collections: [{ name: collectionName, requests: [] }],
      source: { format: 'postman-v2.1', originalName: collectionName, itemCount: 0 },
      errors: [],
    }
  }

  // Inheritable auth at collection level
  const collectionAuth = parseAuth(root.auth)

  const requests: RequestConfig[] = []
  for (const item of items) {
    flattenPostmanItems(item, collectionName, collectionAuth, '', requests, errors)
  }

  return {
    collections: [{ name: collectionName, description: (info?.description as string) ?? '', requests }],
    source: { format: 'postman-v2.1', originalName: collectionName, itemCount: requests.length },
    errors,
  }
}

function flattenPostmanItems(
  item: unknown,
  _collectionName: string,
  collectionAuth: AuthConfig | null,
  prefix: string,
  out: RequestConfig[],
  errors: ImportError[],
): void {
  const obj = item as Record<string, unknown> | undefined
  if (!obj) return

  const name = (obj.name as string) ?? 'Unnamed'
  const fullName = prefix ? `${prefix} / ${name}` : name

  // Postman folder = item with nested `item[]`
  const nestedItems = obj.item as unknown[] | undefined
  if (Array.isArray(nestedItems)) {
    // This is a folder — recurse
    for (const child of nestedItems) {
      flattenPostmanItems(child, _collectionName, collectionAuth, fullName, out, errors)
    }
    return
  }

  // Leaf item — has a `request` field
  const requestRaw = obj.request as Record<string, unknown> | undefined
  if (!requestRaw) {
    errors.push({ type: 'item-skip', message: `Skipped "${fullName}": no request field`, itemName: fullName })
    return
  }

  const request = convertPostmanRequest(requestRaw, fullName, collectionAuth, errors)
  if (request) {
    out.push(request)
  }
}

function convertPostmanRequest(
  raw: Record<string, unknown>,
  name: string,
  collectionAuth: AuthConfig | null,
  errors: ImportError[],
): RequestConfig | null {
  const method = (raw.method as string)?.toUpperCase() ?? 'GET'
  if (!isValidMethod(method)) {
    errors.push({ type: 'item-skip', message: `Skipped "${name}": invalid method "${method}"`, itemName: name })
    return null
  }

  const urlInfo = parsePostmanUrl(raw.url)
  const headers = parsePostmanHeaders(raw.header)
  const body = parsePostmanBody(raw.body)
  const auth = parseAuth(raw.auth) ?? collectionAuth ?? { type: 'none', data: {} }
  const scripts = extractScripts(raw.event as unknown[] | undefined)

  return {
    id: crypto.randomUUID(),
    name,
    method: method as HttpMethod,
    url: urlInfo.url,
      headers,
    queryParams: urlInfo.queryParams,
    body: body.text,
    bodyType: body.type,
    auth,
    preScript: scripts.preScript,
    postScript: scripts.postScript,
  }
}

interface ParsedUrl {
  url: string
  queryParams: KeyValue[]
}

function parsePostmanUrl(url: unknown): ParsedUrl {
  if (!url) return { url: '', queryParams: [] }

  // String URL
  if (typeof url === 'string') {
    return { url, queryParams: [] }
  }

  // URL object
  const obj = url as Record<string, unknown>

  // Use `raw` field if available (it contains the full URL string)
  if (typeof obj.raw === 'string' && obj.raw.trim()) {
    const queryParams = parsePostmanQueryParams(obj.query as unknown[] | undefined)
    return { url: obj.raw, queryParams }
  }

  // Build from parts
  const protocol = (obj.protocol as string) ?? 'https'
  const host = arrayToString(obj.host)
  const port = obj.port ? `:${obj.port}` : ''
  const path = arrayToString(obj.path as string[] | undefined)
  const queryParams = parsePostmanQueryParams(obj.query as unknown[] | undefined)
  const hash = obj.hash ? `#${obj.hash}` : ''

  let built = `${protocol}://${host}${port}${path ? `/${path}` : ''}${hash}`
  // Collapse double slashes
  built = built.replace(/(?<!:)\/\//g, '/')

  return { url: built, queryParams }
}

function parsePostmanQueryParams(raw: unknown[] | undefined): KeyValue[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((q): q is Record<string, unknown> => typeof q === 'object' && q !== null)
    .map(q => ({
      key: String(q.key ?? ''),
      value: String(q.value ?? ''),
      enabled: q.disabled !== true,
    }))
}

function parsePostmanHeaders(raw: unknown): KeyValue[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((h): h is Record<string, unknown> => typeof h === 'object' && h !== null)
    .map(h => ({
      key: String(h.key ?? ''),
      value: String(h.value ?? ''),
      enabled: (h as Record<string, unknown>).disabled !== true,
    }))
}

function parsePostmanBody(raw: unknown): { text?: string; type: RequestConfig['bodyType'] } {
  if (!raw || typeof raw !== 'object') return { type: 'none' }

  const body = raw as Record<string, unknown>
  const mode = body.mode as string | undefined

  switch (mode) {
    case 'raw': {
      const rawStr = body.raw as string ?? ''
      return { text: rawStr, type: 'json' }
    }
    case 'urlencoded': {
      const params = body.urlencoded as unknown[] | undefined
      if (Array.isArray(params)) {
        const encoded = params
          .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
          .map(p => `${encodeURIComponent(String(p.key ?? ''))}=${encodeURIComponent(String(p.value ?? ''))}`)
          .join('&')
        return { text: encoded, type: 'x-www-form-urlencoded' }
      }
      return { type: 'x-www-form-urlencoded' }
    }
    case 'formdata': {
      const formData = body.formdata as unknown[] | undefined
      if (Array.isArray(formData)) {
        // Store as JSON so it can be re-serialized, but mark as form-data
        const entries = formData
          .filter((f): f is Record<string, unknown> => typeof f === 'object' && f !== null)
          .map(f => ({ key: String(f.key ?? ''), value: String(f.value ?? ''), type: String(f.type ?? 'text') }))
        return { text: JSON.stringify(entries), type: 'form-data' }
      }
      return { type: 'form-data' }
    }
    case 'file':
      return { type: 'binary' }
    default:
      return { type: 'none' }
  }
}

function parseAuth(raw: unknown): AuthConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const auth = raw as Record<string, unknown>
  const type = auth.type as string | undefined

  if (!type || type === 'noauth') return null

  switch (type) {
    case 'bearer': {
      const bearer = firstAuthParam(auth.bearer)
      return { type: 'bearer', data: { token: bearer } }
    }
    case 'basic': {
      const username = firstAuthParam(auth.basic, 'username')
      const password = firstAuthParam(auth.basic, 'password')
      return { type: 'basic', data: { username, password } }
    }
    case 'apikey': {
      const key = firstAuthParam(auth.apikey, 'key')
      const value = firstAuthParam(auth.apikey, 'value')
      const in_field = firstAuthParam(auth.apikey, 'in') || 'header'
      return { type: 'api-key', data: { key, value, in: in_field } }
    }
    case 'oauth2': {
      return { type: 'oauth2', data: {} }
    }
    default:
      return { type: 'none', data: {} }
  }
}

function firstAuthParam(params: unknown, field?: string): string {
  if (!Array.isArray(params)) return field ?? ''
  const first = params[0]
  if (!first || typeof first !== 'object') return ''
  const obj = first as Record<string, unknown>
  if (field) return String(obj.value ?? obj[field] ?? '')
  return String(obj.value ?? obj.token ?? '')
}

function extractScripts(events: unknown[] | undefined): { preScript?: string; postScript?: string } {
  if (!Array.isArray(events)) return {}

  let preScript = ''
  let postScript = ''

  for (const evt of events) {
    if (!evt || typeof evt !== 'object') continue
    const e = evt as Record<string, unknown>
    const listen = e.listen as string
    const script = e.script as Record<string, unknown> | undefined
    if (!script) continue

    const exec = script.exec as string[] | undefined
    if (!Array.isArray(exec)) continue
    const code = exec.join('\n')

    if (listen === 'prerequest') preScript = code
    if (listen === 'test') postScript = code
  }

  return {
    preScript: preScript || undefined,
    postScript: postScript || undefined,
  }
}

function isValidMethod(m: string): m is HttpMethod {
  const VALID: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
  return VALID.includes(m as HttpMethod)
}

function arrayToString(arr: unknown): string {
  if (typeof arr === 'string') return arr
  if (Array.isArray(arr)) return arr.filter(Boolean).join('.')
  return ''
}

function emptySource(): ImportSource {
  return { format: 'postman-v2.1', originalName: 'unknown', itemCount: 0 }
}
