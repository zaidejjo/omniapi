import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import type { RequestConfig, HttpMethod, KeyValue, AuthConfig } from '@omniapi/core'
import { useHistoryStore } from './history'

export interface ResponseData {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  durationMs: number
  size: number
}

function emptyConfig(): RequestConfig {
  return {
    id: '',
    name: 'Untitled Request',
    method: 'GET',
    url: '',
    headers: [],
    queryParams: [],
    body: '',
    bodyType: 'none',
    auth: { type: 'none', data: {} },
  }
}

export const useRequestStore = defineStore('request', () => {
  const config = reactive<RequestConfig>(emptyConfig())
  const response = ref<ResponseData | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  let activeTab = ref<'params' | 'headers' | 'body' | 'auth'>('params')

  function setMethod(method: HttpMethod) {
    config.method = method
  }

  function setUrl(url: string) {
    config.url = url
  }

  function setBodyType(type: RequestConfig['bodyType']) {
    config.bodyType = type
  }

  function setBody(body: string) {
    config.body = body
  }

  function setAuth(auth: AuthConfig) {
    config.auth = { ...auth }
  }

  function setActiveTab(tab: 'params' | 'headers' | 'body' | 'auth') {
    activeTab.value = tab
  }

  function addHeader() {
    config.headers = [...config.headers, { key: '', value: '', enabled: true } as KeyValue]
  }

  function updateHeader(index: number, field: keyof KeyValue, value: string | boolean) {
    const updated = [...config.headers] as KeyValue[]
    updated[index] = { ...updated[index], [field]: value } as KeyValue
    config.headers = updated
  }

  function removeHeader(index: number) {
    config.headers = config.headers.filter((_, i) => i !== index)
  }

  function addQueryParam() {
    config.queryParams = [
      ...config.queryParams,
      { key: '', value: '', enabled: true } as KeyValue,
    ]
  }

  function updateQueryParam(index: number, field: keyof KeyValue, value: string | boolean) {
    const updated = [...config.queryParams] as KeyValue[]
    updated[index] = { ...updated[index], [field]: value } as KeyValue
    config.queryParams = updated
  }

  function removeQueryParam(index: number) {
    config.queryParams = config.queryParams.filter((_, i) => i !== index)
  }

  /** Auto-prepend https:// if URL has no protocol */
  function normalizeUrl(raw: string): string {
    const trimmed = raw.trim()
    if (!trimmed) return trimmed
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) return trimmed
    return `https://${trimmed}`
  }

  async function send() {
    if (!config.url) return

    // Normalize URL before sending
    config.url = normalizeUrl(config.url)
    if (!config.url) return

    loading.value = true
    error.value = null
    response.value = null

    try {
      const configJson = JSON.stringify({ ...config })
      const raw = await invoke<string>('execute_request', { configJson })
      const resp = JSON.parse(raw)

      if (!resp.ok) {
        error.value = resp.error ?? 'Request failed'
      } else if (resp.data?.error) {
        error.value = resp.data.error.message
      } else {
        response.value = resp.data.response

        // Save to history automatically
        const history = useHistoryStore()
        history.add({
          method: config.method,
          url: config.url,
          status: resp.data.response?.status,
          durationMs: resp.data.response?.durationMs,
        })
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  function loadFromConfig(cfg: Partial<RequestConfig>) {
    Object.assign(config, emptyConfig(), cfg)
  }

  function reset() {
    Object.assign(config, emptyConfig())
    response.value = null
    error.value = null
  }

  return {
    config,
    response,
    loading,
    error,
    activeTab,
    setMethod,
    setUrl,
    setBodyType,
    setBody,
    setAuth,
    setActiveTab,
    addHeader,
    updateHeader,
    removeHeader,
    addQueryParam,
    updateQueryParam,
    removeQueryParam,
    send,
    loadFromConfig,
    reset,
  }
})
