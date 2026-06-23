import { defineConfig } from 'vitest/config'
import { resolve }     from 'path'

export default defineConfig({
  test: {
    globals:     true,
    environment: 'node',
    include:     ['src/**/*.test.ts'],
  },
  resolve: {
    alias: [
      { find: '@statdash/charts', replacement: resolve(__dirname, 'src')             },
      { find: '@statdash/engine', replacement: resolve(__dirname, '../core/src')     },
      { find: '@statdash/expr',   replacement: resolve(__dirname, '../expr/index.ts') },
    ],
  },
})
