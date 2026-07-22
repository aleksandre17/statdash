---
name: panel-code-splitting
description: apps/panel bundle code-splitting — lazy boundaries (wizard steps, canvas, cmdk, saveGuard) + Rolldown codeSplitting vendor groups + the jsx-runtime/apexcharts priority gotcha
metadata:
  type: project
---

apps/panel (Constructor) ships a single Vite/Rolldown entry that was a 1.89 MB monolith. It is now route/feature code-split so the eager boot/shell is small and authoring surfaces load on demand.

**Lazy boundaries (React.lazy + dynamic import, accessible Suspense):**
- `features/wizard/ConstructorWizard.tsx` lazy-loads the 3 wizard steps (DataStep / SiteStep / PageStep) — only one renders at a time, the natural route boundary.
- `features/wizard/steps/PageStep.tsx` lazy-loads `canvas/CanvasView` (the REAL @statdash/react renderer → pulls ApexCharts) and `command/CommandPalette` (cmdk). CommandPalette is only MOUNTED when `cmdk.open` (so the cmdk chunk loads on first ⌘K, not on PageStep paint).
- `store/api-actions.ts` lazy-imports `save/saveGuard` (`const loadSaveGuard = () => import('../save/saveGuard')`) inside the save thunks — saveGuard pulls the ~150 kB engine graph (nodeRegistry + canvasPageAdapter + validateField) and is reached ONLY on save, never on boot. `assertSaveable` became async; callers already async.
- `command/useCommandPalette.ts` is split OUT of CommandPalette.tsx so the eager hook (owns ⌘K listener + open state) stays cmdk-free while the palette UI is lazy. Import the hook from `command/useCommandPalette` (NOT the `command` barrel) on eager paths, else the barrel re-pins cmdk into the importer's chunk (INEFFECTIVE_DYNAMIC_IMPORT warning).
- Shared accessible fallback: `shared/SuspenseFallback.tsx` (role=status, aria-live=polite, aria-busy, aria-label'd spinner). `fill` prop: true=fill area, false=inline (use false for portal/overlay surfaces like the palette).

**Vite/Rolldown vendor chunking (vite.config.ts → build.rolldownOptions.output.codeSplitting.groups):**
- Vite 8 is Rolldown-based. The option is `codeSplitting` (NOT rollup `manualChunks`; `advancedChunks` is the deprecated alias). Shape: `{ groups: [{ name, test: /regex/, priority }] }`.
- Groups: react-vendor (priority 40), apexcharts (30), dnd-kit/cmdk (25), mui (20).
- **GOTCHA (load-bearing):** react-vendor MUST have the HIGHEST priority. `includeDependenciesRecursively` (default true) otherwise pulls `react/jsx-runtime` (which every component needs) INTO the apexcharts chunk, forcing the entry to eager-load the 537 kB charting lib just to reach jsx-runtime. Symptom: apexcharts chunk starts with React Symbols and is modulepreloaded in dist/index.html. Verify the fix by checking dist/index.html modulepreload list — apexcharts/cmdk/dnd-kit/engine must NOT be there.

**Result:** eager set ≈732 kB raw / ≈220 kB gzip (index 63 kB + react-vendor 292 + mui 359 + store/api/adapter). On-demand: apexcharts 537, engine 217, controls 248, dnd-kit 44, cmdk 44, DataStep 48, PageStep 37, CanvasView 18. mui+react-vendor dominate the eager shell (react-admin AdminContext + LoginForm) — not split further (YAGNI, shell must stay eager).

**Pre-existing residual (not in scope):** INEFFECTIVE_DYNAMIC_IMPORT on `packages/plugins/datasources/stats-api.ts` (was in baseline). `features/sections/` and `layout/` are orphan modules (no importers, tree-shaken).

## `@statdash/expr` — bundler-agnostic dev-flag pattern
`packages/expr` is zero-dep, bundler-agnostic pure-TS with its OWN standalone `tsup index.ts
--format esm --dts` build (no Vite, no Node types in scope). Dev-only diagnostics there must read
the dev flag via a self-contained LOCAL CAST, never: `process.env.NODE_ENV` (Node-ism, undefined
in browser); bare `import.meta.env.DEV` (needs `vite/client` ambient types, absent from expr's own
tsup `--dts` build → TS2339); or a global `interface ImportMeta{env?:...}` ambient `.d.ts` (LEAKS
through the `@statdash/expr/src/*` path alias into consuming apps' type graph and weakens their
OWN `import.meta.env.X` to "possibly undefined" — declaration merging on a global interface from a
shared package is not scoped).

**Correct pattern** (in `derive.ts`):
`function isDevMode(){ const env=(import.meta as {env?:{DEV?:boolean}}).env; return env?.DEV===true }`
— local cast, no global augmentation; Vite still statically replaces DEV, other bundlers read
falsy and the branch dead-strips. The general convention elsewhere (packages/core, packages/react)
is bare `import.meta.env.DEV` because those run only through Vite — this pattern is specifically
for a package with its own bundler-less `tsup --dts` build that is ALSO path-aliased into apps.

Note: `build:engine` (`pnpm -r --filter ./packages/* build`) is pre-existing RED independent of
this — packages/core's standalone dts build fails TS7016 on `@statdash/expr` when expr's dist
`.d.ts` is stale. Not one of the platform's green gates (build/typecheck/test/lint are).
