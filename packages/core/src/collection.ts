import { getDb } from './db'
import { detectFormat, parsePostmanCollection, parseInsomniaExport } from './importer'
import type { RequestConfig } from './types'

export interface Collection {
  id: string
  workspaceId: string
  name: string
  description: string
  sourcePath: string | null
  autoSync: boolean
}

export class CollectionManager {
  create(name: string, workspaceId: string): Collection {
    const db = getDb()
    const id = crypto.randomUUID()

    db.run(
      'INSERT INTO collections (id, workspace_id, name) VALUES (?, ?, ?)',
      [id, workspaceId, name],
    )

    return { id, workspaceId, name, description: '', sourcePath: null, autoSync: false }
  }

  list(workspaceId: string): Collection[] {
    return getDb()
      .query<Collection, string>(
        'SELECT id, workspace_id AS workspaceId, name, description, source_path AS sourcePath, auto_sync AS autoSync FROM collections WHERE workspace_id = ? ORDER BY name',
      )
      .all(workspaceId)
  }

  get(id: string): Collection | null {
    return (
      getDb()
        .query<Collection, string>(
          'SELECT id, workspace_id AS workspaceId, name, description, source_path AS sourcePath, auto_sync AS autoSync FROM collections WHERE id = ?',
        )
        .get(id) ?? null
    )
  }

  getRequests(collectionId: string): RequestConfig[] {
    const stmt = getDb().query<unknown, string>(
      'SELECT id, name, method, url, headers, query_params AS queryParams, body, auth, pre_script AS preScript, post_script AS postScript FROM requests WHERE collection_id = ? ORDER BY sort_order',
    )
    const rows = stmt.all(collectionId) as Record<string, unknown>[]

    return rows.map(r => parseRequestRow(r))
  }

  addRequest(collectionId: string, req: RequestConfig): void {
    const db = getDb()
    db.run(
      `INSERT INTO requests (id, collection_id, name, method, url, headers, query_params, body, auth, pre_script, post_script)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.id,
        collectionId,
        req.name,
        req.method,
        req.url,
        JSON.stringify(req.headers),
        JSON.stringify(req.queryParams),
        JSON.stringify(req.body),
        JSON.stringify(req.auth),
        req.preScript ?? '',
        req.postScript ?? '',
      ],
    )
  }

  delete(id: string): void {
    getDb().run('DELETE FROM collections WHERE id = ?', [id])
  }

  async exportToJson(collectionId: string): Promise<string> {
    const collection = this.get(collectionId)
    if (!collection) throw new Error(`Collection ${collectionId} not found`)

    const requests = this.getRequests(collectionId)
    return JSON.stringify({ collection, requests }, null, 2)
  }

  async importFromJson(json: string, workspaceId?: string): Promise<Collection> {
    const data = JSON.parse(json) as Record<string, unknown>
    const format = detectFormat(data)
    const targetWs = workspaceId ?? 'default'

    // Parse foreign formats into OmniAPI-native structure
    let parsedCol: { name: string; description?: string; requests: RequestConfig[] } | null = null

    if (format === 'postman-v2.1') {
      const result = parsePostmanCollection(data)
      parsedCol = result.collections[0] ?? null
      if (!parsedCol && result.errors.length > 0) {
        throw new Error(`Import failed: ${result.errors.map(e => e.message).join('; ')}`)
      }
    } else if (format === 'insomnia-v4' || format === 'insomnia-v5') {
      const result = parseInsomniaExport(data)
      parsedCol = result.collections[0] ?? null
      if (!parsedCol && result.errors.length > 0) {
        throw new Error(`Import failed: ${result.errors.map(e => e.message).join('; ')}`)
      }
    } else if (format === 'omniapi-native') {
      const nativeData = data as { collection: { name: string; workspaceId?: string }; requests: RequestConfig[] }
      parsedCol = { name: nativeData.collection?.name ?? 'Imported', requests: nativeData.requests ?? [] }
    } else {
      throw new Error(`Unsupported import format: ${format}. Supported: Postman v2.1, Insomnia v4/v5, OmniAPI native`)
    }

    if (!parsedCol) {
      throw new Error('Import produced no collections')
    }

    const collection = this.create(parsedCol.name, targetWs)
    for (const req of parsedCol.requests) {
      this.addRequest(collection.id, req)
    }

    return collection
  }
}

function parseRequestRow(r: Record<string, unknown>): RequestConfig {
  return {
    id: r.id as string,
    name: r.name as string,
    method: r.method as RequestConfig['method'],
    url: r.url as string,
    headers: safeJsonParse(r.headers as string, []),
    queryParams: safeJsonParse(r.queryParams as string, []),
    body: r.body as string | undefined,
    auth: safeJsonParse(r.auth as string, { type: 'none', data: {} }),
    preScript: r.preScript as string | undefined,
    postScript: r.postScript as string | undefined,
  }
}

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}
