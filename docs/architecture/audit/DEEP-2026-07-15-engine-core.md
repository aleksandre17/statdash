# DEEP EXPEDITION — Engine-Core lens (packages/core · expr · contracts · engine surface of react)

> **Owner directive 2026-07-15:** "go into the depths with every discipline's skill … SEE WHAT IS NOT VISIBLE."
> **Author:** engine-specialist (Opus 4.8), read-only study. One of five parallel lenses; the lead synthesizes.
> **Method:** first-principles read of the live core (`packages/core/src/**`), cross-read against ADR-034 / SPEC-data-semantic-worldclass-fable / the reactive-graph track / ADR-041/042, and the STUDY-authoring-canon-circle-break live-probe context. Every claim is code-cited. **No code was touched.**
> **Verdict up front:** the engine is a **stronger machine than the product can currently reach**. The kernel is *converging* to one algebra and is genuinely world-surpassing in two places (the config-compiled reactive graph; additivity-at-grain). But three load-bearing capabilities are **built and unreachable**, one invariant the platform's identity rests on (statistical honesty) is **enforced in exactly one path and absent in the pervasive one**, and the single most-repeated architectural claim in the ADRs — *"lineage is a read; provenance composes through the algebra"* — **is written down but not built**. The invisible truth is not a missing feature. It is that **the engine already computes almost everything needed for statistics-grade honesty and lineage, and then throws that information away at three specific seams before it reaches a consumer.**

---

## 1 · VERDICT ON THE KERNEL — one algebra, or accreted dialects?

**One algebra in intent, three-quarters collapsed in fact, with the collapse stalled at the exact half-way line the Strangler always stalls at.**

### 1.1 What is genuinely ONE now (settled, do not reopen)
- **One expression dialect.** `DeriveExpr` retired; `@statdash/expr` is the sole AST/evaluator; `parseFormula` is the string surface (ADR-034 M3, `53bb83f`). `metric-calc.ts`, `metric-grain.ts`, `directional.ts` all evaluate through `evalExpr` — verified: no second evaluator survives.
- **One measure-resolution seam.** `resolveMeasureRef` (`data/metric.ts:259`) is the sole raw-code-vs-metric-id discriminator; QueryResolver, the KPI read path, `extractRequirements`, and the grain evaluator all route through it. `FF-ONE-RESOLUTION-PATH` holds.
- **One grain SSOT.** `evalMeasureAtGrain` (`metric-grain.ts:265`) is the single "measure at any grain" entry — calc metrics re-derive via align-join + Expr; base metrics roll up per cell; `drill.ts` and the react `resolveDrill.ts` *compose* it rather than fork it. This is real discipline: the S4 hierarchy drill added **zero** new query paths (`metric-grain.ts` unchanged, per ADR-034 §8.3).

### 1.2 Where the union is still DIALECTS, not algebra
- **The DataSpec union carries four accreted surface forms that are NOT yet sugar.** `desugar.ts` only lowers `pivot`→transform and `timeseries`→point-series (`desugar.ts:134-140`). **`growth` and `ratio-list` still have bespoke hand-written resolvers** (`resolvers.ts:199-264`) with their own YoY loops and `den ? (num/den)*100 : 0` ratio math — the exact per-type special-casing the algebra is meant to dissolve. ADR-034's ⛔ one-way door (demote `growth`/`ratio-list` to sugar over calc metrics) is **HELD, gate-fired only** — so today the union is: 2 primitives (`query`, `transform`) + 1 internal (`point-series`) + 1 semantic noun (`metric`) + **4 un-lowered dialect resolvers** (`row-list`, `growth`, `ratio-list`, and the thin `pivot`/`timeseries` delegates). The honest kernel is **~3 nouns** (`query` physical, `metric` semantic, `transform` relational); everything else should be sugar. The collapse is designed, reversible-proven, and **not done**.
- **Three aggregation ideas still live in two places.** `METRIC_AGG_VALUES = ['sum','avg','last']` (`metric.ts:56`) for cross-time metric agg vs the transform `Reducer` set (`sum|mean|min|max|count|first|last`). ADR-034 claims M3 unified these; the *reducer* set was unified, but `MetricAgg` remains a **separate three-value tuple** that does not derive from the reducer SSOT. Minor, but it is a second vocabulary the picker and the type both hardcode.

### 1.3 Over-built vs under-built
- **Under-consumed, not over-built.** Nothing here is speculative gold-plating. The `metric` discriminant, `evalMeasureAtGrain`, the additivity model, the hierarchy drill, the reactive graph — every one is a real, tested capability. The imbalance is the opposite of YAGNI-violation: **the engine is ahead of its consumers.** That is a healthier failure than most, but it is *this study's* central finding (§2).
- **The one genuinely new engine capability** — align-join at grain (`enumerateGrainTuples` + `readInputAt`, `metric-grain.ts:127-181`) — is correct but **untested against a reference join/window engine** (ADR-034 §4 flags this: "must be tested against DuckDB-reference join/window semantics"). It does an outer align on the *union* of grain tuples across inputs; a component missing a tuple contributes `0` via `readInputAt`'s `?? 0`, which is a **left-outer-join-fill-zero** decision made silently. For a *ratio* metric that is often wrong (missing denominator ≠ 0). See §2-F4.

**Kernel verdict:** trajectory is correct and the destination is right (3-noun algebra). The AR-50 M-SQ resolver has landed to a high standard. But the union is mid-Strangler, the collapse is parked behind a one-way door nobody has fired, and — decisively — **the algebra's outputs are lossy at the boundary** (§2). Collapsing the remaining dialects is *power, not churn*, but it is the **least** urgent of the moves below.

---

## 2 · THE INVISIBLE — seven findings nobody has named

### F1 · The honest-state grammar EXISTS on the async envelope and is DISCARDED at the synchronous render boundary
`QueryResult` (`store.ts:110-115`) carries `state: 'loading' | 'done' | 'error'` — a real, Grafana-DataFrame-grade state channel. But **every render read goes through `querySync`**, which returns a bare `EngineRow[]` (`store.ts:146`), and through `storeVal` (`store.ts:195-197`):
```ts
export function storeVal(store, code, ctx): number {
  return (store.querySync({ type: 'val', code }, ctx)[0]?.['value'] as number) ?? 0
}
```
The `?? 0` is the origin of the owner's felt "the canvas lies." **Four semantically distinct conditions all collapse to the number `0`:** genuine zero · no observation at this coordinate (no-data) · unbound spec (empty measure) · cold cache (loading). The state grammar the platform needs is **already modeled** — it just never survives the sync fast-lane. This is not a missing abstraction; it is a **discarded** one. (W1 owner: this is your seam — see §4, PM-1.)

### F2 · `interpretKpi` emits a FORMATTED STRING — the honest state cannot even be represented in the KPI output
`resolveValue` (`kpi.ts:82-154`) returns `getFormatter(spec.format)(n)` — an unbound KPI leaves the engine as the string `"0.0%"`. There is **no channel** on `KpiDef` to say "this value is unresolved." The formatting boundary is *inside* the engine, before any honest-state decision can be made. A canvas that wants to render an honest "აუბმელი" affordance (W1) cannot get the signal — it was destroyed one layer too early. The engine formats before it decides whether there is anything to format.

### F3 · Lineage-as-a-read and provenance-composition are the most-repeated claim in the ADRs — and neither is built
Six documents assert it (ADR-034 §4, SPEC lines 20-22, 125, 156, 194). The reality:
- **The `MetricResolver` emits no provenance at all.** Its row is `{ ...tuple, id, label, series, metric, value }` (`metric-resolver.ts:114`) — `status`, `methodology`, `vintage`, `lastUpdated` are all dropped. A chart bound to a governed metric carries **less** provenance than one bound to a raw obs (which at least gets `status` via `applyEncoding`, `encoding.ts:254-259`).
- **`withMetricProvenance` does not compose.** It finds the *one* metric owning a code and fills `methodology`/`unit` (`metric.ts:367-387`); it **does not walk `calc.inputs`**. A derived metric (deflator = nominal/real) surfaces neither component's methodology, nor a worst-of preliminary status. The SPEC's "surpass nobody has" (line 194) is a comment, not code.
- **The reactive graph has no `metric:` source.** `deps.measures` is extracted (`extractDeps.ts:88`) — but `depsToSources`/`SRC` (`compilePage.ts:51-72`) map only `dim/param/var/perspective/classifier/store/locale`. **There is no measure or metric-catalog edge in the graph.** ADR-034's headline consequence — "*`metric:` source edges make catalog edits invalidate exactly the consuming nodes; lineage becomes a read over graph + catalog*" — is **structurally absent**. Editing a `MetricDef.calc` invalidates nothing. The lineage the platform advertises as its statistics-grade differentiator is one `SRC.metric` key and one graph-walk away, and that walk has never been wired.

### F4 · Additivity is guarded in ONE path and unguarded in the PERVASIVE one — the summed-ratio defect is closed for the new door, open on the old highway
`guardNoSumOfRatio` (`metric-grain.ts:79-83`) is real and correct — but it is only reached through `evalMeasureAtGrain`/`readInputAt`. **The path 99% of the live corpus uses — `storeVal` — sums across every unpinned ambient dimension with no additivity check.** `storeVal` issues `{type:'val'}`, whose contract is "OLAP cell **sum**" (`store.ts:55`). Read a deflator or a per-capita *raw code* at a coordinate where `geo` is unpinned, and the store silently sums the ratio across regions. `guardNoSumOfRatio` never sees it. Worse, in `kpi.ts:56-60`, `readMeasure` does `for (const code of resolveMeasureRef(measure).codes) sum += storeVal(...)` — so a **KPI `point` variant referencing a calc metric-id** would sum its *component codes* instead of evaluating its expr (the correct path exists only in the separate `type:'metric'` KPI variant, `kpi.ts:145-152`). The protection is **variant-dependent and path-dependent, not measure-dependent.** The scientific invariant the platform exists to enforce is honored where a new author uses the new noun and violated wherever the old noun is used. `FF-NO-SUM-OF-RATIO` bites a door almost nobody walks through yet.

### F5 · The `metric` DataSpec — the AR-50 keystone — has ZERO authored consumers in the shipped corpus
`grep type:'metric'` across `plugins`/`apps` configs: **nothing** binds it. It appears only in the *editors* (`MetricSpecEditor.tsx`, `DataSpecEditor.tsx`) and one e2e (`metricSpecRender.e2e.ts`). The resolver is registered (`resolvers.ts:355`), tested, and correct — and **no page uses it**. This is the STUDY's F3 ("mechanism shipped, adoption pending") seen from the engine floor: the semantic query is a **fully-built noun with no sentence written in it.** The "one governed number on every surface" DoD cannot be met by a noun the corpus doesn't speak.

### F6 · `EngineRow = Record<string, DimVal>` — the algebra's output is an untyped bag, so nothing downstream can be *type-forced* to carry state, provenance, or lineage
`encoding.ts:34`. Every enrichment the platform wants (cell-state, OBS_STATUS, provenance handle, source-cell lineage) has to be a **conventional string key** on an open record, invisible to the type system and easy to drop (which is exactly what F1/F3 do — they drop by omission, and nothing complains). The reference platforms that ship lineage (Arrow, Grafana DataFrames, Sigma) carry it in a **typed field/column envelope**, not a bag. This is the structural root under F1, F3, and the "objects don't declare their contracts" felt-list item: the engine's own row type declares no contract.

### F7 · The confidential status `c` is a badge with no masking — a live data-integrity hole
`OBS_STATUS 'c'` = confidential/suppressed (`provenance.ts:28`, `encoding.ts:257`). It resolves to a badge label. But nothing in the value path **masks** a `c`-flagged observation — `storeVal` sums it as a number like any other. A statistics platform that renders a confidential cell's numeric value with a "Confidential" badge next to it has **published the thing the flag says must not be published.** No code enforces suppression; the flag is decorative.

---

## 3 · THE MAXIMAL ENGINE CONCEPT — benchmarked

**The engine already contains, in pieces, the one thing no reference platform ships as a whole: a config-compiled, statistics-grade, provenance-carrying *cell*.** The maximal concept is to make that cell **real and lossless end-to-end** — a single typed value-envelope that flows from store read to render, carrying not just a number but its *state, its status, and its lineage handle* — and to make the reactive graph the **lineage index** over it.

| Reference | What they ship | What we already have | The unclaimed surpass |
|---|---|---|---|
| **Grafana DataFrames** | typed fields + per-frame state (loading/error/no-data) | `QueryResult.state` — **discarded at `querySync`** (F1) | state that survives to the *cell*, per-value not per-frame |
| **Vega / Vega-Lite** | invalid/filtered-datum handling; one view's dataflow | the reactive graph — **whole-page**, config-compiled (surpass, ADR-024) | + a *value-state* grammar Vega has only per-mark |
| **Cube / dbt-SL / MetricFlow** | governed semantic query API; grain; ratio metrics | `metric` discriminant + `evalMeasureAtGrain` + additivity | SDMX-native, and **provenance composes through the algebra** (F3 — designed, unbuilt) |
| **Malloy** | nesting, source-model lineage | `by`/grain generic axes; hierarchy drill | lineage as a *graph read*, not a compiler pass |
| **Arrow / dbt / Sigma** | columnar typed cells; lineage-as-UX; cell traceability | `deps.measures` + the graph + `ProvenanceRecord` | **the graph + catalog make lineage mechanically free — one `SRC.metric` edge away** (F3) |
| **SDMX (our canon)** | OBS_STATUS A/p/e/r/c; DSD structural contract | `status` carried on `DataRow`; `OBS_STATUS_LABELS` | **enforced** suppression (F7) + status *composition* through derived metrics |

**The concept in one sentence:** *a value in this engine should be a `Cell`, not a `number` — {value, state, status, provenance-ref} — and the reactive graph should be its lineage index; every seam that today returns a bare number or drops the async state is a place the Cell leaks.* This is not new machinery. It is **stopping three specific losses** (F1, F3, F7) and giving the row a **typed spine** (F6). The maximal engine is the one that already exists, minus the leaks.

---

## 4 · POWER MOVES — ranked by leverage, with cost / YAGNI / one-way honesty

### PM-1 · The interpret-level honest-state seam (the `Cell` / `ValueState`) — **W1's engine dependency, do this first**
**Leverage: highest.** Unblocks W1's `FF-CANVAS-NEVER-LIES`, closes F1+F2, and lays the typed spine (F6) every later move needs.

**Recommended design (for W1's consumption — additive, reversible, arrow-clean):**

The canonical interpret-level state grammar, benchmarked against Grafana (frame state), Vega-Lite (invalid datum), and SDMX (OBS_STATUS):
```ts
// core/src/data/cell.ts  (new leaf, zero deps beyond sdmx/provenance types)
export type ValueState =
  | 'ok'        // a real value (incl. a genuine 0)
  | 'no-data'   // coordinate valid, store has no observation there
  | 'unbound'   // spec incomplete — no measure/coordinate to read (authoring)
  | 'loading'   // async read in flight (the QueryResult.state that today dies at querySync)
  | 'error'     // read failed
  | 'masked'    // suppressed by OBS_STATUS 'c' (F7) — value withheld, not zero
export interface Cell {
  value:  number | null            // null ⟺ state !== 'ok'; NEVER a fake 0
  state:  ValueState
  status?: ObsStatus               // p/e/r decoration when state==='ok'
}
```
**The seam, not a rewrite.** Introduce **one** function beside `storeVal`:
```ts
export function storeCell(store, code, ctx): Cell   // the honest sibling of storeVal
```
`storeVal` stays (byte-identical `?? 0`) so nothing breaks; `storeCell` distinguishes the four conditions the store already knows (empty rows → `no-data`; `queryAsync.state` → `loading`/`error`; empty `code` → `unbound`; `status==='c'` → `masked`). Then:
- **Unbound is decidable *before* the store** — an interpreter checks "is there a measure ref?" and returns `{value:null,state:'unbound'}` without a read. This is what W1's "empty state becomes the door to J4" needs: the *interpreter* declares unbound, the react layer renders the bind affordance.
- **`KpiDef` gains an optional `state?: ValueState`** (additive) so F2's string-formatting no longer erases the signal; the formatter is only applied when `state==='ok'`, else the renderer picks the honest affordance.
- **`EngineRow` stays a bag for now** but a data-bearing row *may* carry `_state` (convention, like `status`), so charts can veil no-data points.

**Cost:** ~1 new leaf file + 1 `KpiDef` field + react consumption (W1 owns the render side). **One-way?** No — purely additive; `storeVal` untouched, `storeCell` is opt-in. **YAGNI check:** passes hard — W1 has a named, live consumer *today*. **Refuse the temptation** to make `EngineRow` a typed `Cell[]` in this move (that is PM-4's job and a bigger contract); ship the state channel first.

### PM-2 · Wire the `metric:` source into the reactive graph → lineage becomes a read
**Leverage: very high, cost surprisingly low.** `deps.measures` already exists (`extractDeps.ts:88`); this is **one `SRC.measure` key + one line in `depsToSources`** (`compilePage.ts:62-72`) + a `diffState` bucket. That single edge:
- makes a `MetricDef.calc` edit invalidate **exactly** the consuming nodes (the ADR-034 headline, currently vaporware);
- makes "which panels use metric X" (`computeMetricImpact`, referenced in the SPEC) a **graph read, not a scan**;
- makes lineage ("why is this number") a walk over graph-edges + catalog — the G2 promise.

**Cost:** low (the data is already collected; only the source-key mapping is missing). **One-way?** No — additive source key; existing invalidation unaffected. **YAGNI:** the *invalidation* half is justified today (catalog edits in the modeler already exist); the *lineage-UX* half is a read that becomes free once the edge exists — don't build the UI here, just light the edge and expose `metricImpact(id)`.

### PM-3 · Move the additivity guard to the measure-resolution SSOT — close the summed-ratio highway (F4)
**Leverage: high — this is the platform's scientific identity.** Today `FF-NO-SUM-OF-RATIO` protects only `evalMeasureAtGrain`. The fix is to make `effectiveAdditivity` consulted at **`resolveMeasureRef`/`storeVal` scale**: a non-additive measure read across an unpinned ambient dim must **re-derive or refuse**, not sum. Concretely — `readMeasure` (`kpi.ts:56`) and the `val`-cell ambient sum are the two unguarded sites; route a metric-id read through the additivity classifier before the OLAP sum.

**Cost:** medium — touches the hot read path; needs the reversible-expansion parity discipline (a raw code / additive measure must stay byte-identical; only a *declared* non-additive measure changes behavior). **One-way?** No, but **behavior-changing** for any config that was (incorrectly) relying on a summed ratio — so it must land behind a parity gate proving additive/raw paths unchanged, and surface the newly-refused cases as diagnostics, not silent flips. **YAGNI:** justified — this is correctness, not feature. But sequence it **after** PM-1 (it needs `state:'error'`/a diagnostic channel to refuse *loudly* rather than throw into a render boundary — see the fail-soft-interpret guard lesson in memory).

### PM-4 · Provenance composition through the algebra (F3 second half)
**Leverage: high (the true "nobody has this" surpass), but honest cost.** Extend `withMetricProvenance` to walk `calc.inputs` (worst-of preliminary status, methodology chain, latest `lastUpdated`), and have `MetricResolver` emit the composed `ProvenanceRecord` on its rows. This is the statistics-grade differentiator.
**Cost:** medium; **depends on PM-1's typed-cell spine** to carry provenance without the bag dropping it. **One-way?** No. **YAGNI honesty:** this has **no live consumer yet** (F5 — the `metric` noun isn't authored). Do **not** build it before W2 migrates the corpus onto metric handles; it would be another cathedral. **Recommend: design now, build when W2 lands a real metric-bound panel.** This is the one move where I counsel *patience* over initiative.

### PM-5 · Collapse the remaining dialects (`growth`/`ratio-list` → sugar) — the parked ⛔
**Leverage: real but lowest urgency.** It is debt-kill and it shrinks the surface `extractDeps`/the Constructor must trust, but it changes nothing the owner can *feel*, and it is the **one genuine one-way door** in the whole plan (demoting stored discriminants). **Refuse to fire it during the W1–W5 window** (the STUDY's WIP=1 doctrine). Its precondition — `FF-GROWTH-KIND-EQUIV`/`FF-METRIC-QUERY-EQUIV` green on *every stored config* — cannot even be evaluated until F5 is fixed and the corpus speaks `metric`. **Sequence: dead last, after W5, gate-fired.**

---

## 5 · WHAT TO REFUSE

1. **Refuse to build provenance-composition, richer grain (D5), or pre-agg (S10) before the `metric` noun has a live authored consumer (F5).** The engine's disease is *ahead-of-consumers*, not *behind*. Adding more unreachable power deepens the exact "we started architectures that didn't come out" pathology the STUDY names. Design-and-park; do not build into the void.
2. **Refuse to fire the `growth`/`ratio-list` demotion one-way door during W1–W5.** It is the only irreversible move on the board and buys the owner nothing feelable. WIP=1 + journey-DoD forbids it.
3. **Refuse to fix "the canvas lies" in the render layer alone.** F1/F2 prove the lie is *born in the engine* (`storeVal ?? 0`; formatted-string KPI output). A react-only veil would be a symptom patch (Law 6); the honest-state seam (PM-1) must originate in core or the canvas will keep lying wherever the store returns a bare number.
4. **Refuse to promote `EngineRow` to a typed `Cell[]` in one big-bang.** The bag is load-bearing across every resolver, encoder, and table; a wholesale retype is exactly the "another object-model reform" the STUDY refuses. Add the `state` channel as a seam (PM-1), let the typed spine accrete.
5. **Refuse to add a second query plane / foreign engine for lineage or state.** Both are one edge (PM-2) and one seam (PM-1) away *inside the machinery we have*. Importing Arrow/Cube semantics would fork the SDMX-native substrate (ADR-034 ALT-A/C, correctly rejected) — and would be, again, capability without a consumer.

---

## 6 · The one-line synthesis for the lead
The engine is not under-built; it is **lossy at three seams and ahead of its consumers by one migration.** The highest-leverage engine work for the live program is not new algebra — it is **PM-1 (the honest-state Cell seam, W1's dependency) and PM-2 (the one `metric:` graph edge that turns lineage from prose into a read)**, both additive, both reversible, both cheap. Everything else the ADRs promise as "surpass nobody has" is *already computed and then thrown away* — recover it at the seams, do not rebuild it.
