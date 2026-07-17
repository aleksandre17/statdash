---
name: responsive-authoring
description: Per-breakpoint responsive authoring LANDED via ONE unified value-authoring control (fixed·bound·responsive); the active-breakpoint context has two projections
metadata:
  type: project
---

Per-breakpoint responsive authoring (Builder.io/Framer hallmark) LANDED on branch
`feat/ar49-m0-metric-first-authoring` (capability injection #3), unified with binding
into ONE value-authoring model — NOT a third bolt-on wrapper.

**The unified model.** `apps/panel/src/inspector/controls/ValueAuthoringControl.tsx` is
now THE single wrapper the Inspector routes every field through (absorbed + deleted
`BindableControl`). It presents the value's MODE: fixed (literal) / bound (`{ $bind }`,
the ⚡ affordance — DOM byte-preserved: `.insp-bind__toggle/__expr/__preview`) /
responsive (`{ default, md, … }`). Modes COMPOSE: a breakpoint entry is authored through
the SAME control recursively (`allowResponsive={false}`), so an entry can be literal OR
bound — and the render seam already resolves a `$bind` INSIDE a responsive object
(resolveBindings deep-walks; only `children`/`items` skipped). A field with neither
capability returns the bare Control (reference-identical, Law 8).

**Opt-in = declaration.** `PropField.responsive?: boolean` (core `prop-schema.ts`, additive)
is the opt-in — the parallel of `coverage:'localized'`. Binding opts in by scalar `type`.
GridNode marks `columns` + `templateColumns/Rows/Areas` responsive. Zero per-type wiring.

**Two projections of ONE state.** `apps/panel/src/studio/activeBreakpoint.tsx` holds the
active authoring breakpoint. Projection 1 = the inspector writes `value[bp]`. Projection 2
= `CanvasView` caps the renderer layer to that band's width (`data-preview-bp` + a CSS var
in `canvas.css`), so the EXISTING container-query cascade (layout.css `@container`) reflows
LIVE — no second responsive mechanism. Switcher = `BreakpointSwitcher.tsx` in the canvas
toolbar. Reused `ResponsiveVal` + `resolveGrid` + `isResponsiveObject` (new styles SSOT
predicate); invented no breakpoint scale.

**Honesty (Law 11).** An unset non-base breakpoint inherits the nearest LARGER set value
(mirrors the CSS `var()` fallback), shown with an "inherited" annotation, never fabricated.

**Proof.** `valueAuthoring.fitness.test.tsx` locks additive/honest/unified; `responsiveAuthoring.e2e.ts`
proves live on :5173 (grid 4 cols base → 1 col md, reversible; unified control in responsive
mode). Full `tsc -b` green. Pre-existing branch failures unrelated to this slice:
token-cohesion (Select.css), no-tenant-content (colorProjector.ts), geostat perspective-render.

Sibling capabilities: [[dynamic-property-binding]] (⚡), [[conditional-formatting]] (thresholds).
GENERALIZATION path: the responsive affordance is generic — any `ResponsiveVal` prop (all of
NodeStyles is responsive-capable) opts in by adding `responsive:true` to its PropField; the
render half for NodeStyles vars already exists (node.ts setResponsive cascade).
