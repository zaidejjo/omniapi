import type { RequestConfig, HttpMethod, KeyValue, AuthConfig } from '../types'
import type { ImportedCollection, ImportedEnvironment, ImportSource, ImportError } from './types'

interface InsResource {
  _id: string
  _type: string
  parentId: string
  name?: string
  [key: string]: unknown
}

interface InsRequest extends InsResource {
  _type: 'request'
  url: string
  method: string
  headers: Array<{ name: string; value: string; disabled?: boolean }> | string
  body?: { mimeType?: string; text?: string; params?: Array<{ name: string; value: string }> }
  authentication?: {
    type?: string
    token?: string
    username?: string
    password?: string
    [key: string]: unknown
  }
  parameters?: Array<{ name: string; value: string; disabled?: boolean }>
  preRequestScript?: string
  afterResponseScript?: string
}

interface InsEnvironment extends InsResource {
  _type: 'environment'
  data: Record<string, string>
}

/**
 * Parse an Insomnia v4/v5 export JSON into OmniAPI collections + environments.
 *
 * Handles:
 *   - Workspace → collection
 *   - RequestGroup → folder (prefix on names)
 *   - Request → RequestConfig
 *   - Environment → OmniAPI environment
 *   - Authentication: bearer, basic, apikey, oauth2
 *   - Body: JSON, form-urlencoded, multipart form-data
 */
export function parseInsomniaExport(json: unknown): {
  collections: ImportedCollection[]
  environments: ImportedEnvironment[]
  source: ImportSource
  errors: ImportError[]
} {
  const errors: ImportError[] = []
  const root = json as Record<string, unknown> | undefined

  if (!root || root._type !== 'export') {
    return {
      collections: [],
      environments: [],
      source: emptySource(),
      errors: [{ type: 'parse', message: 'Not a valid Insomnia export file' }],
    }
  }

  const format = (root.__export_format as number) ?? 4
  const formatLabel = format === 4 ? 'insomnia-v4' : 'insomnia-v5'

  const resources = root.resources as unknown[] | undefined
  if (!Array.isArray(resources)) {
    return {
      collections: [],
      environments: [],
      source: { format: formatLabel, originalName: 'unknown', itemCount: 0 },
      errors: [{ type: 'parse', message: 'No resources array in export' }],
    }
  }

  const resMap = new Map<string, InsResource>()
  const workspaces: InsResource[] = []
  const requestGroups: InsResource[] = []
  const requests: InsRequest[] = []
  const environments: InsEnvironment[] = []

  for (const r of resources) {
    const res = r as InsResource
    if (!res._id) continue
    resMap.set(res._id, res)
    switch (res._type) {
      case 'workspace':
        workspaces.push(res)
        break
      case 'request_group':
        requestGroups.push(res)
        break
      case 'request':
        requests.push(r as InsRequest)
        break
      case 'environment':
        environments.push(r as InsEnvironment)
        break
    }
  }

  if (workspaces.length === 0) {
    return {
      collections: [],
      environments: [],
      source: { format: formatLabel, originalName: 'unknown', itemCount: 0 },
      errors: [{ type: 'parse', message: 'No workspace found in export' }],
    }
  }

  // Build a hierarchy: for each workspace, find child request groups and requests
  const result: ImportedCollection[] = []
  const resultEnvs: ImportedEnvironment[] = []

  for (const ws of workspaces) {
    const wsName = ws.name ?? 'Imported Workspace'
    const wsRequests = collectRequestsForWorkspace(ws._id, requests, requestGroups, resMap, errors)

    result.push({ name: wsName, description: '', requests: wsRequests })
  }

  // Convert environments
  for (const env of environments) {
    const parentWorkspace = findAncestorWorkspace(env.parentId, resMap)
    const envName = env.name ?? 'Imported Environment'
    if (env.data && typeof env.data === 'object') {
      const variables: Record<string, string> = {}
      for (const [key, value] of Object.entries(env.data)) {
        variables[key] = String(value ?? '')
      }
      resultEnvs.push({ name: `${parentWorkspace ?? ''} / ${envName}`.replace(/^ \/ /, ''), variables })
    }
  }

  const totalRequests = result.reduce((sum, c) => sum + c.requests.length, 0)
  return {
    collections: result,
    environments: resultEnvs,
    source: { format: formatLabel, originalName: workspaces[0]?.name as string ?? 'unknown', itemCount: totalRequests },
    errors,
  }
}

function collectRequestsForWorkspace(
  workspaceId: string,
  allRequests: InsRequest[],
  allGroups: InsResource[],
  _resMap: Map<string, InsResource>,
  errors: ImportError[],
): RequestConfig[] {
  // Build group → child requests map
  const groupRequests = new Map<string, InsRequest[]>()
  const orphanRequests: InsRequest[] = []

  for (const req of allRequests) {
    const parentId = req.parentId
    if (parentId === workspaceId) {
      orphanRequests.push(req)
    } else {
      const list = groupRequests.get(parentId) ?? []
      list.push(req)
      groupRequests.set(parentId, list)
    }
  }

  // Build group name chain
  const groupPathCache = new Map<string, string>()
  function getGroupPath(groupId: string): string {
    const cached = groupPathCache.get(groupId)
    if (cached !== undefined) return cached

    const group = _resMap.get(groupId)
    if (!group || group._type !== 'request_group') {
      groupPathCache.set(groupId, '')
      return ''
    }

    const parentPath = group.parentId && group.parentId !== workspaceId
      ? getGroupPath(group.parentId)
      : ''
    const name = group.name ?? 'Unnamed'
    const path = parentPath ? `${parentPath} / ${name}` : name
    groupPathCache.set(groupId, path)
    return path
  }

  const out: RequestConfig[] = []

  // Process groups in order
  for (const group of allGroups) {
    if (group.parentId !== workspaceId && !isDescendantOf(group.parentId, allGroups, workspaceId)) continue
    const groupPath = getGroupPath(group._id)
    const reqs = groupRequests.get(group._id) ?? []
    for (const req of reqs) {
      const converted = convertInsomniaRequest(req, groupPath, errors)
      if (converted) out.push(converted)
    }
  }

  // Process orphan requests (direct children of workspace)
  for (const req of orphanRequests) {
    const converted = convertInsomniaRequest(req, '', errors)
    if (converted) out.push(converted)
  }

  return out
}

function isDescendantOf(groupId: string, allGroups: InsResource[], ancestorId: string): boolean {
  let current = groupId
  for (let i = 0; i < 50; i++) {
    // Safety limit
    const group = allGroups.find(g => g._id === current)
    if (!group) return false
    if (group.parentId === ancestorId) return true
    current = group.parentId
  }
  return false
}

function findAncestorWorkspace(resourceId: string, resMap: Map<string, InsResource>): string | null {
  let current = resourceId
  for (let i = 0; i < 50; i++) {
    const res = resMap.get(current)
    if (!res) return null
    if (res._type === 'workspace') return (res.name as string) ?? null
    current = res.parentId
  }
  return null
}

function convertInsomniaRequest(
  raw: InsRequest,
  groupPrefix: string,
  errors: ImportError[],
): RequestConfig | null {
  const name = raw.name ?? 'Unnamed'
  const fullName = groupPrefix ? `${groupPrefix} / ${name}` : name
  const method = (raw.method ?? 'GET').toUpperCase()

  if (!isValidMethod(method)) {
    errors.push({ type: 'item-skip', message: `Skipped "${fullName}": invalid method "${method}"`, itemName: fullName })
    return null
  }

  const url = raw.url ?? ''
  const headers = parseInsHeaders(raw.headers)
  const queryParams = parseInsParameters(raw.parameters)
  const body = parseInsBody(raw.body)
  const auth = parseInsAuth(raw.authentication)

  let preScript: string | undefined
  let postScript: string | undefined
  if (raw.preRequestScript) {
    preScript = raw.preRequestScript
  }
  if (raw.afterResponseScript) {
    postScript = raw.afterResponseScript
  }

  return {
    id: crypto.randomUUID(),
    name: fullName,
    method: method as HttpMethod,
    url,
    headers,
    queryParams,
    body: body.text,
    bodyType: body.type,
    auth,
    preScript,
    postScript,
  }
}

function parseInsHeaders(raw: unknown): KeyValue[] {
  if (!raw) return []
  // Insomnia can store headers as JSON string or array
  let arr: Array<{ name: string; value: string; disabled?: boolean }> = []
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw)
    } catch {
      return []
    }
  } else if (Array.isArray(raw)) {
    arr = raw as Array<{ name: string; value: string; disabled?: boolean }>
  } else {
    return []
  }

  return arr.map(h => ({
    key: h.name ?? '',
    value: h.value ?? '',
    enabled: !h.disabled,
  }))
}

function parseInsParameters(raw: unknown): KeyValue[] {
  if (!Array.isArray(raw)) return []
  return raw.map(p => ({
    key: String(p.name ?? ''),
    value: String(p.value ?? ''),
    enabled: !p.disabled,
  }))
}

function parseInsBody(raw: { mimeType?: string; text?: string; params?: Array<{ name: string; value: string }> } | undefined): {
  text?: string
  type: RequestConfig['bodyType']
} {
  if (!raw) return { type: 'none' }

  const mime = raw.mimeType ?? ''

  if (mime.includes('json')) {
    return { text: raw.text ?? '{}', type: 'json' }
  }

  if (mime.includes('x-www-form-urlencoded')) {
    if (Array.isArray(raw.params)) {
      const encoded = raw.params
        .map(p => `${encodeURIComponent(p.name)}=${encodeURIComponent(p.value)}`)
        .join('&')
      return { text: encoded, type: 'x-www-form-urlencoded' }
    }
    return { text: raw.text ?? '', type: 'x-www-form-urlencoded' }
  }

  if (mime.includes('form-data')) {
    if (Array.isArray(raw.params)) {
      return { text: JSON.stringify(raw.params), type: 'form-data' }
    }
    return { text: raw.text ?? '', type: 'form-data' }
  }

  // Fallback: send as-is
  if (raw.text) {
    return { text: raw.text, type: 'json' }
  }

  return { type: 'none' }
}

function parseInsAuth(raw: { type?: string; [key: string]: unknown } | undefined): AuthConfig {
  if (!raw || !raw.type) return { type: 'none', data: {} }

  switch (raw.type) {
    case 'bearer':
      return { type: 'bearer', data: { token: String(raw.token ?? '') } }
    case 'basic':
      return { type: 'basic', data: { username: String(raw.username ?? ''), password: String(raw.password ?? '') } }
    case 'apikey': {
      const key = String(raw.key ?? '')
      const value = String(raw.value ?? '')
      const placement = raw.placement === 'header' ? 'header' : 'query'
      return { type: 'api-key', data: { key, value, in: placement } }
    }
    case 'oauth2':
      return { type: 'oauth2', data: {} }
    default:
      return { type: 'none', data: {} }
  }
}

function isValidMethod(m: string): m is HttpMethod {
  const VALID: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
  return VALID.includes(m as HttpMethod)
}

function emptySource(): ImportSource {
  return { format: 'insomnia-v5', originalName: 'unknown', itemCount: 0 }
}
