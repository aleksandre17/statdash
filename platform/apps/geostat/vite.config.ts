import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Platform layer aliases (apps/geostat → packages/):
//   @statdash/plugins → ../../packages/plugins     (@statdash/plugins/catalog + /registry)
//   @plugins         → ../../packages/plugins     (legacy shim — migrate to @statdash/plugins)
//   @statdash/expr    → ../../packages/expr        (zero-dep expression evaluator)
//   @statdash/styles  → ../../packages/styles/src
//   @statdash/engine  → ../../packages/core/src    (pure TypeScript, zero React)
//   @statdash/charts  → ../../packages/charts/src  (renderer-agnostic chart interpretation)
//   @statdash/react   → ../../packages/react/src   (React adapter, headless UI)
//   @               → ./src                     (this app's content)
//
// RESOLUTION SSOT (P0-1, reconciled):
//   node_modules:  workspace:* is REAL — `.npmrc link-workspace-packages=true` links
//                  every @statdash/* into node_modules (apps/geostat/node_modules/@statdash/*
//                  -> ../../packages/*). That is the authoritative dependency graph.
//   bundler:       these aliases pin @statdash/* to package SOURCE so the dev server +
//                  build compile TypeScript in-graph with no per-package build step.
//                  They AGREE with workspace:* (both point at the same package dirs).
// The aliases are NOT droppable today: removing them would force Rolldown to resolve
// @statdash/* purely via the `source` export condition through the symlinks — the same
// in-graph peer-resolution path that currently fails for plugins peers (react-dom not
// in packages/plugins/node_modules). Until that peer-dep gap is closed (plugins-specialist
// scope), the source-aliases stay as the deliberate, verified bundler resolution layer.
// TypeScript mirrors these in tsconfig.app.json "paths".

export default defineConfig({
  plugins: [react()],
  resolve: {
    // 'source' condition lets Vite pick the TypeScript source entry from package.json
    // exports maps (e.g. "@statdash/expr": { source: "./index.ts", import: "./dist/index.js" })
    // without needing a build step during development.
    conditions: ['source', 'browser', 'module', 'import', 'default'],
    alias: [
      // @statdash/contracts — zero-dep shared boundary types (innermost layer).
      { find: '@statdash/contracts', replacement: resolve(__dirname, '../../packages/contracts/src/index.ts') },
      // @statdash/plugins must precede @plugins (longer prefix wins in Vite).
      { find: '@statdash/plugins', replacement: resolve(__dirname, '../../packages/plugins')   },
      { find: '@plugins',         replacement: resolve(__dirname, '../../packages/plugins')   },
      { find: '@statdash/expr',    replacement: resolve(__dirname, '../../packages/expr')       },
      { find: '@statdash/styles',  replacement: resolve(__dirname, '../../packages/styles/src') },
      { find: '@statdash/engine',  replacement: resolve(__dirname, '../../packages/core/src')   },
      { find: '@statdash/charts',  replacement: resolve(__dirname, '../../packages/charts/src') },
      { find: '@statdash/react',   replacement: resolve(__dirname, '../../packages/react/src')  },
      { find: '@',                replacement: resolve(__dirname, 'src')                    },
    ],
  },
})
