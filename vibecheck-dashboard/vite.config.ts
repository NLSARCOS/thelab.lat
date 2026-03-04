import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Auth & SaaS API → vibecheck-saas (port 8000)
      '/api/auth': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/scans': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/scan': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/credits': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/shield': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/keys': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/admin': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/billing': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // Scanner API → vibecheck-security (port 8080)
      '/api/scanner': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
