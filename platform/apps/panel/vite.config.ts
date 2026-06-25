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
  build: {
    // ── Vendor chunk splitting (secondary lever; lazy boundaries are primary) ──
    //
    //  The primary size win comes from route/feature-level React.lazy boundaries
    //  (the wizard steps + the live canvas + the cmdk palette), which pull the
    //  heavy app graph — and ApexCharts via the real renderer — out of the initial
    //  chunk. These advancedChunks groups additionally peel the large, rarely-
    //  changing vendors into their own cacheable chunks (better long-term caching,
    //  and they ride along with whichever lazy chunk first needs them rather than
    //  bloating the eager entry):
    //    • apexcharts  — the charting engine (only reached through the canvas).
    //    • mui         — MUI + Emotion (shared, but large).
    //    • dnd-kit     — drag/drop sensors used by the editor surfaces.
    //    • react-vendor— react / react-dom / react-router runtime.
    //  Rolldown (Vite 8) ignores manualChunks-as-function in favour of this
    //  declarative group API (define-config: codeSplitting.groups[{name,test}];
    //  advancedChunks is the deprecated alias of the same shape).
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // react-vendor FIRST (highest priority) so the shared React runtime
            // (incl. react/jsx-runtime, which every component statically needs)
            // lands in the small eager vendor chunk — NOT pulled into apexcharts
            // by includeDependenciesRecursively, which would force the entry to
            // eager-load the 540 kB charting lib just to reach jsx-runtime.
            { name: 'react-vendor', test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/, priority: 40 },
            { name: 'apexcharts',   test: /[\\/]node_modules[\\/](apexcharts|react-apexcharts)[\\/]/,    priority: 30 },
            { name: 'dnd-kit',      test: /[\\/]node_modules[\\/]@dnd-kit[\\/]/,                          priority: 25 },
            { name: 'cmdk',         test: /[\\/]node_modules[\\/]cmdk[\\/]/,                              priority: 25 },
            { name: 'mui',          test: /[\\/]node_modules[\\/](@mui|@emotion)[\\/]/,                  priority: 20 },
          ],
        },
      },
    },
  },
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
