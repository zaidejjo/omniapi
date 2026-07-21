<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRequestStore } from '../stores/request'
import JsonViewer from './JsonViewer.vue'

const store = useRequestStore()

type ResponseTab = 'body' | 'headers' | 'raw'
const activeTab = ref<ResponseTab>('body')

const statusClass = computed(() => {
  if (!store.response) return ''
  const s = store.response.status
  if (s >= 200 && s < 300) return 'text-success'
  if (s >= 300 && s < 400) return 'text-warning'
  if (s >= 400) return 'text-destructive'
  return 'text-zinc-400'
})

const headerEntries = computed(() => {
  if (!store.response) return []
  return Object.entries(store.response.headers)
})
</script>

<template>
  <div
    class="border-t border-border bg-surface flex flex-col min-h-0"
    :style="store.response ? { flex: '1 1 0%' } : { flex: '0 0 auto' }"
  >
    <!-- Empty / loading state -->
    <div v-if="!store.response && !store.error && !store.loading" class="flex items-center justify-center flex-1 p-8">
      <div class="text-center">
        <svg class="w-8 h-8 mx-auto text-text-muted mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p class="text-sm text-text-muted">Enter a URL and click Send</p>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="store.loading" class="flex items-center justify-center flex-1 p-8">
      <div class="flex items-center gap-3 text-sm text-text-secondary">
        <div class="w-4 h-4 border-2 border-border-light border-t-accent rounded-full animate-spin" />
        Sending request...
      </div>
    </div>

    <!-- Error -->
    <div v-if="store.error && !store.loading" class="p-4">
      <div class="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
        <div class="flex items-center gap-2 text-sm font-medium text-destructive mb-1">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          Error
        </div>
        <pre class="text-xs text-destructive/80 font-mono whitespace-pre-wrap">{{ store.error }}</pre>
      </div>
    </div>

    <!-- Response -->
    <template v-if="store.response">
      <!-- Status bar -->
      <div class="flex items-center gap-4 px-4 py-2 border-b border-border bg-surface-elevated shrink-0">
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium uppercase tracking-wider text-text-muted">Status:</span>
          <span
            class="text-sm font-bold font-mono"
            :class="statusClass"
          >
            {{ store.response.status }} {{ store.response.statusText }}
          </span>
        </div>
        <div class="flex items-center gap-2" v-if="store.response.durationMs">
          <span class="text-xs font-medium uppercase tracking-wider text-text-muted">Duration:</span>
          <span class="text-xs font-mono text-text-primary">{{ store.response.durationMs.toFixed(0) }}ms</span>
        </div>
        <div class="flex items-center gap-2" v-if="store.response.size">
          <span class="text-xs font-medium uppercase tracking-wider text-text-muted">Size:</span>
          <span class="text-xs font-mono text-text-primary">{{ (store.response.size / 1024).toFixed(2) }} KB</span>
        </div>
      </div>

      <!-- Response tabs -->
      <div class="flex items-center border-b border-border px-1 gap-0 shrink-0">
        <button
          class="px-3 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-[1px]"
          :class="activeTab === 'body'
            ? 'border-accent text-text-primary'
            : 'border-transparent text-text-muted hover:text-text-secondary hover:border-border-light'"
          @click="activeTab = 'body'"
        >
          Response Body
        </button>
        <button
          class="px-3 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-[1px]"
          :class="activeTab === 'headers'
            ? 'border-accent text-text-primary'
            : 'border-transparent text-text-muted hover:text-text-secondary hover:border-border-light'"
          @click="activeTab = 'headers'"
        >
          Headers
        </button>
        <button
          class="px-3 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-[1px]"
          :class="activeTab === 'raw'
            ? 'border-accent text-text-primary'
            : 'border-transparent text-text-muted hover:text-text-secondary hover:border-border-light'"
          @click="activeTab = 'raw'"
        >
          Raw
        </button>
      </div>

      <!-- Tab content -->
      <div class="flex-1 overflow-y-auto">
        <!-- Body with JSON viewer -->
        <div v-if="activeTab === 'body'" class="p-3">
          <JsonViewer :body="store.response.body" />
        </div>

        <!-- Response Headers table -->
        <div v-if="activeTab === 'headers'" class="p-3">
          <div v-if="headerEntries.length === 0" class="text-xs text-text-muted text-center py-6 italic">
            No response headers.
          </div>
          <div class="space-y-0.5">
            <div
              v-for="[key, value] in headerEntries"
              :key="key"
              class="flex items-start gap-3 px-2 py-1 rounded text-xs font-mono hover:bg-surface-hover"
            >
              <span class="text-info font-medium whitespace-nowrap shrink-0">{{ key }}:</span>
              <span class="text-text-secondary break-all min-w-0">{{ value }}</span>
            </div>
          </div>
        </div>

        <!-- Raw body -->
        <div v-if="activeTab === 'raw'" class="p-3">
          <pre class="rounded-lg border border-border bg-bg p-4 overflow-auto max-h-[55vh] text-xs font-mono text-text-secondary whitespace-pre-wrap break-all">{{ store.response.body }}</pre>
        </div>
      </div>
    </template>
  </div>
</template>
