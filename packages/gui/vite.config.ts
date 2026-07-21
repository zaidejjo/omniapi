import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/*.db', '**/*.db-wal', '**/*.db-shm', '**/src-tauri/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'esnext',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    // esbuild is only used for minification, not transpilation in Vite 8
    // oxc handles transpilation, esbuild handles minify — both need install
    rollupOptions: {
      // Externalize bun:sqlite and @omniapi/core for browser — we use Tauri IPC instead
      external: ['bun:sqlite', '@omniapi/core'],
    },
  },
  optimizeDeps: {
    exclude: ['@omniapi/core'],
  },
})
