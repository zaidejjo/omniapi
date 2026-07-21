<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  direction: 'horizontal' | 'vertical'
  min?: number
  max?: number
  modelValue: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const dragging = ref(false)
const frameId = ref(0)

/** Apply/remove inert state on sibling panels for butter-smooth drag */
function lockSiblings(lock: boolean) {
  const el = splitterRef.value
  if (!el) return
  const parent = el.parentElement
  if (!parent) return
  for (const child of parent.children) {
    if (child !== el) {
      (child as HTMLElement).style.pointerEvents = lock ? 'none' : ''
    }
  }
}

const splitterRef = ref<HTMLElement | null>(null)

function onMouseDown(e: MouseEvent) {
  e.preventDefault()
  dragging.value = true
  lockSiblings(true)
  document.body.style.cursor = props.direction === 'vertical' ? 'row-resize' : 'col-resize'
  document.body.style.userSelect = 'none'
}

function onMouseMove(e: MouseEvent) {
  if (!dragging.value) return
  // RAF throttle
  if (frameId.value) cancelAnimationFrame(frameId.value)
  frameId.value = requestAnimationFrame(() => {
    frameId.value = 0
    computeSplit(e)
  })
}

function computeSplit(e: MouseEvent) {
  const parent = splitterRef.value?.parentElement
  if (!parent) return
  const rect = parent.getBoundingClientRect()
  let value: number

  if (props.direction === 'vertical') {
    value = ((e.clientY - rect.top) / rect.height) * 100
  } else {
    value = ((e.clientX - rect.left) / rect.width) * 100
  }

  const min = props.min ?? 15
  const max = props.max ?? 85
  value = Math.max(min, Math.min(max, value))
  emit('update:modelValue', value)
}

function onMouseUp() {
  if (dragging.value) {
    dragging.value = false
    lockSiblings(false)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    if (frameId.value) {
      cancelAnimationFrame(frameId.value)
      frameId.value = 0
    }
  }
}

onMounted(() => {
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  if (frameId.value) cancelAnimationFrame(frameId.value)
})
</script>

<template>
  <div
    ref="splitterRef"
    class="relative group shrink-0 z-10"
    :class="direction === 'vertical'
      ? 'h-1.5 cursor-row-resize -my-[1px]'
      : 'w-1.5 cursor-col-resize -mx-[1px]'"
    @mousedown="onMouseDown"
  >
    <!-- Wider invisible hit area for easier grabbing -->
    <div
      class="absolute inset-0 -inset-x-1 -inset-y-1"
      :class="direction === 'vertical' ? '-inset-y-1' : '-inset-x-1'"
    />
    <!-- Visual indicator bar -->
    <div
      class="absolute inset-0 transition-opacity pointer-events-none"
      :class="dragging ? 'opacity-100 bg-accent/25' : 'opacity-0 group-hover:opacity-100'"
    >
      <div
        class="absolute bg-accent/60 rounded-full"
        :class="direction === 'vertical'
          ? 'left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-8 h-0.5'
          : 'top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-0.5 h-8'"
      />
    </div>
  </div>
</template>
