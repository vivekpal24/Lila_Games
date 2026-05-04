import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Target: initial JS bundle < 150KB gzipped
// deck.gl chunk loads async after initial render
// apache-arrow chunk loads async when first parquet file is requested

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@components': resolve(__dirname, 'src/components'),
      '@utils':      resolve(__dirname, 'src/utils'),
      '@appTypes':   resolve(__dirname, 'src/types'),
      '@store':      resolve(__dirname, 'src/store'),
      '@hooks':      resolve(__dirname, 'src/hooks'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'deck': ['deck.gl', '@deck.gl/core', '@deck.gl/layers'],
          'arrow': ['apache-arrow', 'hyparquet'],
          'vendor': ['react', 'react-dom', 'zustand']
        }
      }
    }
  }
})
