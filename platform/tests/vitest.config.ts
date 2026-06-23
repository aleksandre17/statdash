import { defineConfig } from 'vitest/config'

// Platform-wide fitness functions — invariants that belong to no single package
// but to the whole monorepo (e.g. the de-tenanted npm scope). Runs in Node and
// scans the repo tree from platform/ root.
export default defineConfig({
  test: {
    globals:     true,
    environment: 'node',
    root:        __dirname,
    include:     ['**/*.fitness.test.ts'],
  },
})
