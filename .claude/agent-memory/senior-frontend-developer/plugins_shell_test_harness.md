---
name: plugins-shell-test-harness
description: How to render REAL plugin shells in packages/plugins vitest (axe/a11y/render) — i18next optional-peer stub, jsdom Apex/Leaflet limits, provider stack, direct-call vs renderNode
metadata:
  type: project
---

Rendering real plugin shells (chart/kpi/table/filter-bar/perspective-bar/map/gauge/hero) in `packages/plugins` vitest tests (e.g. `__tests__/shellAxe.fitness.test.tsx`, the FF-PLUGIN-SHELLS-AXE-CLEAN gate):

**i18next is an OPTIONAL peer of @statdash/react, NOT resolvable from plugins** (only apps/geostat has it). Real shells pull `useT` → static `import i18next`. Fix: alias `i18next` → a passthrough stub in `plugins/vitest.config.ts` (`{ find: /^i18next$/, replacement: '__tests__/__stubs__/i18next.ts' }`). The stub needs `default.t`, `t`, `init`, `use`, `addResources`, `addResourceBundle` (registerSlice calls `addResources`). `t(key)` returns the key's local part.

**Why:** mocking the whole `@statdash/react` (the committed PerspectiveBar pattern) breaks SiteProvider/useInject for content-rich shells. The alias resolves i18next so the FULL provider stack works.

**Provider stack a shell needs:** `<MemoryRouter><SiteProvider stores nav i18n><PageStoreProvider store><FilterProvider><FiltersProvider value={{bars,perspectiveKey}}>`. `createDefaultUI()` (from `@statdash/react/engine/createDefaultUI`) supplies EMPTY_STATE/PANEL_LAYOUT/EXPORT_BAR for `ctx.ui`. `ExtensionRegistry` is exported from `@statdash/react` (NOT /engine); `DefaultCommandBus` only from `@statdash/react/engine/commands/CommandBus`.

**jsdom reality:** chart/gauge/map mount ApexCharts/Leaflet which CANNOT render in jsdom — render them on the EMPTY path (`rows=[]` → the shell's own EmptyState, still real shell output). Plain-HTML shells (table/hero/perspective-bar/filter-bar) render WITH content (where th/scope, labels, tablist a11y risk lives). TableShell reads `ctx.rows` directly; filter controls (year-select) need `FilterProvider`+`PageStoreProvider`+bars or they throw on `useFilter()`.

**Direct shell call (`shell(def, ctx, children)`), NOT renderNode:** renderNode wraps every node in NodeErrorBoundary, so a crashing shell renders an accessible fallback and axe passes VACUOUSLY. Direct calls make a crash a test crash. Add a non-vacuous guard: `expect(container.querySelectorAll('*').length).toBeGreaterThan(0)`.

See also [[i18n-label-completeness-gate]].
