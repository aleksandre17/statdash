---
name: grid-maximal-grammar
description: AR-5 — the `grid` layout node is the maximal CSS-Grid JSON grammar (resolveGrid + @container cascade); how to extend it and why the 6 wraps stay
metadata:
  type: project
---

AR-5 (BUILT `0b10f90`): the `grid` layout node is the **maximal JSON grammar of CSS Grid** — the reference-grade layout primitive of the platform.

**Shape (all under `packages/plugins/nodes/layout/grid/default/` + `packages/styles`):**
- `GridNode.ts` — schema declares `templateColumns/Rows/Areas`, `autoFlow/autoColumns/autoRows`, `columns` shorthand, `gap`, `align`, `justify` (Constructor-introspectable palette).
- `resolveGrid` (`packages/styles/src/resolvers/layout.ts`) — pure `GridSpec → {style,data}`. The three TEMPLATE props ride the **shared dual-route** engine (same as `node.ts setResponsive` / `applyContainerVars`): flat value → inline style (the intrinsic `repeat(auto-fit, minmax(min(100%,…),1fr))` reflow lives here); responsive value → `--grid-<axis>-<bp>` vars + a `data-grid-<axis>-responsive` flag. `columns` lowers to `repeat(N, minmax(0,1fr))`.
- `layout.css` — `@container grid` cascade reads those vars (large→small, smaller wins; mirrors `node-styles.css`). `align`→align-items, `justify`→justify-items via `data-*`. Container-query driven, NOT viewport-coupled.
- `GridShell` — pure interpreter (spread `{style,data}`, never inspect); per-child `colSpan/rowSpan/align/order` rides `LayoutItemProvider` (`resolveLayoutItem`).

**How to extend (OCP):** a new grid prop = add to `GridSpec`/`GridNode` schema + the `GRID_RESPONSIVE`/`GRID_FLAT` map in `resolveGrid` + (if responsive) an `@container` cascade block in `layout.css`. Flat-inline is the cheap default; promote to the var+flag route only when a real per-breakpoint consumer exists (YAGNI-on-population, maximal-on-seam — [[feedback-maximal-orthogonality]]).

**Guards:** FF-GRID-MAXIMAL (`grid.fitness.test.ts` — schema surface + resolveGrid dual-route + `@container` wiring) and FF-GRID-COMPOSITION (`apps/api/.../config-grid-composition.fitness.test.ts` — grid adoption, no `count>=2` ladder, no empty grid, wraps keep aspectRatio).

**The 6 `wrap` nodes are KEPT, not weak (Chesterton's fence):** each distributes a responsive `aspectRatio` to a **chart↔table TOGGLE** (SectionShell renders each child in `.section__view[data-view]`, one visible at a time). That is distributed-STYLE (the FILL-vbar band on `.chart-wrap[data-aspect]`, locked by `packages/styles/src/panel-sizing.fitness.test.ts`), NOT layout composition. Converting them to grid/columns lays the toggle side-by-side and regresses verified definite-height. Do NOT "eliminate wrap to raise a grid count" — that is metric-gaming the owner's standard forbids.

**Provisioning adoption:** section pairs = `grid` + `repeat(auto-fit, minmax(min(100%, 24rem), 1fr))` (continuous container-driven 2↔1 reflow, superior to a `columns count:2` step). A `columns count:1` is only weak when it wraps ONE section; over a `repeat` fan-out it is deliberate full-width stacking — keep it (accounts page). Relates to [[project_responsive_composition_model]].
