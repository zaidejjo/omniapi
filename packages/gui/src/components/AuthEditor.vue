<script setup lang="ts">
import type { AuthConfig } from '@omniapi/core'

const props = defineProps<{
  auth: AuthConfig
}>()

const emit = defineEmits<{
  'update:auth': [value: AuthConfig]
}>()

const authTypes: { value: AuthConfig['type']; label: string }[] = [
  { value: 'none', label: 'No Auth' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'api-key', label: 'API Key' },
]

function setType(type: AuthConfig['type']) {
  emit('update:auth', { type, data: {} })
}

function setDataField(key: string, value: string) {
  emit('update:auth', { ...props.auth, data: { ...props.auth.data, [key]: value } })
}
</script>

<template>
  <div class="space-y-4">
    <!-- Auth type selector as pills -->
    <div class="flex items-center gap-2 flex-wrap">
      <button
        v-for="at in authTypes"
        :key="at.value"
        class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
        :class="auth.type === at.value
          ? 'bg-accent/15 text-accent border border-accent/30'
          : 'text-text-muted border border-transparent hover:text-text-secondary hover:bg-surface-hover'"
        @click="setType(at.value)"
      >
        {{ at.label }}
      </button>
    </div>

    <!-- Bearer Token -->
    <div v-if="auth.type === 'bearer'" class="space-y-2">
      <label class="text-xs font-medium text-text-secondary">Token</label>
      <input
        :value="auth.data['token'] ?? ''"
        type="password"
        class="w-full rounded-lg border border-border bg-bg px-3 py-2 text-xs font-mono text-text-primary placeholder-text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
        placeholder="Enter your bearer token"
        @input="setDataField('token', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Basic Auth -->
    <div v-if="auth.type === 'basic'" class="space-y-3">
      <div class="space-y-2">
        <label class="text-xs font-medium text-text-secondary">Username</label>
        <input
          :value="auth.data['username'] ?? ''"
          class="w-full rounded-lg border border-border bg-bg px-3 py-2 text-xs font-mono text-text-primary placeholder-text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
          placeholder="username"
          @input="setDataField('username', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="space-y-2">
        <label class="text-xs font-medium text-text-secondary">Password</label>
        <input
          :value="auth.data['password'] ?? ''"
          type="password"
          class="w-full rounded-lg border border-border bg-bg px-3 py-2 text-xs font-mono text-text-primary placeholder-text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
          placeholder="••••••••"
          @input="setDataField('password', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>

    <!-- API Key -->
    <div v-if="auth.type === 'api-key'" class="space-y-3">
      <div class="space-y-2">
        <label class="text-xs font-medium text-text-secondary">Key</label>
        <input
          :value="auth.data['key'] ?? ''"
          class="w-full rounded-lg border border-border bg-bg px-3 py-2 text-xs font-mono text-text-primary placeholder-text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
          placeholder="X-API-Key"
          @input="setDataField('key', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="space-y-2">
        <label class="text-xs font-medium text-text-secondary">Value</label>
        <input
          :value="auth.data['value'] ?? ''"
          type="password"
          class="w-full rounded-lg border border-border bg-bg px-3 py-2 text-xs font-mono text-text-primary placeholder-text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
          placeholder="your-api-key"
          @input="setDataField('value', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="space-y-2">
        <label class="text-xs font-medium text-text-secondary">Location</label>
        <select
          :value="auth.data['in'] ?? 'header'"
          class="w-full rounded-lg border border-border bg-bg px-3 py-2 text-xs font-mono text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
          @change="setDataField('in', ($event.target as HTMLSelectElement).value)"
        >
          <option value="header" class="bg-surface text-text-primary">Header</option>
          <option value="query" class="bg-surface text-text-primary">Query Parameter</option>
        </select>
      </div>
    </div>

    <!-- None -->
    <div v-if="auth.type === 'none'" class="text-xs text-text-muted py-2 italic">
      No authentication configured.
    </div>
  </div>
</template>
