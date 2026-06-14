import { defineConfig } from 'vitest/config'
import { resolve }     from 'path'

// engine/expr — zero-dep expression evaluator.
// Source root is engine/expr/ itself (no nested src/).
export default defineConfig({
  test: {
    globals:     true,
    environment: 'node',
    include:     ['**/*.test.ts'],
    exclude:     ['node_modules/**', 'dist/**'],
  },
  resolve: {
    alias: [
      { find: '@geostat/expr', replacement: resolve(__dirname, '.') },
    ],
  },
})
