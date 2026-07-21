/** OmniAPI TUI — Central state */

export type FocusPanel = 'collections' | 'request' | 'response'
export type EditMode = 'nav' | 'edit'

export interface AppState {
  editMode: EditMode
  focus: FocusPanel
  statusMsg: string
  selectedMethod: string
  selectedUrl: string
  selectedCollectionId: string | null
  selectedRequestId: string | null
  currentEnvId: string | null
  responseBody: string
  responseStatus: number
  responseHeaders: string
  responseTimeMs: number
  sending: boolean
}

export const defaultState = (): AppState => ({
  editMode: 'nav',
  focus: 'collections',
  statusMsg: 'READY',
  selectedMethod: 'GET',
  selectedUrl: '',
  selectedCollectionId: null,
  selectedRequestId: null,
  currentEnvId: null,
  responseBody: '',
  responseStatus: 0,
  responseHeaders: '',
  responseTimeMs: 0,
  sending: false,
})

export type StateListener = (state: AppState, prev: AppState) => void

export class StateManager {
  private state = defaultState()
  private listeners = new Set<StateListener>()

  get current(): AppState { return this.state }

  update(partial: Partial<AppState>): void {
    const prev = { ...this.state }
    Object.assign(this.state, partial)
    for (const cb of this.listeners) cb(this.state, prev)
  }

  /** Guard: only enter edit mode if element accepts text (caller validates) */
  tryEnterEditMode(): boolean {
    if (this.state.editMode === 'edit') return false
    this.update({ editMode: 'edit', statusMsg: 'EDIT' })
    return true
  }

  /** Guard: exit edit mode, optionally re-focus the panel */
  exitEditMode(focusPanel?: FocusPanel): void {
    if (this.state.editMode !== 'edit') return
    const upd: Partial<AppState> = { editMode: 'nav', statusMsg: 'NAV' }
    if (focusPanel) upd.focus = focusPanel
    this.update(upd)
  }

  toggleFocus(): void {
    if (this.state.editMode === 'edit') return
    const order: FocusPanel[] = ['collections', 'request', 'response']
    const idx = order.indexOf(this.state.focus)
    this.update({ focus: order[(idx + 1) % order.length]! })
  }

  setFocus(panel: FocusPanel): void {
    if (this.state.editMode === 'edit') return
    this.update({ focus: panel })
  }

  onChange(cb: StateListener): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }
}
