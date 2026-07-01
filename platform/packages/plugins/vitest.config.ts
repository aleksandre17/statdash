import { defineConfig }  from 'vitest/config'
import react            from '@vitejs/plugin-react'
import { resolve }      from 'path'
import { fileURLToPath } from 'url'

// Workspace-safe __dirname: import.meta.url is always this file's URL.
// DO NOT use __dirname — Vitest workspace injects it as the workspace root.
const dir = fileURLToPath(new URL('.', import.meta.url))
const eng  = (sub: string) => resolve(dir, '..', sub)

// engine/plugins — shell + panel integration tests.
// Default environment: node. Per-file override via @vitest-environment docblock.
export default defineConfig({
  plugins: [react()],
  test: {
    globals:     true,
    environment: 'node',
    include:     ['panels/**/*.test.{ts,tsx}', 'nodes/**/*.test.{ts,tsx}', 'pages/**/*.test.{ts,tsx}', 'datasources/**/*.test.{ts,tsx}', 'presentation/**/*.test.{ts,tsx}', 'chrome/**/*.test.{ts,tsx}', '__tests__/**/*.test.{ts,tsx}'],
    setupFiles:  [eng('react/vitest.setup.ts')],
  },
  resolve: {
    conditions: ['source', 'import', 'module', 'browser', 'default'],
    alias: [
      { find: '@statdash/engine',  replacement: eng('core/src')   },
      { find: '@statdash/charts',  replacement: eng('charts/src') },
      { find: '@statdash/react',   replacement: eng('react/src')  },
      { find: '@statdash/expr',    replacement: eng('expr')       },
      { find: '@statdash/styles',  replacement: eng('styles/src') },
      { find: '@statdash/plugins', replacement: dir               },
      // i18next is an OPTIONAL peer of @statdash/react (resolved only in the app
      // tier). Shell a11y/render tests that pull `useT` need it to resolve — alias
      // to a passthrough stub (returns the key). See __tests__/__stubs__/i18next.ts.
      { find: /^i18next$/,         replacement: resolve(dir, '__tests__/__stubs__/i18next.ts') },
    ],
  },
})
