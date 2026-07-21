<script setup lang="ts">
import { computed } from 'vue'
import { useRequestStore } from '../stores/request'
import KeyValueEditor from './KeyValueEditor.vue'
import BodyEditor from './BodyEditor.vue'
import AuthEditor from './AuthEditor.vue'

const store = useRequestStore()

const tabs = [
  { key: 'params', label: 'Params' },
  { key: 'headers', label: 'Headers' },
  { key: 'body', label: 'Body' },
  { key: 'auth', label: 'Auth' },
] as const

const activeTab = computed(() => store.activeTab)

function setTab(tab: 'params' | 'headers' | 'body' | 'auth') {
  store.setActiveTab(tab)
}
</script>

<template>
  <div class="flex flex-col flex-1 min-h-0">
    <!-- Tab bar -->
    <div class="flex items-center border-b border-border px-1 gap-0">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-[1px]"
        :class="activeTab === tab.key
          ? 'border-accent text-text-primary'
          : 'border-transparent text-text-muted hover:text-text-secondary hover:border-border-light'"
        @click="setTab(tab.key)"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab content -->
    <div class="flex-1 overflow-y-auto p-3">
      <!-- Params -->
      <div v-if="activeTab === 'params'" class="space-y-3">
        <KeyValueEditor
          :model-value="store.config.queryParams"
          name="Query parameters"
          @update:model-value="store.config.queryParams = $event"
        />
      </div>

      <!-- Headers -->
      <div v-if="activeTab === 'headers'" class="space-y-3">
        <KeyValueEditor
          :model-value="store.config.headers"
          name="Headers"
          @update:model-value="store.config.headers = $event"
        />
      </div>

      <!-- Body -->
      <div v-if="activeTab === 'body'">
        <BodyEditor
          :body-type="store.config.bodyType"
          :body="store.config.body"
          @update:body-type="store.setBodyType"
          @update:body="store.setBody"
        />
      </div>

      <!-- Auth -->
      <div v-if="activeTab === 'auth'">
        <AuthEditor
          :auth="store.config.auth"
          @update:auth="store.setAuth"
        />
      </div>
    </div>
  </div>
</template>
