/** OmniAPI TUI — Theme Manager & UI helpers */

export interface ThemeColors {
  bg: string; sidebarBg: string; inputBg: string; statusBg: string
  fg: string; mutedFg: string; labelFg: string; statusFg: string
  border: string; borderFocus: string
  accent: string; accentAlt: string
  success: string; warning: string; error: string; info: string
  selectedBg: string; selectedFg: string
  get: string; post: string; put: string; patch: string; del: string
}

export interface Theme { name: string; colors: ThemeColors }

const catppuccin: Theme = {
  name: 'Catppuccin',
  colors: {
    bg: '#1e1e2e', sidebarBg: '#181825', inputBg: '#313244', statusBg: '#11111b',
    fg: '#cdd6f4', mutedFg: '#6c7086', labelFg: '#a6adc8', statusFg: '#bac2de',
    border: '#45475a', borderFocus: '#89b4fa',
    accent: '#89b4fa', accentAlt: '#f5c2e7',
    success: '#a6e3a1', warning: '#f9e2af', error: '#f38ba8', info: '#89dceb',
    selectedBg: '#585b70', selectedFg: '#cdd6f4',
    get: '#a6e3a1', post: '#f9e2af', put: '#89b4fa', patch: '#f5c2e7', del: '#f38ba8',
  },
}
const dracula: Theme = {
  name: 'Dracula',
  colors: {
    bg: '#282a36', sidebarBg: '#21222c', inputBg: '#44475a', statusBg: '#191a21',
    fg: '#f8f8f2', mutedFg: '#6272a4', labelFg: '#bd93f9', statusFg: '#f8f8f2',
    border: '#44475a', borderFocus: '#bd93f9',
    accent: '#bd93f9', accentAlt: '#ff79c6',
    success: '#50fa7b', warning: '#f1fa8c', error: '#ff5555', info: '#8be9fd',
    selectedBg: '#6272a4', selectedFg: '#f8f8f2',
    get: '#50fa7b', post: '#f1fa8c', put: '#bd93f9', patch: '#ff79c6', del: '#ff5555',
  },
}
const nord: Theme = {
  name: 'Nord',
  colors: {
    bg: '#2e3440', sidebarBg: '#242933', inputBg: '#3b4252', statusBg: '#1c2128',
    fg: '#eceff4', mutedFg: '#616e88', labelFg: '#81a1c1', statusFg: '#d8dee9',
    border: '#4c566a', borderFocus: '#88c0d0',
    accent: '#88c0d0', accentAlt: '#b48ead',
    success: '#a3be8c', warning: '#ebcb8b', error: '#bf616a', info: '#81a1c1',
    selectedBg: '#4c566a', selectedFg: '#eceff4',
    get: '#a3be8c', post: '#ebcb8b', put: '#81a1c1', patch: '#b48ead', del: '#bf616a',
  },
}
const tokyoNight: Theme = {
  name: 'Tokyo Night',
  colors: {
    bg: '#1a1b26', sidebarBg: '#16161e', inputBg: '#24283b', statusBg: '#0f0f17',
    fg: '#a9b1d6', mutedFg: '#565f89', labelFg: '#7aa2f7', statusFg: '#c0caf5',
    border: '#3b4261', borderFocus: '#7aa2f7',
    accent: '#7aa2f7', accentAlt: '#bb9af7',
    success: '#9ece6a', warning: '#e0af68', error: '#f7768e', info: '#7dcfff',
    selectedBg: '#3b4261', selectedFg: '#a9b1d6',
    get: '#9ece6a', post: '#e0af68', put: '#7aa2f7', patch: '#bb9af7', del: '#f7768e',
  },
}
const ALL_THEMES: Theme[] = [catppuccin, dracula, nord, tokyoNight]

type ThemeListener = (theme: Theme) => void

export class ThemeManager {
  private themes = ALL_THEMES
  private index = 0
  private listeners = new Set<ThemeListener>()
  constructor() {
    const savedIdx = Number(process.env.OMNIAPI_TUI_THEME) || 0
    this.index = Math.min(Math.max(0, savedIdx), this.themes.length - 1)
  }
  get current(): Theme { return this.themes[this.index]! }
  get themeNames(): string[] { return this.themes.map(t => t.name) }
  get currentIndex(): number { return this.index }
  cycle(): Theme {
    this.index = (this.index + 1) % this.themes.length
    process.env.OMNIAPI_TUI_THEME = String(this.index)
    this.notify()
    return this.current
  }
  setIndex(idx: number): Theme {
    this.index = Math.min(Math.max(0, idx), this.themes.length - 1)
    process.env.OMNIAPI_TUI_THEME = String(this.index)
    this.notify()
    return this.current
  }
  onChange(cb: ThemeListener): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }
  private notify(): void { for (const cb of this.listeners) cb(this.current) }
}

// ─── Tag helpers (used by screens that have tags:true) ──────────

export function colorTag(text: string, hex: string): string {
  return `{${hex}-fg}${text}{/}`
}

/** Return method string padded + wrapped in colored tag */
export function methodTag(method: string, colors: ThemeColors): string {
  const map: Record<string, string> = {
    GET: colors.get, POST: colors.post, PUT: colors.put,
    PATCH: colors.patch, DELETE: colors.del, HEAD: colors.info, OPTIONS: colors.mutedFg,
  }
  return colorTag(method.padEnd(6), map[method] ?? colors.fg)
}

/** Modal help text (shown on '?') */
export const HELP_TEXT = `
  ── OmniAPI TUI Help ─────────────────────────────────────────────
  Navigation:
    1 / Ctrl+1    Focus Collections sidebar
    2 / Ctrl+2    Focus Request editor (URL bar)
    3 / Ctrl+3    Focus Response viewer
    Tab / S-Tab   Cycle focus forward / backward
    Escape        Exit edit mode / return to navigation
    ?             Show this help
    q / Ctrl+C    Quit OmniAPI

  Editing:
    Tab/Ctrl+1/2/3  Switch panel (auto-enters edit mode on inputs)
    Enter           On URL: send request
    Ctrl+Enter      Send request from anywhere
    Ctrl+E          Cycle active environment
    Ctrl+T          Cycle theme

  Response panel:
    Up / Down       Scroll response body
    PageUp/Dn       Page scroll

  Themes: ${ALL_THEMES.map(t => t.name).join(', ')}
  ─────────────────────────────────────────────────────────────────
`.trim()
