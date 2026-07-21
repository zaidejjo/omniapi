import { defineStore } from 'pinia'
import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'

export interface Workspace {
  id: string
  name: string
  description?: string
}

export interface Collection {
  id: string
  workspaceId: string
  name: string
  description: string
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const activeWorkspaceId = ref<string | null>(null)
  const workspaces = ref<Workspace[]>([])
  const collections = ref<Collection[]>([])
  const loading = ref(false)
  const initialized = ref(false)
  const error = ref<string | null>(null)

  async function initialize() {
    if (initialized.value) return
    initialized.value = true
    loading.value = true
    error.value = null
    try {
      const raw = await invoke<string>('list_workspaces')
      const parsed = JSON.parse(raw)
      const list: Workspace[] = parsed.ok ? parsed.data : []

      if (list.length === 0) {
        const createRaw = await invoke<string>('create_workspace', { name: 'Default Workspace' })
        const createResp = JSON.parse(createRaw)
        if (createResp.ok) {
          activeWorkspaceId.value = createResp.data
          workspaces.value = [{ id: createResp.data, name: 'Default Workspace' }]
        }
      } else {
        workspaces.value = list
        activeWorkspaceId.value = list[0]!.id
      }

      if (activeWorkspaceId.value) {
        await loadCollections(activeWorkspaceId.value)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  async function loadCollections(workspaceId: string) {
    try {
      const raw = await invoke<string>('list_collections', { workspaceId })
      const resp = JSON.parse(raw)
      collections.value = resp.ok ? resp.data : []
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    }
  }

  async function switchWorkspace(id: string) {
    activeWorkspaceId.value = id
    await loadCollections(id)
  }

  return {
    activeWorkspaceId,
    workspaces,
    collections,
    loading,
    initialized,
    error,
    initialize,
    loadCollections,
    switchWorkspace,
  }
})
