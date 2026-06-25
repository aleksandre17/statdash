import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname, join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { createRequire } from 'module'

// ── Optional-peer singleton resolution (clean-install / Docker correctness) ──
//
// react-leaflet · leaflet · react-apexcharts · apexcharts are declared as OPTIONAL
// peerDependencies of @statdash/plugins (split-ready design; .npmrc
// shamefully-hoist=false keeps strict isolation). The app resolves @statdash/* to
// package SOURCE (the aliases below), so Vite walks the plugins source and hits the
// bare `import { GeoJSON } from 'react-leaflet'` (and apexcharts) from WITHIN
// packages/plugins. Under strict isolation those optional peers are NOT linked into
// packages/plugins/node_modules, so on a clean install Vite substitutes an empty
// `__vite-optional-peer-dep:react-leaflet:@statdash/plugins` stub → MISSING_EXPORT.
// (A dirty local node_modules masks this; the Docker build does not.)
//
// This app DECLARES all four as DIRECT dependencies, so the real copies live in its
// resolvable graph. We pin each bare specifier (exact-match regex /^id$/, so subpath
// imports like 'leaflet/dist/leaflet.css' stay untouched) to that package's best ESM
// ENTRY FILE, resolved from the app's OWN require — an ABSOLUTE path to the actual
// installed location, computed at config load. Install-structure INDEPENDENT: it asks
// the app's resolver where the package really is (no hoist assumption, no guessed
// string), so a clean Docker install resolves the same as a dirty local one. dedupe
// additionally pins these + react/react-dom to a single copy without disturbing the
// node_modules-path-based chunk groups above.
//
// peerEntry() resolves the package ROOT (walk up to the package.json whose `name`
// matches — react-leaflet does NOT expose "./package.json", so we cannot resolve that
// subpath directly), then picks exports['.'].import → .default → `module` → `main`.
// We target the explicit ESM entry (not the package DIRECTORY) deliberately: a bare
// directory alias re-runs Vite's legacy main-field resolution, which prefers the
// top-level `browser` field — and react-apexcharts' `browser` is an IIFE bundle with
// no `default` export (MISSING_EXPORT). Its exports `import` condition is the right
// ESM build, which this selection picks.
const req = createRequire(import.meta.url)
const peerEntry = (id: string): string => {
  for (let dir = dirname(req.resolve(id)); dir !== dirname(dir); dir = dirname(dir)) {
    const manifest = join(dir, 'package.json')
    if (existsSync(manifest)) {
      const pkg = JSON.parse(readFileSync(manifest, 'utf8'))
      if (pkg.name !== id) continue
      const dot = pkg.exports?.['.']
      const sub =
        (typeof dot === 'string' ? dot : dot?.import ?? dot?.default) ?? pkg.module ?? pkg.main
      return resolve(dir, sub)
    }
  }
  throw new Error(`[vite.config] cannot resolve entry for "${id}"`)
}
const OPTIONAL_PEERS = ['react-leaflet', 'leaflet', 'react-apexcharts', 'apexcharts'] as const
const optionalPeerAliases = OPTIONAL_PEERS.map((id) => ({
  find: new RegExp(`^${id}$`),
  replacement: peerEntry(id),
}))

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
    // Force a single copy of these singletons (the optional peers + React runtime)
    // regardless of where pnpm physically places them in the .pnpm store.
    dedupe: ['react', 'react-dom', 'react-leaflet', 'leaflet', 'react-apexcharts', 'apexcharts'],
    alias: [
      // Optional-peer singletons FIRST (exact-match regex) so the bare-specifier
      // imports inside packages/plugins source resolve to the app's REAL installed
      // copy instead of the empty __vite-optional-peer-dep stub. See header note.
      ...optionalPeerAliases,
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
