export type EnvironmentVariables = Record<string, string>

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export interface KeyValue {
  key: string
  value: string
  enabled: boolean
}

export interface AuthConfig {
  type: 'none' | 'basic' | 'bearer' | 'api-key' | 'oauth2'
  data: Record<string, string>
}

export interface RequestConfig {
  id: string
  name: string
  method: HttpMethod
  url: string
  headers: KeyValue[]
  queryParams: KeyValue[]
  body?: string
  bodyType?: 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'binary'
  auth: AuthConfig
  preScript?: string
  postScript?: string
}

export interface ResponseConfig {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  durationMs: number
  size: number
}

export interface RequestContext {
  request: RequestConfig
  response: ResponseConfig | null
  error: Error | null
  env: Record<string, string>
  metadata: Map<string, unknown>
}

export type NextFn = () => Promise<void>

export interface Middleware {
  name: string
  handle(ctx: RequestContext, next: NextFn): Promise<void>
}
