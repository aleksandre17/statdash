# ADR-024 — Config-Compiled Reactive Query Graph (the data/reactivity plane)

> **Status:** ACCEPTED (V0/V1 landed — `extractDeps` + baseline; V2–V6 sequenced, flag-reversible until V3-contract) · **Date:** 2026-07-10
> **Authority:** `docs/architecture/proposals/SPEC-rendering-architecture.md` (the three-plane study) · `MASTER-PLAN-canonical-rearchitecture.md` (backbone 2) · builds on ADR-023 (One Type System).
> **Scope of THIS ADR as first landed:** the decision + V0 baseline + V1 `extractDeps` (the dependency SSOT). V2 (shadow graph), V3 (render switch — the one-way door), V4 (warm/stream subsume), V5 (`ChartEmitter`) are decided-in-principle and sequenced here; each lands behind its own gate.

---

## 1. Context — the problem being solved

Rendering decomposes into three planes (SPEC §1). Planes 1 (declarative grammar) and 3 (the `renderNode` interpreter + registry + multi-target) are reference-grade and KEPT. Plane 2 — **state change → exactly-affected output** — is the genuine architectural debt:

> Any filter/perspective/locale change rebuilds `RenderContext` in `NodePageRendererInner` and re-walks the ENTIRE tree; correctness and cost are rescued by a constellation of hand-rolled string cache-keys.

That constellation is a **dependency graph, built ad hoc, as string keys, scattered across opt-in hooks** — and it has a shipped-bug record:

| Mechanism | Location | Hand-encodes | Origin |
|---|---|---|---|
| `specDimKey` | `react/engine/specDimKey.ts` | which dims a spec reads | — |
| `varsKey` | `useNodeRows.ts:88` | vars are dependencies | **patch over AR-36 staleness bug** |
| `recipeKey` + `_promiseCache` | `useNodeRows.ts:140` | node identity + derivation cache | **patch over N34c collision bug** |
| `_storeCache` | `resolveNodeRows.ts:52` | store-level memo | — |
| `collectRequirements` | `targets/warm.ts` | the SAME dep analysis, re-implemented for prefetch | **standing warm≠render drift class** |

When an architecture keeps growing shadow copies of the same missing abstraction, the root cause is the missing abstraction (Law 6). Two are patches over shipped bugs; one is a permanently-policed drift vector (`FF-WARM-COVERS-RENDER`).

---

## 2. Decision

**Keep the grammar and the interpreter/registry skeleton; reify the data plane as a first-class REACTIVE QUERY GRAPH compiled from the config.** The synthesis (SPEC §2): **Vega's spec→dataflow compilation move, at Grafana's dashboard scale, over our fully-declarative grammar, realized through React.** No reference platform holds both preconditions (a declarative dashboard-scale grammar AND compilation); we do.

- **Law of plane 2:** ONE dependency graph, compiled from config, owns all derivation, caching, invalidation, warming, streaming. No second cache, no string-key shadow.
- The graph is **not** a second state store (sources are the same URL params/perspective — the MVU loop is intact), not an event bus, not a scene graph replacing React. It is the derived-state layer made explicit and correct.
- Residence: `packages/core/src/graph/` — pure, framework-free (the arrow forbids core→react; here that is a feature — the graph serves live/SSR/SSG/warm/Constructor identically).

**Why static extraction is TOTAL (the load-bearing premise):** Law 2 forbids functions in config — every dependency is a NAMED declarative token (`$ctx`/`$param`/`$ref`/`$cl`/`$d`, `fromDim`/`toDim`/`timeDimension`, `visibleWhen` param, measure/metric id, `storeKey`, template `{token}`). Nothing hides in a closure, so a static walk sees the complete set. **This premise was TESTED, not assumed** — see FF-EXTRACTDEPS-TOTAL below and the finding in §6. If it ever fails, that is a foundational Law-2 breach, reported as a blocker.

---

## 3. What landed (V0 + V1)

### V1 — `extractDeps` (the dependency SSOT) — `packages/core/src/graph/extractDeps.ts`

A pure `extractDeps(node, ctx?): NodeDeps` computing ONE renderable's TOTAL dependency (edge) set across every axis, generalising the whole constellation:

| Source bucket | Subsumes | Extraction |
|---|---|---|
| `dims` | `specDimKey` (dim half) | query `$ctx` filters, `fromDim`/`toDim`/`timeDimension`, structural TIME_DIM for time-bound specs, encoding/pipe `$ctx`, template `{token}` |
| `params` | — (new axis) | `visibleWhen` params, `$param`, vars-expr `$ctx` (expr-layer = filterParams) |
| `vars` | `varsKey` | `$ref`, `$derived`, encoding/pipe `$ctx` vars-fallback |
| `perspective` | — (new axis) | `visibleWhen` `perspective-*` axes, perspective carriers |
| `classifiers` | — | `$cl`/`$d` (lookup/join/display) |
| `stores` | `effectiveStoreKey`/`specDataSource` | explicit `storeKey`, metric `dataSource`, `blend` store |
| `measures` | — | `specMeasureRefs` + blend measures |
| `locale` | the useNodeRows/useKpiRows locale fold | any localized display / template |
| `requirements` | `collectRequirements` | `extractRequirements` (ctx-dependent, the warm plan) |

Design decisions of note (each documented at the code):
- **Literal filter pins are constants, not edges** — `{approach:'PROD'}` adds no dim dep; only a `$ctx`-valued filter does. Exact, not just safe.
- **Encoding/pipe `$ctx` is dual-recorded (dims + vars)** — `resolveEncodingRefs`/`resolvePipeRefs` resolve dims-first, vars-fallback; the AR-36 binding is almost always a derived var, so recording dims alone would UNDER-fire. The inert edge (no such dim) never fires — safe.
- **Time is a STRUCTURAL (spec-type) dependency, not a closure** — timeseries/growth/row-list/query read the year from ctx by resolver convention (TIME_DIM). Captured by the typed spec scan, so totality holds under Law 2 (time is declared by spec SHAPE, not hidden in code).
- **The `$ctx` scope split is honoured** — in a `vars` expression `$ctx`→params (evalVarMap binds scope.dims to filterParams); in the data layer `$ctx`→dims. Typed scanners resolve the collision correctly.
- **Interaction slots (`on`/`actions`/`dataLinks`) are out of RENDER-dep scope** — `$row`/`$param` drill-down is resolved on click, not on render.

`extractDeps` COMPUTES only. It does NOT drive invalidation/rendering (V2/V3). Reversible: delete `src/graph/` + the barrel export + the two tests.

### V0 — baseline measurement (the honesty gate)

`apps/api/src/provisioning/extractDeps-corpus.fitness.test.ts` records the CURRENT invalidation fan-out over the real geostat corpus (170 renderable nodes). See `docs/architecture/proposals/BASELINE-render-data-path.md` for the full table. Headline:

- **Coarse (today):** every state change re-walks **all 170** nodes.
- **Exact (extractDeps):** the busiest source (`toYear`) touches **35**; `sector` **16**; `geo` **14**; `time` **13**; `perspective` **10**. A `geo` change should re-evaluate **14** nodes, not 170 — a ~12× over-fire the graph eliminates.

This is the non-regression baseline V3 proves against: after the switch, a source's live re-eval count must be ≤ the coarse baseline AND equal the exact count recorded here.

---

## 4. Fitness functions

| FF | Status | Gates |
|---|---|---|
| **FF-EXTRACTDEPS-TOTAL** | **LIVE (V1)** | every named `$`-ref in a config appears in the extracted dep set; a planted hidden dep is caught. Run on an inline corpus (`extractDeps.fitness.test.ts`) AND the real provisioning corpus (`apps/api`). |
| FF-GRAPH-PARITY | scaffold (V2) | shadow-mode graph rows ≡ legacy rows across corpus × perspectives × locales |
| FF-EXACT-INVALIDATION | scaffold (V3) | writing param P re-evaluates exactly the nodes whose dep-set contains P; equal-value write re-evaluates zero |
| FF-ONE-DERIVATION-PATH | scaffold (V3-contract) | no module-level promise/row cache outside `core/graph` |
| FF-WARM-IS-RENDER | scaffold (V4) | warm pass and render read the same graph instance |

Scaffolds land as `it.todo` (honest pending) — they gate steps not yet built.

---

## 5. Alternatives rejected (SPEC §6, condensed)

- **ALT-A — Vega/Vega-Lite as grammar+runtime.** Rejected: scope mismatch (chart-local vs page-scale), dual state stores (Vega signals vs URL-param SSOT — breaks permalink Law 9 + the MVU loop), loses SDMX/OLAP/i18n integration. We take Vega's *compilation insight*, not its runtime.
- **ALT-B — status quo + more caches.** Rejected: symptom-patching a missing abstraction (Law 6); a shipped-bug record + a growth vector.
- **ALT-C — adopt a reactive library** (RxJS/preact-signals/TanStack). Rejected: wrong grain / view-framework tie inside core (Law 3) / cache-not-graph semantics. The needed engine is small, pull-lazy, topological, zero-dep — owning it costs less.
- **ALT-D — own retained scene graph, drop React.** Rejected: NIH; React IS the retained realizer with a11y DOM + Suspense.

---

## 6. Finding — totality VERIFIED (Law-2 premise holds)

The brief asked to STOP + report if Law 2 turns out NOT to make extraction total (a hidden/closure dep). **It holds.** Over the full geostat provisioning corpus, every one of the `$`-refs an independent raw scanner finds is covered by `extractDeps` — no closure, no unnamed dependency. The single subtlety worth recording (not a breach): **time-boundedness is a structural, spec-type-driven dependency** (resolvers read TIME_DIM by convention), not a `$`-ref — so it is captured by the typed spec scan rather than the ref sweep. This is fully static and declarative (the spec's `type` is the token), so totality is preserved. Two soft edges are documented as coarse-but-safe in V1, to be refined in V2: (a) `locale` is marked for any localized display (over-fires safely — a locale toggle re-localizes broadly today anyway); (b) perspective-carrier detection needs the page's perspective-id set for precision (`DepScanCtx.perspectiveIds`).

---

## 7. One-way doors (owner)

- **D-RRA-1** adopt the three-plane target + V0–V2 — proceeding (flag-guarded, parity-proven, zero grammar change).
- **D-RRA-2** — V3 render-path contract (per-node subscription becomes THE topology; inline `resolveNodeRows` + `_promiseCache` retired). **The one-way door**, fired only when FF-GRAPH-PARITY (golden-DOM) + the latency gate are green (owner-authorized to run on green, 2026-07-10).
- **D-RRA-3** ChartEmitter (V5) — additive, proceeding.
- **D-RRA-4** in-house engine (not a library) — per ALT-C.
