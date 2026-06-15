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
      { find: '@geostat/charts', replacement: resolve(__dirname, 'src')             },
      { find: '@geostat/engine', replacement: resolve(__dirname, '../core/src')     },
      { find: '@geostat/expr',   replacement: resolve(__dirname, '../expr/index.ts') },
    ],
  },
})
