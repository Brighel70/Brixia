/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@teamflow/shared': path.resolve(__dirname, './packages/shared/src/index.ts')
    }
  },
  optimizeDeps: {
    // Usa l'alias a packages/shared/src (niente prebundle stale senza export nuovi)
    exclude: ['@teamflow/shared']
  },
  build: {
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'react'
          if (id.includes('node_modules/@supabase')) return 'supabase'
          // Non raggruppare @react-pdf con jspdf/html2canvas per evitare "Cannot access before initialization"
          if (id.includes('node_modules/xlsx')) return 'xlsx'
        }
      }
    }
  },
  server: {
    port: 3000,
    strictPort: true,
    hmr: {
      overlay: false
    },
    watch: {
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.vite/**']
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'packages/shared/src/**/*.test.ts']
  }
})
