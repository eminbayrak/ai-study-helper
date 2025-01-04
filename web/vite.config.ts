import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'word-data-en': ['./src/data/words.json'],
          'word-data-ja': ['./src/data/words_ja.json'],
          'word-data-tr': ['./src/data/words_tr.json'],
          'word-data-sp': ['./src/data/words_sp.json'],
        },
      },
    },
  },
})
