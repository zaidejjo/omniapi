<script setup lang="ts">
import type { HttpMethod } from '@omniapi/core'

defineProps<{
  modelValue: HttpMethod
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: HttpMethod]
}>()

const methods: { value: HttpMethod; label: string; color: string }[] = [
  { value: 'GET',     label: 'GET',    color: 'text-method-get bg-method-get-bg' },
  { value: 'POST',    label: 'POST',   color: 'text-method-post bg-method-post-bg' },
  { value: 'PUT',     label: 'PUT',    color: 'text-method-put bg-method-put-bg' },
  { value: 'PATCH',   label: 'PATCH',  color: 'text-method-patch bg-method-patch-bg' },
  { value: 'DELETE',  label: 'DELETE', color: 'text-method-delete bg-method-delete-bg' },
  { value: 'HEAD',    label: 'HEAD',   color: 'text-method-head bg-method-head-bg' },
  { value: 'OPTIONS', label: 'OPTIONS',color: 'text-method-options bg-method-options-bg' },
]
</script>

<template>
  <div class="relative">
    <select
      :value="modelValue"
      :disabled="disabled"
      class="appearance-none rounded-lg px-3 py-2 pr-8 text-xs font-mono font-semibold border border-border bg-surface hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      :class="methods.find(m => m.value === modelValue)?.color ?? 'text-text-primary'"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value as HttpMethod)"
    >
      <option v-for="m in methods" :key="m.value" :value="m.value" class="bg-surface text-text-primary">
        {{ m.label }}
      </option>
    </select>
    <svg
      class="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-text-muted"
      fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/>
    </svg>
  </div>
</template>
