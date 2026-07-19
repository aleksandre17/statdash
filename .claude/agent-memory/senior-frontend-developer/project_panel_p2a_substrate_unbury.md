---
name: project-panel-p2a-substrate-unbury
description: ADR-049 P2a — three independent un-bury lanes (workbench kind-agnostic · band-item visibility · TrendField projection), each behind its own FF ratchet
metadata:
  type: project
---

ADR-049 P2a "substrate un-bury" (built 2026-07-19, on top of P1 `00117ef`). Three
independent lanes, each an additive FF ratchet at its tightened `[]` state. Extends
ADR-038/041 — no fifth grammar, no engine object-model change.

**Lane 1 — DataWorkbench is KIND-AGNOSTIC.** `DataFacetField.tsx` `canWorkbench = !!escalation`
(was gated on `spec.type==='query'|'pipeline'`). The seam that WOULD wipe a binding is
`openWorkbench` — now a pure `adoptOnOpen(spec)` in `dataFacetModel.ts`: a bound spec of ANY
kind is adopted intact (returns null → no write), only `!spec` seeds `freshPipelineSpec()`.
The un-gated door reaching a kind the workbench can't shape (row-list/timeseries/growth/
ratio-list → `toWorkbenchModel`=null) is NOT a dead room: `DataWorkbench` empty-state now
renders a `MetricPalette` bind that converts to a governed pipeline (emission flip, explicit
gesture). Gate `workbenchKindAgnostic.fitness.test.ts` (FF-WORKBENCH-KIND-AGNOSTIC): source-scan
no per-kind `spec.type ===` gate literal + adoptOnOpen round-trip.

**Lane 2 — band-item visibility (pure wiring, kpi-strip ONLY).** `KpiStripNode.ts` item `when`
field `type:'object'`→`'visibility'` → the nested-item Inspector dispatches it to the already-
built `VisibilityField`/`VisibilityBuilder` (registered under `'visibility'`). **featured-slider
items have NO `when` field** — the brief's "and featured-slider" was inexact; consistent with
OPAQUE_BY_DESIGN which only listed `kpi-strip.items.when`. Gate `bandItemVisibility.fitness.test.ts`.

**Lane 3 — TrendField (genuinely new, grep=docs-only).** Added `'trend'` to core `PropFieldType`.
Built `inspector/controls/trend/` (TrendField + `trendVariantSchemas.ts` + register). It is the
EventsField pattern: a discriminant selector (yoy/cagr/share/static/none) + the chosen variant's
PropSchema projected through the SAME generic `<Inspector>` (governed measure = enum-ref
source:metrics). Re-declared `trend` `type:'object'`→`'trend'` in KpiStripNode + FeaturedSliderNode.
Registered at boot (`App.tsx` side-effect import, mirrors thresholds/register). Gate
`trendAuthorable.fitness.test.ts`.

**TWO forced consumers when adding a PropFieldType** (both hit here): (1) `PropSchemaForm.tsx`
`FIELD_RENDERERS: Record<PropFieldType,…>` is tsc-EXHAUSTIVE → add a `jsonInput` degrade or the
build reds; (2) `propSchemaToJsonSchema.ts` `typeDescriptor` switch — add `{type:'object',$comment}`
or the authored value falls to `default:{type:'string'}` and the **save-guard rejects** an authored
object. See [[project_page_config_schema_gen_and_panel_i18n]].

**Both schema-completeness sites move together.** Changing an item field off `object`/`array`
means removing its `OPAQUE_BY_DESIGN` entry in `schema-completeness.fitness.test.ts` (the `stale`
check reds a now-non-opaque allowlist entry). AND regenerate the committed artifact:
`pnpm --filter @statdash/react run gen:schema` → `packages/contracts/schema/page-config.schema.json`
(else `page-config-schema.fitness` drifts). See [[project_page_config_schema_gen_and_panel_i18n]].

**Pre-existing debt (NOT P2a):** `@statdash/react` `constructor.test.ts` "round-trips…without loss"
FAILS on clean HEAD — P1 put `make()` functions in `SPEC_CATALOG`, and `describeApp` emits
`specTypes: SPEC_CATALOG` (constructor.ts:153) → a Function in a "JSON-serializable" manifest.
Confirmed via `git stash` test. Owner/P1's to fix (strip `make` from the describeApp projection).
