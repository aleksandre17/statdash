---
title: Data-Binding & Data-Reference Architecture
status: Accepted (partially implemented)
date: 2026-06-25
authors: architect (Opus)
consolidates: adr_data_blending_decision, adr_data_reference_render_vision, adr_data_source_reference_spectrum
supersedes: architect memory adr_data_* files (now slim pointers)
---

# ADR-001 — Data-Binding & Data-Reference Architecture

**Status:** Accepted (partially implemented). The source-kind spectrum and `storeKey` routing are SHIPPED (see [[project_data_binding_shipped]]); the semantic-layer binding spine (R1) and the declarative cross-store `blend` step are the still-open, decided-but-not-fully-built halves. This ADR consolidates three data-axis design records that were authored as one system.

## Context

A node in the config tree references data along three orthogonal axes that were originally documented separately:

1. **The binding model** — *how* a node names and consumes data end-to-end (`config → resolveNodeRows → interpretSpec → EngineRow → applyEncoding → interpretChart`). Surveyed against Vega-Lite / Grafana / Tableau / Power BI / ECharts-G2 / Malloy / Cube / Looker / Superset / deck.gl. Verdict: the rendering pipeline and encoding grammar are best-in-class (a faithful Vega-Lite subset), but the **data-reference model is fragmented** — ~12 distinct, overlapping ways to say "this data" with no single semantic anchor. `MetricRegistry` (N26) is the seed of the leaders' one convergent idea (a named semantic layer) but is an orphan — nothing in the render path resolves through it.

2. **The source-kind spectrum** — *what kind of thing* a store is: `STATIC` (inline `data:{values}`), `HREF` (`data:{url}`), `STOREID` (`data:{name}`, a governed cube). This is the canonical Vega-Lite `data:{ values | url | name }` trichotomy. We once had all three; de-tenanting collapsed us to one registered kind (`stats`). STATIC survives fragmented; HREF is an orphaned ghost (a `null`-returning resolver pointing at a deleted file).

3. **Cross-store blending (D3)** — the last deferred data-source door. The hard gap is real and named: `interpretSpec(spec, ctx, ONE-store)` is the whole resolver registry's signature, so no node's resolution reaches a second store; the `ctx.stores` manifest lives in react `RenderContext` and is never threaded into core (correct per Law 3). `joinByField` already exists as a tested hash-join engine but is deliberately schema-less — the missing half is the declarative front-door that names a second store and resolves its rows.

## Decision

- **One `DataStore` port, N source KINDS behind `buildStoreManifest` kind-dispatch.** The node-level discriminant stays `storeKey` (→ a kind via the manifest); do NOT add a parallel `DataSpec.data:{values|url|name}` union. Register `static` as a first-class kind now (real consumers: lossless round-trip, `transform.source`, `staticStore` fallback). Keep `stats`/`storeId` as the load-bearing default.
- **Make the semantic layer (MetricRegistry) the binding spine (R1)** through which the major `DataSpec` branches resolve — collapsing the reference fragmentation without bending the grammar down. Enrich channels, desugar convenience specs, unify the `$`-ref taxonomy, first-class `timeDimension`.
- **Blending: SHIP THE SEAM, DEFER THE PLANNER.** Ship a bounded, declarative `blend`/`lookupStore` step (secondary `storeKey` + `ObsQuery` + shared-dim join key), resolved in the react binding layer (where `ctx.stores` lives) and compiled down to the existing `joinByField`. Law-1 generic dims make the shared-dim link free.

## Rejected Alternatives

1. **A node-level `DataSpec.data:{values|url|name}` union** (mirroring Vega-Lite's node-local data literally) — REJECTED: it creates a *second* "which data" mechanism beside `storeKey`, exactly the F-A/F-B fragmentation this axis is trying to remove. Source kind belongs at the store tier, not duplicated on every node.
2. **Give a core resolver a second store / a manifest** to do blending inside `interpretSpec` — REJECTED: violates the dependency arrow (Law 3); core is the pure engine over the one store it is handed. Second-store fetch must happen in the react binding layer and be handed down as already-resolved rows.
3. **Build the symmetric N-store query planner now** (cross-store pushdown, server-side join, blend-aware prefetch, many-to-many) — REJECTED as speculative generality: no consumer today, and every mature tool (Tableau/Grafana/Metabase) deliberately constrains cross-source query. Gated behind door `D3-PLANNER` with a named trigger.
4. **Restore the old multi-envelope datasource system wholesale** (the `external|api|stats` + `ApiResponse` Tier-1/2/3 machinery) — REJECTED: re-adopt only the contained slice with a real consumer; finish-or-delete the HREF ghost (defer HREF behind door `D-HREF`) rather than resurrect dead code (Lava-Flow).

## Consequences

- Positive: one port, closed source-kind set, no fetch-in-config; the join engine (`joinByField`) gets a Constructor-authorable declarative front door; the semantic layer becomes load-bearing instead of orphaned.
- Negative / cost: R1 (semantic-layer spine) touches the resolver path; HREF and the planner stay behind named doors, so those capabilities are inert until triggered.
- Fitness functions: `FF-STATIC-KIND`, `FF-SOURCE-KIND-CLOSED`, `FF-NO-FETCH-IN-CONFIG`, `FF-METRIC-FLOWS`, `FF-REF-RESOLVES`, `FF-DESUGAR-EQUIV`, `FF-BLEND-ROUTES-SECOND-STORE`, `FF-DESUGARS-TO-JOIN`, `FF-BLEND-DECLARATIVE`, `FF-BLEND-ROUNDTRIP`, `FF-BLEND-KEY-GENERIC`.
- Open doors: `D-HREF` (first remote/CSV consumer), `D3-PLANNER` (3+ stores OR too-big-to-client-join OR reused blend), `D-STATIC-ASSET`, `D-EXTRACT`.

---

## Detailed Records (preserved verbatim from architect memory)

> Three original design records follow, migrated from `.claude/agent-memory/architect/`. They are the SSOT for the benchmarks, code-mapped seams, and reasoning behind the decision above.

### A. Data Blending Decision (D3 / cross-store "Mixed" join)

# Decision ADR — Data Blending (D3 / cross-store "Mixed" join)

**Status:** PROPOSED (2026-06-25). Author: architect (Opus). Design/research only — read-only on code, no git.
**Closes:** the last deferred data-source door — [[multistore-storeid-reintroduction]] **D3** ("Data blending / Mixed source"), [[adr-data-source-reference-spectrum]]'s sibling deferral, and the explicit "do it in the binding/semantic layer, never in `DataSpec`" constraint both ADRs logged.
**Builds ON (does NOT duplicate):** [[multistore-storeid-reintroduction]] (the routing spine + the D3 trigger), [[adr-data-source-reference-spectrum]] (source-kinds behind one port), [[adr-data-reference-render-vision]] (R1 semantic-layer-as-binding-spine — the home D3 must live in).

---

## 0. TL;DR verdict — **SHIP THE SEAM, DEFER THE PLANNER**

This is **not** a clean binary. Honest decomposition splits D3 into two halves with opposite verdicts:

1. **The JOIN itself is canonically ready and shippable NOW.** A node enriches its primary rows with a secondary store's rows, joined on a **shared dimension** (`time`/`geo`). That is a one-sided **lookup/enrichment**, the single most-copied cross-source shape in the field (Vega-Lite `lookup`, SQL LEFT JOIN, Cube `view`, Tableau primary/secondary blend). Our **generic dimensions (Law 1) make it architecturally trivial** — linking two cubes on `time` needs zero per-cube join code. And the **engine already exists**: `joinByField` is a built, tested hash-join op (inner/left/outer, A-wins-on-conflict, non-mutating). What is missing is purely the **declarative front-half**: a config step that *names* the secondary store + its query + the join key, and a resolver that *fetches* that secondary store's rows and feeds them to `joinByField`. That is a bounded, OCP-clean, additive capability — **BUILD IT (B0–B2).**

2. **The QUERY PLANNER is genuinely speculative — DEFER it (door `D3-PLANNER`).** Symmetric N-store joins, cross-store filter/predicate pushdown, server-side join execution, blend-aware `extractRequirements` prefetch across stores, multi-key/fuzzy/range joins, and join-cost optimization are a real can-of-worms with **no consumer today** and a wrong-design-if-built-blind risk. Tableau, Grafana, and Metabase all *deliberately constrain* cross-source query (the §3 survey confirms blending is a "real-but-bounded" feature everywhere) — a strong YAGNI signal. Building the planner now is textbook speculative generality.

**The one-way-door discipline:** the *seam* (a declarative blend step routed through the binding layer) is a **two-way door** — additive, reversible, byte-identical when absent. The *planner* is the part that risks a wrong, expensive, hard-to-reverse design. So we ship the reversible half and gate the irreversible half behind a named trigger.

**`joinByField` is the correct bridge until B-steps land** — and it stays as the permanent `custom`-escape engine *underneath* the new declarative step (the step compiles to a `joinByField` call). We are not throwing it away; we are giving it a declarative, Constructor-authorable front door.

**One line:** *Blending's join is a Law-1-trivial shared-dimension lookup with a pre-built engine (`joinByField`) — ship a bounded declarative `blend` step routed through the react binding layer (where the store manifest lives) NOW; defer the symmetric query planner behind `D3-PLANNER` until a real consumer needs cross-store optimization.*

---

## 1. The architectural gap (named precisely — this is the crux)

Every prior ADR said "defer blending, generic dims make it cheap later." None pinned **exactly what wall blending hits**. Here it is, from code:

- **The entire resolver registry is single-store by signature.** `interpretSpec(spec, ctx, store: DataStore)` (`core/data/spec.ts:52`) takes **one** store. Every `SpecResolver.resolve(spec, ctx, store)` (8 resolvers, `registry/resolvers.ts`) receives that one store. `resolveNodeRows` (`react/engine/resolveNodeRows.ts:74`) resolves the CSS-cascade winner to **one** `store` and threads it down. **There is no path by which a single node's resolution reaches a second store's rows.**
- **The manifest exists but lives one layer up, in the wrong package.** The full `Record<storeKey, DataStore>` manifest IS reachable — but only in **react** `RenderContext.stores` (`react/engine/types/context.ts:58`), never in **core**'s `interpretSpec`. Core (per Law 3, the arrow) must *not* know about a manifest of stores; it is the pure engine that resolves against the *one* store handed to it. **So the second-store fetch cannot happen inside a core resolver — it must happen in the react binding layer and be handed down as already-resolved rows.**
- **`joinByField` already encodes exactly this contract.** Its own header: *"source: EngineRow[] — caller must resolve any DataSpec to rows before constructing this step. The transform layer must not know about DataSpec."* And it is **intentionally schema-less** (`transform/index.ts:45-48`): *"carries already-RESOLVED EngineRow[]… NOT declaratively authorable by a non-programmer. Intentionally schema-less → stays in COVERAGE_TODO."* This is the gap stated in the negative: the *engine* is done and correct; the *declarative authoring + the second-store resolution* is the missing front-half — and the comment correctly identifies that the resolution must happen in a layer that has the stores.

**So the gap is not "we can't join" — `joinByField` joins fine. The gap is "a node config cannot declaratively name a second store and have its rows resolved + handed to the join."** That front-half is precisely what B0–B2 build, and it lands cleanly in the react binding layer where `ctx.stores` already lives. **No core resolver gains a second store; no arrow violation.**

---

## 2. Canonical declarative join shape — what to steal (the survey)

| Source | Cross-source join model | The canonical shape to steal |
|---|---|---|
| **Vega-Lite `lookup`** | `transform:[{ lookup:'key', from:{ data:{name/url}, key:'k', fields:[...] } }]` — left rows enriched from a secondary `data` source on a key; **one-sided** (left-driven). Also `fold` (wide→long, intra-source). | **THE model.** `lookup` = enrich primary rows from a *named secondary source* on a *key*, copying *named fields*. One-sided, left-preserving, key-based. Our `joinByField` IS this engine; the missing half is `from.data` naming a **store** (not just inline rows). The blend step = "`lookup` whose `from` is a `{ storeKey, query }`." |
| **SQL JOIN** | Symmetric `A JOIN B ON A.k=B.k` — inner/left/right/outer, N-way, planner-optimized, predicate pushdown. | The **mode vocabulary** (inner/left/outer — `joinByField` already has all three) and the **ON-key** concept. NOT the symmetric N-way planner / pushdown (that's `D3-PLANNER`). |
| **Malloy joins** | `join_one`/`join_many`/`join_cross` declared **in the source/model**, keyed, composable; joins live in the semantic layer, not the query. | **Joins belong in the MODEL/semantic layer, not the viz** (shared with Looker/Cube). Reinforces: the blend's *relationship* is best declared where metrics live (R1), the *node* just references it. Door: a blended metric (see §6 foresight). |
| **Cube.dev `views` + `joins`** | `joins:{ B:{ sql:'…', relationship:'one_to_many' } }`; a **view** exposes measures from multiple joined cubes as one queryable surface; the query references view members, the engine routes + joins. | **The `view` = a pre-declared blend exposed as one logical surface.** Cube does the cross-cube join *for* the query. Our R1 metric layer is the natural home for a "blended view" later (door). The join `relationship` cardinality is the metadata our step omits today (one_to_one assumed) — door if many-to-many appears. |
| **Tableau data blending** | **Primary** data source + **secondary**, linked on **shared dimensions**; secondary is aggregated to the primary's granularity, then left-joined. Asymmetric (primary-driven), client-side, no physical join. | **THE direct analogue.** Primary = the node's existing store; secondary = the blended store; **linked on a shared generic dim** (`time`/`geo` — Law 1 makes the link free); secondary aggregated to primary grain then left-joined. This is *exactly* B0–B2: a one-sided, shared-dim, client-side blend. Tableau's deliberate asymmetry (primary drives) = our `mode:'left'` default. |
| **Grafana Mixed + `merge`/`join` transforms** | "Mixed" pseudo-datasource (a panel issues N queries to N sources) → the `join by field` / `merge` transformation stitches the returned frames on a shared field. | **Mixed = N queries + a join transform**, *exactly* our shape: resolve N store-queries to rows, then `joinByField`. Validates the architecture end-to-end (Grafana's `join by field` transform ≈ our `joinByField`). The "Mixed datasource" is the *authoring* surface; the join transform is the *engine* — same split we have. |
| **Metabase** | Cross-DB query is *constrained/limited*. | The **YAGNI signal**: even mature tools keep cross-store *bounded*. Confirms: ship the bounded lookup, defer the general planner. |

**Survey synthesis — three convergent truths:**
1. **The canonical cross-source primitive is a one-sided, key-based, left-preserving LOOKUP** (Vega-Lite `lookup`, Tableau primary/secondary, Grafana `join by field`) — **not** a symmetric SQL planner. Our `joinByField` is already exactly this engine.
2. **The secondary source is NAMED, and the link is a SHARED dimension** (Tableau linked dims, Cube view members, Vega-Lite `from.data`). Our generic dims (Law 1) make the link a free `by: 'time'` — the single biggest architectural advantage we hold over every surveyed tool, all of which bolt blending on awkwardly.
3. **Authoring = "Mixed/secondary picker"; engine = "join transform."** The field universally splits the *authoring surface* (name the second source) from the *join engine* (stitch the frames). We have the engine (`joinByField`); B0–B2 build the authoring surface + the resolution glue.

---

## 3. The SHIP-NOW spec — a bounded declarative `blend` (B0–B2)

### Design constraints (the laws this must obey)
- **Law 3 (arrow):** the second-store fetch happens in the **react binding layer** (it has `ctx.stores`); core resolvers stay single-store; the resolved secondary rows are handed *into* the existing pipeline as data. **No core resolver gains a manifest.**
- **Law 2 (declarative):** the blend step is **pure JSON** — a secondary `storeKey` (string) + an `ObsQuery` (already declarative) + a join `by` key (string) + a `mode`. **No function, no `fetch`, no inline resolver in config.** The *resolution* (fetching the secondary store) is renderer behavior, not config.
- **Law 1 (no privileged dims):** the join key is a generic dim name (`by: 'time'`), never `byYear`. The blend is dimension-blind.
- **OCP / [[adr-data-reference-render-vision]] F-A guard:** do NOT add a new top-level `DataSpec` discriminant (that would deepen the 9-branch fragmentation F-A warns against). The blend is a **node-level transform step** (the `node.transforms`/`pipe` channel that `joinByField` already belongs to), OR — cleaner — a **secondary-source declaration** resolved before the pipe. Prefer the transform-step home (see B1) so it composes with the existing pipeline and stays out of the `DataSpec` union.

### The shape (the declarative blend step)
A new **declarative, Constructor-authorable** transform step — the schema'd front-door for `joinByField`:

```
{ op: 'blend'
  from:  { storeKey: string; query: ObsQuery; encoding?: EncodingSpec }  // the SECONDARY source — named store + declarative query
  by:    string                                                          // shared dimension key (Law 1 generic — 'time'/'geo')
  mode?: 'inner' | 'left' | 'outer'                                      // default 'left' (Tableau primary-driven)
  fields?: string[]                                                      // which secondary fields to merge (default: all non-key)
  rename?: Record<string, string>                                        // optional field rename (avoid clobber; A-wins is the default)
}
```

- **`from.storeKey`** names the secondary store — resolved against the **manifest the react layer already holds**. This is the ONE piece `joinByField` lacks (it takes pre-resolved rows; `blend` declares *which store* to resolve them from).
- **`from.query`** is an ordinary `ObsQuery` — fully declarative, Constructor-authorable today (the query editor already exists). The secondary rows are fetched exactly as any primary query: `interpretSpec({ type:'query', query: from.query, encoding }, ctx, secondaryStore)`.
- **`by`** is the shared link dimension. Generic (Law 1). Tableau's "linked dimension."
- **`mode`/`fields`/`rename`** map 1:1 onto `joinByField`'s existing parameters — **the step is a thin declarative façade that compiles to a `joinByField` call** with `source` populated by the resolved secondary rows.

### How it resolves (the binding-layer glue — where the gap is crossed)
In **react** `resolveNodeRows` (or a dedicated `resolveBlend` it calls), AFTER the primary rows are resolved and BEFORE/within the `node.transforms` pipeline:

```
for each blend step in node.transforms:
    secondaryStore = resolveStoreByKey(ctx.stores, blend.from.storeKey)   // react has the manifest — Law 3 satisfied
    secondaryRows  = interpretSpec({type:'query', query: blend.from.query, encoding: blend.from.encoding}, ctx.sectionCtx, secondaryStore)
    // optionally aggregate secondaryRows to the primary grain (Tableau-style) — see B2
    rewrite the step → { op:'joinByField', by: blend.by, mode: blend.mode ?? 'left', source: secondaryRows }
// then the existing applyPipeline runs joinByField as today — engine unchanged
```

The **engine (`joinByField`) does not change at all.** The react layer pre-resolves the secondary store's rows (the only place that *can*, per the arrow) and lowers `blend` → `joinByField`. This is a **desugar-in-the-binding-layer** move — the same Strangler-Fig pattern R3 uses for convenience specs, applied to a cross-store step.

### Precise engine seams touched
1. **`core/data/transform/types.ts`** — add the `blend` step to the `TransformStep` union (declarative shape above). **Additive** — no existing op changes. `joinByField` stays as-is (the engine the blend compiles to).
2. **`core/data/transform/op-schemas.ts` + `transform/index.ts`** — register a **`PropSchema` for `blend`** (storeKey picker, ObsQuery editor, by-key, mode) so it is **Constructor-authorable** (this is the coverage win `joinByField` could never have — `joinByField` stays schema-less; `blend` is its authorable front-door). `blend` does NOT get a runtime `applyXxx` in the core registry — it is desugared in react before the pipeline runs (it cannot have a core impl: resolving a secondary store needs the manifest, which core must not see).
3. **`react/engine/resolveNodeRows.ts`** — a new `resolveBlends(node, ctx)` pass that walks `node.transforms`, resolves each `blend.from.storeKey` against `ctx.stores`, runs `interpretSpec` on the secondary store, and rewrites `blend` → `joinByField` before `applyPipeline`. This is the binding-layer glue — **the only new resolution code, and it lives exactly where the manifest is.**
4. **`react/engine` store resolution** — a small `resolveStoreByKey(stores, key)` helper (the non-cascade, explicit-key form of `resolveStore`) so the secondary store is fetched by its declared key. Reuses the same `CachedStore` WeakMap wrapping (`_storeCache`) so the secondary store is cached identically — no N+1, no double-fetch.
5. **(Optional, B2) `core/data/transform/ops/reduce.ts`** — the Tableau "aggregate secondary to primary grain" step is just an existing `reduce`/`aggregate` op applied to `secondaryRows` before the join. **No new op** — compose existing ones. The blend desugar can inject a `reduce` when grains differ (door; default assumes matching grain).

### Fitness nets
- **`FF-BLEND-ROUTES-SECOND-STORE`** — a node whose `blend.from.storeKey` names a *different* store than its primary resolves rows from BOTH stores; the merged output carries fields from both, joined on `by`. Guards that the binding-layer glue actually reaches the second store (the gap §1 names, made executable). Extend the existing `resolveNodeRows`/cascade tests.
- **`FF-BLEND-DESUGARS-TO-JOIN`** — a `blend` step produces row-identical output to a hand-written `joinByField` with the same secondary rows + `by` + `mode`. Proves the declarative façade is exactly the existing engine (the desugar-equivalence net, mirrors `FF-DESUGAR-EQUIV`).
- **`FF-BLEND-DECLARATIVE`** (Law 2) — a `blend` step is pure JSON: `from.storeKey` is a string, `from.query` is an `ObsQuery`, no function/`fetch`/loader ever enters it. The secondary-store *resolution* lives in the renderer, never in config. Extend `FF-NO-FETCH-IN-CONFIG`.
- **`FF-BLEND-ROUNDTRIP`** — a `blend` step survives `JSON.parse(JSON.stringify(config))` unchanged (it is plain data; `joinByField`'s pre-resolved `EngineRow[]` source never appears in a stored config — only the declarative `blend` does). This also guards the **round-trip hole `joinByField` opened**: a hand-authored `joinByField` with an inline `source` array is *technically* round-trippable but is data-baked-into-config; `blend` is the governed form that references a store instead of inlining rows.
- **`FF-BLEND-KEY-GENERIC`** (Law 1) — the join `by` is a generic dim key; no blend hardcodes a privileged dimension.

### Roadmap (tight, additive, byte-identical when absent)
- **B0 — the `blend` step type + schema (engine, additive).** Add `blend` to `TransformStep`; register its `PropSchema`; land `FF-BLEND-DECLARATIVE` + `FF-BLEND-ROUNDTRIP`. No runtime behavior yet (no node uses it). Pure type/schema addition — byte-identical to today. *Cheap, one PR.*
- **B1 — the binding-layer desugar (react glue).** `resolveBlends` in `resolveNodeRows`: resolve `from.storeKey` against `ctx.stores`, `interpretSpec` the secondary query, rewrite → `joinByField`, then `applyPipeline`. Land `FF-BLEND-ROUTES-SECOND-STORE` + `FF-BLEND-DESUGARS-TO-JOIN`. This is the gap-crossing PR — but it is ~one resolution pass, in the layer that already holds the manifest. *Bounded, the real work.*
- **B2 — grain reconciliation (optional, compose existing ops).** When the secondary grain ≠ primary grain, inject a `reduce`/`aggregate` before the join (Tableau aggregate-to-primary). Default (matching grain) needs nothing. Land behind `FF-BLEND-GRAIN` only when a real grain-mismatch consumer appears. *YAGNI-gated within the ship slice.*
- **B3 — Constructor authoring surface.** The "+ Blend a second source" affordance: store picker (from `describeApp()` datasources) → query editor → link-dimension picker → mode. Pure UI over the B0 schema — the `joinByField` coverage gap finally closes via `blend`'s schema. *Follows the engine; Constructor work.*

**Verdict on the ship slice:** B0 is risk-free additive; B1 is the bounded gap-crossing (well-scoped, in the right layer, engine untouched); B2/B3 are YAGNI-gated and follow. The whole slice is **two-way-door reversible** (absent ⇒ byte-identical; the engine never changed).

---

## 4. The DEFER half — `D3-PLANNER` (the genuinely speculative part)

Behind a single named door, **defer** everything that turns blending from a bounded lookup into a query planner:

- **Symmetric N-store joins** (3+ stores, join graph, ordering/cost). B0–B2 do one secondary per step (chainable for more, but each is a one-sided lookup, not an optimized graph).
- **Cross-store filter/predicate pushdown** — pushing the primary's filter into the secondary query to reduce fetched rows. Today the secondary query is authored explicitly; pushdown is an optimization with no consumer.
- **Server-side join execution** — executing the join in `apps/api`/Postgres instead of client-side. Real value at scale, real cost (a new API surface, the §25 envelope), zero consumer now.
- **Blend-aware `extractRequirements` prefetch** — extending the static-requirements analysis to prefetch the *secondary* store's needs too (no N+1 across stores). `extractRequirements` is single-store today; making it blend-aware is the right eventual move but only matters at the warm/prefetch scale a real consumer sets.
- **Many-to-many / range / fuzzy / multi-key joins** — `joinByField` is single-key one-to-one/one-to-many. Cardinality `relationship` metadata (Cube) and composite keys are doors.
- **Blended metric in the semantic layer (R1 home)** — a `MetricDef` that is itself a cross-store blend (Cube `view` / Malloy `join_one`). This is the *canonically best* long-term home ("joins live in the model," per Malloy/Looker/Cube — and both prior ADRs said "do it in the binding/semantic layer, never in DataSpec"). B0–B2 deliberately ship the *node-level* blend first (smaller, provable, the Tableau model) and leave the *metric-level* blended view to R1 maturity. **This is the cleanest deferral: the node-level `blend` is the bridge; the metric-level blended view is the destination.**

**Trigger for `D3-PLANNER`:** the first real consumer that B0–B2 cannot serve — specifically (a) a blend over **3+ stores** needing join-order/cost decisions, (b) a secondary dataset **too large to fetch-then-join client-side** (needs pushdown or server-side join), or (c) a **blended metric reused across many panels** (promotes the node-level blend to an R1 metric-level view). Until one fires, B0–B2 + chaining cover the real cases and the planner is speculative generality.

---

## 5. Why `joinByField` is the correct bridge until B-steps land

- **It is the real, tested join engine** — inner/left/outer, A-wins-on-conflict, non-mutating, empty-input-safe (`joinByField.test.ts` covers all modes). The math is done and correct.
- **It is honestly scoped as a programmer escape** — schema-less by deliberate design (`transform/index.ts:45`), staying in `COVERAGE_TODO`. An app/test that needs a cross-store join *today* pre-resolves both stores' rows (it has the manifest in react) and constructs a `joinByField` step by hand. That is the `custom`-escape pattern working exactly as intended (Law 8: the escape hatch absorbs the not-yet-canonical case without bending the architecture).
- **B0–B2 do not replace it — they give it a front door.** `blend` *compiles to* `joinByField`. The engine is reused verbatim; only the declarative authoring + the second-store resolution are added. This is the platform-thinking move (Law 8): the recurring "I need a second store's rows" need gets promoted from a hand-rolled `custom`/`joinByField` one-off to a reusable, Constructor-authorable capability — solved once, for every future caller.
- **The bridge has a known sharp edge to close:** a hand-authored `joinByField` with an inline `source: EngineRow[]` **bakes data into the config** (a round-trip/SSOT smell — the rows are values, not a reference). `blend` fixes this at the root: it references a *store* (`from.storeKey` + `query`), never inline rows. So migrating `joinByField` hand-uses → `blend` is also a data-hygiene win (`FF-BLEND-ROUNDTRIP` enforces it).

---

## 6. Foresight — when each capability is the right tool

- **Node-level `blend` (B0–B2): NOW.** Two seeded cubes with a shared `time`/`geo` dim (gdp + regional) → a single chart showing GDP alongside regional GVA *joined on time* is a genuine, in-domain national-accounts use case (the exact example [[multistore-storeid-reintroduction]] §6 flagged as "real now"). The routing exists, the engine exists, the dims are generic — the only missing piece is the declarative step. This is the canonical, ready, low-risk capability.
- **Metric-level blended view (R1 home): DEFER to R1 maturity.** When a blend is *reused* across panels, it belongs in the semantic layer as a blended `MetricDef`/view (Malloy `join_one`, Cube `view`). R1 is the right home (units/methodology/dataSource already live on `MetricDef`); a blended view is `MetricDef` × N stores. Door, not now — node-level `blend` is the bridge.
- **Server-side / planner (`D3-PLANNER`): DEFER to scale.** When client-side fetch-then-join stops scaling (large secondary, 3+ stores, pushdown needed). The generic-dim + long-format invariants keep this cheap *later*; building it now is speculative.

---

## 7. Decision

**SHIP THE SEAM (B0–B2), DEFER THE PLANNER (`D3-PLANNER`).** Build a bounded, declarative, Constructor-authorable `blend` transform step that names a secondary `storeKey` + `ObsQuery` + shared-dim join key, resolved in the **react binding layer** (where the store manifest lives, satisfying the arrow) and **desugared to the existing `joinByField` engine**. This closes D3's *real-now* half (the Law-1-trivial shared-dim lookup) with additive, two-way-door, fitness-netted code, and keeps `joinByField` as both the underlying engine and the interim `custom`-escape bridge. Defer the symmetric query planner, pushdown, server-side join, blend-aware prefetch, and the metric-level blended view behind the single named door `D3-PLANNER`, with explicit triggers.

## 8. Rejected alternatives

1. **Defer all of D3 (the status-quo verdict from the prior ADRs).** REJECTED. That verdict was correct *when written* (no consumer, planner-shaped fear). But the honest decomposition shows the **join half is canonically ready** (Vega-Lite/Tableau/Grafana all confirm the one-sided shared-dim lookup is THE shape), the **engine is already built** (`joinByField`), and the **dims are generic** (Law 1 makes the link free). Continuing to defer the *whole* thing conflates the shippable lookup with the speculative planner — exactly the "finish everything" the user is owed. Ship the lookup; defer only the planner.
2. **Add a new top-level `DataSpec` discriminant `{ type: 'blend', primary, secondary, on }`.** REJECTED. Deepens the 9-branch `DataSpec` fragmentation [[adr-data-reference-render-vision]] F-A explicitly warns against, and forces a *core* resolver to reach a second store (an arrow violation — core must not see the manifest). The blend belongs as a **transform step** (the `joinByField` channel) resolved in the **react binding layer**, not as a `DataSpec` branch resolved in core.
3. **Build the full symmetric SQL-style join planner + pushdown now ("do it properly once").** REJECTED. No consumer; Metabase/Tableau/Grafana all *deliberately constrain* cross-store query (a YAGNI signal from the entire field). It is the one-way-door, wrong-if-built-blind part. The bounded lookup serves the real cases; the planner waits for `D3-PLANNER`'s trigger.
4. **Make `joinByField` itself Constructor-authorable (give it a schema that takes an inline `source` array).** REJECTED. That bakes data into the config (round-trip/SSOT smell — rows as values, not a store reference) and still can't reach a *live* second store (the inline array is frozen). `blend` is the right authorable form: it references a store, resolves live, round-trips as a pointer. `joinByField` stays the schema-less engine underneath.
5. **Do blending only at the metric/semantic layer (a blended `MetricDef`/view), skip the node-level step.** REJECTED *as the first move* (kept as the destination). The metric-level blended view is the canonically best long-term home (Malloy/Cube/Looker "joins live in the model") — but R1's semantic layer is still being wired (the MetricRegistry-orphan work), and a metric-level blend is a larger, reuse-shaped feature. Ship the smaller, provable **node-level** blend (Tableau model) now as the bridge; promote to a metric-level view when reuse demands it (a `D3-PLANNER`-adjacent door).

## 9. Consequences

- **Positive:** the last deferred data-source door closes in its *shippable* form — cross-store blending becomes a declarative, Constructor-authorable, OCP-clean capability with the engine already built and the dims already generic. The platform gains a real national-accounts use case (GDP × regional on `time`). `joinByField`'s round-trip/SSOT smell (inline `source` rows) is closed by `blend`'s store-reference form. The architecture is *not* bent: core stays single-store, the arrow holds, the manifest stays in react, the planner risk is quarantined behind a named trigger.
- **Negative / trade-offs:** a transitional period where `joinByField` (the schema-less engine + interim escape) and `blend` (the declarative front-door) coexist — documented as engine-vs-façade, not drift. Client-side fetch-then-join is the only execution mode until `D3-PLANNER` (acceptable for the seeded-cube scale; the door names the scale trigger). The metric-level blended view (the canonically best home) is deferred to R1 maturity — accepted, with the node-level `blend` as the explicit bridge.
- **ISO 25010:** maximizes **Functional suitability** (cross-store blending, the field-standard capability) and **Maintainability** (one engine `joinByField`, one declarative façade `blend`, OCP transform-step extension) and **Reusability** (a Constructor capability, not a `custom` one-off); trades a transitional engine/façade duplication and defers **Performance efficiency** of large/server-side blends behind `D3-PLANNER`. **Compatibility** preserved: every B-step is additive, byte-identical when absent, round-trip-netted.

## 10. Alignment with project laws
- **Law 1 (no privileged dims):** the join `by` key is a generic dim; the shared-dim link is what makes blending *cheap* — the law is the enabling advantage, not a constraint. `FF-BLEND-KEY-GENERIC` pins it.
- **Law 2 (declarative):** `blend` is pure JSON (storeKey string + ObsQuery + by-key); the secondary-store *resolution* is renderer behavior, never config. `FF-BLEND-DECLARATIVE` enforces. `joinByField`'s pre-resolved `source` array never appears in a stored config — only `blend` does.
- **Law 3 (arrow):** the second-store fetch lives in **react** (which holds `ctx.stores`); core resolvers stay single-store; resolved rows cross into the pipeline as data. No core→manifest coupling, no new violation.
- **Law 5 (API-readiness):** a blend names stores that are `DatasourceInstanceConfig` rows — swapping a blended source is a DB row, not a deploy. `fromSDMX` stays the sole adapter boundary.
- **Law 6 (root-cause):** the gap is fixed at its root (the missing declarative front-half + binding-layer resolution), not patched (no inline-rows hack); `joinByField`'s round-trip smell is closed, not tolerated.
- **Law 7 (architecture leads):** target = declarative blend desugaring to the engine, resolved in the right layer; the hand-rolled `joinByField`/`custom` uses migrate onto `blend` (Strangler-Fig). The architecture is not bent to keep data-baked-in joins.
- **Law 8 (platform thinking) + YAGNI:** the recurring "I need a second store's rows" need is promoted from a `custom`/`joinByField` one-off to a reusable capability (the second consumer — gdp × regional — is real). The planner is deferred because *its* consumer is speculative. The discipline cuts exactly at the consumer line.
- **Ties:** closes [[multistore-storeid-reintroduction]] D3; uses [[adr-data-source-reference-spectrum]]'s one-port/many-kinds manifest (the secondary store is any kind — `stats`/`static`/`href`); the metric-level blended view is the [[adr-data-reference-render-vision]] R1 destination, with the node-level `blend` as the bridge.


---

### B. Data-Reference Model & Rendering Axis (the binding spine)


# Vision ADR — The Data-Reference Model & Rendering Axis (the binding spine)

Status: PROPOSED (2026-06-24). Author: architect (Opus). Design/research only.
Builds ON (does NOT duplicate): [[adr-config-and-render-vision]] (config-object + SDUI renderer; validateConfig/JSON-Schema floor) and [[adr-constructor-vision-north-star]] (authoring/coverage). Those two own the CONFIG-OBJECT axis and the AUTHORING-COVERAGE axis. THIS ADR owns the third axis neither made first-class: **how every node references and consumes data — the data-reference model itself**, end to end (render AND Constructor).
Related: [[project_semantic_layer_n26]] (MetricRegistry), [[project_charts_split_8_1]], [[adr-element-config-schema-seam]].

**Thesis:** Our rendering pipeline is best-in-class and our encoding grammar is a faithful Vega-Lite subset. But our **data-REFERENCE model is fragmented**: a node can say "this data" in ~12 distinct, overlapping ways with no unifying grammar and no single semantic anchor. The leaders (Malloy/Cube/Looker/Tableau) converge on ONE idea we have only half-built: a **named semantic layer of measures/dimensions/metrics**, referenced everywhere, governed once. Our `MetricRegistry` (N26) is the seed of exactly that — but it is an orphan: nothing in the render path resolves through it. The recommendation is to make the semantic layer the **spine** through which the major DataSpec branches resolve, collapsing the fragmentation without bending the grammar down.

---

## 0. The rendering + data path (mapped from code, board stale)

The canonical flow (verified across `packages/core/src/data/**`, `packages/react/src/engine/**`, `packages/charts`):

```
config (NodeBase.data: DataSpec)
  └─ resolveNodeRows(node, ctx)                       [react/engine/resolveNodeRows.ts]
       ├─ resolveStore(ctx)  → CSS-cascade: pageStoreKey → stores[key] → first → staticStore
       │                       (CachedStore-wrapped via _storeCache WeakMap; async/streaming bypass)
       ├─ interpretSpec(spec, sectionCtx, store)       [core/data/spec.ts]
       │     └─ defaultRegistry.spec(spec.type).resolve(...)   (Strategy; 8 resolvers)
       │           → EngineRow[]  (neutral Record<string,DimVal>, renderer-agnostic)
       ├─ applyEncoding(rawRows, enc, lookup)          [core/data/encoding.ts]
       │     → DataRow[]  (typed: id/label/series/value/pct/color/isTotal/level/parentId/provenance)
       └─ applyPipeline(rows, node.transforms, pipeCtx)  (node-level Grafana-transform post-step)
              │
              ├─ DataTable  consumes DataRow[]  (columns: ColumnDef[])
              └─ interpretChart(ChartDef, DataRow[], ctx) [charts/interpret.ts]
                    → ChartOutput (neutral) → toApexOptions → <ReactApexChart/>
```

Key seams:
- **`DataStore` port** (`core/data/store.ts`): one unified interface (Grafana `DataSourceApi` / Cube `CubeApi` pattern). `StoreQuery` is itself a discriminated union open for extension: `val` (OLAP cell) · `obs` (multi-dim rows) · `schema` (Constructor palette) · `distinct` (dropdown options). Sync fast-lane (`querySync`) + async envelope (`queryAsync → QueryResult{state,data,error,meta}`) + optional `batch`/`subscribe`/`queryFrame`. `StoreCaps` declares batching/streaming/sync. `staticStore` = Null Object. `fromSDMX` is the only adapter boundary (Law 5).
- **`SectionContext`** (`core/core/context.ts`): the OLAP coordinate — `{ timeMode, dims: Record<string,DimVal>, locale? }`. **No privileged dimension** (Law 1): `ctx.dims['time']`, never `ctx.year`. `TIME_DIM='time'` is the single named SSOT for the one conventional key the time-axis resolvers pin via `atTime()`.
- **`extractRequirements(spec, ctx)`**: static analysis — returns every `{code,dims}` a spec WILL need without executing it. Powers `ApiStore.prefetch()` / `CachedStore.warm()` (no N+1). This is a genuine LEAD — Vega-Lite/Grafana have no static-requirements extraction.
- **Ingest (Bronze→Silver→Gold / Medallion):** raw SDMX/CSV → `fromSDMX` adapter → `DataBundle {facts, classifiers, display}` → `ExternalStore`/`ApiStore`. `Classifier` = Kimball dimension table (structural: code/parent, no display); `DisplayMap` = presentation overlay keyed by the same id space (per-locale = swap one DisplayMap). Structural/presentational split is clean and is a LEAD.

---

## 1. Best-in-class survey — the strongest data/render idea to steal from each

| Renderer | Its data-reference / binding model | The 1–3 ideas genuinely worth stealing |
|---|---|---|
| **Vega-Lite** | `data → transform[] → mark + encoding{channel:{field,type,aggregate,bin,timeUnit}}`. The channel references a FIELD by name + a measurement TYPE (quantitative/ordinal/nominal/temporal) + an inline `aggregate`/`bin`. | (1) **`type` on the channel** (Q/O/N/T measurement level) — we map field→channel but never carry the measurement type on the encoding; the renderer re-sniffs. (2) **inline `aggregate`/`bin`/`timeUnit`** on the channel — a binding can summarize without a separate transform. (3) **`layer`/`facet`/`repeat`** view operators (we defer these — correctly YAGNI for dashboards, door open). |
| **Grafana** | `DataFrame` (columnar, typed `fields[]` w/ `config`) ← `DataSourceApi.query(targets[])` → `transformations[]` pipeline → `fieldConfig{defaults,overrides}` → panel; `$variable` template refs; `DataLinks`. | (1) **`fieldConfig defaults/overrides` cascade** — we HAVE this (`FieldConfig`+`FieldOverride`, `colorMode`/`thresholds`). Parity, keep. (2) **transformations as a stacked, reorderable pipeline** — we have `TransformStep[]` at two levels (`query.pipe` + `node.transforms`); good, but the TWO levels are a coherence smell (see §3). (3) **`$variable` refs resolved at one layer** — our `$ctx` is the analogue but it's resolved in 3 different evaluators. |
| **Observable Plot** | `Plot.plot({marks:[Plot.barY(data,{x,y,fill,...})]})` — channels are accessor functions OR field names; `transform` (groupX/binX/stackY) as channel-level options. | (1) **transforms attached to the MARK/channel**, not a separate global stage — reinforces Vega-Lite's inline-aggregate idea. (2) **channel value = field-name OR accessor** — validates our "field name in encoding" choice; we correctly forbid the accessor-function form (not serializable). |
| **Tableau VizQL** | Pills on shelves (Rows/Columns/Color/Size/Detail/Filter); a pill = a field reference with an implicit aggregation + role (dimension blue / measure green); **LOD expressions** (`{FIXED [dim]: SUM([m])}`) — compute at a declared granularity independent of viz. | (1) **dimension-vs-measure ROLE as a first-class field property** (blue/green) — drives "Show Me" + valid drop targets; we derive role in `fieldSchema.ts` but it never reaches the encoding/binding as a typed property. (2) **LOD expressions** — declare the granularity of a measure independent of the viz dims (the gap our `agg` on MetricDef only barely touches). High-value, defer-with-door. |
| **Power BI** | **Field wells** (Axis/Legend/Values/Tooltips); **DAX measures** — named, reusable calculations defined once in the model, referenced by any visual; implicit vs explicit measures. | (1) **Named measures defined ONCE in the model, referenced by every visual** — THE central idea, shared with Malloy/Cube/Looker (our MetricRegistry seed). (2) **field wells as the binding UX** — already the [[adr-constructor-vision-north-star]] V5 plan. |
| **ECharts / AntV G2 / G2Plot** | G2 = grammar of graphics (`data→scale→geom→encode`); `encode({x,y,color})`; G2Plot = chart-preset wrappers over G2. | (1) **scale as a declared object** (domain/range/type) between data and mark — we leave scaling to ApexCharts; a declared scale would make axis behavior config-driven not renderer-driven. (2) validates our chart-preset registry (G2Plot's preset-over-grammar is our `ChartType` registry over `EncodingSpec`). |
| **Malloy** | A modeling language: `source` with named `dimension`/`measure`/`query` defs; queries COMPOSE and NEST; measures are reusable, joins are declared in the source. | (1) **measures + dimensions named in a source and reused** — the semantic-layer thesis. (2) **nested/composable queries** — a query result can be the source of another (we have this partially via `transform.source` but not as named composition). |
| **Cube.dev** | A semantic layer: `cubes` with `measures`/`dimensions`/`segments`; `CubeApi.load({measures,dimensions,filters,timeDimensions})` → resultSet → `chartPivot()`/`tablePivot()`. The query references SEMANTIC names, not physical columns. | (1) **the query references measure/dimension NAMES from the semantic layer**, never physical fields — the cleanest expression of the thesis. (2) **`timeDimensions` w/ granularity** as a first-class query part (vs our time buried in `filter[TIME_DIM]`). (3) **resultSet → chartPivot/tablePivot** = exactly our `EngineRow[] → applyEncoding → DataRow[]`. Parity, validates our long-format invariant. |
| **Looker / LookML** | `dimension`/`measure`/`explore` defined in LookML; governed, versioned, reused; `measure` has a `type` (sum/count/avg) + `sql`. | (1) **governed, versioned semantic definitions** — measures as a contract (ties to [[project_panel_external_product]] SemVer). (2) **measure `type` (aggregation) is part of the definition**, not the query — our `MetricDef.agg` has this shape; push it. |
| **Superset / Metabase** | Superset: dataset-level metrics/columns defined once, reused across charts. Metabase: the **notebook** visual query builder (pick data→filter→summarize→visualize, no SQL). | (1) **metric reuse at the dataset level** (semantic-layer thesis, lighter than Cube). (2) **the notebook query ladder** as the gentlest authoring model for our `query` DataSpec ([[adr-constructor-vision-north-star]] already steals this). |
| **deck.gl** | Layer **accessors**: `getPosition`/`getFillColor`/`getRadius` = functions data→visual attribute; data-driven everything. | (1) **every visual attribute is a declared channel** (position/color/size/radius) — reinforces a richer channel set than label/value/color/series for map/geo panels. (We have `map` as a placeholder chart — its binding is under-modeled.) |
| **D3** | The **data join** (`selection.data(arr).enter/update/exit`) + scales (`scaleLinear`/`scaleOrdinal`). The lowest-level binding: datum → DOM, key function for identity. | (1) **key function = stable identity** — our `applyEncoding` auto-id (`label::series`) is a key function; making the key explicit/declared would stabilize animation & diffing. (2) scales-as-objects (shared with G2). |

**Survey synthesis.** Three convergent ideas dominate the field:
1. **The semantic layer** (Power BI / Malloy / Cube / Looker / Superset): named measures + dimensions defined once in a model, referenced by every visual, governed. *We have the seed (MetricRegistry) but it is not in the render path.* THIS is the single biggest adaptation.
2. **The channel carries more than a field name** (Vega-Lite `type`/`aggregate`/`bin`, Tableau pill role, ECharts/D3 scale): measurement TYPE, ROLE, inline aggregation, and identity key belong ON the binding. *We carry only field names.*
3. **One resolution layer for refs** (Grafana `$variable`, Vega signals): all parameterized references resolve through ONE mechanism. *We have `$ctx`/`$d`/`$cl`/`$row`/`$ref` resolved by FOUR different evaluators.*

---

## 2. Our rendering + data-reference deep-map (what consumes data, how)

Every node carries data through `NodeBase` (`react/engine/types/node.ts`): `data?: DataSpec` · `transforms?: TransformStep[]` · `fieldConfig?: FieldConfig` · `vars?: VarMap` · `dataLinks?: DataLinkDef[]` · `on?: NodeEventHandler[]` · `storeKey?` · `view.scope?: ScopeOverride`. `resolveNodeRows` resolves `data` → `DataRow[]`; absent `data` → inherits `ctx.rows` (parent cascade, a CSS-like data inheritance — a quiet LEAD). Then chart/table consume the rows; `interpretChart` dispatches by `ChartDef.type` (registry, zero-switch).

Element→data→render per type: **chart** (DataSpec→rows→interpretChart→ChartOutput→Apex), **table** (DataSpec→rows→ColumnDef[] mapping, pivot when `encoding.series`), **kpi-strip** (KpiSpec→interpretKpis→cells), **map** (DataSpec→rows, geo binding under-modeled — placeholder), **filter-bar** (renders ParamDefs from `filterSchema`, NOT its own data), **text/layout** (no data; pure composition). The long-format invariant holds throughout: data is never pivoted; `encoding.series` tells the renderer how.

---

## 3. THE DATA-REFERENCE-TYPES INVENTORY (the key deliverable)

Every distinct mechanism by which a node/element references or consumes data. For each: what it does · where · best-model verdict · improvable.

| # | Ref mechanism | What it references | Where (file) | Best model? | Improvable |
|---|---|---|---|---|---|
| **1** | **`DataSpec` union** (9 discriminants: query/row-list/timeseries/growth/ratio-list/by-mode/pivot/transform/custom) | the whole "what data" for a node | `core/config/data-spec.ts`, resolvers `registry/resolvers.ts` | The discriminated-union+Strategy+registry shape is RIGHT (OCP). But the SET is **fragmented**: timeseries/growth/ratio-list are CONVENIENCE shorthands that `query`+`pipe` could subsume; pivot is "sugar for transform+melt" (its own comment). Overlap is real. | **Collapse the convenience branches into derived sugar over `query`** (keep them as authoring affordances, resolve them THROUGH query). Reduce 9 resolvers to ~3 primitives (query · transform · by-mode) + sugar. |
| **2** | **`ObsQuery`** (`measure`, `filter`, `orderBy`) | measure code(s) + dim filters against the store | `core/sdmx.ts` | Good (SDMX Dataflow / OLAP slice). But `measure` is a raw CODE string, not a semantic name → no governance, no reuse, no unit/methodology attached at the ref. `time` is buried in `filter` (Cube makes it first-class `timeDimensions`). | **Let `measure` accept a metric-id** (resolve through MetricRegistry). Promote time to an explicit `timeDimension` shape (granularity-aware). |
| **3** | **`$ctx` ref** (`{$ctx:'dim'}`) + `$ne`/`$ctx`+`$ne` (NeCtxRef) | a runtime dim value from `ctx.dims` | `core/sdmx.ts`, resolved in `resolvers.ts` `resolveFilterForReqs` | Right idea (Vega signals / SDMX parameterised query). | Coherent. Keep. Its sibling resolvers (`$d`/`$cl`/`$row`/`$ref`) are NOT unified with it — see #11. |
| **4** | **`EncodingSpec` channels** (label/value/color/series/pct/negate/tooltip/id/isSeparator/isTotal/level/parentId/seriesFormat/seriesOrder) | obs FIELD → visual channel | `core/data/encoding.ts` | Faithful Vega-Lite subset; long-format invariant held — a genuine LEAD. | **Channels carry only a field NAME** — no measurement `type` (Q/O/N/T), no inline `aggregate`/`bin`, no explicit identity `key`. Add these (Vega-Lite parity). `pct` is overloaded (3 variants) — fine. |
| **5** | **`storeKey` / `DataStore` binding** | WHICH store/cube a node reads | `NodeBase.storeKey`, `resolveStore`, `DatasourceInstanceConfig` | CSS-cascade resolution (nearest wins) is elegant; DataStore port is right (Law 5). | **First-cube-bound-wins** only; multi-store per page is `NOT` ([[adr-constructor-vision-north-star]] gap). `dataSourceBindings` (context-key→source) is modeled but thin. |
| **6** | **`TransformStep[]` pipeline** (20+ ops) at TWO levels: `query.pipe` (pre-encoding) AND `node.transforms` (post-encoding) | declarative row ops | `core/data/transform/**`, applied in resolvers + `resolveNodeRows` | Pipe-and-Filter, registry-driven, op-schemas for authoring — strong. | **TWO pipeline insertion points** is a coherence smell: `query.pipe` runs on EngineRow (pre-encode), `node.transforms` runs on DataRow (post-encode). Same vocabulary, two stages, two mental models. Document the boundary as a contract or unify the staging. |
| **7** | **`fromDim`/`toDim`** (on query/timeseries/growth) | a dim whose ctx value clamps the time range | `data-spec.ts`, `clampYears`/QueryResolver | Works. | A SPECIAL-CASE range filter expressed as two loose string fields — a weak, redundant form of a `filter` range. Fold into a proper range filter on `time` (Postel: one way to express a range). |
| **8** | **`FieldConfig` + `FieldOverride`** (unit/decimals/min/max/colorMode/thresholds, per-series overrides) | per-field DISPLAY config (not data selection) | `core/field/config.ts` | Grafana `fieldConfig` parity — clean, cascades to children. Keep. | Coherent. The threshold colorMode is a tiny binding-by-value (datum→color); fine. |
| **9** | **`vars: VarMap`** (`FilterDerive` ops: find/breadcrumbs/lookup/if-else/tree-field/contains/join-labels + `ExprVal`) | node/page derived values bound to filter state + classifiers | `core/config/filter-derive.ts` | Sandboxed grammar (no functions) — a LEAD over Retool's `{{ }}`. Grafana template-variable / Power-BI-DAX analogue. | The `source` of a derive is `DimRef | inline-array` → overlaps with #11. Coherent within itself; its ref-resolution shares no machinery with `$ctx` (#3). |
| **10** | **`dataLinks: DataLinkDef[]`** with `DataLinkParam` (`$row`/`$ctx`/literal) | a clicked-row field or filter param → drill-down/cross-filter | `core/links/types.ts` | Grafana DataLinks parity. `$row` (clicked datum) is a distinct, valid ref class. | `$ctx` here means "filter param" while `$ctx` in ObsQuery means "ctx.dims" — **same token, two scopes**. Astonishment risk (Least-Astonishment law). Disambiguate. |
| **11** | **`DimRef` = `$cl` (ClassifierRef, structural) / `$d` (DisplayRef, UI)** with `view` (byCode/items/leaves/rollups) | a codelist/display view of a dimension | `core/sdmx.ts`, `resolveDimRef` | The structural/display split is excellent (Kimball + per-locale swap). | **Yet another `$`-ref family** resolved by its own resolver. With `$ctx` (#3), `$ref` (#9 if-else), `$row`/`$ctx` (#10) → **FIVE `$`-prefixed ref vocabularies, four evaluators.** No unified "ref" concept. |
| **12** | **`MetricRegistry` / `MetricDef`** (code/label/unit/agg/parent/methodology/datasource/dims) [N26] | a NAMED metric → measure code(s) + defaults | `core/data/metric.ts` | The RIGHT idea (semantic layer, Cube/Looker/Power-BI). Provenance decorator is elegant. | **ORPHAN: nothing in interpretSpec/ObsQuery resolves through it.** It feeds `describeApp()` (palette) and the provenance MetadataPort only. It is a catalog with no binding power. THIS is the central improvable. |

Plus secondary carriers: `StoreQuery` union (#1b, the store-facing query) and `ColumnDef.key` (table column → DataRow field, a tiny ref). And `ScopeOverride` (`view.scope` — per-panel dim/compare override), a 13th: a node-local ctx mutation, valid (N37 compare).

### Coherence verdict: **STRONG GRAMMAR, FRAGMENTED REFERENCE SURFACE.**

The *grammar of graphics* half (DataSpec→EngineRow→EncodingSpec→DataRow, long-format) is coherent and best-in-class. The *reference* half is fragmented along three fault lines:

- **F-A — Too many ways to say "this measure's data."** `query`+`row-list`+`timeseries`+`growth`+`ratio-list` are five DataSpec branches that all ultimately mean "pull these codes, shape them." pivot ≈ transform+melt. The union grew by convenience, not by orthogonality. (Code smells: *divergent change*, *speculative generality* on the rarely-used branches.)
- **F-B — Five `$`-ref vocabularies, no unifying "ref" concept.** `$ctx` (dims), `$ne`, `$d`/`$cl` (dim views), `$row` (clicked datum), `$ctx` (filter param, a NAME COLLISION with the first), `$ref` (param value in if-else). Each has its own resolver. A reader cannot predict, from a `$`-token, which scope it binds or who resolves it (Least-Astonishment violation; no SSOT for "reference resolution").
- **F-C — The semantic layer is disconnected.** MetricRegistry exists but `ObsQuery.measure` references raw codes, so unit/methodology/agg/default-dims declared on a MetricDef do NOT flow into a query. The one mechanism that would COLLAPSE F-A (reference a named metric, stop hand-rolling code lists) is built but unwired.

This is not a Big Ball of Mud — each mechanism is individually clean and tested. It is **un-unified growth**: the platform accreted a reference type per need without a periodic "are these one concept?" refactor. Exactly the drift [[adr-config-and-render-vision]] §5 names as the entropy ledger, now visible on the DATA axis.

---

## 4. Lead / Lag — honest, on the data + render axis

**We LEAD:**
- **Long-format invariant + renderer-agnostic EngineRow** — cleaner than Grafana's DataFrame coupling; one row shape feeds table AND chart (Cube `chartPivot`/`tablePivot` parity, expressed once).
- **`extractRequirements` static analysis** — prefetch/warm with zero N+1. No surveyed tool has static requirement extraction from the spec.
- **Structural/presentational dimension split** (`Classifier` vs `DisplayMap`, per-locale swap) — cleaner than Tableau's blended aliasing; SDMX/Kimball-correct.
- **No-functions-in-config, sandboxed `FilterDerive` grammar** — a LEAD over Retool/Appsmith `{{ js }}` (serializable, Constructor-ready).
- **DataStore port + StoreQuery open union + sync/async/batch/stream caps** — Grafana `DataSourceApi` parity with a cleaner capability declaration.
- **Parent-cascade data inheritance** (`node.data` absent → inherit `ctx.rows`) — a quiet elegance most builders lack.

**We are at PARITY:**
- Encoding grammar (Vega-Lite subset), fieldConfig cascade (Grafana), transform pipeline (Grafana/Vega-Lite), DataLinks (Grafana), page-vars (Grafana template vars / Power-BI DAX shape).

**We LAG:**
- **Semantic layer not in the binding path** (Cube/Looker/Malloy/Power-BI/Superset all resolve queries through named measures; we don't). *The biggest lag.*
- **Channels carry no measurement `type`/`aggregate`/`bin`/`key`** (Vega-Lite, Observable Plot, ECharts carry these on the channel). We re-derive role/type downstream.
- **Time is not a first-class query dimension** (Cube `timeDimensions` w/ granularity; ours is buried in `filter[TIME_DIM]` + ad-hoc `fromDim`/`toDim` + `YearsSpec`).
- **No LOD / declared-granularity measures** (Tableau LOD, Malloy aggregate-locality). `MetricDef.agg` is the seed only.
- **Reference resolution is not unified** (Grafana `$variable` / Vega signals = one layer; ours = five vocabularies / four evaluators).
- **Geo/map binding under-modeled** (deck.gl-style accessor channels; our `map` is a placeholder ChartOutput).

---

## 5. ADAPT-UP recommendations (reshape ours toward the canonical concepts; never bend the concept down)

### R1 — Make the SEMANTIC LAYER the binding spine (the headline). [must-do, foundational]
Wire `MetricRegistry` into the resolution path so a binding can reference a **named metric** instead of a raw code:
- Extend `ObsQuery.measure` (and the convenience-spec `code` fields) to accept a **metric-id** alongside a raw code. A new `resolveMeasureRef(ref, store)` in core resolves a metric-id → `{ codes, agg, dims, unit, methodology }` from `getMetric()`, merging `MetricDef.dims` into the query filter (defaults, query-time wins) and threading `unit`/`methodology` into FieldConfig/provenance automatically. Raw codes still work (Postel: liberal in what we accept) — this is expand-contract, not a break.
- Result: unit, methodology, default-dims, and aggregation are declared ONCE on the metric and flow to EVERY panel that references it. This is the Cube/Looker/Power-BI move, in our grammar. It directly attacks F-C and shrinks F-A (you reference `metric:gdp`, you stop hand-authoring row-lists of codes).
- Door for later: hierarchical metrics (`MetricDef.parent` already exists) → drill-down navigation; LOD/granularity (`agg` → a fuller `{ agg, grain }`). YAGNI-gate both until a consumer asks.

### R2 — Enrich the encoding channel toward Vega-Lite. [should-do]
Add OPTIONAL, additive fields to `EncodingSpec` channels: measurement `type` (Q/O/N/T) carried explicitly (default-derived from `fieldSchema` role/type so existing configs are unaffected), and an explicit identity `key` (stabilizes chart diffing/animation; defaults to today's `label::series`). Consider inline `aggregate`/`bin` ONLY if a real binding needs summarization without a pipe step (else YAGNI — `query.pipe` covers it; door open). This is pure expand (no field removed), so every stored config keeps rendering.

### R3 — Collapse the convenience DataSpec branches into sugar over `query`. [should-do, Strangler-Fig]
Keep timeseries/growth/ratio-list/pivot as **authoring affordances** (the Constructor still shows friendly editors), but resolve them by **desugaring to `query`+`pipe`+`encoding`** internally rather than as bespoke resolvers. Target primitive set: **`query` · `transform` · `by-mode`** (the 3 orthogonal primitives) + a desugaring layer. This attacks F-A at the root: one resolution path, fewer code-paths to test, while the Constructor UX (the friendly per-type editors) is unchanged. Migrate one branch at a time behind a fitness function that asserts identical rows pre/post desugar. (`growth`/`ratio-list` carry real computation — they desugar to a `derive`/`window` pipe op, which already exists.)

### R4 — Unify the `$`-ref vocabularies under one declared concept. [should-do]
Introduce a single documented **Ref taxonomy** with non-colliding tokens and ONE resolution dispatcher (a `resolveRef(ref, scope, services)` that routes by scope): `ctx.dims` (rename the ObsQuery `$ctx` clearly), `param` (filter param — fixes the `$ctx` name collision in DataLinks #10), `row` (clicked datum), `dim` (`$d`/`$cl` views), `var` (`$ref` to a page var). Don't rip out the existing evaluators (Strangler-Fig); route them through one named seam so the platform has an SSOT for "what is a reference and who resolves it." Fixes F-B and the Least-Astonishment collision. This is the data-axis analogue of [[adr-config-and-render-vision]]'s "one home per datum."

### R5 — Promote time to a first-class query dimension. [could-do, behind R1]
Fold `YearsSpec` + `fromDim`/`toDim` into a `timeDimension { dim, range, granularity? }` shape on the query (Cube `timeDimensions` parity), deprecating the three loose mechanisms (expand-contract). Reduces #2/#7 to one coherent time model. Gate on R1 landing (the metric layer is the natural home for grain).

### R6 — Encode the data-reference invariants as fitness functions. [must-do, cheap]
- **FF-REF-RESOLVES:** every `$`-ref token in a stored config resolves through the unified dispatcher (no orphan ref scope).
- **FF-METRIC-FLOWS:** a panel referencing `metric:X` renders with X's unit + methodology without per-panel authoring (proves R1 wiring).
- **FF-DESUGAR-EQUIV:** each convenience spec produces row-identical output to its desugared `query` form (proves R3 safety).
- **FF-ENCODING-ADDITIVE:** the enriched EncodingSpec keeps every existing config valid (proves R2 is expand-only).
- **FF-ONE-RESOLUTION-PATH** (post-R3): the resolver registry has exactly the primitive set + registered customs (catches re-fragmentation).

---

## 6. Tie to the Constructor (every ref type must be authorable — the coverage gate)

This ADR sharpens the [[adr-constructor-vision-north-star]] coverage audit on the DATA axis. The authoring model per ref type:
- **Metric reference (R1)** → a **semantic-metric picker** (Power-BI/Looker field list): the author picks `metric:gdp` from MetricRegistry (`describeApp().metrics` already exposes them) instead of typing a code. This is the SINGLE most important non-programmer binding affordance and it now has render-path meaning. Surface metrics as a first-class palette/well source (the V5 field-wells get a "Metrics" tab).
- **Enriched encoding (R2)** → field-wells fed by `fieldSchema`/`suggestEncodings` (already derives Q/O/N/T-ish roles); the `type` becomes a visible chip property (Tableau blue/green).
- **Desugared specs (R3)** → unchanged friendly editors; desugaring is invisible to the author (a LEAD: coverage cost drops because fewer primitives need bespoke editors).
- **Unified refs (R4)** → the Retool-style **binding-chip** affordance ([[adr-constructor-vision-north-star]] Part A Retool steal): a field is a literal OR a `Ref` chip, and the chip's scope (ctx/param/row/dim/var) is chosen from one menu — one UX for all five, mirroring the one dispatcher.
- The coverage fitness (`adr-constructor-vision-north-star` #1) extends: every Ref scope and every primitive DataSpec has an authoring surface; the metric picker is `pick-don't-type` (#3) by construction.

---

## Decision

Treat the **semantic layer (MetricRegistry) as the intended binding spine** and wire it into resolution (R1); enrich the encoding channel toward Vega-Lite additively (R2); collapse the convenience DataSpec branches to sugar over `query` via Strangler-Fig (R3); unify the `$`-ref vocabularies under one declared taxonomy + dispatcher (R4); promote time to a first-class query dimension behind R1 (R5); and pin all of it with data-reference fitness functions (R6). Hold YAGNI on LOD, hierarchical-metric drill-down, inline aggregate/bin, and geo-accessor channels — doors named, not built.

## Rejected alternatives

1. **Leave the reference surface as-is ("each mechanism is clean").** Rejected: individually clean, collectively fragmented (F-A/F-B/F-C). Un-unified growth is the entropy the laws (SSOT, Least-Astonishment) exist to refuse; the cost compounds per new dataset/panel.
2. **Adopt a full modeling language (Malloy/LookML) wholesale.** Rejected: violates KISS/YAGNI for a dashboard platform and would import joins/SQL semantics we don't need. `MetricDef` is deliberately "thin — not a modeling language" (its own invariant); R1 keeps it thin and just gives it binding power.
3. **Make raw codes illegal; force every binding through a metric.** Rejected: breaks expand-contract (every stored config) and Postel's Law. Metrics are an additive, preferred path; raw codes remain liberal-accept.
4. **Replace the DataSpec union with a single mega-query (Cube-style only).** Rejected: the convenience branches are real authoring ergonomics (a statistician thinks "growth of GDP," not "query+window+derive"). Keep them as sugar (R3), don't delete them.
5. **One `$`-ref token reused everywhere by raw merge.** Rejected: that is the current name-collision (`$ctx` = dims vs param). The fix is a NAMED taxonomy with distinct scopes + one dispatcher, not fewer tokens.

## Consequences

- **Positive:** the data-reference surface collapses from ~12 fragmented mechanisms toward a coherent spine — a **named semantic layer** (governance, reuse, unit/methodology-once), **richer channels** (Vega-Lite parity), **fewer primitives** (3 + sugar), and **one ref taxonomy**. Units/methodology declared once flow everywhere (compliance Law 9 gets easier). The Constructor's binding UX simplifies (metric picker + binding chips) precisely because the model unified. New capability still = new registration (OCP preserved).
- **Negative / trade-offs:** R1+R3+R4 touch the hot resolution path — must be Strangler-Fig behind fitness functions (FF-DESUGAR-EQUIV, FF-METRIC-FLOWS) so no render regresses. R3 is the riskiest (row-identity must be proven per branch). Short-term, both raw-code and metric-ref paths coexist (Postel) — a temporary duplication that the fitness functions keep honest until raw-code authoring is deprecated.
- **ISO 25010:** maximizes **Maintainability** (modularity/SSOT — one binding spine), **Reusability** (named metrics), and **Functional suitability** (governance, units-once); trades short-term **Effort** and a transitional dual-path. **Compatibility** preserved by expand-contract (every recommendation is additive-first).

## Prioritized roadmap (must-do vs gold-plating)

**MUST-DO (the integrity + reuse spine):**
1. **R1 — semantic layer into the binding path** (`resolveMeasureRef`, metric-id in ObsQuery/spec codes, unit/methodology auto-flow). FF-METRIC-FLOWS. *Highest ROI — wires the orphan, attacks F-C, simplifies authoring.*
2. **R6 — the data-reference fitness functions** (land alongside each R as its safety net).
3. **R4 — unify the `$`-ref taxonomy + one dispatcher** (fixes the `$ctx` collision + Least-Astonishment; cheap, high coherence gain). FF-REF-RESOLVES.

**SHOULD-DO (de-fragment the grammar):**
4. **R3 — desugar convenience specs to `query`+pipe** (Strangler-Fig, one branch at a time). FF-DESUGAR-EQUIV.
5. **R2 — enrich encoding channels (`type`/`key`, additive)**. FF-ENCODING-ADDITIVE.

**COULD-DO (behind R1):**
6. **R5 — first-class `timeDimension`** (fold YearsSpec/fromDim/toDim).

**GOLD-PLATING (doors named, do NOT build now):**
- LOD / declared-granularity measures (Tableau/Malloy) — door: `MetricDef.agg → {agg,grain}`.
- Hierarchical-metric drill-down (`MetricDef.parent` exists) — door open.
- Inline channel `aggregate`/`bin` (Vega-Lite) — door: additive EncodingSpec fields; `query.pipe` covers today.
- Geo/map accessor channels (deck.gl) — door: the `map` ChartOutput is a placeholder; model when geo panels are funded.
- Multi-store per page / richer `dataSourceBindings` — door already in SiteDef; build at the 2nd-cube-per-page consumer.
- Vega-style `layer`/`facet`/`repeat` view operators — deferred in [[adr-config-and-render-vision]]; unchanged here.

**Sequence:** R1+R6 first (spine + nets), then R4 (cheap coherence), then R3 (de-fragment, gated by FF-DESUGAR-EQUIV), then R2, then R5. Gold-plating stays out with re-entry doors named.


---

### C. Data-Source-Reference Spectrum (STATIC / HREF / STOREID)


# Vision ADR — The Data-Source-Reference Spectrum (STATIC · HREF · STOREID)

**Status:** PROPOSED (2026-06-25). Author: architect (Opus). Design/research only — no product code, no git.
**Builds ON (does NOT duplicate):**
- [[multistore-storeid-reintroduction]] — owns the *routing* half (which named store a node reads; CSS-cascade `storeKey`; `buildStoreManifest`+`resolveStore`; three real cubes). That ADR's verdict: routing spine is LIVE.
- [[adr-data-reference-render-vision]] — owns the *binding* half (the 12 ref mechanisms, the semantic-layer spine R1, the `$`-ref taxonomy). Ref-type **#5** in that inventory is `storeKey`/`DataStore` binding — THIS ADR is the deep-dive on the *kinds* a store can be.

**The axis this ADR owns (and neither prior one made first-class):** **the SOURCE KIND** — not *which* named store, but *what kind of thing* that store is. A node references data that is one of three fundamentally different origins:

| Mode | Vega-Lite name | "My data is…" | Backend needed | Portability |
|---|---|---|---|---|
| **STATIC** | `data: { values: [...] }` | …THIS literal array, embedded in the config | none | total (offline) |
| **HREF** | `data: { url: "..." }` | …at THIS remote URL, fetched + parsed | none (just a URL) | high (self-contained pointer) |
| **STOREID** | `data: { name: "gdp" }` | …in THIS registered, governed cube | a provisioned store | governed/live |

**Thesis.** This is the canonical **Vega-Lite `data: { values | url | name }` trichotomy** — the single most-copied data-reference design in declarative-viz. We once had all three (the `datasource.ts` kinds `external | api | stats`; the `source.ts` `StaticSource | ApiSource | InlineSource`; the `25-datasource-system.md` `static`/`sdmx-api`/`rest-json` plugins). De-tenanting collapsed us to **one registered kind: `stats`**. STATIC *survives in fragments* (the `staticStore` Null Object + `transform.source` inline rows + `InlineSource` in selectors), but as scattered special-cases, not as a *kind of store*. HREF is **a ghost**: the `ApiSource` type still compiles, but its resolver returns `null` and the async path it points to (`FilterSchema.tsx`) no longer exists. The recommendation is NOT "restore the old envelope" — it is to **recognize that `static`/`href`/`storeId` are three KINDS behind the ONE `DataStore` port the kind-dispatch registry already supports**, register `static` as a first-class kind now (it has a real consumer), and gate `href` behind a named door (it does not).

---

## 0. TL;DR verdict

1. **The three modes are not three architectures — they are three KINDS behind ONE port.** `DataStore` + `registerStoreBuilder(kind, fn)` + `buildStoreManifest` *already* dispatch by kind. `static`/`href`/`storeId` are `StaticStore` / `HrefStore` / `ApiStore` — same interface, different builder. **This is the canonical hybrid and it needs almost no new architecture.** The node-level discriminant stays `storeKey` (→ a kind via the manifest); we do NOT add a parallel `DataSpec.data: { values | url | name }` union (that would be a *second* "which data" mechanism — exactly the fragmentation [[adr-data-reference-render-vision]] F-A/F-B warns against).
2. **STATIC: re-adopt now as a first-class kind.** Real consumers exist *today*: the lossless round-trip (a config that embeds its own data renders with zero backend — the demo/test/snapshot path), `transform.source` inline rows, and the `staticStore` fallback. Promote the scattered fragments to one registered `StaticStore` builder so "inline data" is a *store kind*, not three special-cases. Low cost, immediate payoff, kills a coherence smell.
3. **HREF: DEFER behind named door `D-HREF`.** No live consumer. The `ApiSource` ghost should be *finished or deleted*, not left half-wired (a `null`-returning resolver pointing at a deleted file is a Lava-Flow smell). Recommendation: **delete the orphaned `api`-in-selector path** (Strangler-Fig: remove dead code), and re-introduce HREF *as a store kind* (`HrefStore`, Vega-Lite `url` + `format`) only when the first real external/CSV/remote-JSON consumer appears. Name the trigger.
4. **STOREID: keep — it is the load-bearing default** ([[multistore-storeid-reintroduction]] already covers it). This ADR adds: storeId is *one kind among three*, and the kind-dispatch must stay open (OCP) so static/href slot in beside it without touching `resolveStore`.

**One line:** *Three source kinds, one `DataStore` port, the `storeKey`→kind manifest as the discriminant; register `static` now, gate `href` behind D-HREF, keep `stats` as the default — restoring the full Vega-Lite spectrum with near-zero new architecture.*

---

## 1. The recovered three-mode model (what we HAD)

The trichotomy lived at **three independent layers**, which is why "we used to have it" is true even though no single file holds all three today.

### 1a. The DataStore-KIND layer — `datasource.ts` (LIVE type, partial impl)
`packages/core/src/data/datasource.ts` still documents the three built-in kinds verbatim:
```
'external' — ExternalStore built from static observations + classifiers   ← STATIC
'api'      — MSW-intercepted fetch (dev mock)                              ← HREF (mock)
'stats'    — live stats API (production)                                   ← STOREID
```
`DatasourceInstanceConfig = { id, kind, url?, params? }` — the `url?` field is the HREF carrier; `params` is the STATIC carrier (the doc's `options.observations`). **The discriminant `kind` is the source-mode selector.** This is the spine that survived.

### 1b. The selector/filter layer — `source.ts` (LIVE types, HREF orphaned)
`packages/core/src/data/source.ts` defines the trichotomy for *filter options* (the `OptionsSource`/`ChipSource`/`YearsSource` used by dropdowns):
```
StaticSource<T> = { type: 'static'; items: T[] }                          ← STATIC (literal)
InlineSource    = { type: 'inline'; items: DimRef | Record[]; pipe? }     ← STATIC (literal OR dim-ref)
QuerySource     = { type: 'query';  query: ObsQuery; pipe? }              ← STOREID (via store.observe)
ApiSource       = { type: 'api';    url: string; pipe? }                  ← HREF  ← THE GHOST
```
The header comment names the lineage exactly: *"Grafana/Retool/AppSmith pattern (B+C hybrid): Generic core — StaticSource · QuerySource · ApiSource · RemoteSource."* This is a faithful Vega-Lite `values | url | name` mirror, in the selector layer.

### 1c. The plugin/envelope layer — `25-datasource-system.md` (documented, NOT built)
The richest recovery. The doc (Grafana datasource model × SDMX-JSON × JSON:API) specifies:
- **Three plugins** = the three modes: `static` (`Promise.resolve(observations)`, no HTTP) · `sdmx-api` + `rest-json` (`fetchWithAuth(config.url)` — the HREF mode, with `auth` + `structureUrl`) · all behind `SuspenseStore` (format-agnostic).
- **The `ApiResponse<T>` envelope** (`meta + structure? + data?`) with three *response* modes (structure-only / data-only / combined) and the **Tier-1/2/3 classifier resolution** — the genuinely clever part ([[multistore-storeid-reintroduction]] §1 pillar 4).
- **`plugin.create / testConnection / getMetadata`** — the Constructor authoring hooks.

So the *original* three-mode model was: **STATIC = the `static` plugin (inline `observations` in config) · HREF = the `sdmx-api`/`rest-json` plugins (`config.url` + `auth` + `SuspenseStore` fetch) · STOREID = a named instance in the manifest, referenced by node `storeKey`.** All three were *one `DatasourcePlugin` interface, dispatched by `plugin` id* — already the unification this ADR will re-affirm.

### 1d. The DataSpec-inline layer — `data-spec.ts` (LIVE)
Independently, two `DataSpec` branches carry **literal data inline** (a fourth STATIC surface):
- `{ type: 'transform'; source: Record[]; steps; encoding }` — `source` is a literal row array, consumed *directly* by `TransformResolver.resolve → applyPipeline(spec.source, spec.steps)` (`registry/resolvers.ts:362`). **This is live, working inline-static data — no store at all.**
- `{ type: 'pivot'; rows: Record[]; ... }` — same: literal `rows`, desugared to transform+melt (`desugar.ts:96`).

**Why it got dropped (the honest archaeology).** Three converging forces, none a deliberate "kill the spectrum" decision:
- **De-tenanting (ADR-0028) collapsed the backend to ONE.** The runner became a pure SDUI shell whose data comes from `GET /api/bootstrap` → `config.data_source` rows → all `kind: 'stats'`. With a single internal Postgres backend, there was *nothing for `external` or `api`/`href` to point at* — every real source was the stats API. So only `registerStoreBuilders()` (= `stats` only, `setupRegistrations.ts:16`) ships. `external`/`api` kinds have **no registered builder** — `buildStoreManifest` would `throw` on them today.
- **The `ApiResponse` envelope was superseded by a better-for-one-backend design.** The `stats` builder fetches classifiers per-dim at build time + observations per-query (ApiStore, Cache-Aside) — *simpler and superior* to Tier-3 for the real backend, but it left the elegant 3-tier envelope (and the `sdmx-api`/`rest-json` HREF plugins that needed it) unbuilt.
- **HREF half-rotted in place.** `ApiSource` (`type:'api'`) kept compiling but `resolveRaw` returns `null` for it (`resolve.ts:27`) with a comment pointing at *"the async fetch in FilterSchema.tsx"* — **a file that no longer exists** (grep finds zero `asyncOpts`/`fetch(` there). This is the Lava-Flow: a type and a `null`-branch surviving their consumer. It is the single clearest "we had href and lost it" artifact.

---

## 2. What EXISTS now (the delta)

| Mode | Status | Where it survives / where it died |
|---|---|---|
| **STOREID** | **LIVE, the default, load-bearing** | `stats` builder (`stats-registrations.ts`); `buildStoreManifest`; node `storeKey`; `resolveStore` CSS-cascade; 3 seeded cubes. The *only* registered kind. |
| **STATIC** | **SURVIVES, fragmented across 4 surfaces** | (a) `staticStore` Null Object (`store.ts:241`) — the empty fallback; (b) `DataSpec.transform.source` / `pivot.rows` — **live inline literal rows**, consumed by `TransformResolver`; (c) `InlineSource`/`StaticSource` in the selector layer (`source.ts`, `resolve.ts` — live for filter options); (d) the documented `external`/`static` STORE kind — **type exists, builder NOT registered** (`buildStoreManifest` would throw). |
| **HREF** | **GHOST — type compiles, runtime is dead** | `ApiSource = {type:'api', url}` in `source.ts` — but `resolveRaw` returns `null` (`resolve.ts:27`), pointing at a deleted file. The `sdmx-api`/`rest-json` plugins + `SuspenseStore` + `fetchWithAuth` + `ApiResponse` envelope = **documented only, never built** (or built-then-removed in de-tenant). No `url`/`href` DataStore kind is registered. The `stats` builder *uses* a URL internally, but that is STOREID-fetching-its-own-backend, not author-supplied HREF. |

**The delta in one line:** *STOREID is the whole live story; STATIC is alive but scattered as special-cases rather than a kind; HREF is a compile-time ghost with a dead runtime branch.* The trichotomy collapsed to a unary, with static fragments orbiting it.

---

## 3. Best-in-class data-source-reference models — the idea to steal from each

| Platform | How an author says "static / url / named" | The idea genuinely worth stealing |
|---|---|---|
| **Vega-Lite** | `data: { values: [...] }` \| `{ url: "...", format: {type:'csv'} }` \| `{ name: "table" }` \| `{ sequence }` \| `{ graticule }`. ONE `data` slot, a discriminated union; `format` rides with `url`. | **THE canonical model.** One `data` discriminant covers all origins; `values`=static, `url`+`format`=href, `name`=named/registered. The lesson: *the source-mode is a discriminated union on ONE slot, with `format` as a sibling of `url`.* Our `kind` on `DatasourceInstanceConfig` IS this union — at the store level instead of the node level. We steal the *shape* (one discriminant, format-with-url) but keep it at the manifest tier (see §4). |
| **Grafana** | Datasource plugins (named instances) + **inline/CSV/TestData** datasources + the **Infinity datasource** (point at ANY REST/CSV/GraphQL URL, map columns) + `-- Grafana --` built-in. | **Inline-data and URL-data are themselves DATASOURCE TYPES**, not a separate node concept. The Infinity plugin = HREF-as-a-kind done right (url + parser + column mapping). Validates: static and href are *store kinds*, dispatched the same way as a DB connection. |
| **Observable** | `FileAttachment("x.csv").csv()` (static-ish, bundled) \| `d3.json(url)` / `fetch(url)` (href) \| data loaders (build-time gen). | **FileAttachment = a bundled static asset referenced by name**; the *name* indirection (not the bytes inline) is a 4th sub-mode of static — "static by reference" vs "static by value". Door: a `StaticStore` could resolve `params.assetId` instead of `params.values` for large embedded datasets. |
| **D3** | `d3.json(url)` / `d3.csv(url)` — pure fetch + parse, no store concept. | The lowest-level HREF: url + parser. Confirms `HrefStore = fetch(url) → format-parse → rows` is a ~30-line builder, not a subsystem. Steal the minimalism: HREF needs `url` + a `format` parser registry, nothing more. |
| **Tableau** | Live vs Extract vs File (.hyper/.csv) vs Published datasource. | **The live/extract toggle = STOREID vs STATIC as a switch on the SAME logical source.** Foresight: a node could "freeze" a storeId query into a static snapshot (extract) for portability — a future bridge between the two modes (door, not now). |
| **Power BI** | Import (cached copy = static-ish) vs DirectQuery (live = storeId) vs Composite (mix). | Reinforces the **import/live duality as a first-class choice**; Composite = a node mixing static + live. We will NOT build composite (YAGNI), but it names the ceiling. |
| **Superset / Metabase** | datasets / saved queries (named = storeId) + **CSV/Excel upload → a new dataset** (static promoted to named). | **Upload-to-dataset = static data PROMOTED into a named store.** The cleanest Constructor story: an author pastes/uploads inline data → it becomes a `StaticStore` instance in the manifest → referenced by `storeKey` like any cube. *Static and storeId unify at the manifest tier.* |
| **Adaptive Cards** | `$data` binding (inline data island) + templating. | Inline data + a binding expression — the static-with-binding pattern. Our `transform.source` + `pipe` is exactly this. Keep it. |
| **Retool** | Resources (named REST/DB connections) + **static JS/JSON** as a resource + REST resource (url). | **Resource = global named source; static JSON and a REST url are BOTH resources.** Identical to our `registerStoreBuilder` + `kind`. The strongest external validation that static/href/storeId belong behind ONE registry, dispatched by kind. |

**Survey synthesis — three convergent truths:**
1. **The source-mode is a DISCRIMINATED UNION on one slot** (Vega-Lite `data`, Grafana datasource-type, Retool resource-kind). Never three parallel mechanisms. *We have this: `DatasourceInstanceConfig.kind`.*
2. **Static and HREF are STORE KINDS, peers of the named cube** (Grafana inline/Infinity, Retool static-JS/REST, Superset upload→dataset). Not a node-level escape hatch. *This is the unification (§4).*
3. **HREF = url + a `format` parser, nothing more** (Vega-Lite `format`, D3 `d3.csv`, Grafana Infinity column-map). A small builder, not a subsystem — which is *why* deferring it is cheap (re-entry is a single builder registration).

---

## 4. The unification — ONE `DataStore` port, N source KINDS (the canonical hybrid)

**The insight to evaluate (from the prompt):** since `registerStoreBuilder(kind, fn)` already dispatches by kind, `static`/`href`/`storeId` are simply three store kinds behind one port — `StaticStore` (from inline `values`), `HrefStore` (fetch `url` + `format`), `ApiStore` (the cube). **Verdict: YES — this is the canonical hybrid, and it is the RIGHT one.** Critique and refinement:

### Why kinds-behind-one-port is correct (not a `DataSpec.data` union)
There are two candidate homes for the source-mode discriminant:
- **(A) Store-kind discriminant** (`DatasourceInstanceConfig.kind`) — the source-mode is a property of the *named store*; nodes reference it by `storeKey`; `buildStoreManifest` dispatches `kind → builder`. **← RECOMMENDED.**
- **(B) Node-level `DataSpec.data` union** (Vega-Lite-literal: each node carries `data: { values | url | name }`). The source-mode is a property of the *node*.

**Choose (A). Reject (B) as the primary mechanism.** Reasons, against the laws:
- **SSOT + no fragmentation.** [[adr-data-reference-render-vision]] already names F-A ("too many ways to say *this data*") and F-B (five `$`-ref vocabularies) as the platform's live entropy. Adding a node-level `data: {values|url|name}` union creates a SECOND "which data source" mechanism beside `storeKey` — the exact divergent-change smell. One discriminant (`kind` at the store), not two.
- **Governance + reuse (the §3 convergent truth).** Superset/Retool/Grafana all put static and href *at the resource tier* so they are named, reused, testable, and authored once. A node-level inline `url` is un-named, un-reused, un-governed — and re-fetched per node.
- **The cascade already works.** `resolveStore` (CSS-cascade: page `storeKey` → node override → first → `staticStore`) is mode-blind: it resolves a `storeKey` to a `DataStore` regardless of kind. Static/href slot in with ZERO change to the resolver — pure OCP. A `DataSpec.data` union would need a whole parallel resolution path.
- **Round-trip stays trivial.** `kind`+`params`+`url` are plain JSON on the manifest; `JSON.parse(JSON.stringify) === config` holds by construction (Law 2). Inline `values` live in `params.values` (or `transform.source`), already serializable.

**The one principled exception (keep B in the small):** `DataSpec.transform.source` / `pivot.rows` — *inline literal rows on the node* — is legitimate and should STAY, as **authoring sugar for the truly-local, computed-by-the-author case** (a 5-row annotation table, a hand-entered reference series). This is Adaptive-Cards `$data` / Vega-Lite `values` at the node. It is NOT a competing "source kind"; it is a node that needs no store at all. Keep it bounded: it carries *only* literal rows the author typed, never a `url`, never a query. (Fitness: `transform.source` must be a literal array, never a ref to a remote.)

### The unified model (target)
```
DatasourceInstanceConfig { id, kind, url?, params? }            (manifest tier — the SSOT for source-mode)
   kind = 'static'  → StaticStore(params.values, params.classifiers?)      ← STATIC  (Vega-Lite values)
   kind = 'href'    → HrefStore(url, params.format)                        ← HREF    (Vega-Lite url + format)
   kind = 'stats'   → CachedStore(ApiStore(url, ...))                      ← STOREID (the live cube)
        ↓ all return the SAME DataStore port
node.storeKey → resolveStore(ctx) → DataStore → querySync/queryAsync       (one resolution path, mode-blind)

PLUS (bounded, node-local, no store):
node.data = { type:'transform', source: <literal rows>, steps, encoding }  ← inline-static-by-value
```
**This restores the full spectrum with one new builder now (`static`), one deferred builder (`href`), and ZERO new resolution architecture.** The port, the registry, the cascade, the round-trip — all already exist.

### Critique / risks of the unification
- **`StaticStore` must be a real `DataStore`, not just `staticStore`-the-Null-Object.** Today `staticStore` returns `[]` for everything (correct as a *fallback*). A `static` *kind* must actually serve its `params.values` through `querySync({type:'obs'|'val'}, ctx)` — i.e. an in-memory `ExternalStore` fed from `params.values`. The `ExternalStore` class already exists (`store-impl.ts`); the `static` builder is `new ExternalStore(params.values, {classifiers})`. ~10 lines. The doc's `static` plugin (`§25` lines 408-428) is the exact blueprint.
- **Classifiers for static.** A `StaticStore` needs `classifiers`/`display` for `$cl`/`$d` resolution and filter dropdowns (the §25 "why classifiers must be synchronous" point). `params.classifiers` carries them inline (Tier-1, instant). Trivial for static (no fetch).
- **HREF's real cost is `format` + auth + Suspense, not the fetch.** `HrefStore` is small *if* it serves a pre-parsed JSON envelope; it grows teeth with CSV parsing, auth (the `AuthConfig` union), and Suspense timing for classifiers (Tier-2/3). That growth is exactly why HREF is deferred — its cost is real and has no consumer to justify it (§5, §6).

---

## 5. Per-mode assessment — benefit · Constructor authoring · foresight · cost/YAGNI

### STATIC (inline `values` / `transform.source`)
- **Genuine benefits:** portable/offline configs (a dashboard that renders with zero backend — demos, docs, embeds, fixtures); the **lossless round-trip** target (a config that *embeds its own data* is the cleanest round-trip proof — what you build = what serializes = what renders, no live store needed); hand-authored reference/annotation series; **test + snapshot determinism** (the engine's own tests already lean on `ExternalStore(obs)` — `spec.test.ts`, `metric-binding.fitness.test.ts`). The de-tenant runner's `emptyManifest()` fallback is itself a static-mode artifact.
- **Constructor authoring:** paste/upload a CSV or JSON → `StaticStore` instance written to `config.data_source` (the **Superset upload→dataset** model) OR hand-entered rows → `transform.source` (the **Adaptive-Cards `$data`** model). Both are pick-don't-type-able and round-trip cleanly.
- **Foresight (when is static the right tool):** demos/onboarding templates; embedded/exported dashboards (no live backend at the embed site); small slow-moving reference data (region labels, methodology notes) that doesn't deserve a cube; test fixtures; the "freeze a live query into a snapshot" extract (Tableau extract — future door).
- **Cost/risk + YAGNI:** **LOW cost, REAL consumer → BUILD NOW.** `ExternalStore` exists; the `static` builder is ~10 lines; it *unifies four scattered fragments* (Null Object + `transform.source` + `InlineSource` + the unregistered `external` kind) into one named kind. The YAGNI test PASSES — the second consumer is not speculative, it is already here (tests, round-trip, `emptyManifest`, `transform.source`).

### HREF (author-supplied `url` + `format`)
- **Genuine benefits:** reference a remote CSV/JSON/external API with **no store to provision** (point at an open-data URL, Eurostat/World-Bank SDMX endpoint, a teammate's gist); the most *portable shareable* form (a config + a URL, no DB seeding). Grafana's Infinity datasource exists precisely because this is genuinely wanted in dashboards.
- **Constructor authoring:** "Add remote source" → url + format picker + `[Test connection]` (the §25 `testConnection` hook) + column-map (Grafana Infinity). This is the richest authoring surface of the three.
- **Foresight (when is href the right tool):** mixing an external open-data series into an internal dashboard without an ETL/provisioning step; rapid prototyping against a live public API; a tenant whose data lives at a URL we don't host (the multi-tenant SDMX-endpoint case the §25 doc was *designed* for — `url: 'https://api.geostat.ge/sdmx/...'`).
- **Cost/risk + YAGNI:** **REAL cost, NO consumer today → DEFER behind door `D-HREF`.** The cost is not the fetch — it is the *tail*: `format` parser registry (CSV/SDMX-JSON/REST-JSON → rows; the `fromSDMX` adapter boundary, Law 5), the `AuthConfig` discriminated union (bearer/basic/apikey — secrets handling, a security surface), and Suspense-timed classifier resolution (Tier-2/3 — the genuinely-clever-but-unbuilt envelope). Building all that for zero current consumer is textbook speculative generality (YAGNI FAILS today). **AND: the half-built `ApiSource` ghost is a Lava-Flow that should be cleaned up regardless** (delete the `null`-returning `api` branch + the dead-file comment in `resolve.ts`, or finish it — but do not leave it).

### STOREID (named cube)
- Covered in [[multistore-storeid-reintroduction]]. This ADR's only addition: **storeId is one kind among three; the kind-dispatch must stay OCP-open** so static/href register beside it. It is the correct *default* (governed, live, the real backend), and nothing here weakens it.

---

## 6. WHAT WE DO — the recommendation

**Re-adopt the spectrum as THREE KINDS behind the ONE `DataStore` port (the canonical hybrid). Register `static` now. Defer `href` behind a named door. Keep `stats` as the default. Clean up the `href` ghost.**

### Adopt now (the vital few)
1. **Register a first-class `static` store kind.** `registerStoreBuilder('static', async ({id, params}) => new ExternalStore(params.values ?? [], { classifiers: params.classifiers, display: params.display }))` in `@statdash/plugins/datasources` (beside `stats`, the established shared seam — Law 3 holds). The §25 `static` plugin is the blueprint. This promotes the four scattered static fragments into one named kind addressable by `storeKey` — and makes the **round-trip provable end-to-end** (a config with a `static` source renders with zero backend).
2. **Keep `transform.source`/`pivot.rows` as bounded node-local inline-static sugar.** No change; just pin the invariant (a literal array, never a remote ref) with a fitness function. This is the legitimate node-level `values` (Adaptive-Cards `$data`), distinct from the `static` *store kind*.
3. **Clean up the HREF ghost (Strangler-Fig: remove dead code).** Either delete the orphaned `ApiSource` `null`-branch + stale `FilterSchema.tsx` comment in `resolve.ts`, or quarantine `ApiSource` behind D-HREF with an explicit `// deferred — see ADR D-HREF` marker. A `null`-returning branch pointing at a deleted file is a broken window; the no-degradation law (Law 6) says fix it. **Decision: delete the dead selector-layer `api` path now; HREF re-enters as a STORE kind, not a selector type.**

### Defer behind named doors (YAGNI holds)
- **`D-HREF` — the `href` store kind.** `registerStoreBuilder('href', ...)` = `HrefStore(url, format)` with a `format` parser registry + (later) `AuthConfig`. **Trigger:** the first real author-supplied external/remote source (an open-data URL, an external SDMX endpoint, a non-`/api/stats` backend, or the first true multi-tenant deployment whose data lives at a URL we don't host). When it opens, build it as `fetch(url) → format-parse → ExternalStore`-shaped rows; lift the §25 `sdmx-api`/`rest-json` plugins + `SuspenseStore` + `ApiResponse` envelope *only as far as the consumer needs* (probably JSON-only first; CSV + auth + Tier-2/3 each behind their own sub-trigger). This is the same door as [[multistore-storeid-reintroduction]] D1 (`ApiResponse` Tier-2/3) — they open together.
- **`D-STATIC-ASSET` — static-by-reference.** `StaticStore` resolving `params.assetId` (a bundled/uploaded large dataset) instead of inline `params.values`. **Trigger:** the first static dataset too large to inline comfortably in the config (Observable `FileAttachment` pattern). Until then, inline `values` suffices.
- **`D-EXTRACT` — freeze a storeId query into a static snapshot** (Tableau extract / Power BI import). **Trigger:** a real need to portable-ize a live dashboard (export with frozen data). The generic-dim long-format invariant makes this cheap later.

### Rejected alternatives
1. **Restore the full `25-datasource-system.md` envelope (sdmx-api/rest-json plugins + `ApiResponse` Tier-1/2/3 + `auth`) now.** REJECTED — speculative generality for zero current HREF consumer; the `stats` per-dim/per-query design is simpler and superior for the one real backend. (Same verdict as [[multistore-storeid-reintroduction]] D1.)
2. **Add a node-level `DataSpec.data: { values | url | name }` Vega-Lite-literal union as the primary mechanism.** REJECTED — creates a SECOND "which source" mechanism beside `storeKey` (F-A/F-B fragmentation; divergent-change smell; un-governed, un-reused per-node url). The discriminant belongs at the manifest/store tier (Grafana/Retool/Superset all agree). The *bounded* `transform.source` node-local inline is the only node-level exception, and it carries literals only.
3. **Leave `static` as scattered fragments (Null Object + transform.source + InlineSource + unregistered `external`).** REJECTED — that *is* the un-unified growth the laws refuse; four surfaces for one concept (static data) with no single named kind. Promote to one `StaticStore` kind.
4. **Build `href` now "because Vega-Lite/Grafana have it."** REJECTED — no consumer; real tail-cost (format/auth/Suspense). Name the door (D-HREF), keep the minimalism insight (it's a small builder when it comes), open on trigger.
5. **Keep the `ApiSource` ghost as-is "in case we need href."** REJECTED — a `null`-branch pointing at a deleted file is a broken window (Lava Flow). Dead code is not a placeholder; the door (D-HREF) is the placeholder. Delete it.

### Phased Strangler-Fig path
- **S0 — Register `static` kind + fitness nets.** Add the `static` builder (`ExternalStore` from `params.values`); land `FF-STATIC-KIND` + `FF-SOURCE-KIND-CLOSED`. Prove a `static`-source page renders with zero backend (the round-trip win). *Cheap, immediate.*
- **S1 — Unify the static fragments.** Point the `staticStore` fallback, `transform.source` documentation, and `InlineSource` at the one conceptual model ("inline data is the `static` kind, or node-local `transform.source` for typed literals"). Pin `transform.source = literal-only` (`FF-NO-FETCH-IN-CONFIG`).
- **S2 — Clean the HREF ghost.** Delete the dead `api` selector branch (`resolve.ts`) + stale comment; mark `ApiSource` as D-HREF-deferred or remove. No new code; remove dead code.
- **S3+ — open D-HREF / D-STATIC-ASSET / D-EXTRACT only on their named triggers**, building each as a store kind behind the existing port + registry.

### Fitness functions
- **`FF-STATIC-KIND`** — a `DatasourceInstanceConfig { kind:'static', params:{ values } }` builds via `buildStoreManifest` into a `DataStore` that serves `params.values` through `querySync`; a `static`-sourced page renders identical rows with NO network call (the offline/round-trip invariant made executable).
- **`FF-SOURCE-KIND-CLOSED`** — `buildStoreManifest` dispatches every `kind` through `registerStoreBuilder` (no hardcoded `if kind==='stats'`); adding a kind = one registration, zero resolver edits (OCP guard — catches re-privileging one kind).
- **`FF-NO-FETCH-IN-CONFIG`** — no `DataSpec` (esp. `transform.source`/`pivot.rows`) and no `DatasourceInstanceConfig` carries a function, `fetch`, or imperative loader; `static` data is literal values, `href` data is a `url` string + declared `format` (Law 2 — config is declarative; the source-mode never smuggles logic).
- **`FF-CONFIG-ROUNDTRIP`** (existing, extend) — `kind`/`url`/`params.values` survive `JSON.parse(JSON.stringify(config))` unchanged across all three modes.
- **`FF-HREF-DOOR`** (latent, activates with D-HREF) — when `href` is registered, an author-supplied url + format resolves to rows through the SAME `DataStore` port as `stats`/`static` (no parallel resolution path).

---

## 7. Alignment with project laws + prior ADRs
- **Law 1 (no privileged dims):** source-mode is dimension-blind; `StaticStore`/`HrefStore`/`ApiStore` all serve generic `Record<dim,val>` rows. No mode hardcodes a dimension.
- **Law 2 (config declarative):** `static`=literal `values`, `href`=`url`+`format` string, `storeId`=named ref. No mode admits a function/`fetch`/loader into config — the fitness `FF-NO-FETCH-IN-CONFIG` enforces it. The `ApiSource` ghost's `url` was already declarative; its sin was a dead resolver, not impurity.
- **Law 3 (arrow):** all builders register in `@statdash/plugins/datasources` (below `apps/*`); the `static` builder uses `ExternalStore` from `@statdash/engine` (core) — arrow holds, exactly as `stats` does.
- **Law 4 (full standards):** we adopt the Vega-Lite `data: {values|url|name}` trichotomy *whole* (the canonical spectrum), placed at the store tier (Grafana/Retool form) rather than the node tier — the best form for a governed platform.
- **Law 5 (API-readiness):** swapping a source = a `config.data_source` row (`kind` flip), not a deploy. `fromSDMX` stays the sole HREF adapter boundary when D-HREF opens.
- **Law 6 (best/root-cause):** the `ApiSource` ghost is fixed at the root (delete the dead branch), not patched. Static is unified (one kind), not left fragmented.
- **Law 7 (architecture leads):** target = three kinds behind one port; the scattered static fragments migrate to the `static` kind (Strangler-Fig), the architecture is not bent to keep four static surfaces.
- **Law 8 (platform thinking) + YAGNI:** `static` is built because the second consumer is real (tests + round-trip + `emptyManifest` + `transform.source`); `href` is deferred because it is speculative — the discipline cuts exactly where the consumer line is.
- **Ties to [[multistore-storeid-reintroduction]]:** that ADR's routing spine + this ADR's source kinds compose — `resolveStore` routes to a named store; that store's *kind* (this ADR) decides static/href/live. D-HREF here = D1 there (open together). [[adr-data-reference-render-vision]] R1 (semantic layer): a metric names its store; that store's kind is orthogonal — a metric can resolve to a `static` snapshot or a live cube identically.

## 8. Consequences
- **Positive:** the full Vega-Lite spectrum restored with ~one new builder; static unified from four fragments to one named kind; the round-trip provable end-to-end (offline render); the HREF ghost cleaned; the kind-dispatch proven OCP-open for the next source type; zero new resolution architecture (the port + cascade + manifest already carry it).
- **Negative / trade-offs:** a transitional period where `transform.source` (node-local static) and the `static` *kind* (manifest static) coexist — two static surfaces by design (one node-local-typed, one named-reusable); documented as the bounded exception, not drift. Deferring `href` means the §25 envelope work stays unbuilt — accepted, behind a named door with the cost honestly logged.
- **ISO 25010:** maximizes **Portability** (offline/static configs), **Maintainability** (one kind not four fragments; OCP registry), **Reusability** (named static sources, Superset-style); trades a small transitional duplication (two static surfaces) and defers **Functional suitability** of remote sources (href) until a consumer justifies its cost.
