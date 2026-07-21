import { RequestEngine, envResolver, scriptRunner } from '@omniapi/core'
import type { RequestConfig } from '@omniapi/core'
import { TapFormatter, type TapResult } from '../formatters/tap'

export interface RunOptions {
  env?: string
  variable?: string[]
  timeout?: string
  failFast?: boolean
}

interface CollectionFile {
  collection?: { name: string; workspaceId?: string }
  requests: RequestConfig[]
}

interface RunnerStats {
  total: number
  passed: number
  failed: number
  totalDurationMs: number
}

export async function runCommand(path: string, options: RunOptions): Promise<void> {
  // 1. Parse collection file
  const requests = await loadCollection(path)

  if (requests.length === 0) {
    console.log('TAP version 14')
    console.log('1..0 # SKIP collection is empty')
    process.exit(0)
  }

  // 2. Load environment
  const env = await loadEnvironment(options)

  // 3. Create engine with middleware
  const engine = new RequestEngine()
  engine.use(envResolver)
  engine.use(scriptRunner)

  // 4. Execute requests sequentially
  const formatter = new TapFormatter()
  formatter.planCount(requests.length)

  const timeoutMs = options.timeout ? parseInt(options.timeout, 10) : 30_000
  const startAll = performance.now()

  for (let i = 0; i < requests.length; i++) {
    const req = requests[i]!

    // Run with race-against-timeout
    const result = await executeWithTimeout(engine, req, env, timeoutMs)

    const tapResult: TapResult = {
      index: i + 1,
      name: req.name || `${req.method} ${req.url}`,
      passed: isSuccess(result),
      request: req,
      response: result.response ?? undefined,
      error: result.error?.message,
      durationMs: result.response?.durationMs ?? 0,
    }

    formatter.addResult(tapResult)

    // Fail-fast: fill remaining with SKIP, then stop
    if (!tapResult.passed && options.failFast) {
      for (let j = i + 1; j < requests.length; j++) {
        formatter.addResult({
          index: j + 1,
          name: requests[j]?.name ?? `#${j + 1}`,
          passed: true,
          request: requests[j]!,
          durationMs: 0,
        })
      }
      break
    }
  }

  // 5. Output TAP
  const output = formatter.format()
  process.stdout.write(output)

  // 6. Exit code = number of failures
  const exitCode = formatter.toExitCode()
  process.exit(exitCode)
}

async function loadCollection(path: string): Promise<RequestConfig[]> {
  let content: string
  try {
    const file = Bun.file(path)
    content = await file.text()
  } catch (err) {
    console.error(`Failed to read collection file: ${path}`)
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    console.error(`Invalid JSON in collection file: ${path}`)
    process.exit(1)
  }

  // Support 3 formats:
  // 1. { collection: ..., requests: [...] }
  // 2. [...] (flat array of requests)
  // 3. { ... } (single request object)
  if (Array.isArray(parsed)) {
    return parsed as RequestConfig[]
  }

  if (isCollectionFile(parsed)) {
    return parsed.requests
  }

  // Single request object
  return [parsed as RequestConfig]
}

function isCollectionFile(obj: unknown): obj is CollectionFile {
  return typeof obj === 'object' && obj !== null && 'requests' in obj
}

async function loadEnvironment(options: RunOptions): Promise<Record<string, string>> {
  const env: Record<string, string> = {}

  // Load from env file if specified
  if (options.env) {
    try {
      const file = Bun.file(options.env)
      const content = await file.text()
      const parsed = JSON.parse(content)

      // Support: { "variables": { ... } } and flat { "key": "value" }
      const vars = parsed.variables ?? parsed
      if (typeof vars === 'object' && vars !== null) {
        for (const [key, value] of Object.entries(vars)) {
          if (typeof value === 'string') {
            env[key] = value
          }
        }
      }
    } catch (err) {
      console.error(`Failed to load environment file: ${options.env}`)
      if (err instanceof Error) console.error(err.message)
      process.exit(1)
    }
  }

  // Inline variable overrides (--variable key=value)
  if (options.variable) {
    for (const v of options.variable) {
      const eqIdx = v.indexOf('=')
      if (eqIdx > 0) {
        env[v.slice(0, eqIdx)] = v.slice(eqIdx + 1)
      }
    }
  }

  return env
}

async function executeWithTimeout(
  engine: RequestEngine,
  config: RequestConfig,
  env: Record<string, string>,
  timeoutMs: number,
) {
  const timeoutPromise = new Promise<ReturnType<typeof engine.execute>>((resolve) => {
    setTimeout(
      () =>
        resolve({
          request: config,
          response: null,
          error: new Error(`Request timed out after ${timeoutMs}ms`),
          env,
          metadata: new Map(),
        }),
      timeoutMs,
    )
  })

  const result = await Promise.race([engine.execute(config, env), timeoutPromise])
  return result
}

function isSuccess(result: { response?: { status: number } | null; error?: Error | null }): boolean {
  if (result.error) return false
  if (!result.response) return false
  return result.response.status < 400
}
