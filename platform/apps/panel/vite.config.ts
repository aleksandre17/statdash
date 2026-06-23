import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Panel (Constructor platform) — package layers resolved via aliases.
//
// RESOLUTION SSOT (P0-1, reconciled): workspace:* is REAL (.npmrc
// link-workspace-packages=true links @statdash/* into node_modules — that is the
// authoritative graph). These aliases pin @statdash/* to package SOURCE for zero-build
// bundler resolution and AGREE with workspace:* (same package dirs). They are NOT
// droppable today: pure source-condition resolution through the symlinks is the same
// in-graph peer path that currently fails for plugins peers (react-dom). They stay as
// the deliberate bundler resolution layer. @plugins keeps its alias during the gradual
// migration to @statdash/plugins sub-paths (catalog / registry).
//
// ESLint enforces: no src-relative reach-ins to packages/ (use @statdash/* or @plugins).

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
      // @statdash/plugins must come before @plugins (more specific prefix wins).
      { find: '@statdash/plugins', replacement: resolve(__dirname, '../../packages/plugins')   },
      { find: '@plugins',         replacement: resolve(__dirname, '../../packages/plugins')   },
      { find: '@statdash/expr',    replacement: resolve(__dirname, '../../packages/expr')       },
      { find: '@statdash/styles',  replacement: resolve(__dirname, '../../packages/styles/src') },
      { find: '@statdash/engine',  replacement: resolve(__dirname, '../../packages/core/src')   },
      { find: '@statdash/charts',  replacement: resolve(__dirname, '../../packages/charts/src') },
      // Explicit subpath first (more specific wins) — the live canvas imports
      // @statdash/react/engine (NodePageRenderer + nodeRegistry).
      { find: '@statdash/react/engine', replacement: resolve(__dirname, '../../packages/react/src/engine') },
      { find: '@statdash/react',   replacement: resolve(__dirname, '../../packages/react/src')  },
      { find: '@',                replacement: resolve(__dirname, 'src')                      },
    ],
  },
})
