import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type ThemeId = 'catppuccin-mocha' | 'tokyo-night' | 'one-dark' | 'latte-light'

export interface AppSettings {
  theme: ThemeId
  requestTimeout: number
  followRedirects: boolean
  verifySsl: boolean
}

const SETTINGS_KEY = 'omniapi:settings'

const defaults: AppSettings = {
  theme: 'catppuccin-mocha',
  requestTimeout: 30000,
  followRedirects: true,
  verifySsl: true,
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>(loadFromStorage())

  watch(settings, saveToStorage, { deep: true })

  function setTheme(theme: ThemeId) {
    settings.value.theme = theme
    applyTheme(theme)
  }

  function setRequestTimeout(ms: number) {
    settings.value.requestTimeout = ms
  }

  function setFollowRedirects(val: boolean) {
    settings.value.followRedirects = val
  }

  function setVerifySsl(val: boolean) {
    settings.value.verifySsl = val
  }

  function loadFromStorage(): AppSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY)
      if (raw) return { ...defaults, ...(JSON.parse(raw) as Partial<AppSettings>) }
    } catch { /* ignore */ }
    return { ...defaults }
  }

  function saveToStorage() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings.value))
    } catch { /* quota */ }
  }

  function applyTheme(theme: ThemeId) {
    document.documentElement.setAttribute('data-theme', theme)
  }

  // Init: apply saved theme on first load
  applyTheme(settings.value.theme)

  return {
    settings,
    setTheme,
    setRequestTimeout,
    setFollowRedirects,
    setVerifySsl,
  }
})
