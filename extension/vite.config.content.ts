import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// Config for content script only - IIFE format (bundled)
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        format: 'iife',
        name: 'AdStashContent',
        inlineDynamicImports: true,
      },
    },
    target: 'esnext',
    minify: false,
    sourcemap: true,
  },
})
