import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname, join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { createRequire } from 'module'

// ── Optional-peer singleton resolution (clean-install / Docker correctness) ──
//
// react-leaflet · leaflet · react-apexcharts · apexcharts are declared as OPTIONAL
// peerDependencies of @statdash/plugins (split-ready design — not every consumer
// renders maps/charts; .npmrc shamefully-hoist=false keeps strict isolation). The
// apps resolve @statdash/* to package SOURCE (the aliases below), so Vite walks the
// plugins source and hits `import { GeoJSON } from 'react-leaflet'` from WITHIN
// packages/plugins. Under strict isolation those optional peers are NOT linked into
// packages/plugins/node_modules, so on a clean install Vite substitutes an empty
// `__vite-optional-peer-dep:react-leaflet:@statdash/plugins` stub → MISSING_EXPORT.
// (A dirty local node_modules masks this; the Docker build does not.)
//
// These apps DO declare all four as DIRECT dependencies, so the real copies live in
// the app's resolvable graph. We pin each bare specifier (exact-match regex /^id$/, so
// subpath imports like 'leaflet/dist/leaflet.css' stay untouched) to that package's
// best ESM ENTRY FILE, resolved from the app's OWN require — an ABSOLUTE path to the
// actual installed location, computed at config load. This is install-structure
// INDEPENDENT: it never assumes a hoist layout or a guessed path string; it asks the
// app's resolver where the package really is, so a clean Docker install resolves the
// same way a dirty local one does. dedupe additionally pins these + react/react-dom to
// a single copy without disturbing the node_modules-path-based chunk groups above.
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
  build: {
    // ── Vendor chunk splitting (secondary lever; lazy boundaries are primary) ──
    //
    //  The primary size win is the route-level React.lazy boundary in App.tsx
    //  (./app/RendererSurface), which pulls the heavy renderer graph — the
    //  @statdash/react engine plus the panel/node plugins (ApexCharts, Leaflet)
    //  registered by setupRegistrations() — out of the eager entry chunk. These
    //  codeSplitting groups additionally peel the large, rarely-changing vendors
    //  into their own cacheable chunks: they ride along with whichever lazy chunk
    //  first needs them rather than bloating the entry, and change independently
    //  of app code (better long-term caching).
    //
    //  Rolldown (Vite 8) ignores manualChunks-as-function in favour of this
    //  declarative group API (codeSplitting.groups[{ name, test, priority }];
    //  advancedChunks is the deprecated alias of the same shape).
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // react-vendor FIRST (highest priority) so the shared React runtime
            // (incl. react/jsx-runtime, which every component statically needs)
            // lands in the small eager vendor chunk — NOT pulled into apexcharts
            // by includeDependenciesRecursively, which would force the entry to
            // eager-load the ~540 kB charting lib just to reach jsx-runtime.
            { name: 'react-vendor', test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/, priority: 40 },
            { name: 'apexcharts',   test: /[\\/]node_modules[\\/](apexcharts|react-apexcharts)[\\/]/, priority: 30 },
            { name: 'leaflet',      test: /[\\/]node_modules[\\/](leaflet|react-leaflet|@react-leaflet)[\\/]/, priority: 30 },
            { name: 'i18n',         test: /[\\/]node_modules[\\/](i18next|react-i18next)[\\/]/, priority: 25 },
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
