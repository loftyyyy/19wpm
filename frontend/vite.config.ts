import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'

function vendorChunk(id: string) {
  const norm = id.replace(/\\/g, '/')
  if (!norm.includes('/node_modules/')) return undefined
  if (
    norm.includes('/react/') ||
    norm.includes('/react-dom/') ||
    norm.includes('/scheduler/') ||
    norm.includes('/react-router/') ||
    norm.includes('/react-router-dom/')
  ) {
    return 'vendor'
  }
  return undefined
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    visualizer({ gzipSize: true, filename: 'dist/stats.html' }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: vendorChunk,
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
