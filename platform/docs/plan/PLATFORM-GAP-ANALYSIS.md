# Platform-Wide Gap Analysis — statdash-platform
> Chief Engineer audit, 2026-06-16. Compared against Grafana, Retool, AppSmith, Builder.io, Metabase/Superset.
> Evidence-grounded: all file:line citations verified against the live codebase.

---

## Finding That Dominates Everything: Data Resolution Is Synchronous

`interpretSpec(spec, ctx, store): EngineRow[]` returns rows **synchronously** (`engine/core/src/data/spec.ts:51`).
`DataStore.query()` returns `EngineRow[]`, never `Promise` (`store.ts:68-69`).
`ChartShell` reads `ctx.rows` directly and renders or shows `<EmptyState/>` (`ChartShell.tsx:74`).
`StoreCaps.streaming` exists but is hardcoded `false` in every store (`store-impl.ts:27,123,184`).

This is the **root cause behind ~8 of the gaps below**. Grafana's entire value rests on
`PanelData = { state: Loading|Done|Error, series, request, timeRange }` flowing asynchronously
into every panel. This platform has **no loading state, no error state, no per-node request
lifecycle, no polling, no streaming** — because the contract is synchronous. `ApiStore` papers
over this by pre-filling a cache via `prefetch()` and reading it synchronously — works for static
national-accounts data but cannot express a live query that resolves over the network per panel.

**Root-cause fix (N34):** evolve the store contract to `query(q, ctx): Promise<QueryResult>` where
`QueryResult = { state, rows, error?, meta? }` (Grafana `DataQueryResponse`). Keep the sync path as
a `querySync` fast-lane for in-memory `ExternalStore` (SSR/snapshot targets need it). Thread an
`AsyncState` into `RenderContext.rows` so shells render skeleton/error/data via the existing
`skeletonRegistry`. Expand-contract migration: old synchronous stores keep working behind an adapter.

---

## Layer: engine/core

| # | Gap | Sev | Reference | Fix |
|---|-----|-----|-----------|-----|
| C1 | **Synchronous resolution — no async/loading/error lifecycle** | Critical | Grafana `PanelData.state` (Loading/Done/Error) + `DataQueryResponse` | Promise-returning store contract + `QueryResult` envelope — see N34 |
| C2 | **No polling / refresh / live streaming.** `StoreCaps.streaming` is decorative — no `subscribe()` on the interface | Major | Grafana `DataSourceApi.query` returns `Observable<DataQueryResponse>`; per-panel refresh interval | Add optional `subscribe?(q, ctx): Unsubscribe` to `DataStore`; add `view.refreshInterval` to `ViewParams` |
| C3 | **No result-set semantic metadata.** `StoreQuery {type:'schema'}` returns measure/label/color/unit only — no column type (dimension vs measure), no primary key, no `FieldType` | Major | Metabase semantic types (dimension/measure/PK); Grafana `Field.type` + `FieldConfig` | Extend `schema` query to return `FieldMeta[] { name, role: 'dim'\|'measure', type, unit }`. Constructor needs this to auto-suggest encodings |
| C4 | **Transform pipeline is 15 ops; Grafana ships 30+.** Missing: `reduce` (per-series stat), `joinByField` outer/inner, `limit/head`, `pivot`/`unpivot` (wide-pivot), `window` (running total/moving avg) | Major | Grafana transformations panel | Add `reduce`, `joinByField` outer, `limit`, `window` op (movingAvg/cumSum/lag/diff) |
| C5 | **No time-series-native ops.** No moving average, no resample/downsample, no fill-missing/interpolate, no YoY/QoQ as a transform (only as a `growth` DataSpec) | Major | Grafana `timeSeriesTable`, Prometheus `rate/increase`; Superset time-comparison | Add `window` op `{op:'window', fn:'movingAvg'\|'cumSum'\|'lag'\|'diff', over, by, n}`. For a statistical dashboard this is core domain. |
| C6 | **DataSpec cannot express joins across measures / derived cross-series.** `ratio-list` is the only cross-measure spec; arbitrary measure-vs-measure math requires a `transform` spec with inline source | Minor | Malloy/Cube measures; Grafana math expressions across queries (`$A + $B`) | Add an `expr` DataSpec referencing prior named specs via the existing `engine/expr` evaluator |
| C7 | **No query-result caching keyed by request.** `CachedStore` caches only `{type:'val'}` scalars; `obs`/`distinct`/`schema` pass straight through uncached | Minor | Grafana query cache; Metabase result cache with TTL | Cache by `(queryType, code/measure, dimKey)`; add TTL field to `StoreCaps` |

---

## Layer: engine/react

| # | Gap | Sev | Reference | Fix |
|---|-----|-----|-----------|-----|
| R1 | **No cross-filter propagation.** Clicking a chart bar publishes `row:hover` on EventBus (`ChartShell.tsx:51`) but nothing turns a panel selection into a filter that re-scopes sibling panels | Critical | Metabase/Superset dashboard cross-filters; Retool `{{chart1.selectedRow}}` | Add `DataLinkDef.target:'filter'` (or a new `onSelect` handler) that writes to `ctx.set`. EventBus + `ctx.set` already exist — connect click→filter (N36) |
| R2 | **No per-node / per-panel time-range or filter override.** Every panel inherits the page `SectionContext` wholesale. `ViewParams` has no `timeRange`, `filterOverride`, or `compare` | Major | Grafana per-panel time override + "compare to previous period"; Superset card-level filters | Add `view.scope?: { timeRange?, dimOverride?, compare? }`, merged into a derived `SectionContext` in `renderNode` (N37) |
| R3 | **No annotations (temporal overlays).** No annotation type anywhere; charts cannot show event markers / reference bands | Major | Grafana annotations (data-sourced time-range overlays) | Add `annotations?: AnnotationSpec[]` to chart `ViewParams`, resolved like a DataSpec; render as ApexCharts `annotations` (N42) |
| R4 | **No alerting / threshold-rule engine.** `FieldConfig.thresholds` color cells but no rule fires (notify/badge/state) when a value crosses a threshold | Major | Grafana alert rules per panel; threshold expressions | Add declarative `rules?: ThresholdRule[]` evaluated in-engine producing a `Diagnostic`/badge — reuse existing `Diagnostic` contract and `StatusBadge` component (N42) |
| R5 | **Snapshot target produces data, but no snapshot persistence/share API.** `renderPageToJSON` returns an in-memory `PageDataSnapshot`; nothing stores it and returns a permalink. No signed embed URL | Major | Grafana `POST /api/snapshots` → permanent URL; Metabase signed embedding with param whitelist | Add `apps/api` route `POST /snapshots` + `GET /embed/:token` with HMAC-signed, param-whitelisted access. The render target is done; the delivery boundary is missing (N38) |
| R6 | **No diff-snapshot / scheduled delivery** | Minor | Grafana reporting; Metabase scheduled email/Slack | Cron + existing JSON target → email/Slack. Defer until embed exists |
| R7 | **`describeApp()` exists for describing, but no `validateApp()` / capability-compat check.** A page config can reference a chartType or specType not in the manifest and only fail at render via a `diagWarning` | Minor | Builder.io content-model validation against registered components | Add `validatePageTree` cross-check against `describeApp()` axes at save time (N43) |
| R8 | **EventBus is page-scoped and not serializable into config.** Cross-node wiring cannot be authored in JSON — only hardcoded in shells (`ChartShell` publishes hardcoded `row:hover`) | Major | Retool/AppSmith event handlers as declarative config | Add `node.on?: { event: ActionSpec[] }` (declarative action list) resolved by the engine — Constructor-ready version of the EventBus (N36) |

---

## Layer: plugins (panel/node coverage)

**Present:** chart (13 interpreters: cartesian/radial/special/treemap/donut/hbar-diverging), table (data/pivot/simple), kpi-strip, georgraph (map), hero, links, mode-bar, page-header, repeat, section, stats-carousel, full layout set.

| # | Gap | Sev | Reference | Fix |
|---|-----|-----|-----------|-----|
| P1 | **No gauge / single-stat (big-number) panel.** KPI-strip is closest but it's a strip of cards, not a thresholded radial gauge | Major | Grafana Gauge + Stat panels | New `gauge` panel reusing `FieldConfig.thresholds` (already exists) + radial renderer (`engine/charts` radial interpreter already there) — N40 |
| P2 | **No text / markdown panel.** Dashboards cannot carry authored narrative blocks. `hero` and `page-header` are structural, not free rich-text | Major | Grafana Text panel; every BI tool | New `text` panel: markdown → sanitized HTML (note: `dangerouslySetInnerHTML` needs a vetted sanitizer at boundary) — N40 |
| P3 | **No logs/list/news/iframe panels** | Minor | Grafana Logs/News/Text(iframe) | Lower priority for a stats platform; `iframe` (embed external Eurostat widget) is the only one with real demand |
| P4 | **Map panel (`georgraph`) is a single concrete shell, not a generic choropleth panel.** Named for one use, not a reusable map capability with configurable geo-join + color scale | Major | Metabase/Superset choropleth; Grafana Geomap | Generalize to a `map` panel taking `{ geoDim, valueField, scale, topology }`. A national-accounts platform lives and dies on regional choropleths. The `join`/`lookup` ops + `FieldConfig` give the pieces — N40 |
| P5 | **Table lacks server-side pagination / virtualization at scale.** `TableConfig.rowThreshold` truncates with a notice rather than virtualizing | Minor | AG-Grid/Metabase virtualized + paginated tables | Wire a virtualizer when `rows > threshold` instead of truncating. Already flagged in roadmap [N25] |

---

## Layer: App integration / Constructor (`apps/panel`) + governance

| # | Gap | Sev | Reference | Fix |
|---|-----|-----|-----------|-----|
| A1 | **No live WYSIWYG canvas.** The Constructor edits via forms + wizard (`DataSpecEditor`, `PipelineBuilder`, `ConstructorWizard`) and has DnD + undo history — but it does **not** render the page being built with `NodePageRenderer` (zero usages in `apps/panel`). You edit JSON-via-forms, then preview elsewhere | Critical | Builder.io / Retool / AppSmith: you drag onto the **rendered** page | Mount `NodePageRenderer` as the canvas with drop zones overlaid. The `slots`/`SlotDef` taxonomy and `canHaveChildren`/`rootOnly` in `slice-meta.ts` are already designed for exactly this — N35 |
| A2 | **No permissions / RBAC / per-node visibility-by-role.** Zero matches platform-wide. `VisibilityExpr` (`section.ts:165`) keys off filter params + mode only — never identity/role | Major | Retool per-component/per-resource permissions; Metabase data sandboxing | Add `view.visibleToRoles?` + an `AuthContext` port in `RenderContext` (kept out of `engine/core`; injected by `apps/geostat`). `apps/api` already has `auth.ts` — N41 |
| A3 | **No audit log of config changes / query execution.** `PageConfigBase.changeNote` exists (`types.ts:341`) but the comment says `audit_log` table is Phase 2 and unbuilt | Major | Retool audit log; Grafana provisioning history | Add `audit_log` table + middleware in `apps/api` config routes. Governance fields ([N31]) already on config type — the sink is missing — N41 |
| A4 | **GitOps / provisioning is half-present.** Pages are JSON and `apps/api` serves them; `manifest.ts` is the documented Phase-1→2 seam. But no file-based provisioning (YAML/JSON folder → load on boot) and no export-config-to-git path | Minor | Grafana provisioning (YAML dashboards/datasources, GitOps-ready) | Add a `provisioning/` loader in `apps/api` that ingests config files on boot |
| A5 | **i18n is structurally complete but locale-coverage is unenforced.** `LocaleString`, `formatMessage`, `createCollator` all present (`engine/core/src/i18n`). No fitness function asserts every `LocaleString` in shipped configs has all required locales | Minor | — | Add fitness test over page configs: every `LocaleString` has `{ka, en}` |
| A6 | **Theming is per-app tokens, not multi-theme / dark-mode switchable at runtime.** `engine/styles` has a real token system + parity test, but no theme variant selection (light/dark/high-contrast) threaded through `RenderContext`. High-contrast is also a WCAG concern | Minor | AppSmith app theming; Builder.io design tokens per variant | Add a `theme` axis to tokens + a runtime theme switch. High-contrast theme doubles as a WCAG AA win — N44 |

---

## Accessibility (Law 9) — Partial

**Present:** `ChartDataTable.a11y.test.tsx`, `role="toolbar"` on `ExportBar`, export-per-section wired, URL=permalink via `useSearchParams`.

**Gaps:**
- No platform-wide automated a11y CI gate (only one a11y test file)
- No keyboard-nav contract for chart/table/map panels
- No high-contrast theme (A6)
- Methodology/preliminary/last-updated badges depend on provenance port being populated — which is optional and likely unpopulated for most measures

**Recommended:** an `axe` fitness function in CI across all rendered panel types — N44.

---

## Prioritized N-Move List (next 6 months)

Ordered by blast-radius × leverage (Pareto). First three are the vital few.

| Move | Title | Size | Closes | Rationale |
|------|-------|------|--------|-----------|
| **N34** | Async data lifecycle | L | C1, C2, + all live-data stories | Promise-returning `DataStore` + `QueryResult{state,rows,error,meta}` + loading/error via `skeletonRegistry`. Single highest-leverage move — synchronous contract is the root cause of ~8 gaps |
| **N35** | Live WYSIWYG Constructor canvas | L | A1 | Mount `NodePageRenderer` with slot drop-zones in `apps/panel`. Closes gap between platform ambition and form-based editor |
| **N36** | Cross-filter + declarative events | M | R1, R8 | `DataLinkDef.target:'filter'` + `node.on` action config + click→`ctx.set`. Turns panels into interactive dashboard |
| **N37** | Per-panel scope (time-range / filter override / compare) | M | R2 | `view.scope?: { timeRange?, dimOverride?, compare? }`. Prerequisite for compare-mode stats |
| **N38** | Snapshot persistence + signed embed | M | R5 | `POST /snapshots`, `GET /embed/:token` (HMAC, param whitelist). Render target already exists — delivery boundary missing |
| **N39** | Time-series transform ops | M | C4, C5 | `window` (movingAvg/cumSum/lag/diff) + `reduce` + `joinByField` outer. Core domain for a statistical platform |
| **N40** | Generic map + gauge + text panels | M | P1, P2, P4 | Parallelizable. `gauge` reuses `FieldConfig.thresholds`; `text` needs sanitizer; `map` generalizes `georgraph` |
| **N41** | Governance: RBAC port + audit_log sink | M | A2, A3 | Config fields ([N31]) already exist — enforcement and sinks are unbuilt |
| **N42** | Annotations + threshold rules | M | R3, R4 | AnnotationSpec on charts; ThresholdRule producing Diagnostic/badge |
| **N43** | Result semantic metadata + manifest-validated saves | S | C3, R7 | Makes the Constructor smarter; validates config against `describeApp()` axes |
| **N44** | a11y CI gate + high-contrast theme | S | A6, Law 9 gap | `axe` fitness function across all panel types; high-contrast token theme |

---

## Honest Scorecard — % of Way to Reference Platforms

> The engineering foundation is genuinely strong (best-in-class registry/OCP discipline,
> lossless-serialization invariant, sandboxed DSL, multi-target rendering). Gaps are at the
> **interactive/live/governance frontier** — not in a long tail of features.

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Declarative config / JSON-driven architecture** (vs Builder.io) | ~85% | Best-in-class registry, OCP discipline, sandboxed DSL. Missing live canvas (A1) + declarative events (R8) |
| **Transform pipeline** (vs Grafana) | ~55% | Strong tidy-data core, but half the op count and no time-series/window ops — real gap for a *statistics* product |
| **Data lifecycle / datasource** (vs Grafana) | ~40% | Clean `DataStore` abstraction, but synchronous, no loading/error/streaming/polling. **Weakest dimension** |
| **Interactivity / cross-filter / drill** (vs Retool/Metabase) | ~35% | DataLinks + EventBus exist as primitives but aren't wired into cross-panel filtering |
| **Panel coverage** (vs Grafana) | ~60% | Strong chart/table/kpi; missing gauge, text, generic map |
| **Embed / snapshot / scheduling** (vs Metabase) | ~30% | Render targets done; delivery/persistence/signing absent |
| **Governance: RBAC / audit / provisioning** (vs Retool/Grafana) | ~25% | Config schema is governance-ready ([N31] fields) but enforcement and sinks are unbuilt |
| **Accessibility / i18n / theming** (Law 9) | ~65% | Token system + i18n primitives excellent; no a11y CI gate, no high-contrast theme, provenance badges depend on unpopulated metadata |
| **Composite** | **~55%** | — |

**Conclusion:** The missing 45% is concentrated in **three crossable architectural moves** (N34 async data, N35 live canvas, N36 cross-panel interactivity) — not in a long tail of features. N34–N36 alone would move the composite past **~75%**.

---

## Evidence Files

- `engine/core/src/data/spec.ts:51` — synchronous resolution
- `engine/core/src/data/store.ts:68` — sync contract, `streaming:false`
- `engine/core/src/data/transform/types.ts` — 15 ops
- `engine/react/src/engine/types.ts:58` — `ViewParams` (no scope/refresh)
- `engine/react/src/engine/targets/api.ts` — snapshot data, no persistence
- `engine/plugins/panels/chart/default/ChartShell.tsx:51,74` — EventBus publish, EmptyState
- `apps/panel/src/features/**` — form-based Constructor, no canvas
- `engine/core/src/config/section.ts:165` — `VisibilityExpr` (no role)
- `engine/react/src/engine/slice-meta.ts:128` — `NodeCap`, slot taxonomy ready for canvas
