/** OmniAPI TUI — Request editor with reliable input capture */

import blessed from 'neo-blessed'
import { RequestEngine, envResolver, scriptRunner } from '@omniapi/core'
import type { RequestConfig, HttpMethod } from '@omniapi/core'
import type { StateManager } from '../state'
import type { Theme, ThemeColors } from '../theme'
import { methodTag } from '../theme'

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

export class RequestEditor {
  public readonly box: blessed.Widgets.BoxElement
  public readonly urlInput: blessed.Widgets.TextboxElement
  public readonly textInputs: blessed.Widgets.BlessedElement[]

  private methodIdx = 0
  private methodBtn: blessed.Widgets.ButtonElement
  private sendBtn: blessed.Widgets.ButtonElement
  private headersInput: blessed.Widgets.TextareaElement
  private bodyInput: blessed.Widgets.TextareaElement
  private loadingText: blessed.Widgets.TextElement
  private currentRequestId: string | null = null

  constructor(
    parent: blessed.Widgets.BoxElement,
    private screen: blessed.Widgets.Screen,
    private state: StateManager,
    private theme: Theme,
    private envRef: { variables: Record<string, string> } = { variables: {} },
  ) {
    const c = theme.colors
    this.box = parent

    // ── Method selector ──
    this.methodBtn = blessed.button({
      parent: this.box, top: 1, left: 1, height: 1, width: 8,
      content: ` ${METHODS[0]!.padEnd(5)}`,
      style: { bg: c.inputBg, fg: c.fg, focus: {}, border: {} },
      mouse: true,
    }) as blessed.Widgets.ButtonElement
    this.methodBtn.on('press', () => this.cycleMethod())

    // ── URL input ──
    this.urlInput = blessed.textbox({
      parent: this.box, top: 1, left: 10, right: 10, height: 1,
      inputOnFocus: true, input: true, keys: true, mouse: true,
      style: { bg: c.inputBg, fg: c.fg, focus: {}, border: {} },
    }) as blessed.Widgets.TextboxElement
    this.urlInput.on('focus', () => this.startInputCapture(this.urlInput))
    // Enter on urlInput → send request
    this.urlInput.on('submit', () => this.sendRequest())

    // ── Send button ──
    this.sendBtn = blessed.button({
      parent: this.box, top: 1, right: 1, height: 1, width: 8,
      content: ' SEND ',
      style: { bg: c.accent, fg: c.sidebarBg, focus: {}, border: {} },
      mouse: true,
    }) as blessed.Widgets.ButtonElement
    this.sendBtn.on('press', () => this.sendRequest())

    // ── Headers section ──
    const headersBox = blessed.box({
      parent: this.box, top: 3, left: 0, right: 0, height: 7,
      border: { type: 'line', fg: c.border },
      style: { border: { fg: c.border }, focus: {} },
    })
    blessed.text({
      parent: headersBox, top: 0, left: 1, height: 1,
      content: ' Headers (key: value, one per line) ',
      style: { fg: c.labelFg, focus: {}, border: {} },
    })
    this.headersInput = blessed.textarea({
      parent: headersBox, top: 1, left: 1, right: 1, bottom: 1,
      inputOnFocus: true, input: true, keys: true, mouse: true,
      scrollable: true, alwaysScroll: true, vi: true,
      style: { bg: c.inputBg, fg: c.fg, focus: {}, border: {} },
    }) as blessed.Widgets.TextareaElement
    this.headersInput.on('focus', () => this.startInputCapture(this.headersInput))

    // ── Body section ──
    const bodyBox = blessed.box({
      parent: this.box, top: 11, left: 0, right: 0, bottom: 0,
      border: { type: 'line', fg: c.border },
      style: { border: { fg: c.border }, focus: {} },
    })
    blessed.text({
      parent: bodyBox, top: 0, left: 1, height: 1,
      content: ' Body ',
      style: { fg: c.labelFg, focus: {}, border: {} },
    })
    this.bodyInput = blessed.textarea({
      parent: bodyBox, top: 1, left: 1, right: 1, bottom: 1,
      inputOnFocus: true, input: true, keys: true, mouse: true,
      scrollable: true, alwaysScroll: true, vi: true,
      style: { bg: c.inputBg, fg: c.fg, focus: {}, border: {} },
    }) as blessed.Widgets.TextareaElement
    this.bodyInput.on('focus', () => this.startInputCapture(this.bodyInput))

    // ── Loading indicator ──
    this.loadingText = blessed.text({
      parent: this.box, top: 1, left: '50%-8', height: 1, width: 16,
      content: '', style: { fg: c.warning, focus: {}, border: {} }, hidden: true,
    }) as blessed.Widgets.TextElement

    // ── State change listener: panel focus border ──
    this.state.onChange((s) => {
      const borderFg = s.focus === 'request' ? c.borderFocus : c.border
      if ((this.box as any).options?.border) (this.box as any).options.border.fg = borderFg
    })

    this.textInputs = [this.urlInput, this.headersInput, this.bodyInput]
  }

  private get c(): ThemeColors { return this.theme.colors }

  /**
   * Start capturing keystrokes immediately when an input gets focus.
   * Uses setTimeout to avoid neo-blessed render conflicts during the focus cycle.
   */
  private startInputCapture(el: blessed.Widgets.BlessedElement): void {
    if (this.state.current.editMode !== 'edit') {
      this.state.update({ editMode: 'edit', statusMsg: 'EDIT' })
    }
    // Explicit .readInput() — ensures neo-blessed starts key buffering
    // Deferred to next tick to avoid race with focus-induced render
    setTimeout(() => {
      if ((el as any).readInput) {
        try { (el as any).readInput() } catch {}
      }
    }, 0)
  }

  private cycleMethod(): void {
    this.methodIdx = (this.methodIdx + 1) % METHODS.length
    this.methodBtn.setContent(` ${methodTag(METHODS[this.methodIdx]!, this.c)}`)
    this.screen.render()
  }

  getCurrentMethod(): HttpMethod { return METHODS[this.methodIdx] ?? 'GET' }

  loadRequest(req: { id: string; method?: string; url?: string; headers?: string; body?: string }): void {
    this.currentRequestId = req.id
    if (req.method) {
      const idx = METHODS.indexOf(req.method as HttpMethod)
      if (idx >= 0) {
        this.methodIdx = idx
        this.methodBtn.setContent(` ${methodTag(METHODS[this.methodIdx]!, this.c)}`)
      }
    }
    this.setUrlValue(req.url ?? '')
    this.setHeadersValue(req.headers ?? '')
    this.setBodyValue(req.body ?? '')
    this.screen.render()
  }

  setUrlValue(v: string): void { this.urlInput.clearValue(); this.urlInput.setValue(v); this.urlInput.text = v }
  setHeadersValue(v: string): void { this.headersInput.clearValue(); this.headersInput.setValue(v); this.headersInput.text = v }
  setBodyValue(v: string): void { this.bodyInput.clearValue(); this.bodyInput.setValue(v); this.bodyInput.text = v }

  async sendRequest(): Promise<void> {
    const method = this.getCurrentMethod()
    const url = this.urlInput.value || this.urlInput.text || ''
    if (!url) return

    this.loadingText.setContent('  Sending...  ')
    this.loadingText.hidden = false
    this.sendBtn.setContent('  ...  ')
    this.state.update({ sending: true, statusMsg: 'SENDING...' })
    this.screen.render()

    const headersRaw = this.headersInput.value || this.headersInput.text || ''
    const headers = headersRaw.split('\n')
      .map((l: string) => l.trim()).filter((l: string) => l.includes(':'))
      .map((l: string) => { const ci = l.indexOf(':'); return { key: l.slice(0, ci).trim(), value: l.slice(ci + 1).trim(), enabled: true } })
    const body = this.bodyInput.value || this.bodyInput.text || ''

    const config: RequestConfig = {
      id: this.currentRequestId ?? crypto.randomUUID(),
      name: url, method, url,
      headers, queryParams: [],
      auth: { type: 'none', data: {} },
      bodyType: (method === 'GET' || method === 'HEAD') ? 'none' : 'json',
      body: body || undefined,
    }

    try {
      const engine = new RequestEngine()
      engine.use(envResolver)
      engine.use(scriptRunner)
      const result = await engine.execute(config, this.envRef.variables)

      if (result.error) {
        this.state.update({
          sending: false,
          statusMsg: `ERROR: ${result.error.message}`,
          responseBody: result.error.message,
          responseStatus: 0, responseHeaders: '', responseTimeMs: 0,
        })
      } else if (result.response) {
        this.state.update({
          sending: false,
          statusMsg: `${result.response.status} ${result.response.statusText}`,
          responseBody: result.response.body,
          responseStatus: result.response.status,
          responseHeaders: Object.entries(result.response.headers).map(([k, v]) => `${k}: ${v}`).join('\n'),
          responseTimeMs: result.response.durationMs,
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.state.update({
        sending: false,
        statusMsg: `ERROR: ${msg}`,
        responseBody: msg, responseStatus: 0, responseHeaders: '', responseTimeMs: 0,
      })
    } finally {
      this.loadingText.hidden = true
      this.sendBtn.setContent(' SEND ')
      this.screen.render()
    }
  }

  applyTheme(t: Theme): void {
    const c = t.colors
    this.theme = t
    this.methodBtn.style = { ...this.methodBtn.style, bg: c.inputBg, fg: c.fg, focus: {}, border: {} }
    this.urlInput.style = { ...this.urlInput.style, bg: c.inputBg, fg: c.fg, focus: {}, border: {} }
    this.sendBtn.style = { ...this.sendBtn.style, bg: c.accent, fg: c.sidebarBg, focus: {}, border: {} }
    this.headersInput.style = { ...this.headersInput.style, bg: c.inputBg, fg: c.fg, focus: {}, border: {} }
    this.bodyInput.style = { ...this.bodyInput.style, bg: c.inputBg, fg: c.fg, focus: {}, border: {} }
    this.loadingText.style = { fg: c.warning, focus: {}, border: {} }
  }
}
