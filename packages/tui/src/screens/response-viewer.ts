/** OmniAPI TUI — Response viewer panel */

import blessed from 'neo-blessed'
import type { StateManager } from '../state'
import type { Theme, ThemeColors } from '../theme'

export class ResponseViewer {
  public readonly box: blessed.Widgets.BoxElement
  public readonly focusTarget: blessed.Widgets.BoxElement

  private statusLine: blessed.Widgets.BoxElement
  private headersBox: blessed.Widgets.BoxElement
  private bodyBox: blessed.Widgets.BoxElement

  constructor(
    parent: blessed.Widgets.BoxElement,
    private screen: blessed.Widgets.Screen,
    private state: StateManager,
    private theme: Theme,
  ) {
    const c = theme.colors

    this.box = parent

    // Status line
    this.statusLine = blessed.box({
      parent: this.box,
      top: 1, left: 1, right: 1, height: 1,
      content: ' Status: —  |  Duration: —  |  Size: — ',
      style: { fg: c.labelFg, focus: {}, border: {} },
    }) as blessed.Widgets.BoxElement

    // Response headers (collapsible)
    this.headersBox = blessed.box({
      parent: this.box,
      top: 2, left: 1, right: 1, height: 4,
      scrollable: true, alwaysScroll: true,
      content: '',
      style: { fg: c.info, focus: {}, border: {} },
      border: { type: 'line', fg: c.border },
      label: ' Response Headers ',
      hidden: true,
    }) as blessed.Widgets.BoxElement

    // Response body
    this.bodyBox = blessed.box({
      parent: this.box,
      top: 7, left: 1, right: 1, bottom: 1,
      scrollable: true, alwaysScroll: true,
      keys: true, vi: true, mouse: true,
      tags: true,
      content: ' Send a request to see the response here.',
      style: { fg: c.fg, bg: c.bg, focus: {}, border: {} },
      border: { type: 'line', fg: c.border },
      label: ' Response Body ',
    }) as blessed.Widgets.BoxElement

    // ── State listener: react to request results ──
    this.state.onChange((s, prev) => {
      if (s.sending !== prev.sending) {
        s.sending ? this.showLoading() : null
      }
      if (s.responseBody !== prev.responseBody && s.responseBody && !s.sending) {
        this.displayResult(s)
      }
    })

    this.focusTarget = this.bodyBox
  }

  private get c(): ThemeColors { return this.theme.colors }

  private showLoading(): void {
    this.bodyBox.setContent(' Sending request...')
    this.statusLine.setContent(' Status: ...  |  Duration: ...  |  Size: ... ')
    this.bodyBox.setLabel(' Response Body ')
    if ((this.bodyBox as any).options?.border) (this.bodyBox as any).options.border.fg = this.c.warning
    this.headersBox.hidden = true
    this.screen.render()
  }

  private displayResult(s: { responseStatus: number; responseTimeMs: number; responseBody: string; responseHeaders: string }): void {
    const c = this.c
    const status = s.responseStatus
    const statusColor = status === 0 ? c.error : status < 300 ? c.success : status < 500 ? c.warning : c.error
    const statusText = status === 0 ? 'ERROR' : String(status)
    const sizeKb = (s.responseBody.length / 1024).toFixed(1)

    this.statusLine.setContent(
      ` Status: {${statusColor}-fg}${statusText}{/${statusColor}-fg}  |  ` +
      `Duration: ${s.responseTimeMs.toFixed(0)}ms  |  Size: ${sizeKb}KB`,
    )

    const body = s.responseBody || '(empty response body)'
    this.bodyBox.setContent(highlightJson(body, c))
    this.bodyBox.setLabel(` Response Body (${sizeKb}KB) `)
    if ((this.bodyBox as any).options?.border) (this.bodyBox as any).options.border.fg = statusColor
    this.bodyBox.scrollTo(0)

    // headers
    if (s.responseHeaders) {
      const lines = s.responseHeaders.split('\n')
        .map(h => `{${c.info}-fg}${h.split(':')[0]}{/${c.info}-fg}: ${h.split(':').slice(1).join(':')}`)
        .join('\n')
      this.headersBox.setContent(lines)
      this.headersBox.hidden = false
    } else {
      this.headersBox.hidden = true
    }

    this.screen.render()
  }

  applyTheme(t: Theme): void {
    this.theme = t
    const c = t.colors
    this.statusLine.style = { fg: c.labelFg, focus: {}, border: {} }
    this.headersBox.style = { fg: c.info, border: { fg: c.border }, focus: {} }
    this.bodyBox.style = { fg: c.fg, bg: c.bg, border: { fg: c.border }, focus: {} }
    if (this.state.current.responseStatus >= 400) {
      if ((this.bodyBox as any).options?.border) (this.bodyBox as any).options.border.fg = c.error
    }
    this.screen.render()
  }

  focus(): void { this.bodyBox.focus() }
}

// ─── JSON highlighting ─────────────────────────────────────────

function highlightJson(raw: string, colors: ThemeColors): string {
  let formatted: string
  try {
    const parsed = JSON.parse(raw)
    formatted = JSON.stringify(parsed, null, 2)
  } catch {
    return raw.length > 50_000 ? raw.slice(0, 50_000) + '\n... (truncated)' : raw
  }

  if (formatted.length > 100_000) {
    return formatted.slice(0, 100_000) + '\n... (truncated)'
  }

  const RESET = '{/}'
  const out: string[] = []
  const len = formatted.length
  let i = 0

  while (i < len) {
    const ch = formatted[i]!

    if (ch === '"') {
      const isKey = isJsonKey(formatted, i)
      const colorHex = isKey ? colors.accent : colors.success
      out.push(`{${colorHex}-fg}`)
      out.push(ch)
      i++
      while (i < len) {
        const sc = formatted[i]!
        out.push(sc)
        i++
        if (sc === '\\' && i < len) {
          out.push(formatted[i]!)
          i++
        } else if (sc === '"') {
          break
        }
      }
      out.push(RESET)
      continue
    }

    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      out.push(`{${colors.warning}-fg}`)
      let j = i
      while (j < len && /[-\d.eE+]/.test(formatted[j]!)) j++
      out.push(formatted.slice(i, j))
      out.push(RESET)
      i = j
      continue
    }

    if (formatted.startsWith('true', i)) {
      out.push(`{${colors.info}-fg}true{/${colors.info}-fg}`)
      i += 4
      continue
    }
    if (formatted.startsWith('false', i)) {
      out.push(`{${colors.info}-fg}false{/${colors.info}-fg}`)
      i += 5
      continue
    }
    if (formatted.startsWith('null', i)) {
      out.push(`{${colors.error}-fg}null{/${colors.error}-fg}`)
      i += 4
      continue
    }

    out.push(ch)
    i++
  }

  return out.join('')
}

function isJsonKey(text: string, quoteIndex: number): boolean {
  let i = quoteIndex + 1
  const len = text.length
  while (i < len) {
    const c = text[i]!
    if (c === '\\') { i += 2; continue }
    if (c === '"') { i++; break }
    i++
  }
  while (i < len && (text[i] === ' ' || text[i] === '\t')) i++
  return i < len && text[i] === ':'
}
