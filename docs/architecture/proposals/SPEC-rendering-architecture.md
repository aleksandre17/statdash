# SPEC — Rendering Architecture: Grammar → Reactive Query Graph → Pluggable Realizers

> **Status:** PROPOSED (design-only; no code in this commission) · **Author:** platform-architect (deep independent study, 2026-07-10)
> **Commission (owner):** unconstrained, first-principles study of the BEST rendering architecture — how config becomes interactive, data-bound output. Big changes permitted; honesty required over ambition.
> **Companion:** `SPEC-rendering-core-object-model.md` (study 1 — the TYPE system; unchanged by this study, strengthened by it) · `DESIGN-rendering-architecture.md` (AR-28 — render *topology* CSR/SSG; orthogonal, confirmed) · `DESIGN-grammar-of-interaction.md` (AR-36) · `DESIGN-cross-filter-interaction.md` (AR-42). New engine work → **ADR-024**.

---

## 1. Verdict on the current rendering architecture

Decompose "rendering" into its three planes and judge each against the reference class:

**Plane 1 — the declarative grammar (config → intent).** **Reference-grade, and in places ahead of the references.** `NodePageConfig` is a uniform typed tree (study-1 F3); `DataSpec` + `EncodingSpec` + `TransformStep` pipe is Grammar-of-Graphics-shaped (mark = `ChartType`, encoding = channel map, transform = declarative pipe — `charts/types.ts` says "Vega-Lite mark + encoding analogue" and means it); `$ctx` refs bind channels/filters/marks to state (AR-36 lands GoG's *selection* grammar); `ChartOutput` is a neutral, 100%-serializable visualization IR. Nothing here needs replacing.

**Plane 2 — the view/target plane (resolved state → pixels).** **The right skeleton, one honest hole.** `renderNode` is a 12-step interpreter with zero type-branching, registry dispatch, per-node error isolation, versioned migration — Builder.io/Grafana lineage, verified best-of-class in study 1. Multi-target already exists (`RenderTarget = dom | html | pdf | api`, `targets/html.tsx` reuses the same pipeline). **ApexCharts is already NOT the fixed renderer at the type level** — `ChartRendererRegistry` registers a `ComponentType<ChartRendererProps>` per chart type; `ChartOutput` is the seam. The hole: every registered strategy is a *DOM/client* renderer, so the html/pdf/export targets ship **no chart pixels** (AR-28 §4 admitted this: "charts do NOT degrade"). The target abstraction is designed but not *completed*.

**Plane 3 — the data/reactivity plane (state change → exactly-affected output).** **This is where the architecture is genuinely short — and it is architectural, not cosmetic.** The current model: any filter/perspective/locale change rebuilds `RenderContext` in `NodePageRendererInner` and re-walks the ENTIRE tree; `resolveNodeRows` re-runs per data node; correctness and cost are rescued by a constellation of hand-rolled caches. Verified inventory of that constellation:

| Mechanism | Location | What it hand-encodes |
|---|---|---|
| `specDimKey` fingerprint | `engine/specDimKey.ts` | *which dims a spec depends on* |
| `varsKey = JSON.stringify(ctx.vars)` | `useNodeRows.ts:88` | *that vars are dependencies* (added as a bugfix, AR-36 staleness) |
| `recipeKey` stable-stringify of data+transforms | `useNodeRows.ts:140` | *node identity* (added as a bugfix — N34c promise-cache collision: two siblings sharing one covering fetch were served each other's rows) |
| `cacheKey = recipe⊕dep⊕storeKey` + module-level promise Map | `useNodeRows.ts:144,49` | *the derivation cache* (with LRU-by-FIFO eviction) |
| `_storeCache` WeakMap of CachedStores | `resolveNodeRows.ts:52` | *store-level memo* |
| `warm.ts collectRequirements` walk | `targets/warm.ts` | *the same dependency analysis, re-implemented for prefetch* — with the standing warm≠render drift class (SPEC-render-pipeline-target C2) |
| `useChartOutput` useMemo dep list | plugins chart panel | *per-output derivation* |

**This is a dependency graph, built ad hoc, as string keys, scattered across opt-in hooks.** Each entry above exists because the platform *needed* graph semantics and derived them by hand — and two of them are patches over shipped bugs (N34c collision; AR-36 vars staleness), while a third (warm vs render) is a permanently-guarded drift vector (`FF-WARM-COVERS-RENDER` exists to police what a single mechanism would make structurally impossible). When an architecture keeps growing shadow copies of the same missing abstraction, the root cause is the missing abstraction (Law 6).

**Verdict:** not "rebuild the renderer" — **two planes confirmed close-to-best; one plane redesigned.** The genuinely-best architecture keeps the grammar and the interpreter/registry skeleton, **reifies the data plane as a first-class reactive query graph compiled from the config**, and completes the target plane with one static chart emitter. That is a substantial change (the render topology changes at V3), but it is the honest size — bigger would be big-for-big's-sake, smaller would leave the bug-generating shadow graph alive.

---

## 2. The study — how the best render (expert distillation; no live web, uncertainty marked)

| System | Rendering model | The lesson we take / reject |
|---|---|---|
| **Vega / Vega-Lite** | Declarative spec **statically compiled to a reactive dataflow graph** (operators, pulse propagation); signals drive scales/marks; renderer (SVG/Canvas) is a swappable backend | **The core insight we adopt:** *because the spec is declarative, the dependency graph is derivable by static analysis — never hand-wired.* We apply it at **dashboard scale**, not chart scale. We do NOT adopt the runtime (§6: dual-state-store hazard, scope mismatch) |
| **Grafana Scenes** | Retained object graph of state nodes (`$timeRange`, `$variables`, `SceneQueryRunner`); panels **subscribe to exactly their dependencies** (RxJS); variable change → only referencing queries re-run | **Our quadrant's reference solving our exact problem** — but its graph is *hand-assembled in code*. Ours can be **compiled from config** (our grammar is fully declarative; theirs is programmatic). That is the "nobody else has this" edge |
| **SolidJS / Preact Signals / MobX** | Fine-grained reactivity: sources + derivations + effects; pull-based lazy recompute, push invalidation, glitch-free via topological ordering | **The runtime mechanics canon** for the graph engine: lazy derivations, exact invalidation, no zombie updates. Adopt the *semantics*, in-house and framework-free (core layer cannot take a view-framework dep — Law 3) |
| **React (current)** | Retained element tree + reconciliation; coarse top-down invalidation; Suspense for async | **Keep as the DOM realizer** — world-class reconciler, a11y-capable DOM, Suspense/ErrorBoundary already load-bearing in renderNode. Its *invalidation grain* is what the graph fixes; its *realization* is not worth rebuilding (NIH) |
| **Elm / MVU** | `Msg → update → Model → view`, single state atom, unidirectional | Already ours in substance: CommandBus (`filter:set`…) = Msg; URL params + perspectiveState = Model (permalink, Law 9); pure `render(config, state)` = view. **Name it and keep it** — the graph slots in as the *derived-state* layer of the same loop, never a second state store |
| **SwiftUI / Flutter** | Declarative `view = f(state)` over a retained tree; framework tracks per-view dependencies (`@Published`/`markNeedsBuild`) and re-renders only dependents | Confirms the direction: declarative surface + **fine-grained invalidation underneath** is the end-state every mature declarative UI system converges on |
| **Figma** | Immediate-mode GPU scene graph, custom text/raster pipeline | **Rejected for our quadrant:** statistics-grade output needs real DOM — WCAG 2.1 AA (Law 9), text selection/zoom, screen readers, SSG/SEO (AR-28). GPU canvas is for infinite-canvas editors, not published statistics |
| **Observable Plot** | **Stateless pure function: spec + data → SVG element**, no runtime retained | **The exact model for the static chart emitter** (§5): `ChartOutput → SVG string`, pure, server-runnable — chart pixels for html/pdf/export targets |
| **ECharts / Plotly** | Option-object diffing over canvas/WebGL retained scene | Alternative chart *strategy* candidates behind the existing registry — proof the seam is right, not new architecture |
| **D3** | Imperative data-join; maximal control, zero declarativity | The layer *under* emitters/strategies, never the platform surface (Law 2) |
| **Builder.io / Puck / Plasmic** | Component-per-node registry render trees; coarse React reactivity; data-binding shallow | We already **exceed** them on plane 2 (validation, migration, error isolation, multi-target) and plane 3 is where none of them lead — they are content builders, not data platforms |
| **TanStack Query** | Derived async state keyed by serialized query keys, staleness + dedup | The *canonical form of what `useNodeRows` hand-rolls* (its `cacheKey` IS a query key). Rejected as a dependency (React-tier, wrong layer, cache-semantics-not-graph-semantics) but validates the keyed-derivation design |

**Distillation — the three-plane convergence.** Every mature system separates: (1) a **declarative grammar** stating intent; (2) a **reactive dataflow** that knows exactly what depends on what (Vega compiles it; Scenes hand-builds it; Solid tracks it at runtime; Flutter tracks it in the framework); (3) **pluggable realizers** turning resolved state into pixels per target (Vega's SVG/Canvas, Grafana's panel plugins + image renderer, Plot's pure SVG). No leader merges plane 2 into plane 3's framework reconciler *at scale* — coarse re-render + caches is the adolescent stage of every one of these systems, and each graduated by reifying the graph.

**Our unification (the architecture nobody else has):** Vega proves the graph can be *compiled from a declarative spec* — but only for one chart. Grafana Scenes proves the graph works at *dashboard scale* — but hand-wired imperatively. **We hold both preconditions at once: a fully-declarative dashboard-scale grammar (Law 2, no functions, every dependency a named `$ctx`/`$ref`/template token) — so we can compile the dashboard-scale dataflow graph from config.** That is the synthesis: **Vega's compilation move, at Grafana's scale, over our grammar, realized through React.**

---

## 3. The design — three planes, one law each

```
  PLANE 1 · GRAMMAR (SSOT)             PLANE 2 · REACTIVE QUERY GRAPH          PLANE 3 · REALIZERS
  NodePageConfig                        compilePage(config) → QueryGraph        renderNode pipeline (kept)
  DataSpec·Encoding·Transforms          sources:  params · perspective ·        ├─ dom    → React shells (kept)
  ChartDef · vars · visibleWhen                   locale · theme · stream        ├─ html   → React static (kept)
  on[] / FilterAction (AR-36/42)        derived:  vars → scopedCtx →            │            + SVG chart emitter (NEW)
        │                                          rows/node → ChartOutput      ├─ pdf    → html + emitter (kept seam)
        │  static analysis                         (lazy, memo, async-capable)  ├─ api    → data JSON (kept)
        └─ extractDeps(config) ─────────► edges = every $ctx/$ref/template ref  └─ chart strategies: Apex (kept),
                                          invalidate exactly; subscribe per node    static-svg (NEW), vega-lite/echarts (optional)
```

- **Law of plane 1:** the config is the only grammar; it names every dependency explicitly (Law 2 already guarantees this — it is what makes plane 2 compilable).
- **Law of plane 2:** *one* dependency graph, compiled from config, owning all derivation, caching, invalidation, warming, and streaming. No second cache, no string-key shadow.
- **Law of plane 3:** realizers are strategies over neutral IR (`ResolvedNode` state + `ChartOutput`); adding a target or chart backend is a registration, never an engine edit (already the design intent — now with the static emitter making it true for every target).

### 3.1 Plane 2 in full — the Reactive Query Graph (the substantive change)

**Residence:** `packages/core/src/graph/` — framework-free, pure TypeScript (the arrow forbids core→react anyway; this is a feature, not a constraint: the graph is target-agnostic by construction and serves SSR/SSG/api/warm identically).

**Node kinds** (closed set; each is today's code, re-homed as a derivation):

| Graph node | Today's incarnation | Derivation body |
|---|---|---|
| **Source: param** | URL filter state (`useFilter`) | written ONLY via CommandBus (`filter:set`/`setMany`/`perspective:set`) — the MVU write point, unchanged (AR-42 plugs in here untouched) |
| **Source: perspectiveState / locale / theme / auth** | SiteRenderer memos | direct sources |
| **Source: stream** | `useNodeStream` subscribe/polling | `store.subscribe()` push or timer → source write |
| **Derived: vars** | `evalVarMap(page.vars)` | pure eval; depends on the params it references |
| **Derived: scopedCtx** | `scopeCtxByPerspective` + SectionContext assembly | per-page (and per-node when `view.scope` overrides) |
| **Derived: rows(node)** | `resolveNodeRows` body (interpretSpec → encoding-ref lowering → applyEncoding → blend desugar → applyPipeline → resolveRowLocales) | **unchanged logic, one call site** — the graph wraps it, never forks it |
| **Derived: output(node)** | `useChartOutput` (interpretChart → ChartOutput) | optional second stage; gives ChartOutput-level memo + makes the serializable IR available to non-DOM targets |

**Compilation — `compilePage(config): QueryGraph`.** Walk the tree (the `nodeWalk` walker exists); for each data-bearing node run **`extractDeps`** — the generalization and SSOT-ification of what exists in fragments: `specDimKey` (dims a spec reads) ∪ every `$ctx`/`$ref` occurrence in encoding/pipe/transforms/chartType/vars (the AR-36 scanner surface) ∪ template `{token}` refs in display fields ∪ the storeKey cascade (`effectiveStoreKey`) ∪ locale. **Static analysis is total because Law 2 forbids functions in config — every dependency is a named ref.** This is the platform's structural advantage: Vega must compile a chart spec; Grafana cannot compile at all (programmatic scenes); we compile a *dashboard*.

**Runtime semantics** (signals canon, in-house, small — estimated low-hundreds of lines):
- **Pull-based lazy** derivations with **push invalidation**: a param write marks dependents dirty (topological, glitch-free — no intermediate inconsistent reads); recompute happens on demand (render or warm), memoized until a dependency actually changes (value-equality cut-off, so writing the same value is a no-op).
- **Async-capable:** a rows-node over a `caps.sync===false` store holds `rows | Promise<rows>`; the React adapter suspends via `use()` — exactly today's Suspense integration, minus the module-level promise Map, minus its LRU, minus its collision class (graph nodes are *per config node* — identity is structural, N34c-class collisions become unrepresentable).
- **Visibility-pruned:** a node hidden by `visibleWhen` in the active perspective is an inert subgraph — not evaluated, not warmed (the `visibilityGate` law, now one mechanism for live/warm/SSR instead of three call sites).
- **React adapter** (`packages/react`): `useGraphRows(nodeId)` = `useSyncExternalStore` subscription + `use()` for async. Shell boundaries (`ShellWrapper` — already a component per node) subscribe to *their* graph node; `NodePageRendererInner` stops rebuilding the world per keystroke of state.

**What the graph subsumes (the DRY collapse — each row deletes a mechanism):**

| Subsumed | How |
|---|---|
| `useNodeRows` cacheKey/promise-cache/LRU | graph node identity + memo (delete `_promiseCache`, `nodeRecipeKey`, `varsKey`) |
| `specDimKey` | `extractDeps` (kept as an alias during migration) |
| **warm pass** (`warm.ts`, C2's entire drift class) | **warm = cold evaluation of the same graph** (`graph.evaluate({until: rows})` with no realizer). Warm===Render stops being a policed invariant and becomes the *same code path* — `FF-WARM-COVERS-RENDER` still runs, but can no longer fail for drift reasons |
| `useNodeStream` + polling | stream/timer source nodes; panels don't choose a different hook — the graph node's source kind decides |
| cross-filter reactivity (AR-36/38/42) | READ side: selection param → graph propagation (already the design — "selection IS a filter param"); WRITE side: `useNodeInteractions` → CommandBus, byte-identical to the AR-42 spec. The graph makes the READ side *exact*: a 2-region select re-evaluates precisely the nodes whose deps include `geo` |
| Constructor live preview | config edit → incremental recompile of the touched subgraph → surgical update. **This is the authoring payoff:** the canvas re-renders one panel per keystroke, not the page — the M-series Studio's scaling precondition |
| ApiStore network era | exact invalidation = minimal refetch set; the graph's requirement set (per node, per state) IS the batch-prefetch plan (one HTTP call per state change, planned, not discovered) |

**What the graph is NOT:** not a second state store (sources are the *same* URL params/perspective state — Elm loop intact; the graph is the derived-state layer); not an event bus (EventBus/CommandBus unchanged); not a scene graph replacing React; not visible in config (zero grammar change — the graph is compiled *from* the grammar).

**Determinism preserved:** `render(config, state)` remains referentially transparent — the graph is the renderer's internal memoization made explicit and correct. Same config + same source values ⇒ same graph values ⇒ same UI. `FF-RENDER-DETERMINISTIC` (AR-28) unaffected; SSR/SSG evaluate the graph synchronously over warm stores exactly as `renderPageToHTML` resolves today.

### 3.2 Plane 3 completed — the target abstraction's missing half

1. **Keep `renderNode`'s 12-step pipeline as the realizer front-end.** One seam changes: step 2 (`resolveNodeRows` inline / `useNodeRows`) delegates to the graph. Steps 0–1.5 and 3–7.5 (migrate, validate, RBAC, middleware, slots, boundaries) are untouched — study 1 already ruled them reference-grade.
2. **`ChartEmitter` — the static strategy (NEW, additive, high-value):** a pure function `emit(output: ChartOutput, opts: {locale, theme, fonts}) → string /* SVG */` — the Observable Plot model. Registered beside DOM strategies (the registry grows a `mode: 'dom' | 'static'` facet or a sibling `chartEmitterRegistry` — decide at ADR-024 by ISP taste). Consumed by: `html` target (charts render as real SVG in snapshots — closes AR-28's admitted gap and upgrades its §3 "no-JS" row from 🟡 to ✅ for charts), `pdf` (same HTML in), `data:export` image formats, AR-48 embed/snapshot, and SSG chart pixels when AR-28 §7.2 triggers. `ChartOutput` was *designed* serializable for exactly this ("swap ApexCharts → change apexAdapter only" — charts/types.ts header); the emitter is that promise kept.
3. **ApexCharts = confirmed as ONE strategy** (it already is, mechanically). Optional additional DOM strategies (`vega-lite`, `echarts`) stay YAGNI-gated proofs — register-only, no engine change; do not build without a consumer.
4. **Rejected: a React-free retained scene graph of our own** (SwiftUI-style). React already is the retained tree + reconciler + a11y DOM + Suspense; owning that layer is NIH with negative value in our quadrant. The framework-independence that *matters* (data plane, chart IR, resolution pipeline in core) is exactly what planes 1–2 and the emitter give us — `packages/react` remains a thin adapter, which is the Clean-Architecture shape of "pluggable view framework" without paying for a second implementation.

### 3.3 Plane 1 confirmed — grammar decisions

- **Do NOT adopt Vega-Lite as the platform grammar/runtime.** Three grounds: **(i) scope** — VL models one visualization; our grammar is page-scale (sections, KPI strips, pivot tables, choropleth+codelist joins, perspectives, i18n LocaleString, SDMX/OLAP dims) — none of which VL carries; **(ii) state sovereignty** — the Vega runtime owns its signal state internally; our SSOT is URL params (permalink = Law 9) + SectionContext through one CommandBus. Embedding Vega means two reactive worlds bridged at every interaction — the exact dual-source-of-truth anti-pattern AR-42 refused with SelectionContext; **(iii) the field** — Grafana/Superset/Metabase all converged on neutral-data-frame + panel plugins, not embedded Vega, for this same reason. **Law 4 honesty:** the *full benefit* of Grammar of Graphics is its concept set — mark/encoding/scale/transform/**selection** — which the grammar already carries and AR-36 completes (state-bound channels = GoG selection semantics). Adopting VL's *runtime* would trade our integration for its chart-locality: less standard-whole, not more. A registered `vega-lite` chart strategy remains the honest way to honor VL where it is strong (per-chart), gated on a real consumer.
- **MVU named and kept:** CommandBus (Msg) → params/perspective (Model) → graph (derived state) → realizers (view). The graph slots into the existing loop; nothing about write-paths changes.
- Grammar deltas riding this spec: **none required.** (AR-36's `CtxRef` widening and AR-42's `on[]` adapter proceed independently; the graph consumes them.)

---

## 4. Migration — Strangler-Fig, phased, measured, reversible until V3-contract

| Phase | Work | Gate / proof | Reversibility |
|---|---|---|---|
| **V0** | **ADR-024** + fitness scaffold (§7, landing red) + **baseline measurements**: per-state-change resolve counts, re-render counts, interaction latency on the geostat corpus (the honesty gate — see below) | numbers recorded | trivial |
| **V1** | **`extractDeps` in core** — SSOT of dependency identity (generalizes `specDimKey` + AR-36 ref-scanning + storeKey cascade + locale). `useNodeRows` keys re-derived FROM it (aliases). Standalone value: deletes the cache-key fragility class even if we stopped here | `FF-DEPS-COMPLETE` green; `useNodeRows` byte-identical behavior | full |
| **V2** | **QueryGraph engine + `compilePage`** in core; **shadow mode** — graph evaluates alongside the legacy path, results diffed in dev/CI, no render consumption | `FF-GRAPH-PARITY` (graph rows ≡ legacy rows over the provisioning corpus × perspectives × locales) | full (flag off = zero effect) |
| **V3** | **Render-path switch** — renderNode step 2 + shells consume the graph via `useGraphRows` (useSyncExternalStore); per-node invalidation live. Golden-DOM corpus locked before/after. Legacy inline path kept behind the flag through a soak window | golden-DOM identical; interaction-latency ≤ baseline; then **contract**: retire inline `resolveNodeRows` call-site + `_promiseCache` | expand fully; **contract = the one-way door (D-RRA-2)** |
| **V4** | **Subsume warm/stream/poll** — `warm.ts` walks the graph (delete `collectRequirements`' parallel walk); stream/timer sources replace `useNodeStream` internals; C2's drift class closes structurally | `FF-WARM-IS-RENDER` (same graph object serves both); existing warm tests green | staged |
| **V5** | **Static SVG `ChartEmitter`** + registration into html/pdf/export/embed targets (independent of V2–V4 — can land any time after V0) | snapshot tests: `emit(ChartOutput)` deterministic SVG; html target renders chart pixels | full (additive) |
| **V6** | *(optional, YAGNI-gated)* extra chart strategies (vega-lite / echarts / canvas-PNG); Constructor incremental-recompile fast path | a named consumer exists | — |

**Honesty gate (V0):** today's pages are dozens of nodes over in-memory stores — coarse re-render is likely *not* a user-visible latency problem yet. The graph's case does **not** rest on today's frame times; it rests on (a) the shipped-bug record of the shadow graph (N34c, AR-36 staleness) and the standing C2 drift class — correctness-by-construction; (b) the Constructor-era load profile (live editing, per-keystroke updates) and the ApiStore network era (exact invalidation = planned prefetch), both roadmapped; (c) 60fps cross-filter interaction (AR-36/38) on the owner's core-expectation path. If V0's baseline plus the owner's roadmap weighting ever says otherwise, the honest fallback is **V1 + V5 only** (dependency SSOT + chart emitter) — both carry standalone value. I recommend the full sequence: the bug class is real and recurring, and V2–V4 are each individually gated and parity-proven.

**Big/one-way steps, flagged plainly:** V3's *contract* is the only one-way door — after it, per-node subscription is the render topology and the inline path is gone. Everything before it is flag-reversible; everything after it (V4–V6) is additive. V2's in-house engine is a *commitment* (we own ~small reactive core rather than adopting a lib) but not a door — it is deletable while shadow-mode.

---

## 5. Relation to study 1 and the paused work

- **Object model (One Type System, Two Residences) — unchanged; mutually reinforcing.** Graph nodes are addressed by study-1's spine (`documentId, nodeId`); residence is orthogonal (value-band items have no graph nodes — their host node does). The **kpi-card promotion (R2/D-ROM-2)** gets stronger: each promoted card is a leaf data node = its own graph node ⇒ per-card exact reactivity and per-card warm for free — the graph is the runtime that makes the promotion *cheap*, and the promotion is the object model that makes the graph *fine-grained*. Build order flexible (neither blocks the other); R2 after V3 gets the full payoff immediately.
- **Placement Law / `SPEC-studio-shell-layout.md` — unaffected** (style/layout plane; no data-flow assumption). Unpause verdict from study 1 stands.
- **AR-28 (CSR/SSG topology) — confirmed and served:** the graph is framework-free and synchronously evaluable ⇒ SSG/`renderPageToHTML` unchanged in shape; V5 upgrades every static target with chart pixels — strengthening AR-28's §7.2 north-star.
- **AR-42 cross-filter WRITE adapter — proceeds unchanged;** the graph is its READ-side completion.
- **SPEC-render-pipeline-target (C1–C7)** — C2's warm-contract guard is subsumed at V4 (kept as a fitness function, made unbreakable-by-construction); everything else orthogonal.

## 6. ADR core — alternatives rejected (≥2)

- **ALT-A — Adopt Vega/Vega-Lite as grammar + runtime** (the strong reading of the lead's hypothesis). **Rejected:** scope mismatch (chart-local vs page-scale), dual state stores (Vega signals vs URL-param SSOT — breaks permalink Law 9 and the MVU loop), loses SDMX/OLAP/i18n/provenance integration, and the field's dashboard leaders all declined the same move. We take Vega's *compilation insight* whole — which is the Law-4-honest reading.
- **ALT-B — Status quo plus more caches.** **Rejected:** the shadow graph has a shipped-bug record and a growth vector (every new binding surface — AR-36 marks, AR-40 metrics, streaming — adds another hand-tuned key). Symptom-patching a missing abstraction (Law 6).
- **ALT-C — Adopt a reactive library** (RxJS à la Grafana Scenes / preact-signals / TanStack Query). **Rejected:** RxJS = push-stream semantics at the wrong grain + heavyweight; preact-signals = view-framework tie inside `packages/core`; TanStack = React-tier and cache-semantics-not-graph-semantics. The needed engine is small, pull-lazy, topological, zero-dep — owning it costs less than bending any of these (and core cannot take view deps, Law 3).
- **ALT-D — Own retained scene graph + custom realizers (drop React).** **Rejected:** NIH; React IS the retained realizer with a11y DOM, Suspense, and our entire shell/plugin ecosystem; framework-independence where it matters is delivered by planes 1–2 + the emitter.
- **CHOSEN:** Grammar (kept) → **config-compiled Reactive Query Graph** (Vega's move at Grafana's scale, signals semantics, in-house core) → realizers completed with the **static ChartEmitter** (Observable Plot model), React confirmed as DOM realizer, Apex as one strategy.

## 7. Fitness functions

- **FF-DEPS-COMPLETE** — every `$ctx`/`$ref`/template-token occurrence in a config maps to an `extractDeps` edge (scanner over the provisioning corpus; a binding surface with no edge = red).
- **FF-GRAPH-PARITY** — shadow-mode graph rows ≡ legacy rows across corpus × perspectives × locales (V2 gate).
- **FF-EXACT-INVALIDATION** — writing param P re-evaluates exactly the nodes whose dep-set contains P (counted, not sampled); writing an equal value re-evaluates zero.
- **FF-ONE-DERIVATION-PATH** — after V3-contract: no module-level promise/row cache outside `core/graph` (grep gate on `_promiseCache`-class patterns).
- **FF-WARM-IS-RENDER** — warm pass and render read the same graph instance (V4; supersedes-by-construction FF-WARM-COVERS-RENDER, which stays as the regression tripwire).
- **FF-EMITTER-DETERMINISTIC** — `emit(ChartOutput)` is a pure function: same output+opts ⇒ byte-identical SVG (Node, no DOM).
- **FF-RENDER-DETERMINISTIC / FF-RENDERER-ISOMORPHIC** (AR-28) — inherited, must stay green through every phase.

## 8. Owner decisions / one-way doors

- **D-RRA-1** — adopt the three-plane target + build V0–V2 (rec: **yes**; flag-guarded, parity-proven, zero grammar change).
- **D-RRA-2** — V3 render-path contract (per-node subscription becomes THE topology; inline path retired). **The one-way door.** Rec: yes, after golden-DOM + latency gates green and a soak window.
- **D-RRA-3** — build V5 ChartEmitter now (rec: **yes** — independent, additive, unlocks AR-48 embed/export images + AR-28 no-JS/SSG chart pixels; the cheapest high-visibility win in this spec).
- **D-RRA-4** — in-house graph engine vs library (rec: **in-house**, per ALT-C; revisit only if the engine's scope creeps past derivation+invalidation).
- **D-RRA-5** — optional chart strategies (vega-lite/echarts) (rec: **defer, YAGNI** — registry seam already proven by Apex + emitter).

## 9. Where I agreed / departed from the lead's hypothesis

**Agreed:** (1) the data-plane diagnosis — coarse React reactivity patched by caches is the real architectural debt, and a **reactive dataflow runtime is the answer**; (2) the **pluggable target** direction — with the correction that the seam already exists (`ChartRendererRegistry` + serializable `ChartOutput`) and the work is *completing* it (static emitter), not creating it; (3) Apex as one strategy — already mechanically true, now made true for non-DOM targets.
**Departed:** (1) **"Grammar-of-Graphics/Vega-Lite as the SSOT" is over-strong** — the config already *is* the SSOT grammar with GoG's concept set (AR-36 completes selection); adopting Vega's *runtime* would split state sovereignty and shrink scope to chart-locality (ALT-A). We take Vega's deeper gift instead: **the spec-to-dataflow compilation move, applied at dashboard scale** — which no reference platform has, because none has a fully-declarative dashboard grammar to compile. (2) **Fine-grained signals: yes, but as compiled-from-config graph semantics in core, not a view-framework signals library** — Solid's mechanics, Vega's derivation, our grammar. (3) The render *pipeline* and shell/registry model needed no redesign — the hypothesis' "React-component-per-node" framing undersold plane 2, which is reference-grade; only its step-2 data seam moves.

**The honest size:** between "close to current" and "big redesign" — planes 1 and 3 confirmed near-best (kept, completed), plane 2 substantively rebuilt with one one-way door, phased and parity-gated throughout. That is the best result, not the biggest one.
