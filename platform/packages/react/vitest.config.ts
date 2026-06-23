import { defineConfig } from 'vitest/config'
import react           from '@vitejs/plugin-react'
import { resolve }     from 'path'

// engine/react — React adapter layer.
// Default environment: node. Per-file override via @vitest-environment docblock.
// setupFiles: jest-dom DOM matchers (used by jsdom tests).
export default defineConfig({
  plugins: [react()],
  test: {
    globals:     true,
    environment: 'node',
    include:     ['src/**/*.test.{ts,tsx}'],
    setupFiles:  ['./vitest.setup.ts'],
  },
  resolve: {
    alias: [
      { find: '@statdash/engine', replacement: resolve(__dirname, '../core/src')   },
      { find: '@statdash/charts', replacement: resolve(__dirname, '../charts/src')  },
      { find: '@statdash/react',  replacement: resolve(__dirname, 'src')            },
      { find: '@statdash/expr',   replacement: resolve(__dirname, '../expr')        },
      { find: '@statdash/styles', replacement: resolve(__dirname, '../styles/src')  },
    ],
  },
})
