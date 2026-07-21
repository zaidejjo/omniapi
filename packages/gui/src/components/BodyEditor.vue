<script setup lang="ts">
import type { RequestConfig } from '@omniapi/core'

const props = defineProps<{
  bodyType: RequestConfig['bodyType']
  body: string | undefined
}>()

const emit = defineEmits<{
  'update:bodyType': [value: RequestConfig['bodyType']]
  'update:body': [value: string]
}>()

const bodyTypes: { value: RequestConfig['bodyType']; label: string }[] = [
  { value: 'none', label: 'none' },
  { value: 'json', label: 'JSON' },
  { value: 'x-www-form-urlencoded', label: 'Form URL-encoded' },
  { value: 'form-data', label: 'Multipart Form' },
  { value: 'binary', label: 'Binary' },
]
</script>

<template>
  <div class="space-y-3">
    <!-- Body type selector -->
    <div class="flex items-center gap-2 flex-wrap">
      <button
        v-for="bt in bodyTypes"
        :key="bt.value"
        class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
        :class="bodyType === bt.value
          ? 'bg-accent/15 text-accent border border-accent/30'
          : 'text-text-muted border border-transparent hover:text-text-secondary hover:bg-surface-hover'"
        @click="emit('update:bodyType', bt.value!)"
      >
        {{ bt.label }}
      </button>
    </div>

    <!-- JSON / Raw editor -->
    <textarea
      v-if="bodyType && bodyType !== 'none'"
      :value="body ?? ''"
      class="w-full h-64 rounded-lg border border-border bg-bg px-3 py-2.5 text-xs font-mono text-text-primary placeholder-text-muted resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
      placeholder="Request body..."
      spellcheck="false"
      @input="emit('update:body', ($event.target as HTMLTextAreaElement).value)"
    />

    <div v-else class="text-xs text-text-muted py-6 text-center italic">
      This request has no body.
    </div>
  </div>
</template>
