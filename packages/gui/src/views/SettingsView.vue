<script setup lang="ts">
import { useSettingsStore, type ThemeId } from '../stores/settings'

const settings = useSettingsStore()

const themes: { id: ThemeId; label: string; desc: string }[] = [
  { id: 'catppuccin-mocha', label: 'Catppuccin Mocha', desc: 'Warm dark, purple tones' },
  { id: 'tokyo-night', label: 'Tokyo Night', desc: 'Deep blue dark, vibrant accents' },
  { id: 'one-dark', label: 'One Dark', desc: 'Atom-inspired dark theme' },
  { id: 'latte-light', label: 'Latte Light', desc: 'Catppuccin light, clean' },
]
</script>

<template>
  <div class="flex flex-col h-full overflow-y-auto">
    <!-- Header -->
    <div class="px-6 py-5 border-b border-border shrink-0">
      <h1 class="text-lg font-bold text-text-primary">Settings</h1>
      <p class="text-xs text-text-muted mt-0.5">Customize your OmniAPI experience</p>
    </div>

    <div class="flex-1 px-6 py-5 space-y-8 max-w-2xl">
      <!-- Theme selector -->
      <section>
        <h2 class="text-sm font-semibold text-text-primary mb-3">Theme</h2>
        <div class="grid grid-cols-2 gap-3">
          <button
            v-for="theme in themes"
            :key="theme.id"
            class="relative flex flex-col items-start gap-1 rounded-xl border-2 p-4 text-left transition-all"
            :class="settings.settings.theme === theme.id
              ? 'border-accent bg-accent/10'
              : 'border-border bg-surface hover:border-border-light'"
            @click="settings.setTheme(theme.id)"
          >
            <div class="flex items-center gap-2 w-full">
              <span class="text-sm font-medium text-text-primary">{{ theme.label }}</span>
              <svg
                v-if="settings.settings.theme === theme.id"
                class="w-4 h-4 ml-auto text-accent"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <span class="text-[11px] text-text-muted">{{ theme.desc }}</span>
            <!-- Color preview dots -->
            <div class="flex gap-1 mt-1.5">
              <span
                v-for="dot in 4" :key="dot"
                class="w-3 h-3 rounded-full"
                :class="{
                  'bg-[#89b4fa]': theme.id === 'catppuccin-mocha' && dot === 1,
                  'bg-[#a6e3a1]': theme.id === 'catppuccin-mocha' && dot === 2,
                  'bg-[#f38ba8]': theme.id === 'catppuccin-mocha' && dot === 3,
                  'bg-[#cba6f7]': theme.id === 'catppuccin-mocha' && dot === 4,
                  'bg-[#7aa2f7]': theme.id === 'tokyo-night' && dot === 1,
                  'bg-[#9ece6a]': theme.id === 'tokyo-night' && dot === 2,
                  'bg-[#f7768e]': theme.id === 'tokyo-night' && dot === 3,
                  'bg-[#bb9af7]': theme.id === 'tokyo-night' && dot === 4,
                  'bg-[#61afef]': theme.id === 'one-dark' && dot === 1,
                  'bg-[#98c379]': theme.id === 'one-dark' && dot === 2,
                  'bg-[#e06c75]': theme.id === 'one-dark' && dot === 3,
                  'bg-[#c678dd]': theme.id === 'one-dark' && dot === 4,
                  'bg-[#1e66f5]': theme.id === 'latte-light' && dot === 1,
                  'bg-[#40a02b]': theme.id === 'latte-light' && dot === 2,
                  'bg-[#d20f39]': theme.id === 'latte-light' && dot === 3,
                  'bg-[#8839ef]': theme.id === 'latte-light' && dot === 4,
                }"
              />
            </div>
          </button>
        </div>
      </section>

      <!-- Request defaults -->
      <section>
        <h2 class="text-sm font-semibold text-text-primary mb-3">Request Defaults</h2>
        <div class="space-y-4">
          <!-- Timeout -->
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm text-text-primary" for="timeout">Timeout (ms)</label>
              <p class="text-[11px] text-text-muted">Max wait time per request</p>
            </div>
            <input
              id="timeout"
              type="number"
              min="1000"
              max="300000"
              step="1000"
              :value="settings.settings.requestTimeout"
              class="w-28 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-mono text-text-primary text-right focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              @input="settings.setRequestTimeout(Number(($event.target as HTMLInputElement).value) || 30000)"
            />
          </div>

          <!-- Follow redirects -->
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm text-text-primary">Auto-follow redirects</label>
              <p class="text-[11px] text-text-muted">Automatically follow 3xx responses</p>
            </div>
            <button
              class="relative w-10 h-5 rounded-full transition-colors"
              :class="settings.settings.followRedirects ? 'bg-accent' : 'bg-surface-hover'"
              @click="settings.setFollowRedirects(!settings.settings.followRedirects)"
            >
              <div
                class="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                :class="settings.settings.followRedirects ? 'translate-x-[1.35rem]' : 'translate-x-0.5'"
              />
            </button>
          </div>

          <!-- SSL verification -->
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm text-text-primary">SSL verification</label>
              <p class="text-[11px] text-text-muted">Verify TLS certificates</p>
            </div>
            <button
              class="relative w-10 h-5 rounded-full transition-colors"
              :class="settings.settings.verifySsl ? 'bg-accent' : 'bg-surface-hover'"
              @click="settings.setVerifySsl(!settings.settings.verifySsl)"
            >
              <div
                class="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-colors"
                :class="settings.settings.verifySsl ? 'translate-x-[1.35rem]' : 'translate-x-0.5'"
              />
            </button>
          </div>
        </div>
      </section>

      <!-- About -->
      <section>
        <h2 class="text-sm font-semibold text-text-primary mb-2">About</h2>
        <p class="text-xs text-text-muted">OmniAPI v0.1.0</p>
        <p class="text-xs text-text-muted mt-1">Blazing-fast API client — Tauri + Vue + Bun</p>
      </section>
    </div>
  </div>
</template>
