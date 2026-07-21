import type { RequestConfig, ResponseConfig } from '@omniapi/core'

export interface TapResult {
  index: number
  name: string
  passed: boolean
  request: RequestConfig
  response?: ResponseConfig
  error?: string
  durationMs: number
}

export class TapFormatter {
  private results: TapResult[] = []
  private plan: number | null = null
  private outputLines: string[] = []
  private started = false

  planCount(count: number): void {
    this.plan = count
  }

  addResult(result: TapResult): void {
    this.results.push(result)
  }

  format(): string {
    const lines: string[] = []

    // TAP version header
    lines.push('TAP version 14')

    // Plan
    const count = this.plan ?? this.results.length
    if (count === 0) {
      lines.push('1..0 # SKIP collection is empty')
      return lines.join('\n') + '\n'
    }
    lines.push(`1..${count}`)

    // Test lines
    for (let i = 0; i < count; i++) {
      const r = this.results[i]
      if (!r) {
        lines.push(`ok ${i + 1} - # SKIP missing result`)
        continue
      }

      const description = r.name || `${r.request.method} ${r.request.url}`

      // Detect synthetic skip (created by fail-fast or empty result)
      const isSkipped = r.passed && !r.response && !r.error

      if (isSkipped) {
        lines.push(`ok ${r.index} - ${escapeTapDescription(description)} # SKIP (fail-fast)`)
        continue
      }

      const status = r.passed ? 'ok' : 'not ok'
      const label = `${r.index} - ${escapeTapDescription(description)}`
      lines.push(`${status} ${label}`)

      // YAML diagnostic block for failures
      if (!r.passed) {
        lines.push('  ---')
        lines.push(`  message: ${escapeYamlString(r.error ?? `HTTP ${r.response?.status ?? 0}`)}`)
        lines.push('  severity: fail')
        lines.push('  request:')
        lines.push(`    method: ${r.request.method}`)
        lines.push(`    url: ${escapeYamlString(r.request.url)}`)
        if (r.response) {
          lines.push('  response:')
          lines.push(`    status: ${r.response.status}`)
          lines.push(`    statusText: ${escapeYamlString(r.response.statusText)}`)
          lines.push(`    durationMs: ${r.response.durationMs}`)
          lines.push(`    size: ${r.response.size}`)
        }
        if (r.error) {
          lines.push(`  error: ${escapeYamlString(r.error)}`)
        }
        lines.push('  ...')
      }
    }

    // Summary
    const passed = this.results.filter(r => r.passed).length
    const failed = this.results.filter(r => !r.passed).length
    lines.push(`# tests ${count}`)
    lines.push(`# pass  ${passed}`)
    if (failed > 0) {
      lines.push(`# fail  ${failed}`)
    }

    return lines.join('\n') + '\n'
  }

  toExitCode(): number {
    // Only count non-skipped failures for exit code
    return this.results.filter(r => !r.passed && !this.isSkipped(r)).length
  }

  private isSkipped(r: TapResult): boolean {
    return r.passed && !r.response && !r.error
  }
}

function escapeTapDescription(s: string): string {
  // TAP description can't contain # (starts a comment)
  return s.replace(/#/g, '\\#')
}

function escapeYamlString(s: string): string {
  if (s.includes('\n') || s.includes(':') || s.includes('#')) {
    return `"${s.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
  }
  return s
}
