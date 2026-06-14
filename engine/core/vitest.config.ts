import { defineConfig } from 'vitest/config'
import { resolve }     from 'path'

// engine/core — pure TypeScript, zero React.
// Tests run in Node; no DOM, no React plugin.
export default defineConfig({
  test: {
    globals:     true,
    environment: 'node',
    include:     ['src/**/*.test.ts'],
  },
  resolve: {
    alias: [
      { find: '@geostat/engine', replacement: resolve(__dirname, 'src')      },
      { find: '@geostat/expr',   replacement: resolve(__dirname, '../expr')   },
    ],
  },
})
