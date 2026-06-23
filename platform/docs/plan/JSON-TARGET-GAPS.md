# JSON Rendering Target — Gap Catalog (architect audit, 2026-06-16)

> Companion to [`IMPLEMENTATION-ROADMAP.md`](./IMPLEMENTATION-ROADMAP.md) (verdict, sequencing,
> ADR). Per-gap detail: problem · reference platform · concrete fix · priority.

## G1 — No field metadata per node (typed schema) — **P1**

**Problem.** `NodeDataEntry.rows?: DataRow[]` returns values with no column schema. The consumer
gets `{ id, label, value, pct?, series?, … }` objects and must infer which fields exist, their
types, units, and which are dimensions vs measures. The engine *already knows* this: the
`EncodingSpec` names `label`/`value`/`series`/`color`/`tooltip` channels, `ColumnDef` carries
`format` + `label` (LocaleString), and `FieldConfig`/`ProvenanceRecord` carry units. That
knowledge is discarded at the JSON boundary.

**Reference.** Grafana `DataFrame.schema.fields[]` — each field has `name`, `type`
(`number`/`string`/`time`/`boolean`), `config` (unit, displayName, decimals), `labels`.
Metabase/Superset return `cols[]` with `name`, `base_type`, `display_name`, `unit`.

**Fix.** Introduce a typed frame contract, attached per node:

```ts
export type FieldType = 'number' | 'string' | 'time' | 'boolean'
export type FieldRole = 'dimension' | 'measure' | 'meta'   // OLAP / tidy-data distinction

export interface FieldSchema {
  name:          string                // DataRow key, e.g. 'value' | 'label' | 'pct'
  type:          FieldType
  role:          FieldRole             // derived from EncodingSpec
  displayLabel?: string                // from ColumnDef.label / encoding
  unit?:         string                // from FieldConfig / encoding (Grafana FieldConfig.unit)
  format?:       string                // FORMATTERS registry key
}
export interface NodeDataFrame { schema: { fields: FieldSchema[] }; rows: DataRow[] }
```

Derive `fields` from the node's `EncodingSpec` (for `query`/`transform`) + `NodeBase.fieldConfig`
for units, falling back to type-sniffing the first row for specs with no encoding (`row-list`,
`timeseries`, `growth`, `ratio-list`). Put the derivation in a new `engine/core` helper
`deriveFieldSchema(spec, rows, fieldConfig)` so HTML/API/PDF targets share one SSOT and the React
layer stays thin. **Trade-off (ISO 25010):** +compatibility/+usability/+analysability; small
−performance + −simplicity. Worth it — schema inference by every consumer is the worse duplication.

## G2 — Error silencing (`catch {}`) — **P1, blocking**

**Problem.** `walkNode` swallows any `interpretSpec` throw and omits `rows`. The snapshot cannot
distinguish *failure* from *empty* — a dashboard blank from a backend error looks identical to one
with no data for the selected filters. `interpretSpec` itself already degrades for unknown spec
types (returns `[]` + a diagnostic), so the only throws reaching this `catch` are genuine
resolution failures — exactly the ones a consumer must see.

**Reference.** Grafana frames carry `meta.notices: [{ severity, text }]` and the response has a
per-`refId` `error` + `status`. RFC 9457 (Problem Details) is the canon's API error contract.

**Fix.** Add a structured status to `NodeDataEntry`; never swallow:

```ts
export interface NodeDataEntry {
  // …
  frame?:   NodeDataFrame                  // replaces bare rows? (G1)
  status:   'ok' | 'empty' | 'error'       // explicit, never inferred
  notices?: { severity: 'error'|'warning'|'info'; text: string; specType?: string }[]
}
```

`catch (e)` → `status: 'error'` + a notice with the message and `spec.type`; a successful resolve
with zero rows → `status: 'empty'`. **Also** wire the engine's existing diagnostics
(`emitDiagnostic`/`diagWarning` from `registry/diagnostics`) into a collector so `UNKNOWN_SPEC_TYPE`
/ `UNKNOWN_METRIC_REF` warnings become notices instead of vanishing into the console.
**Trade-off:** +reliability/+observability, −"clean-looking output" (the cleanliness was a lie).
Refuses the symptom patch (empty rows) for the root cause (visible failure).

## G3 — No node metadata (variant, caps, specType) — **P2**

**Problem.** `NodeDataEntry` has `type`, optional `id`, rows, children. Missing: `variant` (the
node carries it — `NodeBase.variant`), display `title`, `caps` the registry already knows
(`nodeRegistry.getCaps(type, variant)`), and the `DataSpec` type that produced the rows. A
consumer building a UI or export picker over the snapshot must cross-reference the registry by hand.

**Reference.** Builder.io content nodes carry a type discriminant + `meta` on every node.
Retool/AppSmith widgets expose capabilities at the data boundary. Grafana panel JSON carries
`title`, `type`, `pluginVersion`.

**Fix.**

```ts
export interface NodeDataEntry {
  type:      string
  id?:       string
  variant?:  string                      // node.variant
  title?:    string                      // node.view?.subtitle / label
  caps?:     readonly NodeCap[]          // nodeRegistry.getCaps(type, variant)
  specType?: string                      // node.data?.type — what produced the frame
  // frame, status, children …
}
```

`caps` requires the target to accept `nodeRegistry` (or a `getCaps` callback) — inject it via
`StaticRenderContext` or an options arg; do **not** push React-registry knowledge into
`engine/core` (dependency arrow). **YAGNI check:** `caps` + `specType` are cheap and unlock the
Constructor's "what can this node do" view — real second caller, build now.

## G4 — Flat rows, no typed column info — **P1 (folded into G1)**

**Problem.** `DataRow[]` is `Record<string, DimVal>`-shaped at the wire; dim-vs-measure split,
column order, and series structure are lost. Long-format (tidy) rows are the correct *storage*
shape, but the consumer has no map back to the wide/pivot view the table renderer uses.

**Reference.** Grafana DataFrame `schema.fields` ordering *is* column order. Cube.dev `resultSet`
exposes `tableColumns()` + `chartPivot()` so consumers reconstruct either shape.

**Fix.** Resolved by `NodeDataFrame.schema.fields` (G1): field order = column order, `role` encodes
dim/measure, `series` field presence signals pivotability. Optionally add a
`pivot?: { seriesField: string; columns: string[] }` hint derived from `EncodingSpec.series` +
`seriesOrder`, so a consumer renders the wide table without re-deriving it. Keep long-format as the
canonical `rows`; the pivot hint is metadata, not duplicated data (SSOT preserved). **Do with G1.**

## G5 — No snapshot-level metadata — **P2**

**Problem.** `PageDataSnapshot` has `sectionCtx` + `generatedAt` + `nodes`. Missing: `pageId`,
`schemaVersion` (the config *has* `PageConfigBase.schemaVersion`), `locale`/`fallbackLocale`
(in `StaticRenderContext`, dropped), `filterParams` that produced the snapshot (dropped), and a
top-level result status (did any node error?).

**Reference.** Builder.io responses carry schema version + locale + variant. Metabase result sets
carry `started_at`, `running_time`, `row_count`. A snapshot with no provenance of *what it is a
snapshot of* is not cacheable or diffable.

**Fix.**

```ts
export interface PageDataSnapshot {
  pageId:         string                 // page.id
  schemaVersion?: number                 // page.schemaVersion
  locale:         string; fallbackLocale: string
  filterParams:   Record<string, unknown>  // inputs that produced this snapshot — cache key
  sectionCtx:     SectionContext
  status:         'ok' | 'partial' | 'error'  // rollup of node statuses
  nodes:          NodeDataEntry[]
  generatedAt:    string
  durationMs?:    number                 // Metabase running_time analogue
}
```

`filterParams` + `pageId` + `schemaVersion` form the natural **cache key** and make the snapshot a
self-describing document. Serves project Law 9 (permalink, last-updated) and Law 5 (API-readiness).
**Trade-off:** +auditability/+cacheability; negligible cost.

## G6 — No pagination — **P3 now, P2 once `ApiStore` is live**

**Problem.** No way to limit rows + return a total count. Every node returns its full `DataRow[]`.
For national-accounts tables this is usually fine (tens-to-hundreds of rows; `TableConfig.rowThreshold`
already exists for the *render* side), but `timeseries`/`query` over `years: 'all'` against a future
`ApiStore` risks unbounded results.

**Reference.** AppSmith/Retool pagination metadata (`total`, `pageSize`, `cursor`). Metabase returns
`row_count` + a truncation flag when a result hit the limit.

**Fix.**

```ts
interface RenderJsonOptions { rowLimit?: number; warm?: boolean }
interface NodeDataFrame { /* … */ totalRows?: number; truncated?: boolean }
```

Apply `rowLimit` after `interpretSpec`; record `totalRows` from the pre-slice length. **YAGNI:**
ship the *contract fields* now (cheap, forward-compatible), wire enforcement only when `ApiStore`
lands — encode-the-seam-not-the-speculative-feature. P3 while all stores are in-memory.

## G7 — No per-node export formats — **P2**

**Problem.** `listExportFormats()` knows CSV / SDMX-JSON / plugin formats exist, and
`NodeCap`/`view.exportable` signal whether a node is exportable, but the snapshot says nothing about
*which formats this node's data can export to*. A consumer building an export menu over the JSON
must call back into a registry it may not have.

**Reference.** Metabase/Superset return available download formats alongside each result set.
Grafana's panel inspect lists per-panel export options.

**Fix.** When a node is exportable (`view.exportable` or an `'export'` cap):

```ts
interface NodeDataEntry { /* … */ exportFormats?: { id: string; label: string; mime: string; ext: string }[] }
```

Populate from `listExportFormats()` mapped through `getExportFormat(id)` (label/mime/ext already on
`ExportFormat`). Gate on exportability so the field is absent for non-data nodes. Makes the snapshot
a complete, self-contained API document — no registry round-trip. **P2.**

## G8 — `collectChildNodes` walks `DataSpec` as a child node — **P1, active bug**

**Problem (confirmed, not hypothetical).** `collectChildNodes` (nodeWalk.ts) iterates *every* key
of a node and treats any object/array-item with `type: string` as a child node — **including the
`data` key**, which is a `DataSpec`. A `{ type: 'query', … }` DataSpec satisfies `isNodeObject`, so
it is pushed as a phantom child and recursed into, emitting a junk
`NodeDataEntry { type: 'query', children: [] }`. For `pivot`/`transform` specs, their nested
`rows`/`source` object arrays are also walked. `warm.ts` shares the flaw (less harmful —
`extractRequirements` returns `[]` for a non-spec). Violates **Principle of Least Astonishment** —
a generic walker too generic to tell structural node-children from data-payload sharing the `type`
shape.

**Reference.** Builder.io distinguishes `children` (the slot tree) from `component.options`
(data/config) *structurally* — config is never walked as the element tree. The discriminant must be
*position in a known slot*, not "has a `type` field."

**Fix (root cause — recommend B).**
- **A (denylist):** exclude reserved data-carrying keys (`data`, `transforms`, `fieldConfig`,
  `dataLinks`, `vars`, `view`) from `collectChildNodes`. Fast, but brittle — a new reserved key
  reintroduces the bug (Shotgun Surgery risk).
- **B (allowlist via registry slots — recommended):** child nodes live only in declared slots. The
  registry already has `getSlots(type, variant)` + `canHaveChildren`. Walk only slot-keyed fields
  (plus conventional `children`), not arbitrary `type`-bearing objects. Structurally correct by
  contract; aligns the walker with the renderer's own slot model (SSOT for "what is a child"). The
  `engine/core` walker takes an injected `isChildSlot(node, key)` predicate to stay registry-decoupled;
  the React target supplies the registry-backed implementation.

**Trade-off:** B is +correctness/+maintainability, −a little generality (intentional — the
generality *was the bug*). Do A as a hotfix if B is >1 day out; B is the correct resolution. **P1.**

## G9 — No diff / incremental snapshot — **P3**

**Problem.** The snapshot is always full. A consumer re-fetching after a filter change recomputes
and re-serializes the entire tree, even if only the nodes whose `data` depends on the changed dim
actually changed.

**Reference.** Grafana streaming/partial frame updates; GraphQL field-level selection; HTTP
`ETag`/`If-None-Match` conditional responses.

**Fix (staged — do not over-build).**
1. **Now (cheap):** make the snapshot content-addressable — emit a stable `etag` (hash of
   `filterParams` + `schemaVersion` + node frames) at page level, so a caller can short-circuit a
   conditional request. The 80/20 win; rides on G5 metadata.
2. **Later (only if measured):** per-node `etag` + `renderPageToJSON(page, ctx, { since: etag })`
   returning only changed nodes. Needs a dependency map (which dims each spec reads —
   `extractRequirements` already exposes dims per requirement, so the seam exists).

**YAGNI verdict:** full incremental diffing is **P3** — do not build until a real large-page +
frequent-filter-change workload exists. Ship the page-level `etag` with G5; defer node-level diff
behind a perf trigger.

## G10 — Warm target not composited with JSON target — **P2**

**Problem.** `warmPageStore` is a separate call. A caller wanting a warm, cache-hit JSON snapshot
must orchestrate `warmPageStore` then `renderPageToJSON` by hand, in the right order. The two share
the *same tree walk and requirement extraction* but duplicate the traversal. Worse,
`renderPageToJSON` against an `ApiStore` with no warm-up does N point reads instead of one batched
prefetch — the exact N+1 the warm target exists to prevent.

**Reference.** Grafana's query path warms its own cache transparently — a consumer never calls
"warm" then "query." Cube.dev's `load()` handles pre-aggregation internally.

**Fix.**

```ts
export function renderPageToJSON(
  page: NodePageConfig, ctx: StaticRenderContext, opts?: { warm?: boolean; rowLimit?: number },
): PageDataSnapshot {
  if (opts?.warm) warmPageStore(page, ctx)   // one batched prefetch, then cache-hit resolves
  // … walk
}
```

Keep `warmPageStore` exported for warm-then-HTML callers. **Deeper fix (P3, platform-level):** both
targets re-walk the tree independently. Promote a single `walkPageTree(page, visitor)` traversal
that `warm`, `api`, and `html` all drive — one traversal, three visitors (Visitor pattern). Removes
the triplicated walk and the G8 bug-surface in one place. **Trade-off:** +performance/+DRY/+consistency;
the composition is trivial, the shared-walk refactor is the bigger (deferrable) win.
