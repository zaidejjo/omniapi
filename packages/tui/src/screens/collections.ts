/** OmniAPI TUI — Collections sidebar (tree browser) */

import blessed from 'neo-blessed'
import type { StateManager, FocusPanel } from '../state'
import type { Theme, ThemeColors } from '../theme'
import { methodTag } from '../theme'

export interface CollectionNode {
  id: string
  type: 'collection' | 'request' | 'folder'
  label: string
  method?: string
  children?: CollectionNode[]
  collapsed?: boolean
}

export class CollectionsPanel {
  public list: blessed.Widgets.ListElement
  private nodes: CollectionNode[] = []
  private running = new Set<string>()

  constructor(
    parent: blessed.Widgets.BoxElement,
    private screen: blessed.Widgets.Screen,
    private state: StateManager,
    private theme: Theme,
  ) {
    const c = theme.colors
    this.list = blessed.list({
      parent,
      top: 0, left: 0, right: 0, bottom: 0,
      style: {
        fg: c.fg, bg: c.bg,
        focus: {},
        border: {},
        selected: { fg: c.selectedFg, bg: c.selectedBg },
        item: { fg: c.fg, bg: c.bg },
      },
      scrollbar: { ch: '│', track: { bg: c.bg }, style: { bg: c.mutedFg } },
      keys: true,
      vi: true,
      mouse: true,
    }) as blessed.Widgets.ListElement

    this.list.on('select', () => this.onSelect())
  }

  private get c(): ThemeColors { return this.theme.colors }

  applyTheme(theme: Theme): void {
    const c = theme.colors
    this.theme = theme
    this.list.style = {
      fg: c.fg, bg: c.bg,
      focus: {},
      border: {},
      selected: { fg: c.selectedFg, bg: c.selectedBg },
      item: { fg: c.fg, bg: c.bg },
    }
    this.rerender()
  }

  setNodes(nodes: CollectionNode[]): void { this.nodes = nodes; this.rerender() }
  setRunning(id: string, isRunning: boolean): void {
    if (isRunning) this.running.add(id); else this.running.delete(id)
    this.rerender()
  }

  selectedNodeId(): string | null {
    const idx = this.list.selected
    const item = this.list.getItem(idx)
    if (!item) return null
    const m = item.content.match(/^\{([^}]+)\}/)
    return m ? m[1]! : null
  }

  focus(): void { this.list.focus() }

  /** Focusable element for focus tracking */
  get focusTarget(): blessed.Widgets.ListElement { return this.list }

  private rerender(): void {
    const lines: string[] = []
    for (const n of this.flatten(this.nodes, '')) lines.push(n)
    this.list.setItems(lines)
    this.screen.render()
  }

  private flatten(nodes: CollectionNode[], prefix: string): string[] {
    const c = this.c
    const out: string[] = []
    for (const node of nodes) {
      if (node.type === 'collection') {
        const icon = node.collapsed ? '▸' : '▾'
        out.push(`{${c.accent}-fg}{bold}${icon} {/}{bold}${node.label}{/}`)
        if (!node.collapsed && node.children) out.push(...this.flatten(node.children, '  '))
      } else if (node.type === 'folder') {
        const icon = node.collapsed ? '▸' : '▾'
        out.push(`${prefix}{${c.info}-fg}${icon} ${node.label}{/}`)
        if (!node.collapsed && node.children) out.push(...this.flatten(node.children, `${prefix}  `))
      } else {
        const m = node.method ?? 'GET'
        const tag = methodTag(m, c)
        const run = this.running.has(node.id) ? '{bold}⟳{/} ' : '  '
        const line = `${prefix}  ${run}${tag} ${node.label}`
        out.push(`{${node.id}}${line}{/${node.id}}`)
      }
    }
    return out
  }

  private onSelect(): void {
    const id = this.selectedNodeId()
    if (!id) return
    const req = this.findNode(this.nodes, id)
    if (req && req.type === 'request') {
      this.state.update({
        selectedRequestId: req.id,
        selectedMethod: req.method ?? 'GET',
        statusMsg: `Request: ${req.label}`,
      })
    }
  }

  private findNode(nodes: CollectionNode[], id: string): CollectionNode | null {
    for (const n of nodes) {
      if (n.id === id) return n
      if (n.children) { const f = this.findNode(n.children, id); if (f) return f }
    }
    return null
  }

  panelId(): FocusPanel { return 'collections' }
}
