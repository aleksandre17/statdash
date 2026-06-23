# Implementation Roadmap

> Created 2026-06-16 to host the JSON-rendering-target audit below. Pre-existing
> roadmap items (if a canonical roadmap is later consolidated here) precede this section.

## Post-Roadmap N-Moves: JSON Rendering Target Deep-Dive (architect audit, 2026-06-16)

> Per-gap catalog (G1–G10, full problem/reference/fix/sketch for each) lives in the
> companion file: [`JSON-TARGET-GAPS.md`](./JSON-TARGET-GAPS.md). This file holds the
> verdict, sequencing, fitness functions, and the ADR to write.

### Verdict (no padding)

`renderPageToJSON` is, today, a tree-shaped `console.log` of rows. It walks the node tree,
calls `interpretSpec` per node, and dumps `DataRow[]` into a mirrored tree. Measured against
what Grafana's `/api/ds/query`, Builder.io's content API, Metabase's dataset endpoint, or even
AppSmith's widget data contract return, it is **not yet a production API surface** — it is a
debug snapshot. The three blocking defects:

1. **It lies by omission.** Errors are swallowed (`catch {}`), so a failed node is
   indistinguishable from a node with genuinely empty data. A consumer cannot tell "no data"
   from "the query threw." Violates project Law 6 (root-cause, no symptom patching) and the
   canon's **Fail-fast / never swallow** law. Grafana never does this — frames carry
   `meta.notices` with severity. → **G2**.
2. **It ships rows with no schema.** `DataRow[]` is handed over with zero field metadata: no
   column types, no units, no display labels, no dim-vs-measure distinction. Every consumer
   re-derives the schema by sniffing the data. Grafana's entire `DataFrame` contract exists
   precisely to *not* do this. → **G1 / G4**.
3. **It has an active tree-walk bug.** `collectChildNodes` treats the `data` field (a
   `DataSpec`, which has a `type` discriminant) as a child node and recurses into it. A
   `query` spec becomes a phantom `NodeDataEntry { type: 'query' }` in the snapshot tree.
   Confirmed in shipping code. → **G8**.

Everything else (named slots, recursion, generic walk, no-React purity) is sound and worth
keeping. The architecture seam — one config, multiple targets — is correct. The *payload
contract* is what is mediocre. Fix the contract, keep the seam.

The unifying root cause: **there is no typed result-frame contract.** Grafana, Metabase, and
Superset all converged on the same shape — *rows + schema + meta + notices* — because consumers
cannot be written safely without it. Every gap below is resolved by introducing that contract
(`NodeDataFrame`) and enriching `NodeDataEntry` / `PageDataSnapshot` around it.

### Gap index (detail in companion file)

| ID | Gap | Priority | Reference platform |
|----|-----|----------|--------------------|
| G1 | No field metadata per node (typed schema) | **P1** | Grafana DataFrame.schema.fields |
| G2 | Error silencing (`catch {}`) | **P1 blocking** | Grafana meta.notices / RFC 9457 |
| G3 | No node metadata (variant, caps, specType) | P2 | Builder.io node meta |
| G4 | Flat rows, no typed column info | **P1** (folds into G1) | Cube.dev resultSet |
| G5 | No snapshot-level metadata | P2 | Builder.io / Metabase result meta |
| G6 | No pagination | P3→P2 (when ApiStore lands) | AppSmith / Metabase row_count |
| G7 | No per-node export formats | P2 | Metabase/Superset download list |
| G8 | `collectChildNodes` walks `DataSpec` as a child | **P1 active bug** | Builder.io slot/config split |
| G9 | No diff / incremental snapshot | P3 | ETag / GraphQL selection |
| G10 | Warm target not composited with JSON target | P2 | Grafana transparent cache warm |

### Cross-cutting: make the contract a fitness function (Evolutionary Architecture)

Two invariants from this audit must be *encoded as tests*, not left as prose (canon §5,
project Law 6):

- **FF-1 (no silent failure):** feed `renderPageToJSON` a node whose spec throws; assert the
  entry has `status: 'error'` + a notice — never a silently-omitted `rows`. Locks **G2**.
- **FF-2 (no phantom nodes):** feed a node with `data: { type: 'query', … }`; assert the
  snapshot tree contains **no** entry with `type: 'query'`. Locks **G8** against regression
  regardless of which walker fix lands.

### Suggested sequencing

1. **P1 batch (correctness + core contract):** G8 walker fix → G2 error status → G1/G4
   `NodeDataFrame` schema. These three turn the debug dump into a typed, honest frame. Land
   FF-1 and FF-2 alongside.
2. **P2 batch (self-description + composition):** G3 node meta + G5 snapshot meta + G7 export
   formats + G10 warm composition. Snapshot becomes a complete, cacheable API document.
3. **P3 / deferred (scale, gated by measurement):** G6 pagination enforcement (when `ApiStore`
   lands), G9 node-level incremental diff, and the shared `walkPageTree` visitor refactor.

### One ADR to write

`ADR-NNNN: JSON render target returns a typed result-frame contract (NodeDataFrame), not bare
rows.` **Context:** consumers cannot be written safely against schemaless, error-silencing
snapshots. **Decision:** adopt the Grafana DataFrame-shaped contract (rows + schema + meta +
notices). **Rejected alternatives:** (1) keep bare `DataRow[]` and document the schema
externally — rejected, drifts and duplicates inference across every consumer; (2) return the
fully *pivoted* wide table per node — rejected, breaks tidy-data SSOT and bakes one renderer's
view into the data layer. **Consequence:** small payload growth + a `deriveFieldSchema` helper
in `engine/core`, in exchange for a self-describing, cacheable, fail-fast API surface.

---

## Post-Roadmap N-Moves: Platform-Wide Gap Analysis (chief-engineer audit, 2026-06-16)

Full detail: [`PLATFORM-GAP-ANALYSIS.md`](./PLATFORM-GAP-ANALYSIS.md)
JSON rendering gaps: [`JSON-TARGET-GAPS.md`](./JSON-TARGET-GAPS.md)

**Root-cause finding:** `interpretSpec` is synchronous (`engine/core/src/data/spec.ts:51`);
`DataStore.query()` never returns a `Promise` (`store.ts:68`). `StoreCaps.streaming` exists but
is hardcoded `false` in every store. This single architectural constraint is the root cause of ~8
cross-cutting gaps (no loading state, no error state, no per-node request lifecycle, no polling,
no streaming). Fix is N34.

**Composite scorecard:** ~55% of the way to Grafana/Retool-class. Missing 45% is concentrated in
three crossable architectural moves (N34/N35/N36) — not a long feature tail. N34–N36 alone move
the composite past ~75%.

### N34 — Async data lifecycle [Critical]
Promise-returning `DataStore.query(q, ctx): Promise<QueryResult>` where
`QueryResult = { state: 'loading'|'done'|'error', rows, error?, meta? }`. Keep `querySync`
fast-lane for `ExternalStore` (SSR/snapshot). Thread `AsyncState` into `RenderContext.rows`
→ shells render skeleton/error/data via existing `skeletonRegistry`. Expand-contract migration:
old synchronous stores work behind an adapter. *Closes C1, C2, unblocks all live-data stories.*
Size: L (split: contract → ExternalStore adapter → shell wiring).

### N35 — Live WYSIWYG Constructor canvas [Critical]
Mount `NodePageRenderer` as the canvas in `apps/panel` with slot drop-zones overlaid. The
`slots`/`SlotDef` taxonomy and `canHaveChildren`/`rootOnly` in `slice-meta.ts` are already
designed for exactly this. *Closes A1 — gap between platform ambition and form-based editor.*
Size: L.

### N36 — Cross-filter + declarative events [Major]
`DataLinkDef.target:'filter'` + `node.on?: { event: string; actions: ActionSpec[] }` config +
click→`ctx.set` wiring. EventBus + `ctx.set` already exist — connect click→filter. Turns a
set of panels into an interactive dashboard. *Closes R1, R8.* Size: M.

### N37 — Per-panel scope: time-range / filter override / compare [Major]
`view.scope?: { timeRange?, dimOverride?, compare? }` merged into a derived `SectionContext`
in `renderNode`. Prerequisite for compare-mode statistics (YoY, regional comparison).
*Closes R2.* Size: M.

### N38 — Snapshot persistence + signed embed [Major]
`POST /snapshots` persisting `PageDataSnapshot` + `GET /embed/:token` with HMAC-signed,
param-whitelisted access in `apps/api`. The render target is done; the delivery boundary
is missing. *Closes R5.* Size: M.

### N39 — Time-series transform ops [Major]
`window` op (`{op:'window', fn:'movingAvg'|'cumSum'|'lag'|'diff', over, by, n}`) + `reduce`
(per-series stat → 1 row) + `joinByField` outer/inner. Core domain for a statistical
platform — absent from all 15 current ops. *Closes C4, C5.* Size: M.

### N40 — Generic map + gauge + text panels [Major]
Three parallel panel additions:
- `gauge` — reuses `FieldConfig.thresholds` (already exists) + radial interpreter (already in `engine/charts`)
- `text` — markdown → sanitized HTML; needs vetted sanitizer at boundary
- `map` — generalizes `georgraph` to `{ geoDim, valueField, scale, topology }`; choropleth is core for a national-accounts platform
*Closes P1, P2, P4.* Size: M (parallelizable across three sub-slices).

### N41 — Governance: RBAC port + audit_log sink [Major]
`view.visibleToRoles?` + `AuthContext` port in `RenderContext` (injected by `apps/geostat`,
kept out of `engine/core`). `audit_log` table + middleware in `apps/api` config routes.
Governance fields ([N31]) already on `PageConfigBase` — the enforcement and sinks are unbuilt.
*Closes A2, A3.* Size: M.

### N42 — Annotations + threshold rules [Major]
`annotations?: AnnotationSpec[]` on chart `ViewParams`, resolved like a `DataSpec`, rendered
as ApexCharts annotations. Declarative `rules?: ThresholdRule[]` evaluated in-engine →
`Diagnostic`/badge via existing `StatusBadge` component. *Closes R3, R4.* Size: M.

### N43 — Result semantic metadata + manifest-validated saves [Minor]
Extend `StoreQuery {type:'schema'}` to return `FieldMeta[] { name, role, type, unit }` →
Constructor auto-suggests encodings. Add `validatePageTree` cross-check against `describeApp()`
axes at save time (`apps/api` config routes are the right seam). *Closes C3, R7.* Size: S.

### N44 — a11y CI gate + high-contrast theme [Minor]
`axe` fitness function in CI across all rendered panel types (not just `ChartDataTable`).
High-contrast token theme variant threaded through `RenderContext` (doubles as WCAG AA win).
*Closes A6, Law 9 gap.* Size: S.

---

## Shipped — JSON Target P1 batch (2026-06-17)

- **G8** — `nodeWalk.ts` exports `DATA_CARRYING_KEYS` (12-key denylist). `collectChildNodes` and `warm.ts:collectRequirements` skip all of them. Phantom `{ type:'query' }` nodes eliminated. FF-2 fitness test.
- **G2** — `NodeStatus = 'ok'|'empty'|'error'` + `DataNotice { severity, text, specType? }` on `NodeDataEntry`. `catch {}` replaced with structured error capture. FF-1 fitness test locks silent-failure regression.
- **G1/G4** — `FieldType`, `FieldRole`, `FieldSchema`, `deriveFieldSchema(spec, rows)` in `engine/core/src/data/fieldSchema.ts`. `NodeDataFrame { schema: { fields: FieldSchema[] }, rows: EngineRow[] }` in `engine/core/src/data/nodeDataFrame.ts`. Both exported from `@statdash/engine`. `NodeDataEntry.frame?: NodeDataFrame` replaces bare `rows?`. Grafana DataFrame-shaped contract.
- **G5** — `PageDataSnapshot` extended: `pageId?`, `schemaVersion?`, `locale`, `fallbackLocale`, `filterParams`, `status` rollup, `durationMs`. Self-describing, cacheable snapshot.
- **G10** — `renderPageToJSON(page, ctx, opts?: { warm? })` — one-call warm+snapshot.
- `NodeStatus`, `DataNotice` exported from `@statdash/react/engine`. `FieldSchema`, `NodeDataFrame`, `deriveFieldSchema` from `@statdash/engine`.
- **N34 design** — `docs/plan/N34/` (10 files). `Suspense`/`skeletonRegistry`/`NodeErrorBoundary` already wired. Dual-method: `querySync` + optional `queryAsync → QueryResult`. N34a–N34d sequenced.
- **296/296 tests, tsc EXIT=0.**

---

## Shipped — Full Platform Audit Batch (2026-06-17)

> All N34–N44 moves and remaining G-gaps from the architect + chief-engineer audits.

### JSON Target P2 gaps
- **G3** — `NodeDataEntry.variant?`, `title?`, `specType?` (node metadata from node.view.title / node.variant). 84/84.
- **G7** — `NodeDataEntry.exportFormats?: ExportFormatInfo[]` — per-node export format list from `listExportFormats()`. `ExportFormatInfo` exported from `@statdash/react/engine`.

### Async data lifecycle (N34a–N34d)
- **N34a** — `DataStore.query` → `querySync` rename across all callers. `SiteContext.tsx` fixed. 338/338.
- **N34b** — `QueryResult<T>`, `asyncFromSync`, `DataStore.queryAsync?` in engine/core. 114/114.
- **N34c** — `useNodeRows` async fork: promise cache (200-entry LRU), `React.use()` for streaming stores, sync fast-lane for all Phase-1 stores. SSR fitness test: `renderPageToJSON` calls only `querySync`. 329+/329+.
- **N34d** — `DataStore.subscribe?()` + `Unsubscribe` + `StoreCaps.streaming?`. `useNodeStream` hook (subscribe → live rows; polling.interval → setInterval fallback). `ViewParams.polling?: { interval }`. `resolveStore` streaming bypass for CachedStore. 259/259.

### Constructor WYSIWYG canvas (N35)
- **N35** — `CanvasView` (two-layer: NodePageRenderer + transparent overlay), `CanvasOverlay` (slot drop-zones from `nodeRegistry.getSlots`), `NodePalette` (registry-driven, native HTML5 DnD). `toNodePageConfig` adapter bridges flat canvas store → NodePageConfig tree. Canvas-anchor middleware via AOP. 12/12 canvas tests.

### Cross-filter + declarative events (N36)
- **N36** — `DataLinkDef` → discriminated union (`NavigateDataLink | FilterDataLink`). `ResolvedLink.action: 'navigate' | 'filter'`. `NodeBase.on?: NodeEventHandler[]`. `ChartShell` + `TableShell` wired: click → `ctx.set(filterKey, value)` or navigate. `SimpleTable` keyboard + ARIA. 395/395.

### Per-panel scope (N37)
- **N37** — `ScopeOverride { dimOverride?, timeMode?, compare? }` in engine/core. `mergeScope(base, scope)` pure function. `ViewParams.scope?: ScopeOverride`. `resolveNodeRows` uses `mergeScope` per-panel. `resolveCompareRows` exports `{ compareRows, compareLabel }` for compare mode. `RenderContext.compareRows?`, `compareLabel?`. 145/145 engine/react.

### Snapshot persistence + embed (N38)
- **N38** — `POST /api/snapshots` (JWT-guarded, HMAC-signed token, LRU store). `GET /api/embed/:token?sig=` (public, 403/404/410). `AuditLogger` port, `createInMemoryAuditLogger`. `SnapshotStore` port (swap-ready for DB). 17/17 N38 tests.

### Transform ops (N39)
- **N39** — `window` op (movingAvg/cumSum/lag/diff, partition-aware, first-row sentinel = omit key). `reduce` op (sum/mean/min/max/count/first/last, per-group). `joinByField` op (inner/left/outer, A-wins conflict, hash join). 18 built-in ops total. 402/402.

### Panel plugins (N40a + N40b)
- **N40a** — Gauge panel (`resolveThresholdColor`, radial ApexChart, FieldConfig.thresholds). Text/markdown panel (`renderMarkdown`, allow-list sanitiser, LocaleString support). 397/397.
- **N40b** — Choropleth/map panel. `TopologyRegistry` (app-tier GeoJSON/TopoJSON, zero plugin coupling). `buildColorScale` (quantile/linear/threshold). WCAG-AA accessible placeholder table. `DEFAULT_PALETTE`. 79/79 plugins.

### Governance RBAC + audit (N41)
- **N41** — `types.ts` split into `types/` directory (node.ts / context.ts / slice.ts / auth.ts / index.ts). `AuthContext { userId?, roles }`. `NodeBase.visibleToRoles?` + `renderNode` guard (unauthorized → null before data resolution). `RenderContext.auth?`, `StaticRenderContext.auth?`. `AuditLogger` + `GET /api/admin/audit-log` (admin-role guarded). 28/28 apps/api.

### Annotations + threshold rules (N42)
- **N42** — `AnnotationSpec` (static value or DataSpec-resolved). `resolveAnnotations` → ApexCharts `{ yaxis, xaxis }`. `ThresholdRule` + `evaluateRules`. `DiagnosticBadge` (role="status", severity CSS, WCAG-AA). `ChartNode.annotations?`, `ChartNode.rules?`. 468/468.

### Semantic metadata + validated saves (N43)
- **N43** — `FieldMeta { name, role, type, unit?, displayLabel?, suggestedEncodings? }` in fieldSchema.ts. `StoreQuery { type:'schema'; indicator? }` arm widened. `storeSchema(store, ctx, indicator?)` ergonomic wrapper alongside `storeVal`/`storeObs`. `runPageValidation` in apps/api config save routes. 490/490.

### a11y CI gate + high-contrast theme (N44)
- **N44** — `axe-core` fitness function in `engine/react/__tests__/a11y.test.tsx` (all registered panel types, discovery-based). `RenderContext.theme?: 'default' | 'high-contrast'`. `StaticRenderContext.theme?`. `[data-theme="high-contrast"]` CSS block in tokens.css (21:1 / 19.6:1 contrast ratios, WCAG AA). `data-theme` wrapper in `NodePageRenderer` + `renderPageToHTML`. 265/265 engine/react.

### Infrastructure
- `@statdash/react` `./engine` subpath export added to `package.json`.
- `vitest.workspace.ts` aligned to all 8 packages with `vitest.config.ts`.

### Deferred (P3 — gated by measurement)
- **G6** — Pagination enforcement (when `ApiStore` lands)
- **G9** — Node-level incremental diff (ETag / GraphQL selection)
- **N34e** — N/A (N34d is the final sub-slice shipped)
