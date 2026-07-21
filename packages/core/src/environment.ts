import { getDb } from './db'

export interface Environment {
  id: string
  workspaceId: string
  name: string
  variables: Record<string, string>
  isActive: boolean
}

export class EnvironmentManager {
  create(name: string, workspaceId: string): Environment {
    const db = getDb()
    const id = crypto.randomUUID()

    db.run(
      'INSERT INTO environments (id, workspace_id, name) VALUES (?, ?, ?)',
      [id, workspaceId, name],
    )

    return { id, workspaceId, name, variables: {}, isActive: false }
  }

  list(workspaceId: string): Environment[] {
    const stmt = getDb().query<unknown, string>(
      'SELECT id, workspace_id AS workspaceId, name, variables, is_active AS isActive FROM environments WHERE workspace_id = ? ORDER BY name',
    )
    const rows = stmt.all(workspaceId) as Record<string, unknown>[]

    return rows.map(r => ({
      id: r.id as string,
      workspaceId: r.workspaceId as string,
      name: r.name as string,
      variables: safeParseJson(r.variables as string),
      isActive: Boolean(r.isActive),
    }))
  }

  getActive(workspaceId: string): Environment | null {
    const stmt = getDb().query<unknown, string>(
      'SELECT id, workspace_id AS workspaceId, name, variables, is_active AS isActive FROM environments WHERE workspace_id = ? AND is_active = 1 LIMIT 1',
    )
    const row = stmt.get(workspaceId) as Record<string, unknown> | undefined

    if (!row) return null

    return {
      id: row.id as string,
      workspaceId: row.workspaceId as string,
      name: row.name as string,
      variables: safeParseJson(row.variables as string),
      isActive: true,
    }
  }

  setActive(id: string, workspaceId: string): void {
    const db = getDb()
    db.transaction(() => {
      db.run('UPDATE environments SET is_active = 0 WHERE workspace_id = ?', [workspaceId])
      db.run('UPDATE environments SET is_active = 1 WHERE id = ?', [id])
    })()
  }

  updateVariables(id: string, variables: Record<string, string>): void {
    getDb().run('UPDATE environments SET variables = ? WHERE id = ?', [JSON.stringify(variables), id])
  }

  delete(id: string): void {
    getDb().run('DELETE FROM environments WHERE id = ?', [id])
  }
}

function safeParseJson(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, string>
  } catch {
    return {}
  }
}
