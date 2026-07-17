---
name: panel-live-canvas
description: N35 mounted the real NodePageRenderer as the Constructor canvas; packages/react + packages/plugins carry undeclared host deps that the panel must provide
metadata:
  type: project
---

The Constructor (`apps/panel`) page step renders the real `@statdash/react` `NodePageRenderer` as a live WYSIWYG canvas (N35), not a mock preview. Canvas code lives in `apps/panel/src/canvas/` (CanvasView, CanvasOverlay, NodePalette, setupCanvasRegistry, canvasPageAdapter, walkNodes, paletteEntries).

**Why:** turn the form-only editor into a true WYSIWYG tool — the JSON config is the single source of truth, rendered verbatim by the engine. The store keeps a flat `CanvasPage` (nodes map + nodeIds); `canvasPageAdapter.toNodePageConfig` projects it into the engine's `NodePageConfig` tree for rendering.

**How to apply:**
- The canvas mounts the renderer behind a `SiteProvider` with `staticStore` (empty rows) — never a real API call. Selection/drop-zone interaction is a separate transparent overlay (`pointer-events` split between the two layers).
- Drop zones come straight from `nodeRegistry.getSlots(type)` (the `SlotDef.accepts` list). The palette comes from `nodeRegistry.list()` filtered by `!rootOnly`. Do NOT invent new SliceMeta/SlotDef fields — the taxonomy already supports this.
- To render the engine, the panel imports the HEAVY `@statdash/plugins` registry (Shell components), which pulls `react-apexcharts` + `leaflet`. The light `@statdash/plugins/catalog` (palette metadata) is separate.

**Undeclared engine deps (latent bug, flagged to architect):** `packages/react` imports `i18next` and `packages/plugins` imports `react-router-dom` / `react-apexcharts` / `leaflet` WITHOUT declaring them — they rely on the host app hoisting them. Under pnpm isolation these bare specifiers are unresolvable from the engine source dirs during a panel-rooted vite transform. `apps/panel` now declares them and pins each to the panel-resolved copy via `resolve.alias` in `vite.config.ts` + `vitest.config.ts` (see the host-externals block). The proper fix is `packages/react`/`packages/plugins` owning these as real deps.

**Testing:** the platform test wiring migrated to `vitest.config.ts` `test.projects` (Vitest 4 dropped `vitest.workspace.ts` auto-discovery). `apps/panel` IS now listed as a project there and each project uses its OWN `vitest.config.ts` (so the panel's `resolve.alias` — `@statdash/react/engine` subpath + host-external pins + SOURCE resolution of `@statdash/engine`/`@statdash/plugins`, NOT dist — still applies). A panel-only run is `cd apps/panel && npx vitest run`; a targeted cross-package run is `npx vitest run <path…>` from the platform root. i18next must be `init()`-ed in the vitest setup before `registerSlice` runs, and jsdom needs a `ResizeObserver` stub. See [[engine-react-no-registerslice-in-tests]].
