/** OmniAPI TUI — Main entry */

import blessed from 'neo-blessed'
import { EnvironmentManager, WorkspaceRepo } from '@omniapi/core'
import { ThemeManager, HELP_TEXT } from './theme'
import { StateManager } from './state'
import { CollectionsPanel } from './screens/collections'
import { RequestEditor } from './screens/request-editor'
import { ResponseViewer } from './screens/response-viewer'

export async function main(): Promise<void> {
  const theme = new ThemeManager()
  const state = new StateManager()

  const screen = blessed.screen({
    smartCSR: true,
    title: 'OmniAPI TUI',
    dockBorders: true,
    fullUnicode: true,
    cursor: { artificial: true, blink: true },
  })

  const c = () => theme.current.colors

  // ── Neutral focus zone (off-screen) ──
  const neutralZone = blessed.box({
    parent: screen, top: -100, left: -100, height: 1, width: 1,
    style: { focus: {}, border: {} },
  })

  // ── Status bar ──
  const statusBar = blessed.box({
    parent: screen, bottom: 0, left: 0, width: '100%', height: 1,
    tags: true,
    style: { bg: c().statusBg, fg: c().statusFg, focus: {}, border: {} },
  })

  // ── Left panel: Collections ──
  const leftBox = blessed.box({
    parent: screen, top: 0, left: 0, width: '30%', bottom: 1,
    border: { type: 'line', fg: c().border },
    style: { border: { fg: c().border }, bg: c().sidebarBg, focus: {} },
    label: ' [1] Collections ', keys: true,
  })
  const collectionsPanel = new CollectionsPanel(leftBox, screen, state, theme.current)

  // ── Right side ──
  const rightBox = blessed.box({
    parent: screen, top: 0, left: '30%', width: '70%', bottom: 1,
    border: { type: 'line', fg: c().border },
    style: { border: { fg: c().border }, focus: {} },
  })

  const requestBox = blessed.box({
    parent: rightBox, top: 0, left: 0, width: '100%', height: '50%',
    border: { type: 'line', fg: c().border },
    style: { border: { fg: c().border }, bg: c().bg, focus: {} },
    label: ' [2] Request ', keys: true,
  })
  const envRef: { variables: Record<string, string> } = { variables: {} }
  const requestEditor = new RequestEditor(requestBox, screen, state, theme.current, envRef)

  const responseBox = blessed.box({
    parent: rightBox, top: '50%+1', left: 0, width: '100%', bottom: 0,
    border: { type: 'line', fg: c().border },
    style: { border: { fg: c().border }, bg: c().bg, focus: {} },
    label: ' [3] Response ', keys: true,
  })
  const responseViewer = new ResponseViewer(responseBox, screen, state, theme.current)

  screen.append(neutralZone)

  // ── Environment management ──
  let envList: Array<{ id: string; name: string; variables: Record<string, string> }> = []
  let activeEnvIndex = 0
  let wsId: string | null = null

  function loadEnvironments(): void {
    const repo = new WorkspaceRepo()
    const workspaces = repo.list() as Array<{ id: string; name: string }>
    if (workspaces.length === 0) {
      repo.create('Default Workspace')
      workspaces.push({ id: 'default', name: 'Default Workspace' })
    }
    wsId = workspaces[0]!.id

    const mgr = new EnvironmentManager()
    const allEnvs = mgr.list(wsId) as Array<{
      id: string; name: string; variables: Record<string, string>; isActive: boolean
    }>

    if (allEnvs.length === 0) {
      mgr.create('Default', wsId)
      const created = mgr.list(wsId) as Array<{
        id: string; name: string; variables: Record<string, string>; isActive: boolean
      }>
      envList = created
      mgr.setActive(created[0]!.id, wsId)
      activeEnvIndex = 0
    } else {
      envList = allEnvs
      const activeIdx = envList.findIndex((e: any) => e.isActive)
      activeEnvIndex = activeIdx >= 0 ? activeIdx : 0
    }
    applyActiveEnv()
  }

  function applyActiveEnv(): void { const env = envList[activeEnvIndex]; if (env) envRef.variables = env.variables }
  function cycleEnv(): void {
    if (envList.length === 0) return
    activeEnvIndex = (activeEnvIndex + 1) % envList.length
    const env = envList[activeEnvIndex]!
    applyActiveEnv()
    if (wsId) { const mgr = new EnvironmentManager(); mgr.setActive(env.id, wsId) }
    state.update({ statusMsg: `Env: ${env.name}` })
  }
  loadEnvironments()

  // ── Focus tracking — 3-element controlled loop ──
  const focusOrder: blessed.Widgets.BlessedElement[] = [
    collectionsPanel.focusTarget,
    requestEditor.urlInput,
    responseViewer.focusTarget,
  ]

  const panelMeta: Array<{ box: blessed.Widgets.BoxElement; label: string; marker: string }> = [
    { box: leftBox, label: ' Collections ', marker: ' [1] Collections ' },
    { box: requestBox, label: ' Request ', marker: ' [2] Request ' },
    { box: responseBox, label: ' Response ', marker: ' [3] Response ' },
  ]

  let highlightedBox: blessed.Widgets.BoxElement | null = null

  function highlightPanel(box: blessed.Widgets.BoxElement | null): void {
    const prevIdx = panelMeta.findIndex(p => p.box === highlightedBox)
    if (prevIdx >= 0) {
      const p = panelMeta[prevIdx]!
      if (!p.box.ended) {
        if (p.box.options.border) (p.box.options.border as any).fg = c().border
        p.box.setLabel(p.label)
      }
    }
    const curIdx = panelMeta.findIndex(p => p.box === box)
    if (curIdx >= 0) {
      const p = panelMeta[curIdx]!
      if (!p.box.ended) {
        if (p.box.options.border) (p.box.options.border as any).fg = c().borderFocus
        p.box.setLabel(p.marker)
      }
    }
    highlightedBox = box
  }

  for (let i = 0; i < focusOrder.length; i++) {
    const panelIdx = i
    focusOrder[i]!.on('focus', () => highlightPanel(panelMeta[panelIdx]!.box))
  }

  function focusIndex(): number {
    const f = screen.focused
    if (!f) return 0
    const idx = focusOrder.indexOf(f as any)
    return idx >= 0 ? idx : 0
  }
  function focusNext(): void {
    const idx = focusIndex()
    focusOrder[(idx + 1) % focusOrder.length]?.focus()
  }
  function focusPrev(): void {
    const idx = focusIndex()
    focusOrder[(idx - 1 + focusOrder.length) % focusOrder.length]?.focus()
  }
  function focusPanel(index: number): void { if (index >= 0 && index < focusOrder.length) focusOrder[index]?.focus() }

  // ── Status bar ──
  function renderStatus(): void {
    const s = state.current
    const envName = envList[activeEnvIndex]?.name ?? 'none'
    const mode = s.editMode === 'edit' ? '{bold}EDIT{/}' : 'NAV'
    const left = ` [${theme.current.name}] Mode: ${mode} | ${s.statusMsg} `
    const right = ` Env: ${envName}  Tab:Switch  Enter:Edit/Send  C-Enter:Send  C-c:Exit `
    const cols = screen.width || 80
    const pad = Math.max(1, cols - left.length - right.length - 2)
    statusBar.setContent(` ${left}${''.padEnd(pad)}${right} `)
    screen.render()
  }
  renderStatus()
  state.onChange(() => renderStatus())

  // ── Help modal ──
  let helpModal: blessed.Widgets.BoxElement | null = null
  function toggleHelp(): void {
    if (helpModal && !helpModal.ended) { helpModal.detach(); helpModal = null; screen.render(); return }
    helpModal = blessed.box({
      parent: screen, top: 'center', left: 'center', width: '60%', height: '60%',
      border: { type: 'line', fg: c().accent },
      style: { bg: c().bg, fg: c().fg, border: { fg: c().accent }, focus: {} },
      label: ' OmniAPI TUI — Help ', content: HELP_TEXT,
      tags: true, scrollable: true, keys: true, vi: true,
    }) as blessed.Widgets.BoxElement
    helpModal.focus()
    screen.render()
  }

  // ── Theme ──
  function applyTheme(): void {
    const cols = c()
    for (const [box, isHighlighted] of [[leftBox, highlightedBox === leftBox], [requestBox, highlightedBox === requestBox], [responseBox, highlightedBox === responseBox]] as const) {
      if ((box as any).options?.border) (box as any).options.border.fg = isHighlighted ? cols.borderFocus : cols.border
    }
    leftBox.style.bg = cols.sidebarBg
    requestBox.style.bg = cols.bg
    responseBox.style.bg = cols.bg
    statusBar.style = { bg: cols.statusBg, fg: cols.statusFg, focus: {}, border: {} }
    collectionsPanel.applyTheme(theme.current)
    requestEditor.applyTheme(theme.current)
    responseViewer.applyTheme(theme.current)
    const cur = panelMeta.find(p => p.box === highlightedBox)
    if (cur && !cur.box.ended) cur.box.setLabel(cur.marker)
    renderStatus()
  }

  function cycleTheme(): void {
    theme.cycle()
    applyTheme()
    statusBar.style = { bg: c().accent, fg: c().sidebarBg, focus: {}, border: {} }
    renderStatus()
    setTimeout(() => {
      if (!statusBar.ended) {
        statusBar.style = { bg: c().statusBg, fg: c().statusFg, focus: {}, border: {} }
        renderStatus()
      }
    }, 800)
  }

  // ── Keybindings ──

  // Quit
  screen.key(['C-c'], () => process.exit(0))
  screen.key(['q'], () => {
    if (helpModal && !helpModal.ended) { toggleHelp(); return }
    if (isTextInput()) return
    process.exit(0)
  })

  // Tab cycle
  screen.key(['tab'], focusNext)
  screen.key(['S-tab'], focusPrev)

  // Panel jumps
  screen.key(['1'], () => { if (!isTextInput()) focusPanel(0) })
  screen.key(['2'], () => { if (!isTextInput()) focusPanel(1) })
  screen.key(['3'], () => { if (!isTextInput()) focusPanel(2) })
  screen.key(['C-1'], () => focusPanel(0))
  screen.key(['C-2'], () => focusPanel(1))
  screen.key(['C-3'], () => focusPanel(2))

  // Enter on urlInput triggers send via submit event; global Enter as fallback
  screen.key(['enter'], () => {
    if (helpModal && !helpModal.ended) { toggleHelp(); return }
    const el = screen.focused
    if (el && (el as any).type === 'textbox') {
      // urlInput 'submit' event already fires; this is a safety net
    }
  })

  // Escape: exit edit mode, blur to neutral zone
  screen.key(['escape'], () => {
    if (helpModal && !helpModal.ended) { toggleHelp(); return }
    if (state.current.editMode === 'edit') {
      state.update({ editMode: 'nav', statusMsg: 'NAV' })
      neutralZone.focus()
      screen.render()
      return
    }
    neutralZone.focus()
    screen.render()
  })

  // Help
  screen.key(['?'], () => { if (!helpModal || helpModal.ended) toggleHelp() })

  // Send request
  screen.key(['C-enter'], () => requestEditor.sendRequest())

  // Cycle environment
  screen.key(['C-e'], () => { cycleEnv(); flashStatusBar() })

  // Cycle theme
  screen.key(['C-t'], () => cycleTheme())

  // ── Helpers ──
  function isTextInput(): boolean {
    const el = screen.focused
    if (!el) return false
    return el.type === 'textarea' || el.type === 'textbox'
  }

  function flashStatusBar(): void {
    const prev = { bg: c().statusBg, fg: c().statusFg }
    statusBar.style = { bg: c().accent, fg: c().sidebarBg, focus: {}, border: {} }
    renderStatus()
    setTimeout(() => {
      if (!statusBar.ended) {
        statusBar.style = { ...prev, focus: {}, border: {} }
        renderStatus()
      }
    }, 600)
  }

  // ── Initial state ──
  highlightPanel(leftBox)
  neutralZone.focus()
  screen.render()
}
