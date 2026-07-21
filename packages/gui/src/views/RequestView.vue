<script setup lang="ts">
import { ref } from 'vue'
import UrlBar from '../components/UrlBar.vue'
import RequestTabs from '../components/RequestTabs.vue'
import ResponsePanel from '../components/ResponsePanel.vue'
import SplitterBar from '../components/SplitterBar.vue'
import { useRequestStore } from '../stores/request'

const store = useRequestStore()
const splitPercent = ref(50) // 50% split between request/response
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- URL Bar -->
    <UrlBar />

    <!-- Divider between URL bar and body -->
    <div class="border-b border-border shrink-0" />

    <!-- Split: Request config (top) / Response (bottom) with draggable splitter -->
    <div class="flex flex-col flex-1 min-h-0">
      <!-- Request config tabs -->
      <div
        class="flex flex-col min-h-0"
        :style="store.response ? { flexBasis: splitPercent + '%' } : { flex: '1 1 0%' }"
      >
        <RequestTabs />
      </div>

      <!-- Vertical splitter (only when response exists) -->
      <SplitterBar
        v-if="store.response"
        direction="vertical"
        :min="20"
        :max="80"
        :model-value="splitPercent"
        @update:model-value="splitPercent = $event"
      />

      <!-- Response panel -->
      <ResponsePanel />
    </div>
  </div>
</template>
