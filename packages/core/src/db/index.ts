import { Database } from 'bun:sqlite'
import { SCHEMA } from './schema'

let db: Database | null = null

export function getDb(): Database {
  if (db) return db

  const path = process.env.OMNIAPI_DB_PATH ?? './omniapi.db'
  db = new Database(path)
  db.run('PRAGMA journal_mode = WAL')
  db.run('PRAGMA foreign_keys = ON')
  execSchema(db)

  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

function execSchema(database: Database): void {
  for (const stmt of SCHEMA) {
    database.run(stmt)
  }
}
