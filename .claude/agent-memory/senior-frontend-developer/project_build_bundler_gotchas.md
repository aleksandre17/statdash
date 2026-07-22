---
name: build-bundler-gotchas
description: "apps/geostat Rolldown code-splitting (the single lazy RendererSurface boundary + the store-builder eager-registration ordering regression) and the data-driven optional-peer Vite alias mechanism both apps share (entry-file vs directory, subpath-import runtime resolution, nested export-condition objects). Consolidated distillate."
metadata:
  type: project
---

> Consolidated 2026-07-22 from 2 sibling files (geostat-code-splitting,
> optional-peer-vite-resolution). See [[project_panel_code_splitting]] for the panel's mirror of
> the same Rolldown vendor-chunking pattern.

## geostat's single lazy boundary — `src/app/RendererSurface.tsx`
Geostat's whole renderer weight roots in TWO eager static chains from main.tsx: (1)
`setupRegistrations()` → `@plugins/panels` (ApexCharts) + `@plugins/nodes` (Leaflet) and (2)
`App → LocaleGuard → NodePageRenderer + AppChrome` (engine). BOTH must move behind one dynamic
import to clear the entry. `RendererSurface.tsx` owns both — runs `setupRegistrations()` at
module top-level AND renders the `SiteProvider`+`Routes` tree; `App.tsx` lazy-loads it via
`React.lazy`. `main.tsx` keeps `i18next.init()` (sync, before createRoot) eager; its
`setupRegistrations()` call was removed.

**ORDERING REGRESSION (fixed) — store-builders must register EAGERLY, before bootstrap.** Moving
`registerStoreBuilders()` into the lazy `setupRegistrations` broke every chart/table/map on the
live deploy: App's `bootstrapSite()` (a `useEffect`) CONSUMES the store-builder registry
(`fetchStoreManifest→buildStoreManifest` throws on an unregistered kind) — but the lazy
RendererSurface only loads AFTER bootstrap resolves, so no builder was registered in time. Fix:
`registerStoreBuilders()` split OUT into `src/bootRegistrations.ts`, called EAGERLY in main.tsx
before `createRoot().render()` — it's light (no ApexCharts/Leaflet). **The lesson:**
"init → register → render" overlooked that BOOTSTRAP is a THIRD actor consuming a registry before
the lazy register runs — any registry touched at bootstrap must be primed eagerly. Regression
guard: `boot-store-registration.test.ts` asserts `buildStoreManifest` succeeds after
`bootRegistrations()` alone, without importing the lazy module.

**Test invariant (load-bearing):** fitness tests import `setupRegistrations`+`LocaleGuard`
DIRECTLY and call them synchronously, never through the lazy module — so `setupRegistrations` must
stay a plain synchronously-importable function.

**Vendor chunking gotcha (shared with panel):** react-vendor MUST have the HIGHEST Rolldown
`codeSplitting` group priority, or `react/jsx-runtime` gets pulled into the apexcharts chunk by
`includeDependenciesRecursively`, forcing an eager load of the whole charting lib. Verify via the
dist `index.html` modulepreload list.

## The data-driven optional-peer Vite alias (both apps' vite.config.ts)
Both apps build `@statdash/*` packages from SOURCE (`resolve.alias`), so Vite/Rolldown walks
`packages/*` and hits THEIR OWN bare peer imports from within — `react-router-dom`/`i18next` (from
packages/react), `react-leaflet`/`leaflet`/`react-apexcharts` (optional, from packages/plugins).
With `.npmrc shamefully-hoist=false` (strict isolation) these are NOT linked into the source
package's own `node_modules`. A clean (Docker) build fails; a dirty local `node_modules` masks it.
Never convert a peer to a hard dep to "fix" this — keep the isolation, fix the alias.

**Mechanism (per-app local helper, package.json IS the SSOT):** `sourcePackagePeers()` reads
every source-aliased package's `peerDependencies` and UNIONs the names (currently 7: react,
react-dom, react-router-dom, i18next, react-apexcharts, leaflet, react-leaflet).
`peerEntry(id)` resolves each to its absolute ESM entry file; aliased via regex
`{find:/^id$/, replacement:<abs entry>}` (so subpath imports like `leaflet/dist/leaflet.css` stay
untouched by THIS alias). `resolve.dedupe` pins the always-required singletons
(react/react-dom/react-router-dom) — optional/feature peers don't need single-instance pinning.

**Gotcha 1 — entry FILE, not directory.** Aliasing a peer to its package directory re-runs Vite's
legacy main-field resolution, which prefers the top-level `browser` field — react-apexcharts'
`browser` is an IIFE bundle with NO `default` export → MISSING_EXPORT. Fix: resolve the explicit
ESM entry from `exports['.']`.

**Gotcha 2 — nested export-condition OBJECTS.** i18next's `exports['.'].import` is itself an
object (`{types,default}`), not a flat string — a naive `dot?.import ?? dot?.default` picker
throws `paths[1] must be string`. Fix: a RECURSIVE `pickExportTarget(node)` walking condition keys
in order `['source','import','browser','module','default']` until it hits a string, falling back
to `pkg.module`→`pkg.main`. Only looks inside `exports['.']` (+module/main), never the top-level
`browser` field (keeps Gotcha-1 avoided).

**Gotcha 3 — subpath imports fail at RUNTIME, not build.** The exact `/^id$/` alias resolves only
the bare specifier, leaving subpaths (`leaflet/dist/leaflet.css`) to normal resolution — which has
none under the same isolation. The build PASSES; the deployed app throws at runtime. Fix: a SECOND
alias per peer `{find:/^id\//, replacement:peerDir(id)}` (package ROOT dir + trailing `/`),
exact-match BEFORE prefix-match. **Verification must be runtime, not build:**
`grep -rn "Could not resolve" dist` must be empty AND the actual asset must have landed in dist —
a passing build alone is not sufficient evidence.

**Guard:** `peerEntry` try/catches the resolve and throws a clear "peer X is not resolvable —
declare it as a direct dependency" instead of emitting a bare `undefined` into `resolve.alias`
(a real prior failure mode). `react-i18next` is correctly excluded (not a declared peer of any
source package).
