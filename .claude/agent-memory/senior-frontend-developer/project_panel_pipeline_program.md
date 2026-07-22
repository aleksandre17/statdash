---
name: panel-pipeline-program
description: "ADR-046 pipeline program history (card 0082/0084/0087/0087b) — the live per-step grid, the three-pane workbench, the emission flip to the pipeline spine, offer-driven step editors, field-ROLE projection, and the steward raw-cube entry. Consolidated distillate; superseded at the surface layer by [[project_panel_one_data_workspace]] and [[project_panel_editor_capability_parity]]."
metadata:
  type: project
---

> Consolidated 2026-07-22 from 7 sibling files (pipeline-live-grid, data-workbench-wp2,
> pipeline-emission-flip-wp5b, poffer-filter-offer, role-projection, raw-cube-promotion, c3-c5).
> These are the durable MECHANISM facts of the data-workbench pipeline editor; the current
> SURFACE shape (which kinds route where) lives in [[project_panel_one_data_workspace]] and
> [[project_panel_editor_capability_parity]] — read those first for "what's true today".

## The live per-step grid (W-P1)
Feature: `apps/panel/src/features/data-layer/pipeline-preview/`. Projection = the ONE engine
seam: `deriveStepRows(sourceRows,pipe,asOfStep)` = `applyPipeline(source,pipe.slice(0,asOfStep+1))`
— byte-identical to what a bound element's rows resolve through. Never a module-level preview
cache; the source read is resolved ONCE, selecting a step is a pure in-render re-slice. Live
source warms via `store.queryAsync(queryReadObs(query),ctx)` BEFORE the sync read (cold store →
[]), debounced + cancel-on-supersede. Headers resolve through the governed catalog, never raw
codes (Law 4). Honest states: genuine 0→"0", null/undefined→"—" (never fake 0, Law 11).
**Gotchas:** a default `derive` step THROWS (`missing 'as'`) — the grid MUST try/catch the
prefix-run for an honest error state (same throw hits `NodeErrorBoundary` on the live canvas).
`queryReadObs(query)` is the SSOT resolver (metric-id expansion + default-dim merge) — feed its
output to `storeObs`, never read `spec.query.measure` raw.

## The three-pane workbench (W-P2)
`features/data-layer/workbench/` — step rail (`PipelineBuilder`) · live grid
(`PipelineStepGridView`) · generated-query pane (`GeneratedQueryPane` + pure `generatedQuery.ts`).
The wide surface is a FOCUS-VIEW ESCALATION, not a dock section. `generatedQuery.ts` is the
plane-split SSOT: `describeAuthorSteps` resolves every noun through `buildColumnLabels` and NEVER
calls `queryReadObs` (structurally cannot leak a raw code, FF-AUTHOR-NO-QUERY by construction);
`describeStewardDetail` (role-gated) adds raw DataSpec JSON + lowered ObsQuery. `DataWorkbench` is
a pure controlled `value`/`onChange` component — needs NO selected node; two live-binding hosts:
facet escalation (canvas element) and entity landing (a workbench-shaped spec selected in
`DataModelingPanel` mounts it inline full-width).

## The emission flip to the pipeline spine (W-P5b)
`workbench/workbenchModel.ts` is the ONE code path: `toWorkbenchModel(spec)` lowers both a
legacy `query` (via engine SSOT `desugarToPipeline`) and a native `pipeline` to
`{head:SourceStep, tail:TransformStep[], encoding}`; `fromWorkbenchModel` emits a `pipeline`
DataSpec. The emission flip = `dataFacetModel.bindMeasureToSpec` → a GOVERNED head
`{op:'source', metrics:[id]}` (append-on-rebind). **The live grid resolves ANY head through the
engine** (`interpretSpec` on a source-only pipeline) — the one derivation path (governed→metric
resolver, steward→query resolver).
**Known crack (architect-owned, still open):** a governed head at grain-∅ gives a scalar (base
metric, 1 row) or 0 rows (a YoY calc, undefined without a time grain) — NOT the rich browse grid
a `query`/storeObs raw-observation read gives. The Get head has no GRAIN axis. Recommended fix =
a Get-grain picker (default `time:{dim:TIME_DIM}` when unset); not built.

## Offer-driven step editors + field-ROLE projection (P-OFFER, card 0082/0087)
**P-OFFER principle (binding):** the author never TYPES an identifier — every field/member/metric
is PICKED from an offered, governed list; free text only where a name is genuinely new (a
Derive's produced-field name). Reusable primitives: `FieldPicker.tsx` (Select over offered
columns) + `MemberPicker.tsx` (Excel AutoFilter checkbox list; checked set → engine `where`
semantics: one→scalar, many→IN-array). Offer seam: `stepInputRows` = the step's input = the
PREVIOUS step's output via the same `deriveStepRows` prefix (never a 2nd fetch); governed columns
+ a column's distinct governed members (cap 1000).

**Field-ROLE (card 0087):** every op-schema `PropField` declares `role:PropFieldRole` =
`field|member|newName|expr|literal` (core, engine never reads it — panel projects it).
`TransformStepEditor.tsx` is the GENERIC role projector (no Inspector-JSON delegation):
field→FieldPicker/checklist · member→MemberPicker · newName→text · expr→`ExprAutocompleteInput` +
a LIVE per-row preview (runs the CURRENT step over sample rows via `applyStep`, the one engine
evaluator) · literal→typed input. Filter/Sort/Lookup stay bespoke; Derive routes here.
**Filter full-power parity (0087b):** Cond model = specific (checkbox IN-list) · follow
(`{$ctx:<dim>}`, tracks page selection) · except (`{$ne:v}`, single DimVal — a multi-exclude is a
ledgered array-$ne engine door, not panel-invented) + "also follow" → NeCtxRef.

**Engine filter grammar (durable fact):** `FilterValue = DimVal|DimVal[]|CtxRef|NeRef|NeCtxRef` —
equality/IN-set only, NO comparators. A comparator filter needs a new engine `FilterValue` variant
(Class-M contract change), never invented in the panel. **Two filter resolution paths must
agree:** query-level filter resolves via store `matchesFilter`; a pipeline tail `filter` step
resolves via `applyFilter` — card 0087b fixed a real divergence (NeCtxRef exclusion silently
dropped in `applyFilter`; fixed to match `$ne` first). Guard: `filter-parity.fitness.ts` asserts
`applyFilter≡matchesFilter`; extend it when adding any new FilterValue shape.

## The steward raw-cube entry + promotion loop (card 0084)
Two-audience canon (the steward `source(query)` head exists, no new grammar). `GetHead.tsx` is
plane-gated: AUTHOR lens → MetricPalette only (no raw tab, FF-AUTHOR-NO-QUERY); STEWARD lens →
tabs metrics|raw cubes. `RawCubePalette.tsx` lists cubes, each an expandable disclosure loading
its profile lazily. `workbenchModel.ts` helpers: `withStewardCube` (steward head, clears tail — a
new raw cube is a new table); `promoteHeadToMetric` (head swap to governed, tail preserved).
`PromoteMetric.tsx` reuses the definition seam verbatim (draft→catalog upsert→save).
**Gotchas that bit:** `saveSemanticCatalog()` PUTs the WHOLE working copy — an un-hydrated store
+ upsert + save WIPES the catalog (always `ensure()` first). zustand mapping-selectors
(`s.metrics.map(...)`) return a fresh array every render → infinite loop (select the stable ref,
derive with `useMemo`). `setState`-in-effect is an ESLint ERROR — seed form state via pure
derivation.
**Finding (still open):** a steward raw-cube head's live BROWSE is PAGE-store-scoped (no
`dataSource` on the head → first-store fallback) — correct for a session source, wrong for a
cross-cube pick. Cube list + label-debt inventory are correct for all cubes; only browse is scoped.

## Constructor MVP capability discovery + save guard (card C3/C5)
- **C3 — `apps/panel/src/discovery/`.** `lib/cubeApi.ts` hits `/api/cube/*` (unguarded delivery
  scope, sibling of `lib/api.ts`'s config CRUD). `useActiveProfile()` is the one hook every
  data-bound control/gate calls (derives the active dataset from
  `DataSource.config.datasetCode`) — returns `none|loading|ready|error`, never throws. Pure cores:
  `suggestPanels` (geo-ROLE→map, isTime→timeseries — reads `conceptRole`, never a dim code, Law 1),
  `cubeEnumOptions`, `capabilityGate` (open unless a ready profile proves an entry unsupported).
- **De-privilege (landed):** `capabilityGate` used to type-sniff (`entry.type==='map'`, a Law 1
  breach). Now a DECLARED field `CapabilityRequirement{conceptRole?}` on `ObjectMeta.requires`,
  forwarded through `registerSlice`→`PaletteEntry.requires`; the gate matches it against a
  profile dim's declared role — zero type-sniff. Canon-locked by a source scan for `'geo'`/`'time'`
  literals (even in comments).
- **C5 — `apps/panel/src/save/saveGuard.ts`.** `validatePageForSave` runs FOUR checks, returns ALL
  issues: migrate-identity, serialize-round-trip, per-node-valid (PropSchema `validateField`),
  locale-complete. Wired as a real consumer: `createPage`/`savePage` call `assertSaveable`, which
  THROWS `SaveGuardError{issues}` BEFORE the API write.
- **Gotcha:** two `migratePageConfig` exist — engine `@statdash/engine` (version-blob, what the
  guard uses) vs `@statdash/react/engine` per-node (not barrel-exported). Filter `tsc -b` output to
  `apps/panel/src` when validating — the wider graph carries pre-existing packages errors.
