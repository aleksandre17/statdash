---
name: bounded-element-bands
description: The band-selection seam (ADR-038/039) — homogeneous props bands vs the discriminated page-filter band; the BandSource port decision
metadata:
  type: project
---

The Bounded-Element canvas selection (ADR-039, extends ADR-038) makes a value-band ITEM
selectable + inspectable. Two distinct band shapes now exist; the seam that unifies them
is a **BandSource port** (Strategy/DIP), decided in the ADR-039 BE-4 delta.

- **Homogeneous props band (BE-1, SHIPPED).** kpi-strip `items[]`: a `PropField`
  `type:'array'+itemSchema` whose values live in `node.props[field]`. Enumerated by
  `bandItemsOf`/`bandFieldsOf` (`apps/panel/src/canvas/bandItems.ts`); anchored by the ONE
  generic `BandItemBoundary` (`packages/react/src/engine/bandAnchor.tsx`, on only under
  `AuthoringAnchorContext`); dock projects `selectedBand.itemSchema` via `fixedSchemaSource`
  in `inspector/sections/builtins.tsx` (`element.schema` section). Read/write by dot-path
  (`getAtPath`/`setAtPath` on props).

- **Discriminated page-filter band (BE-4, DESIGN SETTLED, NOT yet landed).** The filter-bar's
  filters are NOT on the node — they live in the page SSOT `page.meta.filterSchema.bars[barId].filters`
  (a `Record<key, ParamDef>`, page-owned, runner reads via `useFilterState`). Per-item schema is
  DISCRIMINATED by `type`, resolved via engine `param-schema-registry` `getParamSchema(type)`
  (the same registry `filterParamSchemaSource` reads). So a single `itemSchema` cannot fit, and
  the values aren't in node.props.

**Seam decided:** generalize BE-1 into a declared BandSource the node names in its META (a
generic `band` descriptor — NOT a `type==='filter-bar'` branch). `propsBandSource` = today's band;
`filterSchemaBandSource` reads via the shipped `toBarViews`, resolves schema via `getParamSchema`,
writes via `setBarParams`/`commitBar` (`apps/panel/src/features/filters/{filterSchemaModel,useFilterBarAuthoring}.ts`)
— ZERO SSOT fork, no `packages/react` runner change. REJECTED: denormalizing filters onto node.props
(forks the page SSOT + can't express the discriminated union).

**Why:** owner "the filtration items are also not objects" — filters must ride the SAME BE-1 gesture
(click item → bounded selection → its declared contract), one machinery, not the parallel
`FilterBarControlsBridge` drill-list that already exists.

**How to apply:** BE-4 landing is a 3-layer additive slice, NOT apps/panel-only as work item 0062
assumed: `packages/react` (band descriptor on `NodeSliceMeta`), `packages/plugins` (`FilterBarShell`
wraps each control in `BandItemBoundary(barId,key)` + META declares the descriptor), `apps/panel`
(BandSource port + 2 adapters + overlay/controller/dock generalize + FF-FILTER-ITEMS-DECLARED-BAND +
`filterItemSelect.e2e.ts`). FF-NO-EXTERNAL-SPECIAL-CASE must stay green. See [[strict-solid-per-element]].
