---
name: panel-plane-inspector
description: AR-52 relay Step 2 — the AUDIENCE-PLANE axis (author|steward|system) that hides system-plane plumbing from the author dock, plus the StructuredValueView reference-class JSON-tree craft component. The mechanism, the two chokepoints, and the leak tags.
metadata:
  type: project
---

**AR-52 relay Step 2 — "plane the inspector" (DONE 2026-07-15, commit a32b809; apps/panel + additive package edits; ZERO object-model change).** Spec: `docs/architecture/proposals/BLUEPRINT-panel-canonical-relay.md` §2 LAW A. Rides root **Law 11** ("projection with a plane") + ADR-043 Projector Law. Builds on [[project_facet_axis_style_facet]] + [[project_panel_authoring_features_misc]].

## The PLANE mechanism (additive, OCP)
- **`AudiencePlane = 'author'|'steward'|'system'`** — new type in `packages/core/src/config/prop-schema.ts`; `PropField.plane?` + `FacetDescriptor.plane?` (packages/react `engine/facet.ts`). **Absent ⇒ author** (every legacy field byte-identical). Re-export chain to reach `@statdash/react/engine`: core `prop-schema` → core `index.ts` → react `slice-meta.ts` → react `engine/types/slice.ts` → `engine/types/index.ts` → `engine/index.ts` (5 hops; add the symbol beside `PropField` in each `export type {…}` block).
- **The lens (app tier, `apps/panel/src/inspector/plane.ts`):** `planesForRole(role)` — author→`{author}`, steward→`{author,steward}`, **system is in NO role's set (projected to no one by default)**; undefined role ⇒ author (safe default). `isPlaneVisible(plane, planes)`, `filterSchemaByPlanes(schema, planes)`, `useVisiblePlanes()` (reads `useRole` — the swappable seam).
- **TWO chokepoints (DRY):**
  1. **Field level** — `Inspector.tsx` filters `schemaSource.getSchema(node)` through `filterSchemaByPlanes` BEFORE grouping. This ONE point covers EVERY render path incl. the nested-item editor (NestedItemControl's ObjectFormScreen delegates to the same generic `<Inspector>`). Empty groups drop automatically (`groupFields` skips zero-field groups) — the "Variables" group vanishes without touching pageGroups.
  2. **Facet level** — `registerFacetSections` (inspector/sections/builtins.tsx) `appliesTo` gains `isPlaneVisible(facet.plane, planesForRole(ctx.role))`. `ctx.role` is new on **`DockRenderCtx`** (optional; absent ⇒ author). `RightDock` reads `useRole()` and passes `role` into both DockBody ctx objects.
- **Guard:** `FF-NO-UNPROJECTED-DECLARED-FIELD` (`inspector/planeProjection.fitness.test.ts`) — the lens algebra, the real leaking schemas tagged, an author-projection sweep over real node schemas, and the steward-facet-needs-steward-lens leg.

## The leaks tagged (the screenshot-04 disease)
- `vars` (page derive-graph) → **system** — `features/page-config/pageSchemaSource.ts`.
- `presentation.crumbs` (derived breadcrumb VarExpr) → **system** — `packages/plugins/presentation/crumbsProjector.ts` schema field (rides the `presentation.` re-prefix).
- raw `dim→value` coordinate → **system** — kpi `filter` (`kpi-strip/default/KpiStripNode.ts` KpiValueItemSchema), slider `at` (`featured-slider/default/FeaturedSliderNode.ts`).
- kpi per-item `when` (VisibilityExpr) → **steward**.
- the **VISIBILITY facet** (`builtinFacets.ts`) → **plane:'steward'** (reachable behind the steward lens, not deleted).

## CRAFT — the reference-class structured render
- **`inspector/controls/StructuredValueView.tsx`** (+ `.css`) — a token-themed, collapsible JSON/config TREE, replacing RichValueDetail's `{…}` `<dl>` dump. Lib: **`react-json-view-lite`** (^2.5.0, 0-dep, ~4KB, TS-native, React 19; added to apps/panel). Theming: the lib's `style` prop takes a full class map — spread `defaultStyles` (keeps aria/behaviour defaults) then override the visual slots with our BEM classes bound to `--insp-*` DTCG tokens; we do NOT import the lib's CSS (own the glyphs via `::after` content `▸/▾`). `shouldExpandNode=(level)=>level<expandToLevel` (default 1 = top level only, drill-in per contextual-relevance canon). Designed empty state instead of bare "not set".
- `summarize.ts` genericSummary(object) no longer inlines raw keys (`by · op · prefix · source`) — shows the shape ("N fields"); keys live in the tree on Open.

## Gotchas that bit
- **`nodeRegistry.getSchema(type: string, variant?)` takes STRINGS, not a node object.** Passing `{type,props}` returns null (→ empty schema, silent). `getMeta`/`getSchema` are string-keyed; only the dock/controller pass node objects to OTHER seams.
- Tagging VISIBILITY steward broke facetProjection.fitness (elementCtx defaulted no role → author → facet hidden): fixed by defaulting that helper's ctx to `role:'steward'` so axis-completeness tests still see the facet; plane-filtering is proven separately in planeProjection.fitness.
- **dist rebuild required** (`pnpm -r --filter "./packages/**" build`) after core/react/plugins meta edits — the live app boots from dist (tsc-green ≠ dist-fresh). `dist/` is gitignored (don't stage).

## Out-of-scope surfaced (for the lead)
- EVENTS facet is author-plane (not hidden) — arguably steward (advanced). Flagged.
- transform-op "Measure column" (`packages/core/.../op-schemas.ts`, `field:'field'`) is a raw path token on the steward/data-pipeline surface — not the author inspector, left author.
