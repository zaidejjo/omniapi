#!/usr/bin/env bun
/**
 * OmniAPI Core Bridge — one-shot subprocess for Tauri GUI.
 *
 * Reads a JSON-RPC request from stdin:
 *   { "command": "list-workspaces", "args": { ... } }
 *
 * Writes JSON response to stdout:
 *   { "ok": true, "data": ... }
 *
 * Commands:
 *   list-workspaces         → WorkspaceRepo.list()
 *   create-workspace        → WorkspaceRepo.create(name)
 *   list-collections        → CollectionManager.list(workspaceId)
 *   get-requests            → CollectionManager.getRequests(collectionId)
 *   execute-request         → RequestEngine.execute(config)
 *   list-environments       → EnvironmentManager.list(workspaceId)
 *   import-collection       → CollectionManager.importFromJson(json, workspaceId?)
 */

import { WorkspaceRepo, CollectionManager, EnvironmentManager, RequestEngine, envResolver, scriptRunner } from '@omniapi/core'
import type { RequestConfig } from '@omniapi/core'

interface RpcRequest {
  command: string
  args?: Record<string, unknown>
}

interface RpcResponse {
  ok: boolean
  data?: unknown
  error?: string
}

async function main(): Promise<void> {
  // Read full stdin (one command per line, process last line)
  const chunks: Buffer[] = []
  try {
    for await (const chunk of Bun.stdin.stream()) {
      chunks.push(Buffer.from(chunk))
    }
  } catch (err) {
    // EPIPE — stdin closed (e.g., Rust dropped pipe during restart), exit silently
    if (err && typeof err === 'object' && 'code' in err && (err as NodeJS.ErrnoException).code === 'EPIPE') {
      process.exit(1)
    }
    throw err
  }
  const input = Buffer.concat(chunks).toString('utf8').trim()
  if (!input) {
    writeResult({ ok: false, error: 'No input received' })
    process.exit(1)
  }

  // Process the last non-empty line (Rust sends one command per spawn)
  const lines = input.split('\n').map(l => l.trim()).filter(Boolean)
  const lastLine = lines[lines.length - 1]
  if (!lastLine) {
    writeResult({ ok: false, error: 'No valid input line' })
    process.exit(1)
  }

  let req: RpcRequest
  try {
    req = JSON.parse(lastLine) as RpcRequest
  } catch (err) {
    writeResult({ ok: false, error: `Invalid JSON: ${err}` })
    process.exit(1)
  }

  try {
    const resp = await handleCommand(req)
    writeResult(resp)
  } catch (err) {
    writeResult({ ok: false, error: err instanceof Error ? err.message : String(err) })
    process.exit(1)
  }
}

async function handleCommand(req: RpcRequest): Promise<RpcResponse> {
  const args = req.args ?? {}
  const command = req.command

  switch (command) {
    case 'list-workspaces': {
      const repo = new WorkspaceRepo()
      return { ok: true, data: repo.list() as unknown[] }
    }

    case 'create-workspace': {
      const name = args.name as string
      if (!name) return { ok: false, error: 'Missing "name" argument' }
      const repo = new WorkspaceRepo()
      return { ok: true, data: repo.create(name) }
    }

    case 'list-collections': {
      const workspaceId = args.workspaceId as string
      if (!workspaceId) return { ok: false, error: 'Missing "workspaceId" argument' }
      const cm = new CollectionManager()
      return { ok: true, data: cm.list(workspaceId) as unknown[] }
    }

    case 'get-requests': {
      const collectionId = args.collectionId as string
      if (!collectionId) return { ok: false, error: 'Missing "collectionId" argument' }
      const cm = new CollectionManager()
      return { ok: true, data: cm.getRequests(collectionId) as unknown[] }
    }

    case 'execute-request': {
      const config = args.config as Record<string, unknown>
      if (!config) return { ok: false, error: 'Missing "config" argument' }

      const engine = new RequestEngine()
      engine.use(envResolver)
      engine.use(scriptRunner)

      const ctx = await engine.execute(config as unknown as RequestConfig)
      return {
        ok: true,
        data: {
          response: ctx.response
            ? {
                status: ctx.response.status,
                statusText: ctx.response.statusText,
                headers: ctx.response.headers,
                body: ctx.response.body,
                durationMs: ctx.response.durationMs,
                size: ctx.response.size,
              }
            : null,
          error: ctx.error ? { message: ctx.error.message } : null,
        },
      }
    }

    case 'list-environments': {
      const workspaceId = args.workspaceId as string
      if (!workspaceId) return { ok: false, error: 'Missing "workspaceId" argument' }
      const em = new EnvironmentManager()
      return { ok: true, data: em.list(workspaceId) as unknown[] }
    }

    case 'import-collection': {
      const json = args.json as string
      if (!json) return { ok: false, error: 'Missing "json" argument' }
      const workspaceId = args.workspaceId as string | undefined
      const cm = new CollectionManager();
      const col = await cm.importFromJson(json, workspaceId)
      return { ok: true, data: col }
    }

    default:
      return { ok: false, error: `Unknown command: ${command}` }
  }
}

function writeResult(resp: RpcResponse): void {
  try {
    process.stdout.write(JSON.stringify(resp) + '\n')
  } catch (err) {
    // EPIPE — stdout closed (e.g., Tauri killing child during restart), exit silently
    if (err && typeof err === 'object' && 'code' in err && (err as NodeJS.ErrnoException).code === 'EPIPE') {
      process.exit(1)
    }
    throw err
  }
}

main()
