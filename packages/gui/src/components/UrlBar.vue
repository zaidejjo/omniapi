<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRequestStore } from '../stores/request'
import { useHistoryStore } from '../stores/history'
import { useWorkspaceStore } from '../stores/workspace'
import HttpMethodSelect from './HttpMethodSelect.vue'

const store = useRequestStore()
const history = useHistoryStore()
const workspace = useWorkspaceStore()

const inputRef = ref<HTMLInputElement | null>(null)
const showSuggestions = ref(false)
const selectedSuggestion = ref(-1)

/** Build suggestions from history + collections */
const suggestions = computed(() => {
  const parts: { url: string; method: string; label: string }[] = []

  // From history (deduplicate, most recent first)
  const seen = new Set<string>()
  for (const entry of history.sorted) {
    const key = `${entry.method} ${entry.url}`
    if (seen.has(key)) continue
    seen.add(key)
    if (parts.length >= 10) break
    parts.push({ url: entry.url, method: entry.method, label: entry.url })
  }

  // From collections if available
  if (workspace.collections.length > 0 && parts.length < 15) {
    // We don't have individual requests from collections in the store
    // Let's at least show collection names as search hints
  }

  return parts
})

const filteredSuggestions = computed(() => {
  const query = store.config.url.toLowerCase().trim()
  if (!query || query.length < 1) return suggestions.value.slice(0, 8)
  return suggestions.value.filter(s =>
    s.url.toLowerCase().includes(query),
  ).slice(0, 8)
})

function onInput(e: Event) {
  const val = (e.target as HTMLInputElement).value
  store.setUrl(val)
  showSuggestions.value = true
  selectedSuggestion.value = -1
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedSuggestion.value = Math.min(
      selectedSuggestion.value + 1,
      filteredSuggestions.value.length - 1,
    )
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedSuggestion.value = Math.max(selectedSuggestion.value - 1, 0)
  } else if (e.key === 'Enter') {
    const sel = filteredSuggestions.value[selectedSuggestion.value]
    if (selectedSuggestion.value >= 0 && sel) {
      store.setUrl(sel.url)
      store.setMethod(sel.method as any)
      showSuggestions.value = false
      selectedSuggestion.value = -1
    }
    store.send()
  } else if (e.key === 'Escape') {
    showSuggestions.value = false
    selectedSuggestion.value = -1
  }
}

function selectSuggestion(s: { url: string; method: string }) {
  store.setUrl(s.url)
  store.setMethod(s.method as any)
  showSuggestions.value = false
  selectedSuggestion.value = -1
  inputRef.value?.focus()
}

function onFocus() {
  if (store.config.url.length > 0) {
    showSuggestions.value = true
  }
}

function onBlur() {
  // Delay so click on suggestion registers first
  setTimeout(() => { showSuggestions.value = false }, 200)
}
</script>

<template>
  <div class="flex items-center gap-2 px-4 py-3 shrink-0">
    <!-- HTTP Method -->
    <HttpMethodSelect
      :model-value="store.config.method"
      :disabled="store.loading"
      @update:model-value="store.setMethod($event)"
    />

    <!-- URL Input with suggestion dropdown -->
    <div class="flex-1 relative">
      <input
        ref="inputRef"
        :value="store.config.url"
        type="text"
        class="w-full rounded-lg border border-border bg-surface px-3 py-2 pr-10 text-xs font-mono text-text-primary placeholder-text-muted transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        placeholder="https://api.example.com/endpoint"
        spellcheck="false"
        autofocus
        autocomplete="off"
        @input="onInput"
        @keydown="onKeyDown"
        @focus="onFocus"
        @blur="onBlur"
      />

      <!-- Clear button -->
      <button
        v-if="store.config.url"
        class="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
        @click="store.setUrl('')"
      >
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>

      <!-- Suggestion dropdown -->
      <div
        v-if="showSuggestions && filteredSuggestions.length > 0"
        class="absolute left-0 right-0 top-full mt-1 rounded-lg border border-border bg-surface-elevated shadow-xl shadow-black/40 z-50 overflow-hidden"
      >
        <div
          v-for="(s, i) in filteredSuggestions"
          :key="i"
          class="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors"
          :class="i === selectedSuggestion
            ? 'bg-accent/15 text-accent'
            : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'"
          @mousedown.prevent="selectSuggestion(s)"
        >
          <span
            class="text-[10px] font-semibold font-mono uppercase shrink-0"
            :class="{
              'text-method-get': s.method === 'GET',
              'text-method-post': s.method === 'POST',
              'text-method-put': s.method === 'PUT',
              'text-method-patch': s.method === 'PATCH',
              'text-method-delete': s.method === 'DELETE',
              'text-method-head': s.method === 'HEAD',
              'text-method-options': s.method === 'OPTIONS',
            }"
          >
            {{ s.method }}
          </span>
          <span class="text-xs truncate min-w-0">{{ s.url }}</span>
        </div>
      </div>
    </div>

    <!-- Send button -->
    <button
      class="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      :class="store.loading
        ? 'bg-accent/20 text-accent cursor-wait'
        : store.config.url
          ? 'bg-accent text-text-inverse hover:bg-accent-hover active:scale-[0.97]'
          : 'bg-surface-hover text-text-muted cursor-not-allowed'"
      :disabled="!store.config.url || store.loading"
      @click="store.send()"
    >
      <svg v-if="store.loading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      {{ store.loading ? 'Sending...' : 'Send' }}
    </button>
  </div>
</template>
