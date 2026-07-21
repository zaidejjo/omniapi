<script setup lang="ts">
import type { KeyValue } from '@omniapi/core'

const props = defineProps<{
  modelValue: KeyValue[]
  name?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: KeyValue[]]
}>()

function update(index: number, field: 'key' | 'value', val: string) {
  const updated = [...props.modelValue] as KeyValue[]
  const existing = updated[index]!
  updated[index] = { ...existing, [field]: val } as KeyValue
  emit('update:modelValue', updated)
}

function toggle(index: number) {
  const updated = [...props.modelValue] as KeyValue[]
  const existing = updated[index]!
  updated[index] = { ...existing, enabled: !existing.enabled } as KeyValue
  emit('update:modelValue', updated)
}

function remove(index: number) {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index))
}

function addRow() {
  emit('update:modelValue', [
    ...props.modelValue,
    { key: '', value: '', enabled: true } as KeyValue,
  ])
}
</script>

<template>
  <div class="space-y-0">
    <!-- Header row -->
    <div class="flex items-center gap-1 px-1 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-text-muted">
      <span class="w-6" />
      <span class="flex-1 pl-1">Key</span>
      <span class="flex-1 pl-1">Value</span>
      <span class="w-8" />
    </div>

    <!-- Rows -->
    <div v-if="modelValue.length === 0" class="text-xs text-text-muted py-3 text-center italic">
      {{ name ?? 'No items' }}. Click + to add.
    </div>

    <div v-for="(row, i) in modelValue" :key="i" class="group flex items-center gap-1 -mx-1 px-1 rounded-md hover:bg-surface-hover transition-colors">
      <!-- Enabled toggle -->
      <button
        class="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-hover transition-colors shrink-0"
        :title="row.enabled ? 'Disable' : 'Enable'"
        @click="toggle(i)"
      >
        <div
          class="w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-colors"
          :class="row.enabled ? 'bg-accent border-accent' : 'border-border-light'"
        >
          <svg v-if="row.enabled" class="w-2.5 h-2.5 text-text-inverse" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
          </svg>
        </div>
      </button>

      <!-- Key input -->
      <input
        :value="row.key"
        class="flex-1 min-w-0 bg-transparent border border-transparent hover:border-border-light focus:border-border-light rounded px-2 py-1.5 text-xs font-mono text-text-primary placeholder-text-muted transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        placeholder="Key"
        @input="update(i, 'key', ($event.target as HTMLInputElement).value)"
      />

      <!-- Value input -->
      <input
        :value="row.value"
        class="flex-1 min-w-0 bg-transparent border border-transparent hover:border-border-light focus:border-border-light rounded px-2 py-1.5 text-xs font-mono text-text-primary placeholder-text-muted transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        placeholder="Value"
        @input="update(i, 'value', ($event.target as HTMLInputElement).value)"
      />

      <!-- Remove button -->
      <button
        class="w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive text-text-muted transition-all shrink-0"
        title="Remove"
        @click="remove(i)"
      >
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- Add button -->
    <button
      class="flex items-center gap-1.5 mt-1 px-1.5 py-1 text-xs text-text-muted hover:text-text-secondary transition-colors rounded hover:bg-surface-hover"
      @click="addRow"
    >
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
      </svg>
      Add
    </button>
  </div>
</template>
