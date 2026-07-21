import type { RequestContext, Middleware } from './types'

export interface ScriptSandbox {
  execute(script: string, ctx: RequestContext): Promise<void>
}

export class BunScriptSandbox implements ScriptSandbox {
  async execute(script: string, ctx: RequestContext): Promise<void> {
    if (!script?.trim()) return

    const fn = new Function(
      'request',
      'response',
      'env',
      'pm',
      script,
    )

    await fn(ctx.request, ctx.response, ctx.env, this.buildPm(ctx))
  }

  private buildPm(ctx: RequestContext) {
    return {
      setVariable: (key: string, value: string) => {
        ctx.env[key] = value
      },
      getVariable: (key: string): string | undefined => ctx.env[key],
      setNextRequest: (id: string) => {
        ctx.metadata.set('nextRequestId', id)
      },
      abort: (msg: string) => {
        throw new Error(`Script aborted: ${msg}`)
      },
    }
  }
}

export const scriptRunner: Middleware = {
  name: 'script-runner',
  async handle(ctx: RequestContext, next: any): Promise<void> {
    const sandbox = new BunScriptSandbox()

    if (ctx.request.preScript) {
      await sandbox.execute(ctx.request.preScript, ctx)
    }

    await next()

    if (ctx.request.postScript) {
      await sandbox.execute(ctx.request.postScript, ctx)
    }
  },
}

export type PmApi = ReturnType<BunScriptSandbox['buildPm']>
