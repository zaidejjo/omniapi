import { detectFormat, type ImportResult, type ImportSource, type ImportError } from './types'
import { parsePostmanCollection } from './postman'
import { parseInsomniaExport } from './insomnia'
import type { CollectionManager } from '../collection'
import type { EnvironmentManager } from '../environment'
import type { RequestConfig, EnvironmentVariables } from '../types'

/**
 * OmniAPI Importer — orchestrates detection, parsing, and data extraction.
 *
 * Usage:
 * ```ts
 * const importer = new Importer(collectionManager, environmentManager)
 * const result = await importer.import(jsonData)
 * ```
 *
 * The Importer handles parsing; callers persist to their own storage.
 */
export class Importer {
  #collections: CollectionManager
  #environments: EnvironmentManager

  constructor(collections: CollectionManager, environments: EnvironmentManager) {
    this.#collections = collections
    this.#environments = environments
  }

  /**
   * Auto-detect format, parse, and write parsed data to SQLite.
   */
  async import(json: unknown, workspaceId?: string): Promise<ImportResult> {
    const format = detectFormat(json)
    const errors: ImportError[] = []
    let source: ImportSource = {
      format,
      originalName: 'unknown',
      itemCount: 0,
    }

    // Parse
    let parsedCollections: Array<{ name: string; description?: string; requests: RequestConfig[] }> = []
    let parsedEnvironments: Array<{ name: string; variables: EnvironmentVariables }> = []

    switch (format) {
      case 'postman-v2.1': {
        const result = parsePostmanCollection(json)
        parsedCollections = result.collections
        source = result.source
        errors.push(...result.errors)
        break
      }
      case 'insomnia-v4':
      case 'insomnia-v5': {
        const result = parseInsomniaExport(json)
        parsedCollections = result.collections
        parsedEnvironments = result.environments
        source = result.source
        errors.push(...result.errors)
        break
      }
      case 'omniapi-native': {
        const result = parseOmniApiNative(json)
        parsedCollections = result.collections
        parsedEnvironments = result.environments
        errors.push(...result.errors)
        break
      }
      default: {
        errors.push({ type: 'parse', message: 'Unrecognized import format. Supported: Postman v2.1, Insomnia v4/v5' })
        return { collections: [], environments: [], source, errors }
      }
    }

    // Persist collections to SQLite
    for (const col of parsedCollections) {
      if (col.requests.length === 0) continue
      const targetWs = workspaceId ?? 'default'
      const created = this.#collections.create(col.name, targetWs)
      for (const req of col.requests) {
        this.#collections.addRequest(created.id, req)
      }
    }

    // Persist environments to SQLite
    for (const env of parsedEnvironments) {
      const targetWs = workspaceId ?? 'default'
      const created = this.#environments.create(env.name, targetWs)
      this.#environments.updateVariables(created.id, env.variables)
    }

    source.itemCount = parsedCollections.reduce((sum, c) => sum + c.requests.length, 0)

    return {
      collections: parsedCollections,
      environments: parsedEnvironments,
      source,
      errors,
    }
  }
}

/**
 * Static utility: detect format without persisting.
 */
export { detectFormat } from './types'
export { parsePostmanCollection } from './postman'
export { parseInsomniaExport } from './insomnia'

// ─── Helpers ────────────────────────────────────────────────────

function parseOmniApiNative(json: unknown): {
  collections: Array<{ name: string; description?: string; requests: RequestConfig[] }>
  environments: Array<{ name: string; variables: EnvironmentVariables }>
  errors: ImportError[]
} {
  const root = json as Record<string, unknown> | undefined
  const errors: ImportError[] = []

  if (!root) {
    return { collections: [], environments: [], errors: [{ type: 'parse', message: 'Empty JSON' }] }
  }

  const collections: Array<{ name: string; description?: string; requests: RequestConfig[] }> = []
  if (root.collection) {
    const col = root.collection as Record<string, unknown>
    collections.push({
      name: (col.name as string) ?? 'Imported',
      description: col.description as string | undefined,
      requests: (root.requests as RequestConfig[]) ?? [],
    })
  }

  const envs: Array<{ name: string; variables: EnvironmentVariables }> = []
  if (root.environments) {
    const rawEnvs = root.environments as unknown[]
    for (const e of rawEnvs) {
      const env = e as Record<string, unknown>
      envs.push({ name: (env.name as string) ?? 'Env', variables: (env.variables as EnvironmentVariables) ?? {} })
    }
  }

  return { collections, environments: envs, errors }
}
