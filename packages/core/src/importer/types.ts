import type { RequestConfig } from '../types'

export interface ImportedCollection {
  name: string
  description?: string
  requests: RequestConfig[]
}

export interface ImportedEnvironment {
  name: string
  variables: Record<string, string>
}

export interface ImportResult {
  source: ImportSource
  collections: ImportedCollection[]
  environments: ImportedEnvironment[]
  errors: ImportError[]
}

export interface ImportSource {
  format: 'postman-v2.1' | 'insomnia-v4' | 'insomnia-v5' | 'omniapi-native' | 'unknown'
  originalName: string
  itemCount: number
}

export interface ImportError {
  type: 'parse' | 'item-skip' | 'validation'
  message: string
  itemName?: string
}

export function detectFormat(json: unknown): ImportSource['format'] {
  if (!json || typeof json !== 'object') return 'unknown'

  const obj = json as Record<string, unknown>

  // Postman v2.1: has `info` object with `schema` containing "postman"
  if (obj.info && typeof obj.info === 'object') {
    const info = obj.info as Record<string, unknown>
    if (typeof info.schema === 'string' && info.schema.includes('postman')) {
      return 'postman-v2.1'
    }
    // Some exports have info.name but no schema
    if (info.name && obj.item !== undefined) {
      return 'postman-v2.1'
    }
  }

  // Insomnia: has `_type` = "export" and `__export_format`
  if (obj._type === 'export') {
    const fmt = obj.__export_format
    if (fmt === 4) return 'insomnia-v4'
    if (fmt === 5) return 'insomnia-v5'
    // Fallback: insomnia export without format version
    if (Array.isArray(obj.resources)) return 'insomnia-v5'
  }

  // OmniAPI native format
  if (obj.collection && obj.requests !== undefined) {
    return 'omniapi-native'
  }

  return 'unknown'
}
