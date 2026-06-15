import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Platform layer aliases (apps/geostat → engine/):
//   @geostat/plugins → ../../engine/plugins     (@geostat/plugins/catalog + /registry)
//   @plugins         → ../../engine/plugins     (legacy shim — migrate to @geostat/plugins)
//   @geostat/expr    → ../../engine/expr        (zero-dep expression evaluator)
//   @geostat/styles  → ../../engine/styles/src
//   @geostat/engine  → ../../engine/core/src    (pure TypeScript, zero React)
//   @geostat/charts  → ../../engine/charts/src  (renderer-agnostic chart interpretation)
//   @geostat/react   → ../../engine/react/src   (React adapter, headless UI)
//   @               → ./src                     (this app's content)
//
// Aliases resolve directly to source (no build step).
// TypeScript mirrors these in tsconfig.app.json "paths".
// After `pnpm install`, @geostat/* aliases can be dropped (workspace:* takes over).

export default defineConfig({
  plugins: [react()],
  resolve: {
    // 'source' condition lets Vite pick the TypeScript source entry from package.json
    // exports maps (e.g. "@geostat/expr": { source: "./index.ts", import: "./dist/index.js" })
    // without needing a build step during development.
    conditions: ['source', 'browser', 'module', 'import', 'default'],
    alias: [
      // @geostat/plugins must precede @plugins (longer prefix wins in Vite).
      { find: '@geostat/plugins', replacement: resolve(__dirname, '../../engine/plugins')   },
      { find: '@plugins',         replacement: resolve(__dirname, '../../engine/plugins')   },
      { find: '@geostat/expr',    replacement: resolve(__dirname, '../../engine/expr')       },
      { find: '@geostat/styles',  replacement: resolve(__dirname, '../../engine/styles/src') },
      { find: '@geostat/engine',  replacement: resolve(__dirname, '../../engine/core/src')   },
      { find: '@geostat/charts',  replacement: resolve(__dirname, '../../engine/charts/src') },
      { find: '@geostat/react',   replacement: resolve(__dirname, '../../engine/react/src')  },
      { find: '@',                replacement: resolve(__dirname, 'src')                    },
    ],
  },
})
