# Board 01 — ENGINE & DATA-PIPELINE (`platform/packages/{core,expr,contracts}`)

> Senior deep-analysis board. Highest platform concept: **a declarative, config-as-SSOT, framework-agnostic data engine** — DataSpec → interpret → DataRow, with ports & adapters, OCP via discriminated-union registries, and a semantic layer. **Code is ground truth** — every claim below is verified against source at the cited file:line (docs were skimmed for intent only). Analysis only; no product code changed.

Legend: ✅DONE · 🟡PARTIAL · ⛔NOT-DONE · 🆕GAP(unplanned, I identified it). Class: **M** = Class-M public API / data layer (architect-gated). Door: one-way = hard to reverse.

---

### [ENG-01] DataSpec union + `interpretSpec` dispatch (Interpreter + Strategy)
- **Status**: ✅DONE
- **Evidence**: `core/src/config/data-spec.ts:133-190` (union); `core/src/data/spec.ts:53-80` (`interpretSpec`); `core/src/registry/resolvers.ts:348-355` (7 resolvers registered); `core/src/registry/engine.ts` (registry).
- **What & why**: The central data-query vocabulary — 8 discriminants (`query` · `row-list` · `timeseries` · `growth` · `ratio-list` · `pivot` · `transform` · `custom`) resolved by a registry of `SpecResolver` strategies, **no switch**. This is the spine: every chart/table/kpi/panel binds through this one entry point. New spec type = `registerSpec()`, interpreter unchanged (true OCP, Law 8).
- **Critical analysis**: Genuinely clean. `interpretSpec` desugars first then dispatches (one resolution path). 100% JSON-serializable — verified no functions on any branch **except** `custom.fn: string` (a *named* fn — still serializable, see ENG-16). One subtlety: `_specTag` (spec.ts:83) hardcodes a `switch` over types for observability — harmless (logging only) but it is the one place that re-enumerates the union outside the registry; a 9th type silently falls to `default`. Not debt, but a coupling smell.
- **Reference platforms**: Vega-Lite `transform[]` + `mark`/`encoding` is the closest analogue; **Grafana** dispatches `DataQuery` by `datasource.type`; **Cube** has `load(query)` with measures/dimensions/filters/timeDimensions. We **beat** Vega-Lite by making the query itself a closed, Constructor-browsable discriminated union (Vega-Lite's transform is open-ended JSON with weaker authoring affordances). We are **behind Cube** in that our `query` carries raw SDMX codes, not a named semantic model (ENG-05).
- **Foresight**: 1-2yr the union grows (e.g. `cube`, `compare`, `funnel`). Multi-tenant: each tenant adds resolvers at bootstrap without forking core. The door this opens: a **spec-type capability manifest** (`SPEC_CATALOG`, `spec-catalog.ts`) already drives the Constructor — keep it the single SSOT.
- **Plan**: (1) Replace the `_specTag` switch with a registry-provided `tag?(spec)` hook so the union is enumerated in exactly one place. (2) Add a fitness test asserting `DATASPEC_DISCRIMINANTS` (already exported) === registered resolver keys ∪ {custom}. Files: `spec.ts`, `registry/engine.ts`. Effort S · two-way door · Class M · **P2**.
- **Raises-the-bar**: a registry that owns *behavior + authoring schema + observability tag* per discriminant is stronger ISP than any reference platform's type-switch.

---

### [ENG-02] desugar seam (convenience spec → primitive)
- **Status**: 🟡PARTIAL (by design, but the smallest possible footprint)
- **Evidence**: `core/src/data/desugar.ts:94-99` — `switch` desugars **only** `pivot`; everything else returns unchanged. `resolvers.ts:316-328` `PivotResolver` is now a thin delegate.
- **What & why**: ADR R3 / fault-line F-A: lower convenience discriminants to the two orthogonal primitives (`query`·`transform`) so the engine resolves ONE primitive set. Strangler-Fig toward "few primitives, many sugars."
- **Critical analysis**: This is the **most honest partial on the board** and also the most stalled. The docblock (desugar.ts:14-19) admits `timeseries`/`growth`/`ratio-list` cannot desugar because their equivalence needs a **store-port primitive the pipe cannot express** (val-cell reads / per-year `storeVal`). So 3 convenience specs keep bespoke resolvers (`resolvers.ts:182-266`) that re-implement year iteration, growth math, and ratio math **outside** the transform vocabulary. That is duplicated semantics (e.g. growth's `(cur/prev-1)*100` exists only in `GrowthResolver`, unreachable to a Constructor pipe). The real blocker is the **store doesn't expose a declarative "val at (code, dims)" pipe step** — once it does, these collapse.
- **Reference platforms**: **Malloy** and **dbt** lower *all* sugar to one IR (SQL); **Vega-Lite** compiles to full Vega. We are mid-Strangler. **dbt** is the model: macros expand to one primitive SQL — no second execution path.
- **Foresight**: Until the store-port gap closes, each new convenience spec risks a 4th bespoke resolver. The door: a **`valAt` transform step** (declarative point-read against the pipeline's `PipelineContext.section`+store) would let growth/timeseries/ratio-list desugar to `query`+`derive`+`window`, retiring 3 resolvers.
- **Plan**: P1 escalate to architect (store-port primitive = Class-M data-layer design). P2 prototype `valAt`/`lag` window-step coverage for `growth` behind FF-DESUGAR-EQUIV (`desugar.fitness.test.ts` already the harness). Files: `transform/ops/window.ts`, `desugar.ts`, `store.ts` (`StoreQuery`). Effort L · two-way door · Class M · **P2**.
- **Raises-the-bar**: collapsing to one primitive set means the Constructor's pipe editor *is* the full vocabulary — no hidden bespoke math.

---

### [ENG-03] Transform-step registry + pipeline (OCP op dispatch)
- **Status**: ✅DONE
- **Evidence**: `transform/step-registry.ts:32-57` (register/lookup/list + authoring schema per op); `transform/index.ts:38-67` (19 built-in ops register handler **and** PropSchema); `transform/pipeline.ts` (`applyStep` dispatches only via registry).
- **What & why**: The Grafana/Malloy/Cube transform pattern done right — every op is `registerTransformStep(op, fn, schema?)`: ONE line adds a runtime handler **and** its Constructor editor. `listTransformOps()` is the catalog SSOT. 19 ops incl. `melt/rollup/window/reduce/join/lookup/derive`.
- **Critical analysis**: Strong. The op = SSOT for behavior + editor is best-in-class. The visible coverage gap is honest: `joinByField` is intentionally **schema-less** (carries pre-resolved rows → not author-friendly) and stays in COVERAGE_TODO (index.ts:56-58). `blend` carries a schema but a **no-op identity handler** in core (index.ts:42-48) — the real join happens in react (ENG-07). So `listTransformOps()` includes an op core cannot actually execute — a leaky abstraction that a fitness test should pin ("every registered op either executes in core OR is documented react-desugared").
- **Reference platforms**: **Vega-Lite transforms** (closed set, compiler-owned) vs **Grafana transformations** (registry, pluggable — our closest match) vs **Malloy** (typed pipe). We **beat** Grafana by co-locating the authoring schema with the handler (Grafana's transform editors are bespoke React).
- **Foresight**: Plugins register tenant-specific ops with zero core change. Door: a **typed op** (declared input/output FieldSchema per op) → ENG-NEW spec-typing.
- **Plan**: Add fitness `transform-op-executability.fitness.test.ts`: assert each `listTransformOps()` op has a non-identity core handler unless on an explicit `REACT_DESUGARED_OPS` allowlist (`['blend']`). Files: new test, `transform/index.ts`. Effort S · two-way · Class M · **P3**.
- **Raises-the-bar**: keeps the catalog honest — no phantom ops.

---

### [ENG-04] `$`-ref resolution taxonomy (`resolveRef`, ADR R4)
- **Status**: ✅DONE
- **Evidence**: `core/src/ref/ref.ts:40-136` — 5 scopes (`ctx`/`param`/`row`/`var`/`dim`), `refScope()` discriminator, ONE `resolveRef` dispatcher; `ref.fitness.test.ts`.
- **What & why**: Collapses the pre-R4 five `$`-vocabularies / four evaluators / one `$ctx` **name collision** into one taxonomy with non-colliding tokens and one home. Used by store-filter, resolvers, links, codelist, filter-derive (Strangler-Fig). This is "one home per datum" on the reference axis.
- **Critical analysis**: Clean and load-bearing. Two correct-but-worth-noting boundaries: (1) **`ExprRef` (expr package) stays separate** by the dependency arrow (`expr/src/types.ts:11-12`) — `$`-refs in DataSpec vs `ExprRef` in derive expressions are deliberately two systems; the comment in ref.ts notes this. A newcomer could conflate them. (2) `resolveRef` is sync/never-throws, missing key → `undefined`; the `$ne` (not-equal) and multi-value cases are handled *outside* `resolveRef` in `resolveFilterForReqs` (resolvers.ts:122-135) — so the "one dispatcher" claim has a satellite for negation/enumeration. Defensible (those are filter-predicate semantics, not ref-resolution) but it means ref logic lives in 2 files.
- **Reference platforms**: **Looker** `${}` Liquid/lookml refs, **dbt** `{{ ref() }}`/`{{ var() }}`, **Grafana** `$var`/`${var:format}`. All have multiple ref namespaces; few have a single typed dispatcher with a closed scope-token set. We **beat** Grafana (whose variable interpolation is string-templating with format suffixes, untyped).
- **Foresight**: New scope (e.g. `$secret`, `$session` for multi-tenant auth-scoped values) = one case + one service field. Door: ref-scope **provenance** (which scope a cell's value came from) for debuggability.
- **Plan**: (1) Doc-card or type-level brand making `ExprRef` ✗ assignable to `Ref` explicit. (2) Consider folding `$ne` enumeration into a `resolveFilterValue` that *wraps* `resolveRef` so ref.ts stays the only ref-aware module. Files: `ref/ref.ts`, `registry/resolvers.ts`. Effort S · two-way · Class M · **P3**.
- **Raises-the-bar**: a closed, exhaustively-tested scope union beats every reference platform's stringly-typed interpolation.

---

### [ENG-05] Semantic layer — `MetricDef` / `MetricRegistry` (the named-measure model)
- **Status**: 🟡PARTIAL — **fully shipped, ZERO consumers in production**
- **Evidence**: `core/src/data/metric.ts:16-190` (MetricDef, registry, `resolveMeasureRef`, `withMetricProvenance`); wired at the boundary in `resolvers.ts:60-81` (`resolveQueryMeasures`) + `spec.ts:128-161`. **No `registerMetric(...)` call exists in any app/plugin** — verified: only hit is a *comment* in `apps/api/scripts/seed-units.ts:5` referencing a `apps/geostat/src/data/metrics.ts` that **does not exist** (`apps/geostat/src/data/` has no metrics.ts).
- **What & why**: The Cube/Looker semantic layer in miniature: a measure ref in config is EITHER a raw SDMX code (Postel: passes through byte-identical) OR a registered metric-id that expands to code(s) + governance (unit, methodology, default dims, agg, `dataSource`). This is the single biggest *latent* lever on the platform — it is the seam that turns "stringly-typed codes everywhere" into "named, governed metrics."
- **Critical analysis**: The architecture is correct and the wiring is real (every binding path routes through `resolveMeasureRef`, FF-RAW-CODE-IDENTICAL proven). **But because zero metrics are registered, the entire governance half (unit/methodology/dims/agg/dataSource) is dead weight at runtime** — provenance badges (Law 9) that *could* come from metrics instead come from store metadata only. This is the classic "built the cathedral, no congregation." The risk: the seam bit-rots / drifts from real needs because no config exercises it. `resolveMeasureRef` first-metric-wins governance (metric.ts:143-151) is untested against real multi-metric arrays in prod.
- **Reference platforms**: **Cube** `cubes/measures` (sql + format + meta), **Looker** LookML `measure:` / `dimension:`, **Malloy** `measure:`/`dimension:` in a source, **dbt metrics/MetricFlow**. All center the named metric; **we are the only one with the seam but no models**. Where we can **beat** them: our MetricDef is 100% JSON (Constructor-authorable) — Cube/Looker/Malloy require code (`.js`/`.lkml`/`.malloy`). A no-code semantic layer is a genuine differentiator **if we populate it**.
- **Foresight**: This is the multi-tenant keystone — each tenant's metric catalog *is* their semantic model. 1-2yr: metric hierarchy (`parent`), drill-down, cross-store routing (ENG-06) all hang off this. Without adoption the platform stays code-coupled.
- **Plan**: **P1.** (1) Author a real `MetricDef` catalog for geostat (the GDP/B1G measures) behind a `registerMetric` bootstrap — start with 5-10 metrics carrying `unit`+`methodology` so provenance badges flow from the semantic layer. (2) Migrate one page's `query.measure` from raw code → metric-id (FF-RAW-CODE-IDENTICAL guarantees byte-identity until governance is read). (3) Constructor: surface `listMetricDefs()` in the measure picker (`describeApp`). Files: new `apps/geostat/src/data/metrics.ts`, app bootstrap, `withMetricProvenance` install in store-builder. Effort M · **one-way-ish** (config adopts ids) · Class M · **P1**.
- **Raises-the-bar**: a JSON-authored, Constructor-editable semantic layer is something Cube/Looker/Malloy structurally cannot offer.

---

### [ENG-06] Metric-driven store routing (`dataSource`, Cube pattern, M1)
- **Status**: 🟡PARTIAL — seam shipped, no metric declares `dataSource` (depends on ENG-05)
- **Evidence**: `metric.ts:38` (`MetricDef.dataSource`), `metric-store.ts:79-93` (`specDataSource` — first metric-declared dataSource wins), `metric-store.ts:65-67` (`specMeasureRefs`); precedence node>metric>page>default resolved in react.
- **What & why**: Cube's `dataSource:` — a measure NAMES the store it lives in, so a multi-store platform routes a node to the right cube without per-node `storeKey`. The cross-store backbone.
- **Critical analysis**: Pure, deterministic, byte-identical fallthrough (returns `undefined` ⇒ page/default). But it is **entirely gated on ENG-05 adoption** — `specDataSource` can only ever return a value once a registered metric carries `dataSource`. Today it always returns `undefined` in prod. The mechanism is sound; it is a door bolted to a wall with no room behind it yet.
- **Reference platforms**: **Cube** `dataSource`, **Grafana** mixed-datasource panels, **Looker** `connection:` per model. Cube is the exact pattern. We match it declaratively.
- **Foresight**: The moment two real stores exist (e.g. national accounts + labour), this becomes load-bearing. Multi-tenant: tenants compose stores; routing-by-metric avoids leaking store topology into node config.
- **Plan**: Couple to ENG-05 P1 — when geostat metrics are authored, give 1-2 a `dataSource` and add a second registered store (even a clone) to exercise `specDataSource` end-to-end with a fitness test (`metric-store.fitness.test.ts` exists as the harness). Effort M · two-way · Class M · **P2** (after ENG-05).
- **Raises-the-bar**: declarative store topology — node config never names a physical store.

---

### [ENG-07] Declarative blend / cross-store join (`blend` → `joinByField`, D3)
- **Status**: 🟡PARTIAL — B0 (type+schema+no-op) in core, B1 (desugar) in react; B2 grain DEFERRED
- **Evidence**: `transform/index.ts:42-48` (core registers `blend` with schema but **identity handler**); `transform/op-schemas.ts:185-199` (`blendSchema`); react `resolveNodeRows.ts:105-153` (`resolveBlends` rewrites `blend`→`joinByField` with secondary rows resolved against `ctx.stores`); `transform/ops/joinByField.ts` (the real engine).
- **What & why**: The Constructor-authorable front-door for cross-store enrichment — NAME a secondary store + ObsQuery + join key, instead of baking pre-resolved rows into config. `joinByField` is the executable primitive; `blend` is its declarative face.
- **Critical analysis**: The arrow split is correct (the manifest `ctx.stores` is react-only, Law 3 — core must not see it). But the consequence is a **declarative op that core cannot execute** (identity passthrough). This is architecturally honest yet fragile: a `blend` that reaches core un-desugared silently yields wrong (un-joined) rows rather than failing loud. **B2 grain reconciliation is deferred** — joining two stores at different time grains (year vs quarter) has no declarative answer yet; today it would mis-join. The hardest unsolved problem in the engine is here: **cross-grain blend**.
- **Reference platforms**: **Grafana** mixed-datasource + `join`/`merge` transforms (also react-side), **Malloy** cross-source joins (typed, grain-aware via `aggregate`), **Cube** `joins` (declared in the model, grain via `rollup` pre-aggregations), **dbt** joins in SQL. **Malloy/Cube beat us on grain** — they reconcile grain in the model. We can **beat** Grafana (whose blend is UI-bespoke) by making it a typed, round-trippable op.
- **Foresight**: Cross-store is THE multi-tenant composition story. 1-2yr: grain-aware blend + declared join cardinality. Door: B2 grain reconciliation as a `reconcileGrain` step driven by `timeDimension.granularity` (ENG-08 already carries grain metadata).
- **Plan**: **P2.** (1) Loud-fail guard: core `blend` identity handler should `emitDiagnostic(BLEND_NOT_DESUGARED)` instead of silent passthrough (it is a bug if reached). (2) Escalate B2 grain design to architect — `reconcileGrain` step + `MetricDef.grain`. Files: `transform/index.ts`, new diagnostic, escalation. Effort M · two-way (guard) / one-way (grain model) · Class M · **P2**.
- **Raises-the-bar**: a typed, Constructor-authored, grain-aware blend would exceed Grafana and match Malloy in a no-code surface.

---

### [ENG-08] First-class time (`timeDimension`, ADR R5)
- **Status**: ✅DONE (additive) — but the legacy forms remain the *primary* path
- **Evidence**: `data-spec.ts:114-118` (`TimeDimensionSpec`), `core/src/core/time-dimension.ts:1-225` (the fold SSOT: `effectiveBounds`/`effectiveYears`/`clampToBounds`/`resolveTimePin`/`isUnsetTime`); `time-dimension.fitness.test.ts`.
- **What & why**: Cube `timeDimensions` parity — ONE canonical `{dim, range, granularity}` shape folding three scattered legacy forms (`YearsSpec` on timeseries/growth · `fromDim`/`toDim` clamp · time in `ObsQuery.filter`). Postel/byte-identical: legacy wins on overlap, absent ⇒ inert.
- **Critical analysis**: The fold seam is excellent and `isUnsetTime` is a genuinely important SSOT (GAP-4 warm/read-key invariant rests on it — toObsParams and extractRequirements both gate on it, time-dimension.ts:201-225). **However** the additive strategy means *no production spec uses `timeDimension`* — `fromDim`/`toDim`/`years` are still authored everywhere, so `timeDimension` is a parallel door that, like ENG-05, is built but un-adopted. `granularity` is carried but **never affects resolution** (time-dimension.ts:124 "carried metadata, default-derived = year") — pure LOD foresight, zero rollup behavior. So "first-class time" is half-true: the *shape* is first-class, the *grain* is decorative.
- **Reference platforms**: **Cube** `timeDimensions: [{dimension, granularity, dateRange}]` with real grain rollups; **Looker** `dimension_group: type: time` with timeframes; **Power BI** date hierarchy. Cube/Looker actually *roll up* by grain — we don't yet. We match the shape, trail on grain semantics.
- **Foresight**: When quarterly/monthly data lands, `granularity` must drive an actual rollup (`groupBySpan` already exists in transform). Door: grain-aware blend (ENG-07 B2) + LOD. Multi-tenant: tenants with sub-annual data need this.
- **Plan**: (1) Migrate one page to author `timeDimension` (prove adoption, FF-TIMEDIMENSION holds). (2) Wire `granularity` → `groupBySpan` rollup when grain < data grain. Files: `time-dimension.ts`, resolvers, one geostat page. Effort M · two-way · Class M · **P2**.
- **Raises-the-bar**: a no-code, grain-aware time dimension folding 3 legacy forms is cleaner than Grafana's time-range-only model.

---

### [ENG-09] Perspective time-binding ownership (P4.5/P5, the time-mode replacement)
- **Status**: ✅DONE — and well-engineered
- **Evidence**: `config/perspective-axis.ts:77-82` (`PerspectiveTimeBinding` = `TimeDimensionSpec` + `pin` + `targetKeys`); `perspective-axis-parser.ts:106-164` (`perspectiveOwnedParamKeys` — the default-resolution ownership seam) + `185-272` (`scopeCtxByPerspective` + representation-preserving `writeBound`); `time-dimension.ts:84-93` (`resolveTimePin`).
- **What & why**: The declarative replacement for the imperative System-A "time mode" — the active perspective's `scope.timeBinding` is folded into `ctx.dims` at resolve time (`perspective = f(state)`), and the engine OWNS time-binding default-resolution via param-ownership (shifting the seam from bar-visibility to perspective-ownership, Protected Variations).
- **Critical analysis**: This is the engine's **strongest recent work** (per memory P4.5-P7). Strict-SOLID respected: `pin`/`targetKeys` are a perspective-only refinement of `TimeDimensionSpec`, NOT a widening of the shared type (axis.ts:55-82). `writeBound` (parser:267-271) echo-preserves the string/number representation so the migration stayed byte-identical — a subtle, correct call. The one residual subtlety: `scopeCtxByPerspective` applies ONLY `timeBinding`; the `metric` scope-key is **silently ignored at runtime** (see ENG-10). And `bindingOwnedKeys` hardcodes the `${dim}From`/`${dim}To` convention as the fallback — fine, but it is a second place (besides `targetKey`) that knows the convention.
- **Reference platforms**: **Grafana** global time-range picker (single privileged axis); **Tableau** parameters/sets; **SSAS** named cube perspectives. We **beat** Grafana decisively — our perspective is a first-class, multi-axis-ready, URL-derived OLAP view, not a privileged time singleton.
- **Foresight**: D-MULTIAXIS (a second axis param) is already shape-ready (`PerspectivesByParam`). 1-2yr: perspectives that bind non-time dims, metrics, stores (ENG-10 doors).
- **Plan**: No fix needed for time. Carry forward into ENG-10 (apply `metric` scope). Effort — · Class M · already shipped.
- **Raises-the-bar**: generalizing Grafana's time-range into a declarative, multi-axis OLAP perspective is a category improvement.

---

### [ENG-10] Perspective scope-key registry — "the 7 doors" (OCP scope vocabulary)
- **Status**: 🟡PARTIAL — 1 door real (`timeBinding`), 1 door **authoring-only/runtime-dead** (`metric`), 4 doors fitness-locked-shut
- **Evidence**: `config/perspective-scope-registry.ts:32-52` (`registerPerspectiveScopeKey`/`listPerspectiveScopeKeys`); `config/perspective-scope-schemas.ts:17-30` (registers `timeBinding` + `metric` authoring schemas); `contracts/src/perspective-axis.ts:36-52` (deferred keys named: `store`/`dims`/`blend`/`facet`); runtime application: `perspective-axis-parser.ts:196-233` handles **only** `timeBinding`.
- **What & why**: The OCP move that keeps `PerspectiveDef.scope` OPEN — every per-perspective effect is a registered scope-KEY carrying a PropSchema, not a field on a closed interface. A new door = one `register()` call + an optional core field; interpreter/pane/coverage-gate unchanged. The doors: **timeBinding** (✅ real), **metric** (🟡 schema only), **store** · **dims** · **blend** · **facet** (⛔ deferred, intentionally absent).
- **Critical analysis**: The registry design is exemplary OCP. **But there is a real correctness gap I want to flag loudly:** `metric` is registered as an *authoring* scope-key (scope-schemas.ts:27-30) and **round-trips in fitness tests** (`perspective-axis.fitness.test.ts:80` asserts `scope?.metric` survives) — yet **NO runtime code reads `scope.metric`**: `scopeCtxByPerspective` only folds `timeBinding` (parser:196-233). So an author can declare "in the 'CAGR' perspective, swap the measure to `b1g-cagr`," the Constructor will render it, it will persist and validate — **and it will do nothing**. That is a silent declarative no-op: the worst failure mode for a config-as-SSOT platform (looks authored, isn't wired). This is the single most important *correctness* finding in this board after ENG-05.
- **Reference platforms**: **SSAS perspectives** (named cube subsets — structural, no per-perspective measure swap), **Looker** explores/`access_grant`, **Tableau** parameter-driven field swaps. No reference platform has a *registry-driven, Constructor-authored, OCP scope-key vocabulary* for perspectives — this is genuinely ours to pioneer. The gap is we ship a door (`metric`) before its runtime.
- **Foresight**: Each door is a multi-tenant capability: `store` (per-perspective store swap), `dims` (non-time pins, e.g. "seasonally-adjusted view"), `blend` (compare step), `facet` (small-multiples). 1-2yr these are how tenants express "views" without code.
- **Plan**: **P1.** (1) **Close the metric no-op**: EITHER wire `scope.metric` into `scopeCtxByPerspective` (fold a measure override into a resolve-time spec rewrite via `resolveMeasureRef`) OR — if runtime isn't ready — *unregister* the `metric` schema so the Constructor can't author a dead capability (config-as-SSOT integrity: never offer an authoring affordance with no effect). Recommend wiring it, behind a new FF-PERSPECTIVE-METRIC-SWAP. (2) Add a fitness test: **every registered scope-key has a runtime consumer** (`listPerspectiveScopeKeys()` ⊆ applied keys ∪ documented-deferred). Files: `perspective-axis-parser.ts`, `perspective-scope-schemas.ts`, new fitness test. Effort M · two-way · Class M · **P1**. (3) The 4 deferred doors stay shut until a real second caller (YAGNI-correct).
- **Raises-the-bar**: a registry-driven perspective-scope vocabulary with a *"no authoring without runtime"* fitness invariant would be a discipline no reference platform enforces.

---

### [ENG-11] Classifier / display pipe (`$cl`/`$d`, the dimension-view layer)
- **Status**: ✅DONE
- **Evidence**: `core/src/data/codelist.ts:40-218` — `codelistOf`/`itemsOf`/`leaves`/`rollups`, `resolveClassifierRef` (structural) vs `resolveDisplayRef` (UI, joins display overlay), `resolveDimRef` dispatch; LocaleString tagging at codelist.ts:190-200.
- **What & why**: The SDMX codelist → view layer: `$cl` (structural) and `$d` (display) refs resolve a dimension into byCode/items/leaves/rollups views, joining the i18n display overlay. This is how filters/encodings get human labels without hardcoding.
- **Critical analysis**: Clean separation (structural vs display, ISP). The LocaleString *positive-tagging* at the join origin (codelist.ts:190-200, `tagLocaleString`) is a genuinely good design — provenance survives to the react boundary instead of a denylist guess (per memory `reference_localestring_brand`). Subtlety: `resolveDisplayRef` falls back to iterating display-map keys as opaque ids when no classifier is registered (codelist.ts:178-180) — correct for i18n stubs but means label quality silently degrades without a registered codelist; no diagnostic emitted.
- **Reference platforms**: **SDMX codelists** (the standard we adopt whole, Law 4), **Looker** `label`/`value_format`, **Cube** `meta`. We adopt SDMX fully — stronger than Grafana's flat label mapping.
- **Foresight**: Hierarchical drill (parent/leaf) is shape-ready (`leavesOf`/`rollupsOf`). Multi-tenant: each tenant's codelists are their dimension vocabulary.
- **Plan**: Emit a `MISSING_CODELIST` diagnostic when `resolveDisplayRef` hits the opaque-id fallback for a dim that has a registered classifier elsewhere. Files: `codelist.ts`. Effort S · two-way · Class M · **P3**.
- **Raises-the-bar**: full SDMX codelist semantics in a JSON engine.

---

### [ENG-12] Options-source resolvers (filter-option binding)
- **Status**: 🟡PARTIAL — sync (static/inline/query) done; async/remote (HREF) deferred behind a door
- **Evidence**: `core/src/data/resolve.ts:1-124` (`resolveOptions`/`resolveChips`/`resolveYears` — static·inline(`$cl`/`$d`)·query, with optional pipe); HREF deferral documented `resolve.ts:5-8` (door D-HREF, "first author-supplied external source").
- **What & why**: Filter dropdowns/chips/year-lists bind to options declaratively (literal items, a `$cl`/`$d` dim-ref, or a store query + pipe). Pure, sync, testable.
- **Critical analysis**: Solid and DRY (`resolveRaw`/`resolvePiped` shared). The HREF/remote-options deferral is YAGNI-correct **and** architecturally smart — the doc says HREF re-enters as a STORE kind (a DataStore behind the manifest), NOT a new selector type (resolve.ts:6-8). That keeps the options resolver from growing an async branch — the async-ness lives in the store. The actual async-options path exists but at a *different* layer: `resolveDefaults` Tier-3 `OptionsDefault` returns `pendingKeys` for loading options (filter-eval.ts:157-189) — so "async options" is half-handled (defaults wait) but option *lists* are sync-resolved from whatever the store has warmed. Coherent, but the two halves (resolve.ts sync lists + filter-eval pendingKeys) should be cross-referenced or a reader misses that async is handled by deferral+pending, not in-resolver.
- **Reference platforms**: **Grafana** query variables (async, chained), **Looker** suggest/`suggest_explore`, **Retool** async query options. Grafana's chained variables are more mature. We **beat** them on declarativeness (no JS), trail on async ergonomics.
- **Foresight**: When the first external (non-store) source lands, D-HREF opens as a store. Multi-tenant: tenant option catalogs come from their stores.
- **Plan**: No build now (YAGNI). Add a one-paragraph doc linking `resolve.ts` ⇄ `filter-eval.ts` pendingKeys so the async story is discoverable. When D-HREF triggers, implement as an `ExternalStore` behind `buildStoreManifest`, NOT a selector type. Effort S(doc) · two-way · Class M · **P3**.
- **Raises-the-bar**: pushing async into the store port (not the selector) keeps the options vocabulary closed.

---

### [ENG-13] Three-tier defaults system (+ async pendingKeys)
- **Status**: ✅DONE
- **Evidence**: `config/filter-eval.ts:157-202` (`resolveDefaults`: Tier1 DimVal · Tier2 ExprVal topo-sorted · Tier3 OptionsDefault with `pendingKeys`).
- **What & why**: Filter param defaults in three tiers — literal, expression (`$ctx` cross-param refs, topologically resolved), and options-derived (`pick: first|last` from loaded rows). URL state always wins. This is the "permalink = SSOT" (Law 9) machinery on the input side.
- **Critical analysis**: Well-structured: topo-sort for Tier-2 inter-param deps (filter-eval.ts:197) is the correct call (avoids order-dependence bugs). Tier-3 `pendingKeys` cleanly models "default still loading" without blocking. Risk: topo-sort on a cyclic `$ctx` dependency — need to confirm cycle handling doesn't infinite-loop (not verified here; `topoSort` impl unread). One to check.
- **Reference platforms**: **Grafana** variable defaults + chaining, **dbt** `var()` defaults, **Looker** `default_value`. Grafana chains variables; our topo-sort is the rigorous version.
- **Foresight**: Multi-tenant: each tenant's filter defaults are pure config. Door: default *provenance* (why is this value here — URL vs tier-N).
- **Plan**: Verify `topoSort` rejects/ignores cycles with a diagnostic (read `filter-eval.ts` topoSort). Add a fitness for a cyclic `$ctx` default. Effort S · two-way · Class M · **P2**.
- **Raises-the-bar**: topologically-ordered declarative defaults exceed Grafana's positional chaining.

---

### [ENG-14] DataStore async envelope (`QueryResult`/`asyncFromSync`/streaming, N34)
- **Status**: 🟡PARTIAL — sync + async-wrap done; **streaming/subscribe declared but unimplemented**
- **Evidence**: `core/src/data/store.ts:36-244` — `StoreQuery` union (val/obs/schema/distinct), `DataStore` interface (querySync/queryAsync/batch/`subscribe?`/`queryFrame?`), `asyncFromSync` (store.ts:213-224), `staticStore`. ApiStore freshness in `__tests__/apiStore.revalidation.test.ts`.
- **What & why**: The Grafana `DataSourceApi` / Cube `CubeApi` port — one unified store interface, capability-declared (`StoreCaps`), with a sync fast-lane (SSR/warm) and an async envelope. Swapping stores is one parameter (Law 5).
- **Critical analysis**: The port is well-shaped and capability-honest (`caps.sync`/`streaming`). `asyncFromSync` derives async from sync cleanly. **But `subscribe`/streaming (N34d) is declared optional and has no concrete implementation** — `caps.streaming` is always false in prod; the live-subscription door is type-only. `queryFrame` (pagination, P2-1) is similarly optional and sparsely implemented. So the async/realtime surface is *typed* ahead of need (defensible foresight) but a reader could over-trust it. `StoreQuery` is a clean open union — new query type = new discriminant (OCP).
- **Reference platforms**: **Grafana** `DataSourceApi` (query/streaming/testDatasource), **Cube** `load`/`subscribe` (real WebSocket streaming), **Vega** datasets. Cube/Grafana ship real streaming; ours is a stub. We match on the sync/batch path.
- **Foresight**: Realtime stat dashboards (live indicators) would need streaming. Multi-tenant: each tenant's store declares its caps. Door: WebSocket `ExternalStore`.
- **Plan**: Keep streaming type-only until a real-time requirement appears (YAGNI). When it lands, implement `subscribe` on `ApiStore` (SSE/WebSocket) gated by `caps.streaming`. Document `subscribe`/`queryFrame` as "type-declared, not yet implemented" so they aren't mistaken for live. Effort S(doc)/L(impl) · two-way · Class M · **P3**.
- **Raises-the-bar**: a capability-declared port where unimplemented features are *honestly* gated by `caps`.

---

### [ENG-15] `extractRequirements` / warm-read-key SSOT (GAP-4, prefetch planning)
- **Status**: ✅DONE — subtle and correct
- **Evidence**: `core/src/data/spec.ts:112-216` (`extractRequirements` per spec type, range-aware); `registry/resolvers.ts:101-104` (`queryReadObs` — the read-key SSOT); `time-dimension.ts:216-225` (`isUnsetTime` shared predicate); `warm-read-key.fitness.test.ts`.
- **What & why**: Static analysis of a DataSpec → exact `{code, dims}[]` to batch-prefetch (no N+1, no over-fetch). The warm key MUST equal the read key or the cache stays cold (empty charts) — GAP-4.
- **Critical analysis**: This is some of the most careful code in the engine. The range-mode awareness (spec.ts:160-209: an unbounded query emits ONE unbounded requirement, NOT a spurious `time:0` slice) and the shared `isUnsetTime` predicate guaranteeing warm-key === read-key is exactly right — and the docblock explains *why* (a copy would drift). The non-time filter-pin folding (spec.ts:193-200, so two queries differing only by `approach:PROD`/`EXP` get distinct cache identities) is a real correctness subtlety handled well. The honest limit: multi-value/`$ne` pins are left to the obs read (spec.ts:191-192) — they don't narrow to a single cache identity, accepted.
- **Reference platforms**: **Cube** pre-aggregations / `refreshKey`, **Grafana** query caching, **Apollo** normalized cache keys. Cube's pre-agg planner is more sophisticated (it *builds* rollups); ours plans exact-slice warming. We **beat** naive caches by deriving warm+read from ONE key function.
- **Foresight**: Door: a true **query planner** (ENG-NEW) that batches across nodes/pages. Multi-tenant: prefetch scoping per tenant store.
- **Plan**: No fix. Carry the `isUnsetTime`/`queryReadObs` SSOT discipline into any new spec type. Effort — · Class M · shipped.
- **Raises-the-bar**: a single key-derivation function for warm AND read is a cache-correctness invariant most platforms lack.

---

### [ENG-16] `custom` spec type — declared, **no resolver registered**
- **Status**: 🆕GAP (I identified it)
- **Evidence**: `data-spec.ts:190` (`{ type: 'custom'; fn: string; params? }` in the union); `registry/resolvers.ts:348-355` registers 7 resolvers — **`custom` is NOT among them**; `interpretSpec` (spec.ts:62-68) would emit `UNKNOWN_SPEC_TYPE` and return `[]`; `extractRequirements` (spec.ts:214) handles `custom` → `[]`.
- **What & why**: An escape-hatch spec ("call a named custom resolver `fn`") for capabilities not yet in the union. The intent: apps register a `CustomResolver` that dispatches on `fn`.
- **Critical analysis**: Today `custom` is a **declared-but-dead** discriminant — it type-checks, validates as a known type (`DATASPEC_DISCRIMINANTS`), the Constructor could offer it, but authoring one yields a silent empty result + a warning diagnostic. This is the same anti-pattern as ENG-10's `metric` no-op: a config-as-SSOT platform offering an authoring shape with no runtime. It is lower-severity (it's an *escape hatch*, not a feature) but it violates the "no dead authoring affordance" principle and `fn: string` is a faint Law-2 smell (a named function pointer in config — defensible as a registry key, but it invites imperative thinking).
- **Reference platforms**: **Grafana** has no "custom query type" in core (plugins instead); **Vega** has `signal`/`expression` escape hatches. The clean answer is **plugins register resolvers** — which our registry already supports (`registerSpec`), making `custom` arguably redundant.
- **Foresight**: Either bless `custom` (ship a reference `CustomResolver` + registry of named fns) or **remove it** in favor of `registerSpec` (the real OCP path). I lean **remove** — `custom.fn` competes with the registry as a second extension mechanism (two ways to extend = ISP/OCP smell).
- **Plan**: Escalate to architect (DataSpec-union change = Class-M). Option A: remove `custom` from the union, document `registerSpec` as the sole extension path. Option B: implement a `CustomResolver` + named-fn registry + diagnostic when `fn` unregistered. Recommend A (YAGNI + single extension mechanism). Files: `data-spec.ts`, `spec-catalog.ts`, validation corpus, migration. Effort M · **one-way** (union change) · Class M · **P2**.
- **Raises-the-bar**: one extension mechanism (the resolver registry) beats two competing ones.

---

### [ENG-17] Export registry + ExprRef/derive engine (supporting pillars)
- **Status**: ✅DONE
- **Evidence**: `data/export/registry.ts` (format SSOT, `ExportFormatId` closed union — per memory `reference_export_registry_seam`); `expr/src/` (typed `ExprRef`/`Expr` eval, `derive.ts`, ops collection/comparison/logic/lookup/math/string) — the separate-from-`$`-refs expression engine (ENG-04).
- **What & why**: Export-per-section (Law 9) via a format registry (csv/sdmx-json/xlsx/zip); the expr package powers `derive` transform steps + visibility/filter expressions with a typed, ISP-clean `ExprRef`(→DimVal) vs `ListRef`(→rows) split.
- **Critical analysis**: Both solid and well-tested. The expr engine's strict ISP (ExprRef never mixed with ListRef, `expr/types.ts:11-19`) is good discipline. The dep-free STORED-zip xlsx (no external lib) is a pragmatic win. Minor: the expr engine and `resolveRef` are two ref systems separated by the arrow (ENG-04) — correct but a known cognitive cost.
- **Reference platforms**: **SDMX-JSON** export (standard, Law 4 — we ship it), **Grafana** CSV/Excel/image export, **Looker** scheduled exports. We adopt SDMX-JSON export which Grafana/Looker don't.
- **Foresight**: Door: PDF/snapshot export (ties to perspective `snapshot: all-perspectives` render mode). Multi-tenant: per-tenant export formats register without core change.
- **Plan**: No fix. When PDF export lands, register as a format + wire perspective all-views render. Effort — · Class M · **P3**.
- **Raises-the-bar**: SDMX-JSON export keeps us standards-complete (Law 4) beyond commercial BI.

---

## Counts

| Status | Count | Cards |
|---|---|---|
| ✅ DONE | 9 | ENG-01, 03, 04, 09, 11, 13, 15, 17 (+ expr) |
| 🟡 PARTIAL | 6 | ENG-02, 05, 06, 07, 08, 10, 12, 14 → **8** |
| ⛔ NOT-DONE | 0 | (deferred doors are intentional absences, not started-and-stalled) |
| 🆕 GAP | 1 | ENG-16 (`custom` dead discriminant) |

(8 DONE incl. expr, 8 PARTIAL, 1 GAP across 17 cards — several cards span sub-statuses.)

---

## TOP-3 highest-leverage

1. **ENG-05 — Populate the semantic layer (`registerMetric`).** The single biggest latent lever: a fully-built, fully-wired, **zero-consumer** named-measure model. Authoring 5-10 real geostat MetricDefs (unit/methodology/dims/dataSource) activates governed provenance (Law 9), unlocks ENG-06 store routing, and validates a JSON semantic layer no reference platform offers no-code. **P1.** Without adoption the seam bit-rots.
2. **ENG-10 — Close the `metric` scope-key no-op (and add the "no authoring without runtime" fitness invariant).** A perspective can declare a measure swap that the Constructor renders, persists, and validates — and that **does nothing at runtime**. For a config-as-SSOT platform this is the most corrosive failure mode (authored ≠ wired). Either wire `scope.metric` or unregister it; then enforce *every registered scope-key has a runtime consumer*. **P1.**
3. **ENG-02/07/08 — The grain/store-port frontier.** desugar stalled on a missing store-port "valAt" primitive (3 bespoke resolvers can't collapse); blend B2 cross-grain join deferred; `timeDimension.granularity` decorative. These three share one root: **the engine has no declarative grain/point-read vocabulary.** Solving it (architect-gated) collapses duplicated resolver math, enables cross-store/cross-grain blend, and makes time genuinely first-class. **P2, escalate.**

---

## NET-NEW innovation (no reference platform has this)

### **Static DataSpec → output-FieldSchema inference ("spec typing") powering author-time encoding validation + autonomous warm-planning**

**The idea.** The engine already statically analyzes a DataSpec for *requirements* (ENG-15, `extractRequirements`). Extend that same static pass to infer the **output shape** of a DataSpec + its `pipe[]` — the set of fields, their `FieldType`, and `FieldRole` the resolved rows will carry — *without executing it*. Each transform op already declares an authoring PropSchema (ENG-03); give each op a **type transfer function** (`(inSchema) → outSchema`): `melt` adds `series`/`value`, `rename` renames, `cast` retypes, `select` projects, `lookup`/`join` add the joined fields, `derive` adds its `as` field. Fold across the pipe to a final output `FieldSchema`.

**Why it's genuinely new.** Malloy and dbt type their pipelines — but at *SQL compile time*, in *code*, for *engineers*. **No platform infers a transform pipeline's output schema for a no-code visual builder, pre-execution.** With spec-typing the Constructor can:
- **Validate encoding bindings at author time** — `encoding.value` must reference a field the pipe actually produces; today a typo yields silent empty charts (the GAP-4 symptom class). The builder red-flags it before save.
- **Drive smarter pickers** — the `y`-axis dropdown offers exactly the pipe's numeric output fields, the `color` dropdown its categoricals (`FieldRole`-aware).
- **Catch blend grain mismatches** (ENG-07 B2) structurally — two sources whose inferred time-grain differ fail author-time, not at runtime.
- **Autonomous warm-planning** — the inferred schema + requirements feed a cross-node query planner (the ENG-15 door) that batches every page's slices in one round-trip.

**YAGNI-honest scoping.** Start with the 6 highest-value ops (`melt`/`rename`/`cast`/`select`/`derive`/`lookup`) and a single consumer (the Constructor encoding picker). It reuses existing infra — `FieldSchema`/`FieldMeta` (`data/fieldSchema.ts`), the per-op PropSchema registry, and the `extractRequirements` static-pass pattern. It is **additive and inert** (absent inference ⇒ today's behavior) and Constructor-only (zero runtime risk, two-way door). The transfer functions are pure and registry-co-located (op = SSOT for behavior + editor + **type**), preserving OCP: a plugin op ships its transfer function alongside its handler. Class M, **P2 after ENG-05/10**.

**Why it raises the bar.** It turns the transform pipeline from "trust it produces the right columns" into a **statically-verified, typed dataflow for non-programmers** — the typed-pipeline guarantee of Malloy/dbt, delivered through a JSON config and a visual builder. That is a capability the entire reference set structurally cannot offer.
