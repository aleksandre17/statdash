# Board 02 — §A Render pipeline + §B SSR walkers (RX-01..07)

> Part of [Board 02 index](02-react.md). Analysis only.

## §A — Render pipeline (renderNode + sync/async warm-read)

### [RX-01] renderNode — 12-step zero-switch dispatch pipeline
- **Status**: ✅DONE
- **Evidence**: `platform/packages/react/src/engine/renderNode.ts:135-389`
- **What & why**: The single engine entry point. Twelve ordered steps (RBAC → migrate → visibleWhen → validate → middleware.before → store cascade → resolveRows → node-vars → view/fieldConfig → shell lookup → children → ErrorBoundary/Suspense → middleware.after) with **zero `if/switch` on `node.type`** — dispatch is a registry lookup (`nodeRegistry.get`, line 290). New node type = register one slice, no engine edit. Canonical "pure render: render(config)→UI".
- **Critical analysis**: RBAC gate runs first (145-150) so unauthorized nodes cost nothing — correct. But it's **255 lines with a 130-line hoisted closure `renderWithRows`** capturing `migrated/ctxM/type/variant/mws`. Green async tests ≠ maintainable: the closure-in-function shape defeats unit-testing the continuation in isolation, and the dual middleware-after loop (251-254 async, 384-388 sync) is duplicated logic that will drift. Transparent-wrapper expansion (312-330) silently flattens grandchildren into the parent slot; `warnSlotPlacement` is the only guard and is non-blocking (Postel).
- **Reference platforms**: Grafana `PanelRenderer` (type-keyed registry), Builder.io `<BuilderComponent>` (named-slot multi-slot — we mirror their `slots` record, 350-359). **Where WE beat them**: Grafana's renderer has no per-node migration step and no RBAC short-circuit before data resolution; we forward-migrate stored defs AND gate auth before any query — Builder.io has neither.
- **Foresight (1–2yr, multi-tenant)**: At 50+ tenant node types the inline middleware loop + closure is the hotspot for edit-mode overlays + analytics. Extract `renderWithRows` to a named module-level fn over an explicit `RenderState` struct so it's testable and the two middleware loops collapse to one.
- **Plan**: (1) Hoist `renderWithRows` → module fn; (2) unify the two after-loops into `applyAfter(el,node,ctx,mws)`; (3) add `renderContinuation.test.ts`. Files: `renderNode.ts`, new `renderContinuation.ts`. Fitness: existing `renderNode.async.test.tsx` + new test stay green. Effort **M**, risk **two-way**, Class **M**, priority **P2**.
- **Raises-the-bar**: A pipeline whose continuation is a pure, separately-tested function.

### [RX-02] Sync fast-lane vs async Suspense path (capability-transparent warm-read)
- **Status**: ✅DONE
- **Evidence**: `renderNode.ts:198-254`; `useNodeRows.ts`; `resolveNodeRows.ts` (`effectiveStoreKey`)
- **What & why**: Store `caps.sync !== false` ⇒ **byte-identical** synchronous resolution inline (no extra boundary, no Suspense). `caps.sync === false` (ApiStore) ⇒ defers the continuation into an inner `AsyncRows` component calling `useNodeRows`, which suspends on `queryAsync` via `React.use()` (Cache-Aside warm-then-read). Same `renderWithRows` continuation feeds both lanes; shells never know which ran. [[project_async_render_warm_read]].
- **Critical analysis**: Elegant — capability-driven, not store-name-driven. Risk: `AsyncRows` is a **fresh component identity per renderNode call** (line 231); a parent reorder could remount + re-suspend unnecessarily. The async after-loop wraps the *Suspense boundary* while sync wraps the *resolved element* — middleware sees structurally different trees per lane. Metric-green (in-memory tests) hides this; no test exercises async + middleware together.
- **Reference platforms**: React Query / SWR (Cache-Aside), Grafana `DataSourceWithBackend`. **Where WE beat them**: Grafana forces every panel through an async runner even for static data; our sync fast-lane is zero-overhead for Phase-1 stores — real win for static-export/SSR.
- **Foresight**: When DB stores ship (project_debt), async is the hot path. Per-node Suspense ⇒ N waterfalls unless warmed first; `warmPageStore` batches for SSR but not client mount.
- **Plan**: (1) Memoize `AsyncRows` identity per node id; (2) async+middleware combined test; (3) `useWarmOnce(page)` client-mount batch warm mirroring `warmPageStore`. Files: `renderNode.ts`, `useNodeRows.ts`, new `useWarmOnce.ts`. Effort **M**, risk **two-way**, Class **M**, priority **P1**.
- **Raises-the-bar**: One continuation, two lanes, shells blind to which.

### [RX-03] NodeView — JSX composition primitive
- **Status**: ✅DONE
- **Evidence**: `react/src/engine/NodeView.tsx:71-83`
- **What & why**: `<NodeView type="chart" def ctx/>` looks up a node by name and renders through the *full* pipeline (not a bare shell call) so it's self-contained (own rows, validate, RBAC, ErrorBoundary). Generic over `NodeTypeMap[K]` for exact typing.
- **Critical analysis**: Correct (routes through renderNode). Returns `null` for unregistered types (fail-soft) — right for composition, but a typo'd `type` silently renders nothing with no dev diagnostic. The `def` spread + `type` override (77-81) double-casts through `unknown`; could drop a `variant` already on `def` when the prop is absent.
- **Reference platforms**: Builder.io `<BuilderComponent>`, Plasmic `<PlasmicComponent>`. **Where WE beat them**: both need a registration AND a render call with explicit content props; ours is one typed primitive at the JSX altitude with `getShell()` as the low-level sibling.
- **Foresight**: Constructor live-preview composes arbitrary types via NodeView; a missing-type warning helps there.
- **Plan**: DEV-mode warn on registry miss. File: `NodeView.tsx`. Effort **S**, risk **two-way**, Class **G**, priority **P3**.
- **Raises-the-bar**: Typed, pipeline-complete composition-by-name.

### [RX-04] Lazy children proxy + named multi-slots
- **Status**: ✅DONE
- **Evidence**: `renderNode.ts:332-366`; `lazyRendered.ts`
- **What & why**: `rendered[]` is a lazy `Proxy` — child `renderNode` deferred to first access, shared cache also feeds `renderChild(i)`. Named slots populated from `SlotDef` registry (Builder.io multi-slot). A shell rendering only `slots.header` never pays for the body.
- **Critical analysis**: Good — most config renderers render all children eagerly. Risk: child render order is non-deterministic if a shell reads `slots.x` before `rendered`. No test asserts the laziness invariant (an un-accessed slot is never rendered) — load-bearing for perf, untested.
- **Reference platforms**: Builder.io slots, Vue scoped-slots. **Where WE beat them**: lazy-by-default; Builder renders all registered slots.
- **Foresight**: Tab/accordion shells rendering only the active panel rely on this; untested laziness is a regression magnet.
- **Plan**: `lazyRendered.test.ts` asserting un-accessed index never invokes `computeAt`. Effort **S**, risk **one-way**, Class **M**, priority **P2**.
- **Raises-the-bar**: Lazy slot rendering as a tested invariant.

## §B — SSR walkers (warm.ts / api.ts) — perspective-aware

### [RX-05] Perspective-aware prefetch planner (warm.ts)
- **Status**: ✅DONE
- **Evidence**: `react/src/engine/targets/warm.ts:35-141`
- **What & why**: `warmPageStore` statically walks the tree, collects `{code,dims}` Requirements via `extractRequirements`, pre-populates the CachedStore val-cache in one pass. **P-opt**: gated by `isNodeVisibleInActiveView` against the active perspective (`activeViewGate`) — a node hidden in the active perspective warms NOTHING, matching the live DOM. `snapshot:'all-perspectives'` disables the gate for self-contained export. Render-CALL intent, not a config field.
- **Critical analysis**: Gate correctly mirrors `renderNode.ts:157-160`'s visibleWhen check from the same `perspectiveState` SSOT. But the fallback (134-136: `{ [perspectiveKey]: perspective.current }`) is a **single-axis assumption** — two perspective axes would seed only one. Duck-typed `warm` check (99) is fragile but acceptable.
- **Reference platforms**: Next.js RSC prefetch, Remix loaders. **Where WE beat them**: Next prefetches per-route; we prefetch per-*perspective-projection* of one page — warmed set = exactly what the active view renders. Neither has perspective-scoped warm.
- **Foresight**: Multi-axis perspectives break the single-key fallback; the `perspectiveState` record is already multi-key-capable.
- **Plan**: Loop over all declared axes when `perspectiveState` absent. Files: `warm.ts:134-136`, `api.ts` caller. Fitness: `perspectiveWalker.fitness.test.ts` 2-axis fixture. Effort **S**, risk **two-way**, Class **M**, priority **P2**.
- **Raises-the-bar**: Perspective-scoped cache warming — render-equivalent to the live active view.

### [RX-06] renderPageToJSON — data snapshot target (api.ts)
- **Status**: ✅DONE
- **Evidence**: `react/src/engine/targets/api.ts:130-303`
- **What & why**: Pure-TS sibling of `renderPageToHTML` — walks the tree, resolves each `data` spec via `interpretSpec`, emits `PageDataSnapshot` (status rollup, per-node frame, export formats, notices). Same perspective gate: a hidden node yields `status:'empty'` with no frame.
- **Critical analysis**: Clean, registry-free. Two concerns: (1) re-implements row-limit/truncation (184-192) the live `resolveNodeRows` path does NOT apply — JSON snapshot and DOM render can **diverge on truncation**; metric-green hides this. (2) `interpretSpec` is **synchronous** — for `caps.sync===false` stores it throws into the per-node catch as `status:'error'`, so the JSON target silently cannot snapshot async stores; `opts.warm` populates a cache sync `interpretSpec` won't read for an async-only store.
- **Reference platforms**: Grafana `/api/ds/query`, Superset chart-data API. **Where WE beat them**: one config → three targets (DOM/HTML/JSON) from one walk.
- **Foresight**: Async stores need `renderPageToJSONAsync` awaiting `queryAsync` — hard gap for the API tier (apps/api consumes JSON snapshots).
- **Plan**: (1) `renderPageToJSONAsync` awaiting per-node `queryAsync`; (2) reconcile truncation (apply in `resolveNodeRows` too, or drop from snapshot). Files: `api.ts`, `resolveNodeRows.ts`. Fitness: `api.sync.test.ts` + new async test. Effort **M**, risk **two-way**, Class **M**, priority **P1**.
- **Raises-the-bar**: Multi-target render from one config — once async parity lands.

### [RX-07] KPI + node warm surfaces (useKpiRows / useNodeRows)
- **Status**: ✅DONE
- **Evidence**: `useKpiRows.ts`; `useNodeRows.ts`; `useKpiRows.async.test.tsx`
- **What & why**: Two async-warm surfaces ([[project_kpi_warm_surface]]): `useNodeRows` (generic node path); `useKpiRows` (kpi-strip via `extractKpiRequirements`, incl. yoy year-1). Both ride `CachedStore.queryAsync` with in-flight dedup.
- **Critical analysis**: Two parallel warm hooks is a mild DRY smell — `extractRequirements` (node) and `extractKpiRequirements` (kpi) are separate extractors. Justified (kpi has yoy/year-1 semantics), but a 3rd async surface (compare-series charts, scatter) tempts a 4th extractor. Watch [[feedback_registry_over_special_case]]: extraction wants to become a registry keyed by node category.
- **Reference platforms**: React Query `prefetchQuery`, Apollo `cache.batch`. **Where WE beat them**: extraction is *static* (no render) — Apollo/RQ need a render or manual key.
- **Foresight**: A `RequirementExtractorRegistry` keyed by node-category lets new surfaces warm without a bespoke hook. YAGNI today (2 surfaces); revisit at the 3rd.
- **Plan**: Defer; extract `requirementRegistry` when a 3rd surface appears. Effort **M** (when triggered), risk **two-way**, Class **G**, priority **P3**.
- **Raises-the-bar**: Static requirement extraction → batched warm, no render.
