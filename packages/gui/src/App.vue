<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useWorkspaceStore } from './stores/workspace'
import AppSidebar from './components/AppSidebar.vue'
import SplitterBar from './components/SplitterBar.vue'

const workspace = useWorkspaceStore()

// Sidebar state
const sidebarCollapsed = ref(false)
const sidebarPercent = ref(20) // 20% of viewport width

// Fire-and-forget init — UI renders immediately, sidebar shows loading
onMounted(() => {
  workspace.initialize()
})

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}
</script>

<template>
  <div class="flex h-dvh bg-bg text-text-primary overflow-hidden select-none">
    <!-- Sidebar -->
    <AppSidebar
      :collapsed="sidebarCollapsed"
      :style="sidebarCollapsed ? { width: '48px' } : { flexBasis: sidebarPercent + '%' }"
      :class="sidebarCollapsed ? 'w-12' : ''"
      @toggle="toggleSidebar"
    />

    <!-- Sidebar splitter (when expanded) -->
    <SplitterBar
      v-if="!sidebarCollapsed"
      direction="horizontal"
      :min="15"
      :max="35"
      :model-value="sidebarPercent"
      @update:model-value="sidebarPercent = $event"
    />

    <!-- Main content area -->
    <main class="flex-1 flex flex-col min-w-0">
      <router-view />
    </main>
  </div>
</template>
