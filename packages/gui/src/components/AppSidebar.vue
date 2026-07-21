<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkspaceStore } from '../stores/workspace'
import { useRequestStore } from '../stores/request'
import { useHistoryStore } from '../stores/history'

const router = useRouter()
const props = defineProps<{
  collapsed: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()

const workspace = useWorkspaceStore()
const requestStore = useRequestStore()
const history = useHistoryStore()

type NavSection = 'collections' | 'history' | 'environments' | 'settings'
const activeNav = ref<NavSection>('history')

const navItems = [
  {
    key: 'collections' as NavSection,
    label: 'Collections',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>',
  },
  {
    key: 'history' as NavSection,
    label: 'History',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>',
  },
  {
    key: 'environments' as NavSection,
    label: 'Envs',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>',
  },
  {
    key: 'settings' as NavSection,
    label: 'Settings',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>',
  },
] as const

function goHome() {
  router.push('/')
}

function newRequest() {
  requestStore.reset()
  activeNav.value = 'history'
  router.push('/')
}

function loadFromHistory(entry: { method: string; url: string }) {
  requestStore.reset()
  requestStore.setMethod(entry.method as any)
  requestStore.setUrl(entry.url)
  router.push('/')
}

function navigateToSettings() {
  activeNav.value = 'settings'
  router.push('/settings')
}

function countEntries(node: { entries: unknown[]; children: { entries: unknown[] }[] }): number {
  let count = node.entries.length
  for (const child of node.children) {
    count += child.entries.length
  }
  return count
}
</script>

<template>
  <aside
    class="shrink-0 flex flex-col bg-surface border-r border-border select-none overflow-hidden transition-[width] duration-150 ease-out"
    :class="collapsed ? 'w-12' : 'min-w-[180px]'"
  >
    <!-- Header -->
    <div class="flex items-center justify-between h-12 border-b border-border shrink-0" :class="collapsed ? 'px-2' : 'px-3'">
      <button
        v-if="!collapsed"
        class="text-base font-extrabold tracking-tight whitespace-nowrap overflow-hidden text-left hover:opacity-80 transition-opacity"
        @click="goHome"
      >
        <span class="text-accent">Omni</span><span class="text-text-primary">API</span>
      </button>
      <div class="flex items-center gap-1" :class="{ 'w-full justify-center': collapsed }">
        <button
          class="flex items-center justify-center w-7 h-7 rounded-lg bg-accent/15 text-accent hover:bg-accent/25 transition-colors shrink-0"
          :title="collapsed ? 'Expand sidebar' : 'New Request'"
          @click="newRequest()"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
        </button>
        <button
          class="flex items-center justify-center w-7 h-7 rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-hover transition-colors shrink-0"
          :title="collapsed ? 'Expand' : 'Collapse sidebar'"
          @click="emit('toggle')"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path v-if="!collapsed" stroke-linecap="round" stroke-linejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/>
            <path v-else stroke-linecap="round" stroke-linejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Workspace selector (hidden when collapsed) -->
    <div v-if="!collapsed" class="px-2 py-2 border-b border-border shrink-0">
      <select
        v-if="workspace.workspaces.length > 1"
        class="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-text-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        @change="workspace.switchWorkspace(($event.target as HTMLSelectElement).value)"
      >
        <option
          v-for="ws in workspace.workspaces"
          :key="ws.id"
          :value="ws.id"
          :selected="ws.id === workspace.activeWorkspaceId"
          class="bg-surface text-text-primary"
        >
          {{ ws.name }}
        </option>
      </select>
      <div v-else class="text-xs text-text-muted px-1 py-1 truncate">
        {{ workspace.workspaces[0]?.name ?? 'No workspace' }}
      </div>
    </div>

    <!-- Nav items -->
    <nav class="flex shrink-0" :class="collapsed ? 'flex-col px-1 py-2 gap-1' : 'px-2 pt-2 pb-1 gap-0.5'">
      <button
        v-for="item in navItems"
        :key="item.key"
        class="flex items-center rounded-md transition-colors"
        :class="[
          collapsed ? 'justify-center w-full h-8' : 'flex-1 flex-col gap-0.5 px-1 py-1.5 text-[10px] font-medium',
          activeNav === item.key ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover',
        ]"
        :title="item.label"
        @click="item.key === 'settings' ? navigateToSettings() : (activeNav = item.key)"
      >
        <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" v-html="item.icon" />
        <span v-if="!collapsed" class="truncate leading-none mt-0.5">{{ item.label }}</span>
      </button>
    </nav>

    <!-- Content area (hidden when collapsed) -->
    <div v-if="!collapsed" class="flex-1 overflow-y-auto px-1.5 py-1.5 space-y-0.5">
      <!-- Collections -->
      <template v-if="activeNav === 'collections'">
        <div v-if="workspace.loading" class="flex items-center gap-2 px-2 py-3 text-xs text-text-secondary">
          <div class="w-3 h-3 border-2 border-border-light border-t-accent rounded-full animate-spin" />
          Loading...
        </div>
        <div v-else-if="workspace.error" class="px-2 py-3 text-xs text-destructive">
          {{ workspace.error }}
        </div>
        <template v-else>
          <div v-if="workspace.collections.length === 0" class="px-2 py-4 text-xs text-text-muted text-center italic">
            No collections.<br/>Import from Postman.
          </div>
          <div
            v-for="col in workspace.collections"
            :key="col.id"
            class="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors cursor-pointer group"
            @click="goHome"
          >
            <svg class="w-3.5 h-3.5 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2 3h20v18H2z"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h8M8 11h6M8 15h4"/>
            </svg>
            <span class="truncate">{{ col.name }}</span>
          </div>
        </template>
      </template>

      <!-- History — Tree View (domain-grouped) -->
      <template v-if="activeNav === 'history'">
        <div v-if="history.tree.length === 0" class="px-2 py-4 text-xs text-text-muted text-center italic">
          No request history yet.
        </div>

        <!-- Recursive tree rendering -->
        <div v-for="node in history.tree" :key="node.fullPath" class="space-y-0.5">
          <!-- Domain node -->
          <div
            class="flex items-center gap-1 px-1 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors hover:bg-surface-hover"
            :class="history.isExpanded(node.fullPath) ? 'text-text-primary' : 'text-text-muted'"
            @click="history.toggleNode(node.fullPath)"
          >
            <svg
              class="w-3 h-3 shrink-0 transition-transform"
              :class="history.isExpanded(node.fullPath) ? 'rotate-90' : ''"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
            <svg class="w-3.5 h-3.5 shrink-0 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/>
            </svg>
            <span class="truncate">{{ node.name }}</span>
            <span class="ml-auto text-[10px] text-text-muted">{{ countEntries(node) }}</span>
          </div>

          <!-- Children (sub-path nodes) -->
          <div v-if="history.isExpanded(node.fullPath)" class="ml-3 space-y-0.5 border-l border-border pl-1.5">
            <div v-for="child in node.children" :key="child.fullPath" class="space-y-0.5">
              <div
                class="flex items-center gap-1 px-1 py-1 rounded-md text-[11px] cursor-pointer transition-colors hover:bg-surface-hover"
                :class="history.isExpanded(child.fullPath) ? 'text-text-secondary' : 'text-text-muted'"
                @click="history.toggleNode(child.fullPath)"
              >
                <svg
                  class="w-2.5 h-2.5 shrink-0 transition-transform"
                  :class="history.isExpanded(child.fullPath) ? 'rotate-90' : ''"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
                <span class="truncate">/{{ child.name }}</span>
              </div>

              <!-- Leaf entries under child -->
              <div v-if="history.isExpanded(child.fullPath)" class="ml-3 space-y-0.5">
                <div
                  v-for="entry in child.entries"
                  :key="entry.id"
                  class="flex items-center gap-1.5 px-1.5 py-1 rounded-md hover:bg-surface-hover transition-colors cursor-pointer group"
                  @click="loadFromHistory(entry)"
                >
                  <span
                    class="text-[9px] font-semibold font-mono uppercase shrink-0"
                    :class="{
                      'text-method-get': entry.method === 'GET',
                      'text-method-post': entry.method === 'POST',
                      'text-method-put': entry.method === 'PUT',
                      'text-method-patch': entry.method === 'PATCH',
                      'text-method-delete': entry.method === 'DELETE',
                      'text-method-head': entry.method === 'HEAD',
                      'text-method-options': entry.method === 'OPTIONS',
                    }"
                  >
                    {{ entry.method }}
                  </span>
                  <span class="text-[11px] text-text-secondary truncate min-w-0">{{ entry.url.replace(/^https?:\/\/[^/]+/, '') || '/' }}</span>
                  <button
                    class="shrink-0 opacity-0 group-hover:opacity-100 text-text-muted hover:text-destructive transition-all ml-auto"
                    title="Remove"
                    @click.stop="history.remove(entry.id)"
                  >
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- Direct entries on domain (no path subfolder) -->
            <div
              v-for="entry in node.entries"
              :key="entry.id"
              class="flex items-center gap-1.5 px-1.5 py-1 rounded-md hover:bg-surface-hover transition-colors cursor-pointer group"
              @click="loadFromHistory(entry)"
            >
              <span
                class="text-[9px] font-semibold font-mono uppercase shrink-0"
                :class="{
                  'text-method-get': entry.method === 'GET',
                  'text-method-post': entry.method === 'POST',
                  'text-method-put': entry.method === 'PUT',
                  'text-method-patch': entry.method === 'PATCH',
                  'text-method-delete': entry.method === 'DELETE',
                  'text-method-head': entry.method === 'HEAD',
                  'text-method-options': entry.method === 'OPTIONS',
                }"
              >
                {{ entry.method }}
              </span>
              <span class="text-[11px] text-text-secondary truncate min-w-0">{{ entry.url.replace(/^https?:\/\/[^/]+/, '') || '/' }}</span>
              <button
                class="shrink-0 opacity-0 group-hover:opacity-100 text-text-muted hover:text-destructive transition-all ml-auto"
                title="Remove"
                @click.stop="history.remove(entry.id)"
              >
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <button
          v-if="history.sorted.length > 0"
          class="w-full mt-1 px-2 py-1 text-[10px] text-text-muted hover:text-text-secondary transition-colors text-center"
          @click="history.clear()"
        >
          Clear history
        </button>
      </template>

      <!-- Environments -->
      <template v-if="activeNav === 'environments'">
        <div class="px-2 py-4 text-xs text-text-muted text-center italic">
          No environments configured.
        </div>
      </template>

      <!-- Settings placeholder (when active but not navigated) -->
      <template v-if="activeNav === 'settings'">
        <div class="px-2 py-4 text-xs text-text-muted text-center italic">
          Settings page loaded in main panel.
        </div>
      </template>
    </div>
  </aside>
</template>
