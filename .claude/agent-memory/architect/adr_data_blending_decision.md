---
name: adr-data-blending-decision
description: DECISION ADR on D3 data-blending (cross-store / "Mixed" join) — the last deferred data-source door. VERDICT = SHIP THE SEAM, DEFER THE PLANNER (hybrid). The hard architectural gap is real and named: interpretSpec(spec,ctx,ONE-store) is the whole resolver registry's signature — no node's resolution reaches a 2nd store today; the manifest (ctx.stores) lives in react RenderContext and is never threaded into core. joinByField ALREADY EXISTS as a tested hash-join op but is deliberately schema-less (source = pre-resolved EngineRow[]) — it is the correct permanent ENGINE for the join, the missing half is the DECLARATIVE node-config that names a 2nd store + resolves it to rows. Canonical join shape recovered from Vega-Lite lookup/Malloy/SQL/Cube views/Tableau blend = ONE-sided enrichment lookup keyed on shared dims (NOT a full N-way query planner). SHIP NOW (B0-B2): a bounded declarative `blend`/`lookupStore` step that names a secondary storeKey + ObsQuery + join key, resolved in the REACT binding layer (where ctx.stores lives) into a joinByField source — Tableau primary/secondary blend, generic-dims-make-it-cheap (Law 1). DEFER (behind D3-PLANNER): symmetric N-store query optimization, cross-store filter pushdown, server-side join, blend-aware extractRequirements prefetch. joinByField stays the custom-escape bridge until B-steps land. Builds on adr_multistore_storeid_reintroduction (D3) + adr_data_source_reference_spectrum + adr_data_reference_render_vision (R1).
metadata:
  type: project
---

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
