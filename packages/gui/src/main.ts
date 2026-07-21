import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import RequestView from './views/RequestView.vue'
import SettingsView from './views/SettingsView.vue'
import './assets/main.css'

const routes = [
  { path: '/', component: RequestView },
  { path: '/request/:id', component: RequestView },
  { path: '/settings', component: SettingsView },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
