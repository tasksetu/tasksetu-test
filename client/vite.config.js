import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Resolve to root node_modules to ensure single React instance
const rootNodeModules = path.resolve(__dirname, '../node_modules')

export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Force single React instance from root node_modules
      'react': path.resolve(rootNodeModules, 'react'),
      'react-dom': path.resolve(rootNodeModules, 'react-dom'),
      // optional: mirror root aliases if you use them in imports
      '@assets': path.resolve(__dirname, '../attached_assets'),
      '@shared': path.resolve(__dirname, '../shared'),
      '@features': path.resolve(__dirname, './src/features'),
      '@features-shared': path.resolve(__dirname, './src/features/shared'),
      '@features-dashboard': path.resolve(__dirname, './src/features/dashboard'),
      '@features-tasks': path.resolve(__dirname, './src/features/tasks'),
      '@features-calendar': path.resolve(__dirname, './src/features/calendar'),
      '@features-auth': path.resolve(__dirname, './src/features/auth'),
    },
    // Ensure single React instance
    dedupe: ['react', 'react-dom']
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'zustand'],
  },
  build: {
    // Ensure CSS is extracted properly
    cssCodeSplit: true,
    // Ensure proper chunking and deduplication in production
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
        },
        // Ensure assets have consistent naming
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
