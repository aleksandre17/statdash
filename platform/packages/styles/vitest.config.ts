import { defineConfig } from 'vitest/config'

// @statdash/styles — pure CSS + TypeScript, zero React.
// Tests run in Node; environment = node (no DOM needed).
export default defineConfig({
  test: {
    globals:     true,
    environment: 'node',
    include:     ['src/**/*.test.ts'],
  },
})
