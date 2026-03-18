import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:8081',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // CodeMirror editor (lazy-loaded)
          if (id.includes('@codemirror') || id.includes('codemirror')) {
            return 'codemirror'
          }
          // Shiki 语法高亮：语言 grammar 和主题拆分为独立 chunk（按需加载）
          if (id.includes('shiki') && id.includes('/langs/')) {
            return 'shiki-langs'
          }
          if (id.includes('shiki') && id.includes('/themes/')) {
            return 'shiki-themes'
          }
          // 核心 UI 库
          if (id.includes('radix-vue') || id.includes('class-variance-authority') || id.includes('clsx')) {
            return 'ui-core'
          }
          // Lucide 图标
          if (id.includes('lucide-vue-next')) {
            return 'icons'
          }
          // Vue 核心
          if (id.includes('node_modules/vue') || id.includes('node_modules/@vue')) {
            return 'vue-vendor'
          }
        }
      }
    }
  }
})
