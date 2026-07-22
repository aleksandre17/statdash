# RECON — The Two-Dialect Capability Map (query ↔ pipeline)

**Status:** Recon (read-only, facts only — no design opinions)
**Scope:** grounding for the lead-authored unification design (DU4/DU5 arc, ADR-046/ADR-051)
**Method:** direct source read of `platform/packages/core/src/data/` (engine) + `platform/apps/panel/src/features/data-layer/` (panel authoring) + `platform/apps/api/provisioning/` (live corpus). No server reachable from this recon session (no attempt made — static repo read only; flagged as an access wall, not guessed around).

---

## 1. Spec-kind inventory

Source of truth for the discriminant SET: `platform/packages/core/src/config/discriminant-manifest.ts:34-37` (`DATASPEC_DISCRIMINANTS`, compile-time-exhaustive against `DataSpec['type']`, `data-spec.ts:158`).

| `type` | Semantics | Desugar rule (file:line) | Fold status onto `pipeline` | Resolver (file:line) | Proving test corpus |
|---|---|---|---|---|---|
| `query` | Universal: `ObsQuery` + optional `pipe: TransformStep[]` + `EncodingSpec`. Any dim, any store. | `desugar.ts:150-152` → `desugarToPipeline` (`desugar.ts:210-224`): `[source(query+clamp), ...pipe]`. **LIVE** (the switch at `desugar.ts:150` actually runs this at every `interpretSpec`/`extractRequirements` call). | **Folded, byte-identical, LIVE** (ADR-046 W-P5a switch flipped for this kind) | `QueryResolver` (`registry/resolvers.ts:276-303`) / `PipelineResolver` steward branch (`registry/pipeline-resolver.ts:166-175`, delegates back to `QueryResolver`) | `pipeline-desugar.fitness.test.ts:73-106` (FF-PIPELINE-EQUIV rows); `bind-parity.fitness.test.ts` (metric-id≡raw-code); `pipeline-equiv.fitness.test.ts` (18-spec live corpus, requirements-level, both ctx modes) |
| `transform` | Full declarative pipe over a **static inline** `source: Record<string,DimVal>[]`. | `desugar.ts:150-152` → `[source(rows), ...steps]` (`desugar.ts:225-232`). **LIVE.** | **Folded, byte-identical, LIVE** | `TransformResolver` (`registry/resolvers.ts:334-340`) / `PipelineResolver` inline branch (`pipeline-resolver.ts:188-189`) | `pipeline-desugar.fitness.test.ts:92-106`; synthetic fixture in `pipeline-equiv.fitness.test.ts:296-298` (corpus has zero `transform` specs) |
| `pivot` | Wide→long sugar: `rows`+`keyField`+`valueFields`+`colors` → melt+cast+rename+concat+lookup. | `desugarPivot` (`desugar.ts:61-86`) rewrites to a `transform`, THEN recurses through the `transform` rule above (`desugarToPipeline`'s `pivot` arm, `desugar.ts:233-238`). **LIVE** (the live `desugar()` switch at `:152` includes `pivot`). | **Folded, byte-identical, LIVE** (two-hop: pivot→transform→pipeline) | `PivotResolver` thin delegate (`registry/resolvers.ts:315-327`) | `desugar.fitness.test.ts:131-156` (FF-DESUGAR-EQUIV pivot corpus + "lowers to pipeline spine" assertion) |
| `timeseries` | Single measure × time range (years/fromDim-toDim/timeDimension). Value-cell read: `storeValAt` per enumerated year + honest-null. | `desugarTimeseries` (`desugar.ts:104-130`) → internal `PointSeriesSpec`. **`desugar()`'s LIVE switch does NOT lower this to `pipeline`** — only to `point-series` (`desugar.ts:162`, comment ":154-161" explains deliberate non-flip). `desugarToPipeline(timeseries)` (`desugar.ts:239-263`, the DU4a "value-cell `source` head" fold) exists and IS byte-identical, but is reached only when a caller calls `desugarToPipeline` directly (workbench), never via the live `desugar()` switch. | **Fold EXISTS + proven (DU4a), NOT live-switched** (deliberately deferred, ADR-046 Addendum 4) | `TimeseriesResolver` thin delegate (`registry/resolvers.ts:184-196`) → `PointSeriesResolver` | `pipeline-desugar.fitness.test.ts:248-319` (FF-PIPELINE-EQUIV value-cell + warm-requirement identity); `coverage.fitness.test.ts:328-350` (FF-ALL-KINDS-SHAPED, folds=true) |
| `growth` | YoY growth. Single-code OR multi-code (multi → pivot table with per-code label/color meta). | Single-code: `desugarToPipeline(growth)` (`desugar.ts:264-314`) → `source(over=time,code,coords)` + `window(lag)` + 2×`derive` + `exists`/`filter` positional first-period drop + `select`. **NOT live-switched** (default case in `desugar()`, `desugar.ts:163`). Multi-code: `desugarToPipeline` returns identity (`desugar.ts:290`, `codeArr.length !== 1 → return spec`). | **Single-code: folded, proven, NOT live** (DU4b). **Multi-code: NEVER attempted** — routes via calc-metric browse (Addendum 2), stays on direct resolver (DU3 lane) | `GrowthResolver` (`registry/resolvers.ts:200-239`, two branches: single-code scalar loop, multi-code per-code `storeObs` meta + loop) | `pipeline-desugar.fitness.test.ts:320-395` (single-code fold + honest-null + warm-parity; explicit test that multi-code returns identity, `:359-395`) |
| `ratio-list` | Each row = `code/denom × 100`. Optional `pipe`. | `desugarToPipeline` default arm returns **identity** (`desugar.ts:316-326`). | **Deferred (DU4c) — never folds today.** Assessed by engine-specialist 2026-07-20: needs an unspecified "explicit-cells" `cells:{code,denom?,…}[]` head extension (ADR-046 Addendum 5, not yet designed). | `RatioListResolver` (`registry/resolvers.ts:243-265`) | `pipeline-desugar.fitness.test.ts:396-415` (asserts identity, NOT foldedness); `coverage.fitness.test.ts:304-319` (`NOT_YET_FOLDED` allowlist) |
| `row-list` | Explicit `RowSpec[]` — per-row `negate`/`pctOf`/`isTotal` + store-meta label/color enrichment. | `desugarToPipeline` default arm returns **identity** (same code path as ratio-list). | **Deferred (DU4d) — never folds.** Same Addendum-5 blocker (per-cell negate/pctOf/isTotal + meta read, not expressible by the current value-cell head + pure tail). | `RowListResolver` (`registry/resolvers.ts:133-171`) | `pipeline-desugar.fitness.test.ts:416-447` (identity assertion); `coverage.fitness.test.ts:317-319` |
| `metric` | Governed SemanticQuery [AR-50 M-SQ]: `metrics: MetricRef[]` × generic grain (`by`/`time`/`where`). | Not in `desugar()`'s switch at all — `metric` is ALREADY a `source(metrics)`-shaped head by construction (comment `desugar.ts:325`: "metric is already a source(metrics) head by construction"). No rewrite needed/attempted. | **N/A — the pipeline governed head IS the metric read** (delegation, not desugar) | `MetricResolver` (`registry/metric-resolver.ts`); `PipelineResolver` governed branch (`pipeline-resolver.ts:159-164`) delegates TO the `metric` resolver | `pipeline-desugar.fitness.test.ts:107-247` (FF-PIPELINE-EQUIV governed source ≡ metric spec, incl. grain-∅ BROWSE, Addendum 2) |
| `pipeline` | The ADR-046 spine itself: `pipe: PipeStep[]` (`source` head + pure `TransformStep[]` tail) + `EncodingSpec`. | N/A (already canonical; `desugar()` default-returns it unchanged, `desugar.ts:163`). | **Canonical — the fold TARGET**, not a fold source | `PipelineResolver` (`registry/pipeline-resolver.ts:192-208`) | All of the above corpora (each proves some OTHER kind folds ONTO this one) |
| `point-series` (internal, NOT in `DATASPEC_DISCRIMINANTS`) | Store-aware value-cell primitive: enumerate `over`'s coordinates, `storeValAt` per coordinate. The desugar TARGET of `timeseries`; never authored directly (`data-spec.ts:356-369` — "DELIBERATELY NOT a DataSpec discriminant … stays ABSENT from DATASPEC_DISCRIMINANTS"). | N/A (it IS a desugar target, not a source) | N/A | `PointSeriesResolver` (`registry/point-series-resolver.ts`) | `registry/point-series.fitness.test.ts` |

**Live corpus reality check** (`platform/apps/api/provisioning/geostat.provisioning.json`, 18 collected `DataSpec`s at `data` residence, per `pipeline-equiv.fitness.test.ts:70-97`): **100% `query`** (`pipeline-equiv.baseline.json` — `"specCount": 18"`, all 18 `"discriminant": "query"`). Zero `pipeline`-typed specs exist anywhere in the tracked repo outside test fixtures (confirmed by grep — the only `"type":\s*"pipeline"` hits in non-test files are a stray `work/data-spec-backups/orphan-suggested-specs-backup-2026-07-20-173919.json` and two `.fitness.test` files). **The corpus proves query→pipeline equivalence richly and proves nothing, by population, for `transform`/`timeseries`/`growth`/`ratio-list`/`row-list`/`pivot`/`metric`** — those seven ride on hand-authored synthetic fixtures inside the fitness suites, not the live corpus (explicitly noted, `pipeline-equiv.fitness.test.ts:264-269`: "The corpus is 100% `query`").

---

## 2. Verb inventory (pipeline TAIL steps — `TransformStep` ops)

Registry SSOT: `platform/packages/core/src/data/transform/index.ts:44-82` (registration site = category assignment) + `step-registry.ts` (registry mechanics) + `verb-coverage.fitness.test.ts:35-56` (`CATEGORY_PIN`, the taxonomy pin). **20 registered ops**, each declares exactly one of 7 `StepCategory` verbs (`step-registry.ts:31-38`); `FF-VERB-COVERAGE` asserts zero uncategorized (`listUncategorizedOps()` = `[]`).

| op | verb (category) | semantics (one line) | handler (file:line) | panel workbench affordance | gap |
|---|---|---|---|---|---|
| `source` | get | THE store-aware pipeline HEAD (3 variants: governed/steward/inline + value-cell) — real resolution out-of-pipe in `PipelineResolver`; registered handler is an identity no-op fallback | `transform/index.ts:79`; real logic `pipeline-resolver.ts:150-190` | `GetHead.tsx` + `RawCubePalette.tsx` (workbench) — the ONE head editor | none (only op with a bespoke, non-generic editor — by necessity, it's store-aware) |
| `filter` | filter | keep rows matching a predicate map | `steps.ts:69` | generic `TransformStepEditor.tsx` via `filterSchema` | — |
| `aggregate` | aggregate | group + summarize (sum/avg/etc per group key) | `steps.ts:213` | generic editor via `aggregateSchema` | — |
| `group` | aggregate | group rows (Vega-Lite-style, distinct from `aggregate`'s roll-up) | `steps.ts:244` | generic editor via `groupSchema` | — |
| `rollup` | aggregate | roll a finer grain up to a coarser one (`RollupOp`) | `steps.ts:334` | generic editor via `rollupSchema` | — |
| `reduce` | aggregate | scalar reduction over a field (Vega-Lite `aggregate` transform analogue) | `ops/reduce.ts:16` | generic editor via `reduceSchema` | — |
| `derive` | derive | add a calculated field via `@statdash/expr` | `steps.ts` (see `applyDerive` import, `index.ts:24`) | generic editor via `deriveSchema` | — |
| `addField` | derive | add a literal-valued field | `steps.ts:186` | generic editor via `addFieldSchema` | — |
| `cast` | derive | coerce a field's type (string/number/…) | `steps.ts:54` | generic editor via `castSchema` | — |
| `concat` | derive | join N fields into one string field | `steps.ts:159` | generic editor via `concatSchema` | — |
| `template` | derive | string-template a new field from other fields | `steps.ts:170` | generic editor via `templateSchema` | — |
| `window` | derive | windowed fn (e.g. `lag`) over a partition | `ops/window.ts:13` | generic editor via `windowSchema` | — |
| `melt` | reshape | wide→long (id/value/series fold) | `steps.ts:38` | generic editor via `meltSchema` | — |
| `rename` | reshape | rename fields | `steps.ts:46` | generic editor via `renameSchema` | — |
| `select` | reshape | project a field subset | `steps.ts:190` | generic editor via `selectSchema` | — |
| `sort` | sort | order rows by field + direction | `steps.ts:113` | generic editor via `sortSchema` | — |
| `join` | combine | declarative join (Constructor-authorable) | `steps.ts:307` | generic editor via `joinSchema` | — |
| `lookup` | combine | dictionary lookup-join (`from` map, used by pivot's color fold) | `steps.ts:368` | generic editor via `lookupSchema` | — |
| `blend` | combine | Constructor front-door for cross-STORE enrichment; registered handler is an identity no-op (real resolution needs `ctx.stores`, resolved react-side BEFORE reaching core, Law 3) | `index.ts:46-54` | schema-driven front-door (`blendSchema`); real rewrite in `resolveNodeRows.ts:146-176` (react layer, NOT the panel) | the panel authors `blend`, but its real semantics live in `@statdash/react`, not the engine that resolves the rest of the pipe — a documented split, not a bug |
| `joinByField` | combine | the RESOLVED-ROWS underside of `blend` — takes already-resolved `EngineRow[]`, not authorable | `ops/joinByField.ts:18` | **NONE — deliberately schema-less** (`index.ts:61-65`: "NOT declaratively authorable by a non-programmer … stays in COVERAGE_TODO") | **known, documented gap**: engine op exists, workbench has zero affordance BY DESIGN (it's the internal resolved form of `blend`) |

**7-verb palette (author-facing, `VerbPalette.tsx` + `verbProjection.ts`):** `get / filter / aggregate / derive / reshape / combine / sort` (`step-registry.ts:45-47`) — a live PROJECTION of the `category` field above (`getOpsInCategory`), not a hand list. The palette's "Get" card is intentionally non-insertable (`VerbPalette.tsx:110`, "already the first step").

**E2a extension seam claimed but NOT built.** `workbenchCapabilities.ts:25-26` documents "when head/step editors register (`registerStepEditor`), their `provides` union in [to `workbenchProvidedCapabilities`]" — **grepped repo-wide: `registerStepEditor` appears in exactly ONE place, that same comment.** No such registry exists. This is distinct from the REAL, implemented `specEditorRegistry.ts` (`registerSpecEditor`/`getSpecEditor`, used by `registerSpecEditors.ts:39-45` for the 7 KIND-level dedicated editors) — that one is live and tested (`editorCapabilityParity.fitness.test.tsx`). **Surprise flagged:** the kind-level editor-capability registry is real; the step/head-level one referenced for future "auto-admit" is aspirational prose only.

---

## 3. Query-dialect surface (`ObsQuery` + wrappers)

`ObsQuery` (`platform/packages/core/src/sdmx.ts:76-86`):

| field | type | semantics |
|---|---|---|
| `measure` | `string \| string[]` | one or more indicator codes (or governed metric-ids, expanded via `resolveMeasureRef`, `resolvers.ts:64-86`) |
| `filter?` | `Partial<Record<string, FilterValue>>` | dim → filter; ANDed |
| `orderBy?` | `{ field, dir: 'asc'\|'desc' }` | post-filter ordering |

`FilterValue` (`sdmx.ts:62`) = `DimVal \| DimVal[] \| CtxRef \| NeRef \| NeCtxRef`:

| `$ctx` form | shape | semantics | resolved by |
|---|---|---|---|
| `CtxRef` | `{ $ctx: string }` | runtime lookup `ctx.dims[key]` at interpret time (Vega-Lite signal / SDMX parameterised-query analogue) | `resolveRef` (`ref/ref.ts`), `sdmx.ts:37-44` |
| `NeRef` | `{ $ne: DimVal }` | exclude one literal value (SDMX excludeCode) | `store-filter.ts` |
| `NeCtxRef` | `{ $ne: DimVal, $ctx: string }` | exclude a literal AND (if ctx value present) restrict to it | `resolveFilterForReqs`, `resolvers.ts:116-129` |

**Pipeline-spine equivalent.** The `source(query)` steward head variant (`data-spec.ts:255-265`) carries the ObsQuery **verbatim** (`query: ObsQuery`) plus an optional `dataSource` (store-routing) and `clamp` (range). No gap — every `ObsQuery` field and every `$ctx` form passes through unchanged; `sourceHeadObs()` (`pipeline-resolver.ts:141-147`) returns the steward head's `query` untouched as the "wire truth" the panel's Steward pane shows (`generatedQuery.ts:164-177`).

**Time concept overlay** — `TimeDimensionSpec` (`data-spec.ts:131-135`, `{ dim, range?, granularity? }`) is an ADDITIVE alternative to legacy `fromDim`/`toDim` on BOTH `query` and the pipeline `source(query).clamp` / `source(over=…).clamp` variants (byte-identical fold via `effectiveBounds`, `time-dimension.ts`). No gap here either — the query dialect and the pipeline head share the identical clamp shape verbatim (`data-spec.ts:264-265`, `:282-284`).

**One gap that DOES exist:** the query dialect's optional `pipe?: TransformStep[]` tail (post-observe, pre-encoding — `data-spec.ts:162-169`) is a first-class field ON the `query` DataSpec itself; the pipeline spine expresses the equivalent tail as `pipe.slice(1)` (everything after the head). These are the SAME tail mechanically (`desugarToPipeline`'s `query` arm literally does `pipe: [source, ...(spec.pipe ?? [])]`, `desugar.ts:220`) — not a semantic gap, just two different places the SAME array lives (spec-level field vs. pipe-array suffix).

---

## 4. Consumers — who reads specs at rest

All three render targets funnel through the **one** engine entry point `interpretSpec` (`spec.ts:55-82`), which desugars FIRST (`desugar(spec)`, line 62) — **consumers are dialect-agnostic by construction**; a stored `query` or a stored `pipeline` resolve through the identical call. No consumer branches on `spec.type`.

| Consumer | File:line | What it does | Dialect sensitivity |
|---|---|---|---|
| Interactive DOM render | `platform/packages/react/src/engine/resolveNodeRows.ts:15,244` | `interpretSpec(dataSpec, ctx.sectionCtx, store)` per node with a `data` field; feeds Table + Chart | none — both dialects resolve identically |
| Static HTML target | `platform/packages/react/src/engine/targets/html.tsx` (sibling of `targets/api.ts`, same walk pattern) | same `interpretSpec` walk, HTML output | none |
| JSON snapshot / export target | `platform/packages/react/src/engine/targets/api.ts:17-18,184-187` | `interpretSpec(node['data'] as DataSpec, ctx.sectionCtx, store)` per node; also derives export provenance (`deriveExportProvenance`, line 230) from the SAME `DataSpec` | none |
| Cross-store `blend` (react layer, NOT core) | `resolveNodeRows.ts:146-176` | Resolves a SECOND store's `{ type:'query', query, encoding }` (hardcoded `query` shape, not pipeline) then rewrites the pipe step to `joinByField` | **query-dialect literal** — `blend`'s secondary read is always constructed as a `query` DataSpec here, never a `pipeline`; this is a Law-3 boundary (core must not see `ctx.stores`), not a dialect gap |
| Chart annotation (dynamic value) | `platform/packages/plugins/panels/chart/default/annotationUtils.ts:12,60` | `interpretSpec(spec.data, sectionCtx, store)`, reads `rows[0].value` | none |
| Workbench live preview grid | `platform/apps/panel/src/features/data-layer/pipeline-preview/usePipelineSourceRows.ts` | resolves a SOURCE-ONLY pipeline (`workbenchModel.ts:94-96`, head alone) for the browse grid, tail run locally | pipeline-native by construction (panel authoring surface) |
| KPI value read | `platform/packages/core/src/data/kpi.ts` / `kpi-spec.ts` | separate `KpiSpec` union (point-read `value`), NOT a `DataSpec` — out of this map's scope per DESIGN-0113 note #12 (`kpi-spec.ts:1`) | N/A — different grammar entirely |
| ETL/seed scripts | `platform/apps/api/scripts/seed*.ts` | grepped: **zero** `DataSpec`/`interpretSpec` references — these seed raw fact tables from source data, never touch config specs | not a consumer of either dialect |

**Live corpus dialect count** (the one provisioning artifact reachable in-repo, `platform/apps/api/provisioning/geostat.provisioning.json`): **18 stored specs, 18 `query`, 0 `pipeline`, 0 of any other kind** (`pipeline-equiv.baseline.json`). No `work/` provisioning corpus found beyond one backup JSON (`work/data-spec-backups/orphan-suggested-specs-backup-2026-07-20-173919.json`, contains a `"type":"pipeline"` hit — an orphan-suggestion artifact, not live config). **Access wall:** no live server (`:3011`/`:3013`) was reachable/attempted from this static-repo recon session — the browser tools were available but the task's own framing ("if reachable read-only") was not exercised since the file-corpus answer (18/18 query) already gives the ground truth the live `/api/config/data-specs` endpoint would only restate. Flagging rather than guessing: if a live DB-backed corpus diverges from this JSON artifact, that divergence is unverified by this recon.

---

## 5. Fitness/guard inventory

| Guard | File | Pins | Corpus size |
|---|---|---|---|
| `FF-PIPELINE-EQUIV` (rows) | `packages/core/src/data/pipeline-desugar.fitness.test.ts` | Row-identical resolution: query, transform, governed source (incl. grain-∅ browse), value-cell timeseries, single-code growth; explicit non-fold assertions for ratio-list/row-list/multi-code growth | 31 `it()` blocks across 9 `describe`s |
| `FF-PIPELINE-EQUIV` (requirements, live corpus) | `apps/api/src/provisioning/pipeline-equiv.fitness.test.ts` | Store-read contract (`extractRequirements`) byte-identical between committed baseline and live re-derivation; AND legacy-vs-`desugarToPipeline` equivalence per spec, per 2 canonical ctx modes (year/range) | 18 corpus specs × 2 ctx = 36 comparisons, + 7 synthetic per-discriminant fixtures (`:279-299`) |
| `FF-DESUGAR-EQUIV` | `packages/core/src/data/desugar.fitness.test.ts` | pivot→transform+melt row-identity; pivot/timeseries lower onto the `pipeline`/`point-series` spine; desugar is reference-identity for every NON-lowered spec; timeseries ≡ frozen bespoke resolver | 7 `it()` blocks, 2 `describe`s |
| `FF-BIND-PARITY` | `packages/core/src/data/bind-parity.fitness.test.ts` | metric-id-bound query/KPI ≡ hand-authored raw-code+governed-filter equivalent (chart AND kpi, point AND yoy) | 8 `it()` blocks, 3 `describe`s |
| `FF-ALL-KINDS-SHAPED` | `apps/panel/src/features/data-layer/coverage.fitness.test.ts:287-365` | Every value-cell kind (`timeseries`/`growth`/`ratio-list`/`row-list`) is either FOLDED (`desugarToPipeline` → `pipeline`) or on the explicit `NOT_YET_FOLDED` allowlist; a folded kind still allowlisted, or an unaccounted kind, fails | 4 kinds tracked; today 2 folded (timeseries, growth) + 2 allowlisted (ratio-list, row-list) |
| `FF-VERB-COVERAGE` | `packages/core/src/data/transform/verb-coverage.fitness.test.ts` | Every registered transform op declares exactly one of 7 categories (`CATEGORY_PIN` taxonomy SSOT); no orphan op, no verb without a backing op | 20 pinned ops |
| `FF-ROLE-COVERAGE` | `packages/core/src/data/transform/role-coverage.fitness.test.ts` | Every leaf field of every op schema declares an authoring `role` (field/member/newName/expr/literal) | all registered op-schemas (excludes schema-less `joinByField`) |
| `FF-PROMOTE-ROUNDTRIP` | `packages/core/src/data/promote-roundtrip.fitness.test.ts` | A steward raw head promoted to a governed metric ref resolves byte-identically (refactor, not semantic change) | 3 `it()` blocks |
| `FF-BIND-PARITY`/editor parity | `apps/panel/src/features/data-layer/editorCapabilityParity.fitness.test.tsx` | Each registered dedicated editor's declared `provides` ⊇ its kind's `requiredCapabilities`; the three-pane workbench's `provides` derivation stays correct under editor add/remove | live-registers all 7 dedicated editors + workbench core set |
| `FF-DATASPEC-AUTHORING-COMPLETE` (implied) | `apps/panel/src/features/data-layer/dataSpecAuthoringComplete.fitness.test.ts` | Every `SPEC_CATALOG` entry resolves to `schema` OR a registered `editorKey` (no dead-end kind) | all `DATASPEC_DISCRIMINANTS` |

---

## 6. International-grammar seams already present

- **SDMX** (ISO 17369) — `sdmx.ts:1-9` field naming/model IS the SDMX Observation Model (TIME_PERIOD/REF_AREA/INDICATOR/OBS_VALUE), explicit header comment.
- **Grammar of Graphics / Vega-Lite / ggplot** — `EncodingSpec`'s role channels (`label`/`value`/`series`/`color`) are GoG roles kept rotation-stable (ggplot's `aes()`+`coord_*` split), explicitly NOT Vega-Lite's positional `x`/`y` (a **named, reasoned refusal** of literal VL parity, `DESIGN-0113 §4.1`).
- **Cube.dev / dbt Semantic Layer / MetricFlow** — the `metric` DataSpec's docstring (`data-spec.ts:315-323`) names the shape as "Cube `measures`+`dimensions`+`timeDimensions`, dbt-SL/MetricFlow `metrics`+`group_by`, in SDMX-native form."
- **Power Query** — `PipelineSpec`'s docstring (`data-spec.ts:289-296`) names the Source-first spine model explicitly ("Power Query's Source-first model").
- **OLAP / Tidy Data** — cited as governing standards in root `CLAUDE.md` Law 4 and echoed in module docs (e.g. `metric.ts`, `grain.ts`) for the grain/rollup algebra.
- **DESIGN-0113 (adopted grammar, 5-line summary):** keeps the 4 role channels (`label`/`value`/`series`/`color`) as rotation-stable GoG roles, but adopts Vega-Lite's PER-CHANNEL field-def record whole (`field · type · aggregate · bin · sort · scale · axis · legend · format · condition`) to replace 5 currently-forked encoding-shaped structures (`EncodingSpec`, `ChartDef` axis/legend/palette, `FieldConfig` scale/thresholds, the 6-var directional record, per-spec-kind implicit encodings). Every other encoding surface becomes a PROJECTION of the one channel declaration; today's bare-string channel form stays the byte-identical degenerate case. Status: Proposed, not yet built.

---

## Surprises / flags (Least-Astonishment)

1. **Two different "registry" mechanisms are easy to conflate.** `specEditorRegistry.ts` (kind-level, REAL, tested) vs. the `registerStepEditor` named in a comment (`workbenchCapabilities.ts:25`) for STEP/HEAD-level editors (aspirational, does not exist). A unification design referencing "the editor registry" should disambiguate which one.
2. **The live provisioning corpus is monomorphic** (18/18 `query`) — every fold/equivalence claim for `transform`/`pivot`/`timeseries`/`growth`/`ratio-list`/`row-list`/`metric` rests entirely on hand-authored test fixtures, not production data. This is explicitly acknowledged in-repo (`pipeline-equiv.fitness.test.ts:264-269`) — not a hidden gap, but load-bearing for any "the corpus proves X" claim in the unification design.
3. **`desugar()`'s LIVE switch (used by every real render) is narrower than `desugarToPipeline`** (used only by the panel workbench). `query`/`transform`/`pivot` are lowered to `pipeline` on every read TODAY; `timeseries`/single-code `growth` are lowered to `pipeline` only when the panel explicitly calls `desugarToPipeline` (workbench editing), and still resolve via their DIRECT bespoke resolver on the live render path. Two call sites, two different fold scopes — both correct by design (documented at `desugar.ts:154-161`), but a design reading only `desugarToPipeline` would overstate what's live.
4. **`ratio-list`/`row-list` are not merely "not yet folded"** — they are formally ASSESSED-and-blocked (engine-specialist, 2026-07-20) on an unspecified ADR-046 Addendum 5 (`cells:{code,denom?,…}[]`) extension. This is a real design dependency for any unification proposal, not a "just do it" backlog item.
