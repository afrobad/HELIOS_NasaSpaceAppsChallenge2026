import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Disable sourcemaps completely so source code (.ts, .tsx) is never exposed in DevTools Sources tab
    sourcemap: false,
    cssMinify: true,
  },
  server: {
    host: true,
    port: 3000,
    allowedHosts: true,
    watch: {
      usePolling: true,
      interval: 300,
      ignored: ['**/node_modules/**', '**/.git/**'],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true
      }
    }
  }
})
