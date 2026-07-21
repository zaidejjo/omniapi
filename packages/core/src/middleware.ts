import type { RequestContext, NextFn, Middleware } from './types'

export const envResolver: Middleware = {
  name: 'env-resolver',
  async handle(ctx: RequestContext, next: NextFn): Promise<void> {
    ctx.request.url = resolveVars(ctx.request.url, ctx.env)
    for (const h of ctx.request.headers) {
      if (h.enabled) {
        h.value = resolveVars(h.value, ctx.env)
      }
    }
    if (ctx.request.body) {
      ctx.request.body = resolveVars(ctx.request.body, ctx.env)
    }
    await next()
  },
}

export const logger: Middleware = {
  name: 'logger',
  async handle(ctx: RequestContext, next: NextFn): Promise<void> {
    await next()
    ctx.metadata.set('logged', true)
  },
}

export const retry: Middleware = {
  name: 'retry',
  async handle(ctx: RequestContext, next: NextFn): Promise<void> {
    const maxRetries = (ctx.metadata.get('maxRetries') as number) ?? 0
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      await next()
      const status = ctx.response?.status ?? 0
      if (status < 500 || attempt >= maxRetries) break
      const delay = Math.min(1000 * 2 ** attempt, 10_000)
      await new Promise(r => setTimeout(r, delay))
    }
  },
}

const TEMPLATE_RE = /\{\{(\w+)\}\}/g

function resolveVars(input: string, env: Record<string, string>): string {
  return input.replace(TEMPLATE_RE, (_, key: string) => env[key] ?? '')
}
