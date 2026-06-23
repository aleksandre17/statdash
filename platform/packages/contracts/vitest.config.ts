import { defineConfig } from 'vitest/config'

// @statdash/contracts — pure types + a purity fitness test, zero React, zero deps.
// Tests run in Node.
export default defineConfig({
  test: {
    globals:     true,
    environment: 'node',
    include:     ['src/**/*.test.ts'],
  },
})
