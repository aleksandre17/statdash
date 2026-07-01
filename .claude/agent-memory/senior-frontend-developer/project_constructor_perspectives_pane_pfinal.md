---
name: constructor-perspectives-pane-pfinal
description: Perspectives pane (page-level PerspectiveAxis authoring) in apps/panel — schema-driven scope source, record⇄list adapter, when/available + filter-item visibleWhen surfacing, round-trip fitness
metadata:
  type: project
---

# Constructor Perspectives pane (VISION #3 P-final)

The page-level "Perspectives" authoring surface in `apps/panel/src/features/perspectives/` — the Power BI bookmark-pane IA over a `PerspectiveAxis`. Lands the perspective-axis refactor's Constructor surface (engine + contracts + api were already shipped P0–P6).

**Why:** Phase-2 platform story — a non-coder authors `page.perspectives` JSON visually, no hand-written config (Law 2). Replaces the deleted `ByModeEditor` authoring need.

**How to apply / key facts (verify before relying — files may move):**
- The page stores `PerspectivesByParam` (`Record<urlParam, PerspectiveAxis>`) at `page.meta.perspectives`, carried losslessly by canvasPageAdapter. The pane writes the full `nextMeta` via `updatePage`.
- `perspectiveModel.ts` = pure record⇄ordered-list adapter (mirrors `filterSchemaModel.ts`): `toAxisViews`/`setAxisPerspectives`/`movePerspective`. `perspectives[0]` IS the default (one SSOT) — reorder changes the default.
- **Scope fields are REGISTRY-DRIVEN (Law 8 / OCP):** `perspectiveScopeSchemaSource` unions `listPerspectiveScopeKeys()` (engine) and re-prefixes each key's PropSchema to `scope.*` (same re-prefix trick as `presentation.*` in pageSchemaSource). A new `registerPerspectiveScopeKey()` auto-surfaces in the pane with ZERO pane edit. timeBinding + metric register today.
- `perspectiveDefSchemaSource` = identity (label `LocaleString` + icon) + the scope fields, grouped Identity/Scope. `id` is NEVER a schema field (immutable identity, like ParamDef `key`/`type`). `when`/`available` are NOT scalar fields — authored via the recursive `VisibilityBuilder` (escape-only, seeded `perspective-is`).
- The coverage gate's 5th axis (`PERSPECTIVE_SCOPE_KEYS` in `data-layer/coverage.fitness.test.ts`) reads the SAME engine registry — satisfied by construction (it was already wired pre-P-final; the pane is the real surface it asserts).
- **Per-node `when: perspective-is` was ALREADY surfaced** (VisibilityBuilder has perspective ops; EnumRefField resolves `perspectives` from perspectiveRegistry; VisibilitySection in the node Inspector). P-final only ADDED the **filter-item `visibleWhen`** surfacing: a `VisibilitySection` in `ParamDefEditor` writing `param.visibleWhen` (cross-cutting field, NOT in any param PropSchema — so it needs the explicit section, like a node's `view.visibleWhen`).
- Removed the raw `perspectives` object JSON field from `pageSchemaSource` (pane replaces it); updated `PageInspector.test.tsx` to assert `not.toContain('perspectives')`.
- Round-trip: `perspectiveModel.test.ts` (FF-PERSPECTIVE-ROUNDTRIP) — full PerspectiveDef (pin/targetKeys/metric/when/available/icon) survives author→view→commit identical + JSON.stringify identity.
- Live-canvas preview of the active perspective is NOT wired: `CanvasView` does not accept a `perspectiveState` prop. The pane has a role=radiogroup preview chip-row (local state only). Wiring it to drive the live render needs a CanvasView→NodePageRenderer `perspectiveState` seam (escalated, not forced).
- Mounted in `PageStep.tsx` right rail after PageInspectorPanel, before FiltersDrawer (page-scoped like both).
