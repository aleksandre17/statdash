import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname, join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { createRequire } from 'module'

// ── Source-package peer resolution (clean-install / Docker correctness) ──
//
// The app resolves @statdash/* to package SOURCE (the aliases below), so Vite/Rolldown
// walks that source and hits the workspace packages' OWN bare peer imports from WITHIN
// packages/* — `import … from 'react-router-dom'` in packages/react, `from 'i18next'`,
// `from 'react-leaflet'` in packages/plugins, etc. Those are declared as
// `peerDependencies` of the @statdash/* packages (split-ready design; the map/chart
// peers are additionally `optional` — not every consumer renders them). With .npmrc
// shamefully-hoist=false enforcing strict isolation, those peers are NOT linked into
// packages/<pkg>/node_modules, so on a clean install the bundler cannot resolve them
// in-graph: required peers fail with `failed to resolve import`, and optional peers get
// substituted with an empty `__vite-optional-peer-dep:…` stub → MISSING_EXPORT. (A
// dirty local node_modules masks this; the clean Docker build does not.)
//
// FIX (data-driven, no whack-a-mole list): we read the `peerDependencies` of every
// @statdash/* package the app bundles from source (SOURCE_PACKAGE_DIRS — the SSOT is
// each package.json), take their UNION, and pin each bare specifier to the app's OWN
// installed copy. The app DECLARES every one of these as a DIRECT dependency, so the
// real copy lives in its resolvable graph; we never guess a hoist path. Each alias is
// an exact-match regex /^id$/, so subpath imports like 'leaflet/dist/leaflet.css' stay
// untouched. The optional map/chart peers are simply members of this union — no
// separate hardcoded list. dedupe additionally pins the singletons (react/react-dom/
// react-router-dom) to a single copy without disturbing the node_modules-path-based
// chunk groups above.
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
// Resolve a package-exports `.` target to a string subpath, walking nested condition
// objects (e.g. i18next's exports['.'].import is itself { types, default }). We prefer
// the ESM/browser conditions in order. Returns undefined if no string target is found.
const pickExportTarget = (node: unknown): string | undefined => {
  if (typeof node === 'string') return node
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>
    for (const cond of ['source', 'import', 'browser', 'module', 'default']) {
      if (cond in obj) {
        const hit = pickExportTarget(obj[cond])
        if (hit) return hit
      }
    }
  }
  return undefined
}
const peerEntry = (id: string): string => {
  let resolved: string
  try {
    resolved = req.resolve(id)
  } catch {
    // The app declares every source-package peer as a direct dependency, so this should
    // never happen. Fail loudly (never emit `undefined` into resolve.alias) if it does.
    throw new Error(
      `[vite.config] peer "${id}" (a peerDependency of a bundled @statdash/* package) ` +
        `is not resolvable from this app — declare it as a direct dependency.`,
    )
  }
  for (let dir = dirname(resolved); dir !== dirname(dir); dir = dirname(dir)) {
    const manifest = join(dir, 'package.json')
    if (existsSync(manifest)) {
      const pkg = JSON.parse(readFileSync(manifest, 'utf8'))
      if (pkg.name !== id) continue
      // exports['.'] ESM target (recursive through nested conditions) → module → main.
      const sub = pickExportTarget(pkg.exports?.['.']) ?? pkg.module ?? pkg.main
      if (typeof sub !== 'string') {
        throw new Error(`[vite.config] cannot determine ESM entry subpath for "${id}"`)
      }
      return resolve(dir, sub)
    }
  }
  throw new Error(`[vite.config] cannot resolve entry for "${id}"`)
}

// The @statdash/* packages this app bundles from SOURCE (mirror of the resolve.alias
// source entries below). Their package.json `peerDependencies` are the SSOT for which
// bare peers Vite will encounter in-graph.
const SOURCE_PACKAGE_DIRS = [
  'contracts',
  'expr',
  'core',
  'charts',
  'react',
  'plugins',
  'styles',
].map((d) => resolve(__dirname, '../../packages', d))

const sourcePackagePeers = (): string[] => {
  const names = new Set<string>()
  for (const dir of SOURCE_PACKAGE_DIRS) {
    const manifest = join(dir, 'package.json')
    if (!existsSync(manifest)) continue
    const pkg = JSON.parse(readFileSync(manifest, 'utf8'))
    for (const name of Object.keys(pkg.peerDependencies ?? {})) names.add(name)
  }
  return [...names]
}

const PEER_PACKAGES = sourcePackagePeers()
const peerAliases = PEER_PACKAGES.map((id) => ({
  find: new RegExp(`^${id}$`),
  replacement: peerEntry(id),
}))
// Singletons that MUST be a single copy across the graph (the always-required peers).
// dedupe is by bare-name; optional/feature peers don't need single-instance pinning.
const PEER_SINGLETONS = ['react', 'react-dom', 'react-router-dom']

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
    // Force a single copy of the always-required peer singletons regardless of where
    // pnpm physically places them in the .pnpm store.
    dedupe: PEER_SINGLETONS,
    alias: [
      // Source-package peers FIRST (exact-match regex) so the bare-specifier imports
      // inside the @statdash/* source (react-router-dom, i18next, react-leaflet, …)
      // resolve to the app's REAL installed copy instead of an unresolved import or
      // the empty __vite-optional-peer-dep stub. Data-driven from package peerDeps;
      // see header note.
      ...peerAliases,
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
