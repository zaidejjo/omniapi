import { getDb } from './index'

export interface HistoryEntry {
  id: string
  requestId: string | null
  method: string
  url: string
  statusCode: number | null
  durationMs: number | null
  responseSize: number | null
  requestBody: string | null
  responseBody: string | null
  responseHeaders: string | null
  error: string | null
  createdAt: string
}

export class HistoryRepo {
  insert(entry: Omit<HistoryEntry, 'id' | 'createdAt'>): string {
    const db = getDb()
    const id = crypto.randomUUID()

    db.run(
      `INSERT INTO history (id, request_id, method, url, status_code, duration_ms, response_size,
        request_body, response_body, response_headers, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        entry.requestId,
        entry.method,
        entry.url,
        entry.statusCode,
        entry.durationMs,
        entry.responseSize,
        entry.requestBody,
        entry.responseBody,
        entry.responseHeaders,
        entry.error,
      ],
    )

    return id
  }

  list(limit = 50, offset = 0): HistoryEntry[] {
    return getDb()
      .query<HistoryEntry, [number, number]>(
        'SELECT id, request_id AS requestId, method, url, status_code AS statusCode, duration_ms AS durationMs, response_size AS responseSize, request_body AS requestBody, response_body AS responseBody, response_headers AS responseHeaders, error, created_at AS createdAt FROM history ORDER BY created_at DESC LIMIT ? OFFSET ?',
      )
      .all(limit, offset)
  }

  get(id: string): HistoryEntry | null {
    return (
      getDb()
        .query<HistoryEntry, string>(
          'SELECT id, request_id AS requestId, method, url, status_code AS statusCode, duration_ms AS durationMs, response_size AS responseSize, request_body AS requestBody, response_body AS responseBody, response_headers AS responseHeaders, error, created_at AS createdAt FROM history WHERE id = ?',
        )
        .get(id) ?? null
    )
  }

  deleteOlderThan(days: number): number {
    const result = getDb().run(
      'DELETE FROM history WHERE created_at < datetime("now", ?)',
      [`-${days} days`],
    )
    return result.changes
  }
}

export class WorkspaceRepo {
  create(name: string, description = ''): string {
    const db = getDb()
    const id = crypto.randomUUID()
    db.run('INSERT INTO workspaces (id, name, description) VALUES (?, ?, ?)', [id, name, description])
    return id
  }

  list() {
    return getDb().query('SELECT id, name, description, created_at AS createdAt, updated_at AS updatedAt FROM workspaces ORDER BY name').all()
  }

  get(id: string) {
    return getDb().query('SELECT id, name, description, created_at AS createdAt, updated_at AS updatedAt FROM workspaces WHERE id = ?').get(id)
  }
}
