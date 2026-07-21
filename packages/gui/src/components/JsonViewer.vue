<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  body: string
}>()

const MAX_DISPLAY_SIZE = 512 * 1024
const MAX_LINES = 5000

const truncated = ref(false)
const showFull = ref(false)

interface Token {
  text: string
  cls?: string
}

interface Line {
  indent: number
  tokens: Token[]
}

const payload = computed(() => {
  if (!showFull.value && props.body.length > MAX_DISPLAY_SIZE) {
    truncated.value = true
    return props.body.slice(0, MAX_DISPLAY_SIZE) + '\n...'
  }
  truncated.value = false
  return props.body
})

const lines = computed<Line[]>(() => {
  try {
    const parsed = JSON.parse(payload.value)
    const formatted = JSON.stringify(parsed, null, 2)
    return fastTokenize(formatted).slice(0, MAX_LINES)
  } catch {
    const raw = payload.value
    return raw.split('\n').slice(0, MAX_LINES).map(line => ({
      indent: 0,
      tokens: [{ text: line }],
    }))
  }
})

const totalLines = computed(() => lines.value.length)
const exceededLines = computed(() => totalLines.value >= MAX_LINES)
const previewSize = computed(() => {
  if (!truncated.value && !exceededLines.value) return null
  return `${(props.body.length / 1024).toFixed(1)} KB`
})

watch(() => props.body, () => {
  showFull.value = false
  truncated.value = false
})

function revealFull() { showFull.value = true }

/**
 * Fast single-pass tokenizer — O(n) per line, no nested loops,
 * uses index scanning instead of regex backtracking for strings.
 */
function fastTokenize(json: string): Line[] {
  const rawLines = json.split('\n')
  const result: Line[] = new Array(rawLines.length)

  for (let li = 0; li < rawLines.length; li++) {
    const raw = rawLines[li]!
    const trimmed = raw.trimStart()
    const indent = raw.length - trimmed.length
    const tokens: Token[] = []
    let i = 0

    while (i < trimmed.length) {
      const ch = trimmed[i]!

      // String
      if (ch === '"') {
        const start = i
        i++ // skip opening quote
        while (i < trimmed.length) {
          if (trimmed[i] === '\\') { i += 2; continue }
          if (trimmed[i] === '"') break
          i++
        }
        i++ // skip closing quote
        const str = trimmed.slice(start, i)
        // Check if key (followed by colon)
        const after = trimmed.slice(i).trimStart()
        const firstAfter = after[0] ?? ''
        tokens.push({
          text: str,
          cls: firstAfter === ':' ? 'json-key' : 'json-string',
        })
        continue
      }

      // Number
      if (/[\d-]/.test(ch)) {
        const start = i
        i++
        while (i < trimmed.length && /[\d.eE+\-]/.test(trimmed[i]!)) i++
        tokens.push({ text: trimmed.slice(start, i), cls: 'json-number' })
        continue
      }

      // Booleans & null
      if (trimmed.startsWith('true', i)) {
        tokens.push({ text: 'true', cls: 'json-boolean' }); i += 4; continue
      }
      if (trimmed.startsWith('false', i)) {
        tokens.push({ text: 'false', cls: 'json-boolean' }); i += 5; continue
      }
      if (trimmed.startsWith('null', i)) {
        tokens.push({ text: 'null', cls: 'json-null' }); i += 4; continue
      }

      // Structural
      if ('{}[]'.includes(ch)) {
        tokens.push({ text: ch, cls: 'json-brace' }); i++; continue
      }
      if (ch === ':') {
        tokens.push({ text: ': ', cls: 'json-colon' }); i++; continue
      }
      if (ch === ',') {
        tokens.push({ text: ',', cls: 'json-comma' }); i++; continue
      }

      // Whitespace
      if (/\s/.test(ch)) { i++; continue }

      // Fallback
      tokens.push({ text: ch }); i++
    }

    result[li] = { indent, tokens }
  }

  return result
}

function copyToClipboard() {
  try { void navigator.clipboard.writeText(props.body) } catch { /* ignore */ }
}
</script>

<template>
  <div class="relative">
    <!-- Toolbar -->
    <div class="flex items-center justify-between mb-2">
      <div v-if="previewSize" class="text-[10px] text-text-muted">
        {{ previewSize }} total
        <button
          v-if="!showFull"
          class="ml-1 text-accent hover:text-accent-hover underline transition-colors"
          @click="revealFull"
        >
          Show all
        </button>
      </div>
      <div v-else />
      <button
        class="px-2 py-1 rounded-md text-xs font-medium bg-surface-hover text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
        @click="copyToClipboard"
      >
        Copy
      </button>
    </div>

    <!-- Truncation warning -->
    <div
      v-if="truncated && !showFull"
      class="mb-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning"
    >
      Response truncated to {{ (MAX_DISPLAY_SIZE / 1024).toFixed(0) }}KB.
      <button class="ml-1 underline hover:no-underline" @click="revealFull">Show full response</button>.
    </div>

    <div
      v-if="exceededLines"
      class="mb-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning"
    >
      Showing {{ MAX_LINES.toLocaleString() }} of {{ totalLines.toLocaleString() }} lines.
    </div>

    <!-- JSON lines — white-space: pre + tight leading -->
    <pre
      class="rounded-lg border border-border bg-bg p-3 overflow-auto max-h-[55vh] text-xs leading-[1.35] font-mono whitespace-pre"
      style="tab-size: 2; -moz-tab-size: 2;"
    >
      <div v-for="(line, li) in lines" :key="li" class="jl">
        <span v-for="j in line.indent" :key="'i'+j" class="select-none">{{ '  ' }}</span>
        <span v-for="(t, ti) in line.tokens" :key="ti" :class="t.cls ?? ''">{{ t.text }}</span>
      </div>
    </pre>
  </div>
</template>

<style scoped>
.jl {
  /* Ultra-tight line height, no extra vertical gaps */
  line-height: 1.35;
  min-height: 1.35em;
}
pre {
  /* Ensure pre whitespace handling, no extra spacing */
  margin: 0;
}
</style>
