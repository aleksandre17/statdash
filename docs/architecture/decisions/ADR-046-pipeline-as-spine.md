# ADR-046 — The Pipeline Is the Spine

> **Status:** ACCEPTED (owner-blessed 2026-07-17, verbatim: «ნდობას გიცხადებ, გააკეთე» — on the lead's affirmation that this is the best-known concept, canon, methodology, architecture and grammar for the case).
> **Card:** `work/items/0082` · **SPEC:** `docs/architecture/proposals/SPEC-query-pipeline-data-home.md` (the full design, incl. the lead's §9 elevation pass — binding).
> **Relates:** ADR-034 (semantic query plane) · ADR-041/042 (object model, untouched) · ADR-045 (relative coordinates) · Laws 1–4, 10–11.

## Decision

ONE canonical data-manipulation grammar: a `pipeline` DataSpec discriminant — an ordered `pipe: TransformStep[]` whose **head is a `source` step** (the only store-aware step: a governed-noun read in the author plane, ObsQuery in the steward plane) and whose **tail is the existing pure transform verbs** from the runtime op registry. Every other data-shaping discriminant (`query`, `transform`, `timeseries`, `growth`, `ratio-list`, `pivot`, `metric`) becomes **sugar** that `desugar()` lowers into `pipeline` — read-time only; stored configs are never rewritten (expand-contract).

Authored through the **three-pane surface**: step rail (7 intent-verbs — Get/Filter/Aggregate/Derive/Reshape/Combine/Sort — each a *projection* of a `category` field declared on existing registry ops, never a new grammar) · live per-step data grid (browse-first, capped honest preview, Cell honest states, a projection of the graph engine — never a preview cache) · generated-query pane (read-only declarative truth in the author plane; lowered ObsQuery behind the steward lens; doubles as the per-element EXPLAIN/lineage seam).

Raw data receives its canonical home: the **four-floor ladder** (raw sources → governed model → specs/pipelines → elements), the dependency arrow made visible as IA; DQ expectation-sets declare at Floor 1 on the `CanonicalDsd`, lowered through the existing validation floor, failures riding Cell honest states.

**The ecology rule (E2):** reusable-across-pages calculations are governed metrics (Floor 2); element-local shaping is a pipeline step (Floor 3); a Derive step carries a *promote-to-governed-metric* affordance (author proposes, steward blesses) so local work feeds the semantic layer instead of competing with it.

## Rejected alternatives

- **ALT-A — `pipe?` on every discriminant, keep the type picker.** Entrenches the tag-zoo and the three-homes smell (`query.pipe` / `transform.steps` / `ratio-list.pipe`); the author-facing confusion (the 8-way `Select` + chips + cards + JSON simultaneity, diagnosed in `DataSpecEditor.tsx`) survives. Refused: one concept, one home.
- **ALT-B — a real query language in config (M-code / SQL-lite / JSONata).** Breaks Law 2 (config becomes a language), breaks `FF-AUTHOR-NO-QUERY`, imports a foreign runtime, not non-programmer-authorable, opaque to dependency extraction. Refused whole.
- **ALT-C — adopt Power Query / Vega-Lite as the runtime.** Raw-column vocabulary vs our governed nouns; dual state stores vs URL-param SSOT; the same grounds ADR-024 refused VL-as-runtime. We adopt the *grammar and the surface pattern*, never the runtime.

## Canonical anchors (Law 4 — adopted whole)

Power Query applied-steps + per-step grid (the perception model) · Grafana builder↔code duality (the transparency model) · Vega-Lite/Tidy-Data + Arquero/dplyr verb grammar (the vocabulary) · Looker/dbt promotion path (the ecology) · SDMX ObsQuery (the wire truth, unchanged).

## Consequences & guards

- **One-way door:** only the Constructor's default-emission flip to `pipeline` (W-P5), gated on `FF-PIPELINE-EQUIV` byte-identity across ALL stored configs + `FF-JOURNEY-PIPE` walked live. Everything before it is revert-clean.
- **Trade-off (ISO 25010):** usability + maintainability bought at a one-time guarded compatibility cost.
- **Gates:** `FF-PIPELINE-EQUIV` · `FF-JOURNEY-PIPE` · `FF-VERB-COVERAGE` · `FF-DQ-DECLARED` · `FF-PROMOTE-ROUNDTRIP` (E2) + held: `FF-AUTHOR-NO-QUERY`, `FF-CANVAS-NEVER-LIES`, `FF-ONE-DERIVATION-PATH`.
- **W-P1 dependency truth (E5):** the graph substrate exists (`packages/core/src/graph/`); per-step nodes are new projection work on that engine; SPEC-rendering-architecture remains PROPOSED and is not silently assumed.

## Addendum 2 — browse semantics of the governed `source` head (lead, 2026-07-18, closing the W-P5b crack)

A governed head `{op:'source', metrics:[…]}` with **no grain** lowers to the metric's **OBSERVATION BROWSE**: the full obs read across the metric's natural dimensions (codes via `resolveMeasureRef` → the storeObs path the steward head uses), rendered with governed labels. An **explicit grain** (`by`/`time`/`where`) lowers to the shaped read (the existing M2 grain algebra). A CALC metric under browse evaluates **per member of its time axis** (`resolveMetricValue` at each coordinate) — so `gdp.growthYoy` browses as a year-by-year growth column, honest no-data at the first-period edge (ADR-045). Canonical anchor: Power Query — a source IS the table; shaping comes after. This is what SPEC §9 E1 ("the empty pipeline is the browse grid") requires to be true at the engine, not just the surface. Rejected: a hidden default grain injected at emission (a lie in the config — the stored spec would carry a grain the author never chose); a panel-side browse shim (second derivation path, refusal #6 class).

## Addendum — W-P4 filter-resolution decision (engine-specialist, 2026-07-18)

**The question (W-P0 pre-note #3, deferred into the `source` design):** should `filter.<dim>` values learn UNIFORM governed-ref resolution at the one lowering path, or stay LITERAL-with-a-gate (`config-cube-contract` CHECK-4)?

**Decision: LITERAL-with-gate. The `source` design does NOT extend filter-value resolution.** The governed read a `source` head expresses is resolved at the MEASURE / grain level — its `metrics` (and a steward head's `query.measure`) route through the ONE `resolveMeasureRef` seam, and its `where` pins are coordinate LITERALS merged over `ctx.dims` exactly as `MetricSpec.where` is. No `filter.<dim>` value is governed-ref-resolved anywhere in the pipeline lowering.

**Why.** (1) *One filter path, unchanged.* The engine runtime (`matchesFilter` / `store-filter.ts`) treats every filter value as a literal; making `filter.<dim>` resolve governed refs is a behaviour change to the WHOLE filter path (every discriminant), not something the `source` head needs — it would be scope creep dressed as a lowering detail, and it would break the byte-identity the wave is gated on. (2) *The governed plane already lives at the measure/grain level.* An author never types a `filter` in the `source` head — they pick governed `metrics` + a generic grain; the only coordinate narrowing is `where`, whose SSOT is `MetricSpec.where` (scalar pins, Law 1, not predicates). (3) *The hole is already gated.* CHECK-4 (`config-cube-contract.fitness.test.ts`) fails any explicit `filter.<dim>` literal that is a governed metric-id — the exact b544819 leak — so a metric-id can never masquerade as a filter literal without failing loudly. Extending resolution would REMOVE that honest gate in favour of silent coercion. The literal-with-gate form is kept; CHECK-4 stands as the guard.

## Addendum 3 — the steward `source` head DECLARES its store home (architect, 2026-07-18, card 0089, closing the cross-cube lying-grid)

**The gap (Law-11 lying grid, live-proven).** A steward `source` head `{op:'source', query:{measure}}` carries NO store identity. Its `query.measure` is a RAW SDMX code (`GVA`), so `specDataSource` finds no `MetricDef` to route through (the governed head routes via `metric→dataSource`, but a raw code resolves to `dataSource: undefined`), and `resolveStore` falls to `ctx.pageStoreKey` — **the PAGE's store**. Pick REGIONAL_GVA from a GDP page (0091's Sources cross-gesture) → the browse grid reads GDP rows under a REGIONAL title. The cube LIST is correct; only the live BROWSE lied.

**Decision. The steward head declares its store home as an OPTIONAL `dataSource` field naming a `storeKey` — the exact routing vocabulary the governed head already uses (`MetricDef.dataSource`).** `specDataSource` honors a pipeline steward head's `dataSource` FIRST (before the measure-ref walk), returning it verbatim; `resolveStore` consumes it identically for governed and steward heads. ONE routing vocabulary (a `storeKey` string), pure `core`, byte-identical fall-through when absent. The `datasetCode → storeKey` mapping happens ONCE, at the authoring PICK gesture, in the app layer that holds the session sources — the INVERSE of the existing SSOT `datasetCodeOf` (`cubeProfile.store`, `storeKeyForDataset`), never a second routing rule — and is then FROZEN into config (expand-contract: additive optional field; stored specs never rewritten; a pre-0089 steward head with no `dataSource` resolves exactly as before).

**Store-map identity (the crux, established first).** `storeKey` = a session DataSource's `name` (the live store-map key: `deriveLiveDescriptors` emits `id: source.name`; `buildStoreManifest` keys by `id`; `resolveStore` indexes `ctx.stores[pageStoreKey]`). `datasetCode` = `source.config.datasetCode`. The two DIFFER (`regional` ≠ `REGIONAL_GVA`) but are cleanly 1:1 per session source via `datasetCodeOf` — so this is NOT a modeling fork; the steward head simply had no channel to carry the already-existing storeKey.

**Rejected alternatives.**
- **ALT-1 — head declares the `datasetCode`; `resolveStore` maps datasetCode→storeKey at render.** Refused: introduces a SECOND store-routing vocabulary (datasetCode) into the engine's store layer, forces `core`/`resolveStore` to map (it holds no session sources — it would need datasetCode exposed on every store or a side-map), and re-runs the mapping on every render instead of freezing it once. Violates "reuse the existing mapping SSOT, don't invent a second."
- **ALT-2 — session-scoped store descriptors: the picked cube joins the live store map for the session, no config change (0089 framing option b).** Refused per canon: a session-side store map is STATE the config cannot replay — routing would be correct live but LOST on reload / re-open, the spec resolving to the wrong store again. Config must carry the truth (the head's declared home survives serialization). Also grows the store map with transient entries.
- **ALT-3 — put `dataSource` inside the `ObsQuery` (`query.dataSource`).** Refused: the ObsQuery is the pure wire read-shape (measure/filter/orderBy); store selection is a HEAD concern (the governed head routes at head level via its metrics, not inside a query). Head-level `dataSource` keeps the governed/steward routing symmetric and the ObsQuery wire-faithful.

**Guard.** `FF-STEWARD-HEAD-NAMES-STORE` (`metric-store.fitness.test.ts`): a steward head whose declared `dataSource` differs from the page store routes `specDataSource` to the DECLARED store; absent `dataSource` falls through to undefined (byte-identical). Held: `FF-PROMOTE-ROUNDTRIP` (promotion to a governed metric drops the raw head + its `dataSource` and routes via the metric's own home), `FF-CONFIG-ROUNDTRIP` (the `dataSource` field is pure JSON). Follow-up (NOT this card): a picked cube that is not a session source has no store in the live map — `resolveStore` then falls to the first-key/page store (today's degraded behaviour, no regression); provisioning a picked-but-unbound cube into the session store map is a separate concern from the routing identity.

## Addendum 4 — the value-cell `source` variant (the 4th source head) [architect, 2026-07-20, card 0102 · ADR-051 DU4a · closing the desugar.ts:180-190 escalation]

**The gap (escalated from `desugar.ts:180-190`, W-P5a FINDING).** Three of the convenience discriminants — `timeseries`, `growth`, `ratio-list` (and, in kind, `row-list`) — are the **store-aware value-cell specs**: each ENUMERATES a set of coordinates and reads a **scalar point value** per coordinate (`storeValAt` / `storeVal(atTime)`), not a raw obs stream and not a grain-shaped aggregate. The three existing `source` variants cannot express this: the `metrics` head emits the governed grain/browse shape, the `query` head emits RAW obs (unsummed), and `rows` is literal. So folding these kinds onto the spine cracked row parity (`FF-PIPELINE-EQUIV`) — they were parked on their direct resolvers "awaiting a 4th source variant." This is the load-bearing gap ADR-051 named: while it is open, the pipeline cannot do *everything*, and the DU3 fallback lane cannot ever retire.

**Decision. Add a fourth `SourceStep` variant: the store-aware VALUE-CELL point read** — structurally discriminated by a bare `over` (+ `code`) field, mirroring how the union already discriminates `metrics` / `query` / `rows` by presence (no privileged flag):

```ts
| { op: 'source'; over: string; code: string
    coords?: readonly DimVal[] | 'all'          // explicit list, or store-distinct(over) ascending
    at?:     Partial<Record<string, DimVal>>     // fixed base coordinate merged into every read
    grain?:  Record<string, GrainLevel>          // per-dim LOD forwarded to valAt
    rollup?: RollupOp                             // aggregation when one coord matches finer cells (default 'sum')
    clamp?:  { fromDim?: string; toDim?: string; timeDimension?: TimeDimensionSpec } }
```

This variant IS the existing internal `PointSeriesSpec` read (the genuine store-aware value-cell primitive) **hoisted to a `source` head**. It carries the SAME fields point-series already carries; it is 100% JSON-serializable data (Law 2 — no functions, no `valAt` closure in config; the read lives in the resolver). It is a **source *variant*, not a fifth grammar** (Law 10): the `SourceStep` union gains one structurally-discriminated member; the `PipeStep`/`PipelineSpec` grammar and every tail verb are unchanged.

**How it resolves — delegation, byte-identical by construction (Law 4/6).** `readSource` (pipeline-resolver.ts) gains one arm that follows the exact pattern the other three use (governed→`metric`, steward→`query`, inline→rows): the value-cell head reconstitutes `{ type: 'point-series', ...head }` and delegates to the **already-registered, already-proven `PointSeriesResolver`**. There is NO new read path, NO new store port, NO re-implementation — the read is the same `storeValAt` fan-out `FF-DESUGAR-EQUIV` already proves row-identical for `timeseries`. The pipeline then runs its pure tail over those value cells via the unchanged `applyPipeline`.

**How each kind desugars through it (SPEC §1.3 table, extended):**

- **`timeseries` → `[ source(over=TIME_DIM, code, coords=effectiveYears, clamp?, grain?) ]`** — no tail. The source head IS the point-series read `timeseries` already lowers to (`desugarTimeseries`), so the fold is byte-identical BY CONSTRUCTION: `interpretSpec(pipeline)` calls the same `PointSeriesResolver` on the same params. This is the **keystone fold** — the lowest-risk kind, shipped in DU4a to prove the variant.
- **`growth` → `[ source(over=TIME_DIM, code, coords), window(lag→prev), derive(YoY), derive(color), filter(drop first period), select ]`** — the source enumerates the raw per-year values; the pure tail composes YoY over the ordered series (the `window` verb's `lag` + a `derive` reusing `@statdash/expr`, no second dialect). Multi-code growth carries a per-code store-read for series label/color that the pure tail cannot reproduce; it folds via the governed **calc-metric browse** path (Addendum 2 — a YoY calc metric browses year-by-year with an honest first-period null) rather than the raw-per-year tail. Sequenced DU4b; additive.
- **`ratio-list` → `[ source(over=MEASURE, coords=[numerators]), lookup/derive(÷ denominator ×100) ]`** and **`row-list` → `[ source(over=MEASURE, coords=[codes]), … label/color/pct/negate shaping ]`** — the MEASURE-axis form of the value-cell read (the enumerated coordinate IS the measure code). Their per-cell store-label enrichment strains the pure-tail boundary; they fold via a declared **explicit-cells extension** of this SAME variant (a `cells: {code, denom?, …}[]` mode) once its byte-identity is proven, OR remain on the DU3 fallback lane meanwhile. Sequenced DU4c/DU4d; additive. **Not built until byte-identically proven** (Law 8 — no grammar without a proven fold).

**The invariant — byte-identical, on the stored corpus.** For every kind folded, `interpretSpec(desugarToPipeline(spec))` is **row-identical** (same rows, order, values, nulls, fields — `toEqual`) to the untouched legacy resolver dispatched directly (`legacyDirect`) — `FF-PIPELINE-EQUIV`, the SAME two-path oracle W-P5a established. Desugar runs at READ time only; **stored configs are never rewritten** (expand-contract). Encoding is synthesized to the point-series field names (`{label, value}`); `FF-PIPELINE-EQUIV` compares resolver ROWS (pre-encoding), so the synthesized encoding never affects the parity proof, and the folded field set is preserved so the downstream renderer encodes identically.

**Dependency-graph + warm parity.** `extractDeps` (pipeline branch) gains the value-cell arm: `over` + `at`/`where` keys → dim edges, `clamp` → time-binding edges, `grain` forwarded — the SAME edges point-series/timeseries record, so the reactive graph never goes blind on the new discriminant. `sourceHeadObs` returns the enumerate obs query (`{ measure: code }`) so the async warm covers the enumerate + valAt reads under the identical key.

**Rejected alternatives.**
- **ALT-A — a bespoke per-kind source variant for each of the four kinds (four new union members).** Refused: four grammars smuggled into the `SourceStep` union (Law 10 violation), each re-declaring an enumerate+read it shares with the others; the reactive graph, warm, and validation would each need four new arms. The value-cell read is ONE primitive (`storeValAt` over an enumerated axis) — it gets ONE variant.
- **ALT-B — decompose ALL four into `{query|rows}` head + pure tail, no new variant.** Refused: the `query` head emits raw unsummed obs, so reproducing the per-coordinate `sum`/`valAt` scalar cell would require re-implementing the OLAP point-read as pure tail verbs — either impossible (the tail has no store) or a fragile float-arithmetic re-derivation that cracks byte-identity. The value-cell read is intrinsically store-aware; it belongs at the `source` head, not smeared into the pure tail.
- **ALT-C — keep the four on their direct resolvers forever; declare the spine "done enough."** Refused: it permanently forks the resolution path (Law 6) and blocks ADR-051's `FF-ALL-KINDS-SHAPED` — the DU3 fallback lane could never retire, and "the pipeline does everything" stays false.

**Guards.** `FF-PIPELINE-EQUIV` (byte-identical rows, extended with a value-cell corpus — the ⛔ gate for any emission flip) · `FF-ALL-KINDS-SHAPED` (progress: `timeseries` now pipeline-shapeable; the remaining kinds a visible, shrinking list) · held: `FF-DESUGAR-EQUIV` (the point-series read is unchanged), `FF-CANVAS-NEVER-LIES` (honest first-period null preserved for growth/calc-browse), `FF-CONFIG-ROUNDTRIP` (the variant is pure JSON).

**Status: ACCEPTED** (owner-blessed autonomy, 2026-07-20 — ADR-051 direction). The variant TYPE is a grammar addition (a new config shape) and therefore a one-way door **only at the emission flip** (when the Constructor emits `pipeline` with a value-cell head as the stored default — gated exactly like W-P5 on `FF-PIPELINE-EQUIV` green). The DU4a wiring (union member + desugar arm + resolver delegation + fitness) runs at read/proof time only and is fully **revert-clean**.

## Addendum 5 — the explicit-cells extension of the value-cell head (the MEASURE-axis fold for `ratio-list` + `row-list`) [architect, 2026-07-20, card 0102 · ADR-051 DU4c/DU4d · closing the `desugar.ts:305-317` fallback default]

**The gap (assessed at the DU4c/d attempt, `resolvers.ts:133-265`).** The Add.4 `over`-form value-cell head enumerates a **homogeneous** coordinate axis (`over: TIME_DIM`, distinct coords, one `storeVal` per coord). The two remaining store-aware kinds do not fit that shape — they enumerate an **explicit, heterogeneous list of MEASURE codes**, each cell reading its own value and carrying its own per-cell parameters:

- **`ratio-list`** (`resolvers.ts:243-265`) — per `spec.pairs` entry `{code, denom, label?}`: reads **TWO** cells (`storeVal(numCode)`, `storeVal(denCode)`), emits `{id, measure, label, value:(num/den)*100}` (guarded `den ? … : 0`). Has `measure`, never `pct`, never enrichment. Carries an optional trailing `spec.pipe`.
- **`row-list`** (`resolvers.ts:133-171`) — per `RowSpec` `{code, label?, color?, negate?, isTotal?, pctOf?}`: reads **ONE** cell (`storeVal(code)`) plus a **conditional second** cell (`storeVal(pctOf)`, a *per-cell distinct* denominator) only when `pctOf` is declared; performs a **store-META enrichment** read (`storeObs({measure:code})[0]` → label/color, LocaleString-tagged) when label/color are absent; emits `{id, label, value:negate?-raw:raw}` plus **conditional** `pct` (only where `pctOf` declared, *unguarded* — a 0 denominator yields `Infinity`, deliberately), `color`, `isTotal`. Never `measure`. No tail.

Neither folds through the Add.4 `over`-form. Both need the explicit-cells reading primitive Add.4 named but left unspecified (the `cells:{code,denom?,…}[]` "`…`"). This addendum specifies it.

### Decision — ONE unified `cells` head shape (a 5th `SourceStep` member, in the value-cell family), NOT two variants

A single explicit-cells head serves **both** kinds. It is discriminated by the presence of `cells` (mirroring `metrics`/`query`/`rows`/`over` presence-discrimination); it is the **MEASURE-axis, heterogeneous-list** sibling of the Add.4 `over`-form (the axis-enumerate homogeneous form) — the SAME "enumerate coordinates, read scalar value cells" primitive, two read shapes. It is **not** a fifth grammar (the `PipelineSpec` grammar — source head + pure tail — is unchanged) and **not** a per-kind variant (Add.4 ALT-A) — it is ONE read-shape for the explicit-cells CLASS, serving ratio-list + row-list today and extensible to any future explicit-cell kind. Law 10 honored.

```ts
| { op: 'source'
    cells:   ExplicitCell[]                       // the enumerated, heterogeneous cell list
    enrich?: boolean                              // HEAD-level opt-in store-meta label/color fallback
    at?:     Partial<Record<string, DimVal>>      // fixed base coordinate merged into every read
    grain?:  Record<string, GrainLevel>           // per-dim LOD forwarded to valAt
    rollup?: RollupOp }                            // aggregation when one cell matches finer cells

interface ExplicitCell {
  code:     string             // the measure code read for `value` (the cell's primary coordinate)
  denom?:   string             // ONE secondary read → `_denom` companion (ratio denominator OR pct base)
  label?:   LocaleString       // literal passthrough; enrich fills when absent + enrich
  color?:   string             // literal passthrough; enrich fills when absent + enrich
  negate?:  boolean            // literal passthrough; the tail negates
  isTotal?: boolean            // literal passthrough
}
```

The three open questions, resolved explicitly:

1. **ONE unified shape or two?** — **ONE.** `ExplicitCell` is a *superset* descriptor; each kind populates its subset (ratio-list: `{code, denom(always), label?}`; row-list: `{code, denom?(=pctOf), label?, color?, negate?, isTotal?}`). The two kinds diverge ONLY in their **pure tails** (which the desugar emits per-kind) — the head shape is one. Two structurally-distinct kinds, one read shape.

2. **Does the cell own the store-meta enrichment fallback?** — **No: the cell owns the label/color VALUES; the HEAD owns the enrich POLICY** as an opt-in `enrich?: boolean` flag. Enrichment is applied *uniformly across all cells of a spec or not at all* (row-list enriches every cell missing label/color; ratio-list never does) — there is no spec where some cells enrich and others don't — so the policy is a head property, not a per-cell one. `row-list` desugars with `enrich: true`; `ratio-list` omits it (→ `label ?? code`, no enrichment). Because enrichment reads the store (`storeObs`), it CANNOT be a pure tail verb — it belongs at the head, the only store-aware step.

3. **The differing output field-sets (`measure` vs none; `pct` always vs conditional)?** — **all downstream of the head, split cleanly by the head/tail boundary.** The head does STORE reads only and emits per-cell rows carrying `value` (+ `_denom` companion when a secondary code is declared, + literal passthrough). The **arithmetic** (ratio division, negate, pct formula, the `measure` field) is the **pure tail**, emitted differently per kind. The **conditional output fields** (`pct`, `isTotal`, `color` present on some rows, absent on others) are preserved because the HEAD — imperative store-aware code — emits `_denom`/`isTotal`/`color` **only on the cells that declare them** (exactly as the resolver branches per row), and a presence-conditional `derive` + a presence-preserving `select` carry that through. This is the SAME "field present on some rows only" mechanism the DU4b growth fold already proves byte-identical (`window lag` omits `_prev`; `exists` reads it; `select` preserves what exists).

### The head owns exactly the store-aware read — via a shared, extracted `readExplicitCells` (the Strangler seam guaranteeing byte-identity)

`readSource` (pipeline-resolver.ts) gains ONE arm (`'cells' in head`) that delegates to a new **pure store-read helper** `readExplicitCells(cells, enrich, at, grain, rollup, ctx, store)` extracted from the two legacy resolvers. It performs, per cell, exactly what the resolvers do today: (1) `storeVal(code)` → `value`; (2) if `denom` declared, `storeVal(denom)` → `_denom`; (3) if `enrich` and label/color absent, `storeObs({measure:code})[0]` → fill label/color, **`tagLocaleString` on an object label** (the identical i18n boundary, `resolvers.ts:162`); (4) copy literal `label`/`color`/`negate`/`isTotal` onto the row, conditionally as the resolver does (e.g. `isTotal` only when set). It emits NO ratio/pct/negate arithmetic. **Both** the new head arm **and** (transitionally) the legacy `RatioListResolver`/`RowListResolver` call this ONE helper — so the cells the tail runs on are *literally the same cells* the legacy arithmetic ran on. Byte-identity is by construction; the FF proof reduces to "does the pure tail reproduce the arithmetic." Guard: `FF-EXPLICIT-CELLS-READ-SHARED` (the head arm and the legacy resolvers share the SOLE store-read helper — no re-implementation, one read path, Law 6).

### The desugar arms (`desugarToPipeline`, replacing the `default` identity for these two kinds)

**`ratio-list` →**
```
[ source(cells = pairs.map(p ⇒ ({code:p.code, denom:p.denom, label:p.label}))),   // no enrich
  derive(measure = id),                                    // or head carries measure = code
  derive(value  = '_denom ? (value / _denom * 100) : 0'),  // the guarded ratio
  select([id, measure, label, value]) ]                    // drops _denom scaffold
… ++ spec.pipe                                             // ratio-list's optional existing tail, verbatim
```

**`row-list` →**
```
[ source(cells = rows.map(r ⇒ ({code:r.code, denom:r.pctOf, label:r.label,
                                color:r.color, negate:r.negate, isTotal:r.isTotal})), enrich:true),
  derive(pct   = _denom present ? (abs(value) / _denom) * 100 : ⟨omit⟩),   // UNGUARDED, presence-conditional
  derive(value = 'negate ? -value : value'),                              // pct read abs(value) first — order-safe
  select([id, label, value, pct, color, isTotal]) ]                       // presence-preserving; drops _denom, negate
```

- `pct` uses `abs(value)` and row-list applies no denom-guard, so a 0 pctOf yields `Infinity` — the tail must reproduce this UNGUARDED (unlike ratio-list's guarded `value`). Its emission condition is "**pctOf was DECLARED**" (= `_denom` companion present), NOT "denom value truthy" — so the head emits `_denom` iff declared, and the derive fires on presence. `abs()` makes pct order-independent of the negate step.
- `select` must be **presence-preserving** (project listed fields that EXIST, drop the rest, never inject an absent field as `null`) so row-list rows without `color`/`pct`/`isTotal` stay without them (byte-identity). Equivalent: an exclude-mode select that only strips the `_`-scaffold. **Flagged to build:** confirm `select` is presence-preserving (the DU4b growth fold's `select` never exercised absent listed fields); if it null-fills, use the scaffold-strip form instead. Byte-identity (`FF-PIPELINE-EQUIV`) is the oracle either way.

### FF-PIPELINE-EQUIV corpora (the acceptance bar — `interpretSpec(desugarToPipeline(spec))` `toEqual` `legacyDirect(spec)`)

- **ratio-list:** with/without `label`; `denom` value 0 (→ `value` 0); multi-pair; with and without a trailing `spec.pipe`; verify `measure` present and `pct` absent.
- **row-list:** `label`/`color` present vs absent-then-enriched (from `storeObs` meta, incl. an **object-valued LocaleString** label — the tag must survive); `negate` true/false; `pctOf` present vs absent (`pct` conditional); `pctOf` value 0 (→ `Infinity`, unguarded — must match); `isTotal` present vs absent; verify `measure` absent and no `null`-filled fields.

### Which resolver logic moves where

| logic | today | after Add.5 |
|---|---|---|
| `storeVal(code)` / `storeVal(denom\|pctOf)` reads | in each resolver | `readExplicitCells` (shared) — head arm |
| `storeObs` enrichment + `tagLocaleString` | RowListResolver:147-162 | `readExplicitCells` (behind `enrich`) — head arm |
| literal passthrough (label/color/negate/isTotal) copy | each resolver | `readExplicitCells` — head arm |
| ratio `(num/den)*100`, `measure` field | RatioListResolver | pure `derive`/`select` tail (desugar-emitted) |
| negate, `pct` formula, conditional emission | RowListResolver | pure `derive`/`select` tail (desugar-emitted) |
| `spec.pipe` (ratio-list) | RatioListResolver:258-263 | appended tail verbatim |
| `RatioListResolver` / `RowListResolver` bodies | live dispatch | thin delegates (kept registered, like `TimeseriesResolver`) until DU5 deletion |

### Multi-code `growth` — the calc-metric browse fold path (noted, NOT designed here)

Multi-code `growth` (`code: string[]`, len > 1, `resolvers.ts:221-238`) does NOT fold through the explicit-cells head: it performs a per-code `storeObs({measure:code, filter:{[TIME_DIM]:years[0]}})[0]` series label/color meta read and emits a `series` field + `id: label::year`. Per Add.4 it folds via the **`metrics` head + calc-metric browse** path (Addendum 2 — a governed YoY calc-metric browses year-by-year with an honest first-period null), NOT the value-cell family: each code → a YoY calc-metric; head `source(metrics:[…], time: browse-grain)`; the governed head's natural label/color REPLACE the raw `storeObs` read. **Open risk (flagged, own equivalence proof required):** the governed metric label/color may DIFFER from the raw obs-meta label/color the current resolver reads — so this fold is NOT byte-identical by construction and needs either its own equivalence corpus or an accepted-divergence note. It is sequenced separately (DU4e), belongs to the metrics-head family, and is out of scope for this addendum.

### Guards

`FF-PIPELINE-EQUIV` (extended with the ratio-list + row-list corpora — the ⛔ gate for the emission flip) · `FF-EXPLICIT-CELLS-READ-SHARED` (head arm + legacy resolvers share the SOLE `readExplicitCells`) · `FF-ALL-KINDS-SHAPED` (progress: ratio-list + row-list now foldable → the remaining gap shrinks to *multi-code growth* alone) · held: `FF-DESUGAR-EQUIV`, `FF-CANVAS-NEVER-LIES` (LocaleString labels + honest unguarded values preserved), `FF-CONFIG-ROUNDTRIP` (`cells` is pure JSON — no functions, Law 2).

**Status: ACCEPTED** (owner-blessed autonomy, 2026-07-20 — ADR-051 direction). Like Add.4, the `cells` head TYPE is a grammar addition and a one-way door **only at the emission flip** (Constructor stores `pipeline` with a `cells` head as default — gated on `FF-PIPELINE-EQUIV` green). The DU4c/d wiring (5th union member + `readExplicitCells` extraction + two desugar arms + fitness corpora) runs at read/proof time only and is fully **revert-clean**.
