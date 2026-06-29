import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    watch: {
      ignored: ['**/~*', '**/*.tmp', '**/public/~*']
    },
    proxy: {
      '/api': {
        target: 'http://localhost/umbrella_newversion',
        changeOrigin: true
      }
    }
  }
})
