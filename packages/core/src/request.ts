import type { RequestContext, RequestConfig, ResponseConfig, Middleware } from './types'

export class RequestEngine {
  private middlewares: Middleware[] = []

  use(mw: Middleware): this {
    this.middlewares.push(mw)
    return this
  }

  remove(name: string): this {
    this.middlewares = this.middlewares.filter(m => m.name !== name)
    return this
  }

  async execute(config: RequestConfig, env: Record<string, string> = {}): Promise<RequestContext> {
    const ctx: RequestContext = {
      request: { ...config },
      response: null,
      error: null,
      env,
      metadata: new Map(),
    }

    const chain = this.buildChain()
    try {
      await chain(ctx)
    } catch (err) {
      ctx.error = err instanceof Error ? err : new Error(String(err))
    }
    return ctx
  }

  private buildChain(): (ctx: RequestContext) => Promise<void> {
    const stack = [...this.middlewares]

    const runner = async (ctx: RequestContext): Promise<void> => {
      if (stack.length === 0) {
        ctx.response = await this.fetchRaw(ctx.request)
        return
      }
      const mw = stack.shift()!
      await mw.handle(ctx, () => runner(ctx))
    }

    return runner
  }

  private async fetchRaw(config: RequestConfig): Promise<ResponseConfig> {
    const url = this.buildUrl(config)
    const headers = this.buildHeaders(config)
    const start = performance.now()

    const resp = await fetch(url, {
      method: config.method,
      headers,
      body: config.bodyType && config.bodyType !== 'none' ? config.body : undefined,
    })

    const durationMs = performance.now() - start
    const body = await resp.text()

    return {
      status: resp.status,
      statusText: resp.statusText,
      headers: Object.fromEntries(resp.headers.entries()),
      body,
      durationMs,
      size: new TextEncoder().encode(body).length,
    }
  }

  private buildUrl(config: RequestConfig): string {
    if (config.queryParams.length === 0) return config.url
    const params = config.queryParams
      .filter(p => p.enabled)
      .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join('&')
    return params ? `${config.url}?${params}` : config.url
  }

  private buildHeaders(config: RequestConfig): Record<string, string> {
    return Object.fromEntries(
      config.headers
        .filter(h => h.enabled)
        .map(h => [h.key, h.value])
    )
  }
}
