import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { HttpMethod } from '@omniapi/core'

export interface HistoryEntry {
  id: string
  method: HttpMethod
  url: string
  timestamp: number
  status?: number
  durationMs?: number
}

export interface HistoryTreeNode {
  name: string
  fullPath: string
  children: HistoryTreeNode[]
  entries: HistoryEntry[]
}

const HISTORY_KEY = 'omniapi:history'
const MAX_HISTORY = 100

export const useHistoryStore = defineStore('history', () => {
  const entries = ref<HistoryEntry[]>(loadFromStorage())

  /** Reactive expanded-state map, keyed by fullPath */
  const expanded = ref<Map<string, boolean>>(new Map())

  const sorted = computed(() =>
    [...entries.value].sort((a, b) => b.timestamp - a.timestamp),
  )

  /** Check if a node is expanded */
  function isExpanded(fullPath: string): boolean {
    return expanded.value.get(fullPath) ?? false
  }

  /** Toggle expand/collapse for a node */
  function toggleNode(fullPath: string) {
    const map = new Map(expanded.value)
    map.set(fullPath, !(map.get(fullPath) ?? false))
    expanded.value = map
  }

  /** Build a domain-grouped tree from history entries */
  const tree = computed<HistoryTreeNode[]>(() => {
    const root: HistoryTreeNode[] = []
    const map = new Map<string, HistoryTreeNode>()

    const sortedEntries = [...entries.value].sort((a, b) => b.timestamp - a.timestamp)

    for (const entry of sortedEntries) {
      try {
        const url = new URL(entry.url)
        const domain = url.hostname
        const pathParts = url.pathname.split('/').filter(Boolean)

        let domainNode = map.get(domain)
        if (!domainNode) {
          domainNode = {
            name: domain,
            fullPath: domain,
            children: [],
            entries: [],
          }
          map.set(domain, domainNode)
          root.push(domainNode)
        }

        let current = domainNode
        let accumulatedPath = domain
        for (const part of pathParts) {
          accumulatedPath += `/${part}`
          let child = current.children.find(c => c.name === part)
          if (!child) {
            child = {
              name: part,
              fullPath: accumulatedPath,
              children: [],
              entries: [],
            }
            current.children.push(child)
          }
          current = child
        }

        current.entries.push(entry)
      } catch {
        let other = root.find(n => n.name === '(other)')
        if (!other) {
          other = {
            name: '(other)',
            fullPath: '(other)',
            children: [],
            entries: [],
          }
          root.push(other)
        }
        other.entries.push(entry)
      }
    }

    return root
  })

  function add(entry: Omit<HistoryEntry, 'id' | 'timestamp'>) {
    const newEntry: HistoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    }
    entries.value = [newEntry, ...entries.value].slice(0, MAX_HISTORY)
    saveToStorage()
  }

  function remove(id: string) {
    entries.value = entries.value.filter(e => e.id !== id)
    saveToStorage()
  }

  function clear() {
    entries.value = []
    expanded.value = new Map()
    saveToStorage()
  }

  function loadFromStorage(): HistoryEntry[] {
    try {
      const raw = localStorage.getItem(HISTORY_KEY)
      return raw ? (JSON.parse(raw) as HistoryEntry[]) : []
    } catch {
      return []
    }
  }

  function saveToStorage() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.value))
    } catch { /* quota */ }
  }

  return { entries, sorted, tree, expanded, isExpanded, toggleNode, add, remove, clear }
})
