---
name: test-harness-gotchas
description: "Three vitest harness gotchas — rendering REAL plugin shells (i18next optional-peer stub, jsdom Apex/Leaflet limits), a full render-path test for the geostat runner (boot sequence, jsdom shims, alias bug), and packages/react's pre-existing exportMenu.fitness whole-suite hang. Consolidated distillate."
metadata:
  type: project
---

> Consolidated 2026-07-22 from 3 sibling files (plugins-shell-test-harness,
> geostat-runner-render-test-harness, react-exportmenu-fitness-hangs-gate).

## Rendering REAL plugin shells in `packages/plugins` vitest
**i18next is an OPTIONAL peer of @statdash/react, NOT resolvable from plugins** (only
apps/geostat has it) — real shells pull `useT` → static `import i18next`. Fix: alias `i18next` →
a passthrough stub in `plugins/vitest.config.ts`. The stub needs `default.t`, `t`, `init`, `use`,
`addResources`, `addResourceBundle` (registerSlice calls `addResources`); `t(key)` returns the
key's local part. **Why not mock `@statdash/react` wholesale:** that breaks
SiteProvider/useInject for content-rich shells — aliasing i18next lets the FULL provider stack run.

**Provider stack a shell needs:** `<MemoryRouter><SiteProvider stores nav i18n><PageStoreProvider
store><FilterProvider><FiltersProvider value={{bars,perspectiveKey}}>`. `createDefaultUI()`
(`@statdash/react/engine/createDefaultUI`) supplies EMPTY_STATE/PANEL_LAYOUT/EXPORT_BAR for
`ctx.ui`. `ExtensionRegistry` exports from `@statdash/react` (not `/engine`); `DefaultCommandBus`
only from `@statdash/react/engine/commands/CommandBus`.

**jsdom reality:** chart/gauge/map mount ApexCharts/Leaflet, which CANNOT render in jsdom — render
them on the EMPTY path (`rows=[]` → the shell's own EmptyState, still real shell output).
Plain-HTML shells (table/hero/perspective-bar/filter-bar) render WITH content (where a11y risk
lives — th/scope, labels, tablist). TableShell reads `ctx.rows` directly; filter controls need
`FilterProvider`+`PageStoreProvider`+bars or they throw on `useFilter()`.

**Direct shell call `shell(def,ctx,children)`, NOT `renderNode`:** renderNode wraps every node in
`NodeErrorBoundary`, so a crashing shell renders an accessible fallback and axe passes VACUOUSLY.
Direct calls make a crash a test crash. Add a non-vacuous guard:
`expect(container.querySelectorAll('*').length).toBeGreaterThan(0)`.

## A full render-path test for the geostat runner
Boot like `main.tsx`: `i18next.init({lng:'en',fallbackLng:'en',resources:{},...})` then
`setupRegistrations()` in `beforeAll` (else `nodeRegistry.get(type)` is empty and nothing
renders). Register manifest data as App.tsx does:
`manifest.modes.forEach(modeRegistry.register)` + `registerFormatters(manifest.i18n.locales)`.
`@testing-library/react`+jest-dom live in the ROOT `platform/package.json` devDeps (hoisted), not
apps/geostat's own package.json, but resolve fine. The geostat vitest project name is
`national-accounts` (the package name), not `geostat`.
**jest-dom matchers + jsdom observer shims must load via `setupFiles`**
(`apps/geostat/vitest.setup.ts` imports `@testing-library/jest-dom/vitest`, stubs
IntersectionObserver + ResizeObserver as no-ops — jsdom ships neither; SectionNavContext uses the
former, charts the latter, so full pages crash without them).
**Fixed alias bug in `vitest.config.ts`:** `{find:'@/',replacement:'src'}` dropped the slash
(`@/extensions/registry` → `srcextensions/registry`) — changed to `{find:'@',replacement:'src'}`
to match `vite.config.ts` (Vite's string-alias boundary matches `@`/`@/...` but not
`@statdash`/`@testing-library`, which need a `/` right after; the `@statdash/*` aliases must
precede it in the array).
**Test isolation:** add `afterEach(cleanup)` — without it a prior test's DOM leaks and a missing
element can false-pass via a sibling's render.

## packages/react whole-suite vitest HANG — a known pre-existing file, not a regression
Running the WHOLE `packages/react` suite hangs with zero output; isolated to
`src/components/feedback/exportMenu.fitness.test.tsx` (times out even alone — every other file
passes in seconds). Present before any recent edits; not a load issue (the plugins suite, 65
files/493 tests, finishes in ~29s).
**How to apply:** for a `packages/react` gate, don't run the whole suite — run the touched
directories/files explicitly (`vitest run src/components src/engine/hooks …`). Treat a
whole-suite timeout as this known file, not a regression: confirm your own touched files pass in
isolation + tsc is clean. `--reporter=basic` does NOT exist in vitest 4 (throws a custom-reporter
load error) — use the default reporter.
