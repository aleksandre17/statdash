import { defineConfig } from 'vitest/config'

// Platform test projects (Vitest 4).
//
// `vitest.workspace.ts` was silently ignored after the Vitest 4 upgrade —
// workspace files are no longer auto-discovered; projects must be declared
// here via `test.projects`. Each package still owns its own vitest.config.ts
// (and its own resolve.alias); this file is the only place that knows which
// packages exist and knows nothing about their internal structure.
export default defineConfig({
  test: {
    projects: [
      'packages/contracts',
      'packages/core',
      'packages/charts',
      'packages/expr',
      'packages/plugins',
      'packages/react',
      'packages/styles',
      'apps/api',
      'apps/panel',
      'apps/geostat',
      'tests',
    ],
  },
})
