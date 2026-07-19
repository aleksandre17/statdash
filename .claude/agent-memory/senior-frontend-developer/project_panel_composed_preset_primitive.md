---
name: project-panel-composed-preset-primitive
description: ADR-049 P2b / ADR-050 R2 — composed-preset primitive (presetRegistry + planPresetInserts + palette Starters band)
metadata:
  type: project
---

# Composed-preset primitive (ADR-049 P2b · ADR-050 R2)

"Pick a whole, then tweak" — a preset is a partial element declaration projected into the palette as an insertable whole.

**Shape (the seams):**
- `platform/packages/react/src/engine/PresetRegistry.ts` — engine-resident, app-AGNOSTIC MECHANISM. `PresetDecl { id, label(LocaleString), icon?, category?, caps?, seed }` + recursive pure-config `NodeSeed { type, variant?, props?, data?:DataSpec, view?:{visibleWhen}, children? }`. `presetRegistry` singleton + `registerPreset`/`getPresets`. Exported from the react engine index. Sibling of `objectRegistry` (NOT a field on ObjectMeta, NOT getDefaults — Q1 residence).
- `apps/panel/src/canvas/insertNode.ts` — `planPresetInserts(seed, plan, makeId)` + `planPresetPlacement(...)`. Overlays `makeNode` recursively (props={...getDefaults,...seed.props}; data→props.data; view MERGED into props.view to not clobber view.role). **childIds left EMPTY on every built node** — parent↔child expressed ONLY via each op's `parentId`; the reducer (`insertNodePatch`) wires childIds from it, exactly like `planInserts`. Pre-order ids via same makeId. `makeNode`/`resolveInsertPlan` UNTOUCHED (V6 held).
- CONTENT = shell-registered: `apps/panel/src/canvas/canvasPresets.ts` (`registerCanvasPresets()` wired into `setupCanvasRegistry`). Domain metric ids live here (above the arrow).
- Palette: `NodePalette` renders a `starters` band (PresetItem) ahead of tiles; drag sets `nodeType`(seed root) + `presetId`. `CanvasOverlay.handleDrop` reads `presetId`, `onDrop` gained optional 4th param. `useCanvasController.handleDrop` branches: preset → `planPresetPlacement`, else the bare path. Both commit through the ONE `placeSlotPart`.

**Birth-defaults seam (R2 crash root-cause, 0102).** `planPresetInserts`→`buildSeedInserts`→`makeNode` DOES apply `getDefaults(type)` recursively to every seed node (root AND child) — so a preset child inherits its type's birth defaults. The gap that crashed the section→chart starter was NOT the insert path but that **`getDefaults('chart')` was `undefined`** (chart META declared no `defaults`). A chart born from ANY path (palette drop, preset, hand-author) then lacked `chartType`; once BOUND (rows>0) `useChartOutput.resolveChartType` reads `.$ctx` off undefined chartType → THROW (caught by NodeErrorBoundary). Fix = declare `defaults: { chartType: 'bar', view: { role: 'chart' } }` on `packages/plugins/panels/chart/default/meta.ts` (declare-once, ADR-038; type-agnostic — no per-type branch). RULE: **a node type whose render REQUIRES a field must seed it in `META.defaults`** — that is the birth-defaults SSOT every creation path reads. (`preset-chart-timeseries` only escaped the crash because its `view.visibleWhen: perspective-is range` hides it in the default perspective — NOT because of view.role.) Latent shared cause with card 0103: `resolveChartType`'s unguarded `.$ctx` read still throws for any chart reaching the shell with `chartType` nullish from a non-makeNode source (legacy config / cleared required field) — flagged, not fixed here.

**Gotcha — kpi-strip binds per-item, NOT node.data.** A kpi-strip preset binds `items[].value.measure` (governed metric-ref) + `items[].trend`; a stray `node.data` bind reroutes every sibling KPI through the wrong store (WORK-0083). Chart/table ARE `data-bindable` via props.data.

**Gates (green):** FF-PRESET-DEGENERATE-IDENTITY + FF-PRESET-INSERT-NEVER-CLIFF + registered-preset projection in `apps/panel/src/canvas/presetInsert.fitness.test.ts`. Two existing palette tests (`NodePalette.test`, `paletteContextual.fitness`) scoped their button counts to node tiles (`:not([data-preset-id])`) since presets are an additive band.

**Why:** closes the assembly-by-hand defect — a dropped object arrives as a composed, data-bound whole, not a blank shell.
**How to apply:** a new preset = ONE `PresetDecl` in canvasPresets.ts (or any shell), zero panel/engine edit. R3 will generalize PresetDecl to a page root (page-kind × preset) — not built here.

Related: [[project_panel_p2a_substrate_unbury]] · [[project_panel_insert_accept_graph_gap]] · [[project_panel_layout_assembly_r1]]
