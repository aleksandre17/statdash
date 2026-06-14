# all-types.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Complete TypeScript Type Reference — Geostat National Accounts
 *
 * All types from @geostat/expr + @geostat/engine + @geostat/react.
 * This file is the canonical reference — not for import (use package imports).
 *
 * Import from:
 *   @geostat/expr   — Expr, ExprRef, ExprVal, DimVal, DeriveMap, ExprScope
 *   @geostat/engine — DataRow, DataSpec, DataStore, Observation
 *   @geostat/react  — NodeBase, NodeDef, ThemeConfig, RenderContext, ...
 */

import type { ReactNode } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// @geostat/expr — engine/expr/
// ═══════════════════════════════════════════════════════════════════════════

/** Scalar value universe */
type DimVal = string | number | boolean | null

/**
 * ExprRef — scalar reference into scope. ALWAYS resolves to DimVal.
 * ISP contract: ExprRef → DimVal only. Never DataRow[].
 * (Array references → ListRef, separate type by design.)
 */
type ExprRef =
  | { $ctx:     string }   // scope.dims[key]      — filter param (user selection)
  | { $derived: string }   // scope.derived[key]   — evalDerived() output
  | { $row:     string }   // scope.row?.[key]      — current row inside collection op ONLY
                           // OUTSIDE collection op: scope.row = undefined → returns null (never throws)
                           // evalExpr guard: if (!scope.row) return null
  | { $literal: DimVal }   // literal scalar — explicit, unambiguous, no scope lookup

/**
 * ListRef — array reference for collection op 'list' field.
 * Intentionally separate from ExprRef — ISP:
 *   ExprRef  → DimVal   (scalar, uniform contract, evalExpr<T> stays clean)
 *   ListRef  → DataRow[] (array, collection context only)
 *
 * evalExpr resolves ListRef only in collection op 'list' position.
 * ExprRef never gains dual return type (scalar | array) — this separation prevents it.
 *
 * Current variant:
 *   { $rows: true } → scope.rows: DataRow[]  (the only current array source)
 *
 * Extension path (when DimVal gains array variant for multi-select):
 *   | { $ctx: string }   // scope.dims[key] as string[] — open, no breaking change
 */
type ListRef =
  | { $rows: true }   // scope.rows: DataRow[] — current rendered rows

/** Anything that resolves to a DimVal at runtime */
type ExprVal = Expr | ExprRef | DimVal

/** Full composable expression language — all JSON-serializable */
type Expr =
  // ── Comparison ──────────────────────────────────────────────────────────
  | { op: 'eq';  left: ExprVal; right: ExprVal }
  | { op: 'ne';  left: ExprVal; right: ExprVal }
  | { op: 'gt';  left: ExprVal; right: ExprVal }
  | { op: 'lt';  left: ExprVal; right: ExprVal }
  | { op: 'gte'; left: ExprVal; right: ExprVal }
  | { op: 'lte'; left: ExprVal; right: ExprVal }
  | { op: 'in';  left: ExprVal; right: ExprVal[] }
  | { op: 'nin'; left: ExprVal; right: ExprVal[] }
  | { op: 'null';   value: ExprVal }
  | { op: 'exists'; value: ExprVal }

  // ── Logic ────────────────────────────────────────────────────────────────
  | { op: 'and'; exprs: Expr[] }
  | { op: 'or';  exprs: Expr[] }
  | { op: 'not'; expr:  Expr }
  | { op: 'if';  cond: Expr; then: ExprVal; else?: ExprVal }

  // ── String ───────────────────────────────────────────────────────────────
  | { op: 'template';   tmpl: string }
  | { op: 'concat';     values: ExprVal[] }
  | { op: 'startsWith'; left: ExprVal; right: string }
  | { op: 'includes';   left: ExprVal; right: string }

  // ── Math ─────────────────────────────────────────────────────────────────
  | { op: 'add'; left: ExprVal; right: ExprVal }
  | { op: 'sub'; left: ExprVal; right: ExprVal }
  | { op: 'mul'; left: ExprVal; right: ExprVal }
  | { op: 'div'; left: ExprVal; right: ExprVal }
  | { op: 'mod'; left: ExprVal; right: ExprVal }

  // ── Lookup ───────────────────────────────────────────────────────────────
  | { op: 'get'; ref: ExprRef; path: string }        // 'address.city'
  | { op: 'coalesce'; values: ExprVal[] }            // first non-null

  // ── Collection ───────────────────────────────────────────────────────────
  // list: ListRef — resolves to DataRow[] (NOT ExprRef/DimVal — ISP: separate contracts)
  // Inside the collection body, each row is bound to scope.row → $row refs resolve.
  // Nesting: DataRow values are DimVal scalars — iterating a field as DataRow[] is
  //   structurally impossible. Collection ops are flat-only by design (not a missing feature).
  | { op: 'some';   list: ListRef; expr: Expr }
  | { op: 'every';  list: ListRef; expr: Expr }
  | { op: 'filter'; list: ListRef; expr: Expr }
  | { op: 'count';  list: ListRef }
  | { op: 'map';    list: ListRef; expr: ExprVal }

  // tree-field / map-field → @geostat/engine DeriveEntry (data-access, not here)

/**
 * DeriveMap — ordered pure expression entries
 * Array (NOT Record) — evaluation order explicit, JSON-safe, Constructor-safe
 * Each entry may reference $derived from EARLIER entries only (DAG contract).
 * Forward ref or cycle → evalDerived returns undefined for that key (fail-safe, not throw).
 * Use validateDeriveMap() to detect issues at authoring time.
 */
type DeriveMap = Array<{ key: string; expr: ExprVal }>

/**
 * DeriveOrderError — returned by validateDeriveMap() for authoring-time detection.
 *
 * 'forward-ref': entry K references a key defined at entry K+n (reorder to fix).
 * 'circular':    entry A → B → A (cycle — cannot fix by reordering; redesign needed).
 *
 * evalDerived() itself never throws — fail-safe by design.
 * validateDeriveMap() is the authoring-time gate: Constructor blocks save, tests assert.
 */
interface DeriveOrderError {
  key:           string     // the entry whose expr contains the bad reference
  referencedKey: string     // the $derived key that caused the problem
  reason:        'forward-ref' | 'circular'
}

/**
 * validateDeriveMap — static utility (@geostat/expr, zero deps).
 * Topological analysis: detects forward references and cycles.
 * Returns [] if the map is a valid DAG. Non-empty = authoring bug.
 *
 * Usage:
 *   Constructor:  validateDeriveMap(derive) → block save if non-empty
 *   Tests:        expect(validateDeriveMap(derive)).toEqual([])
 *   Config lint:  run in CI on all feature page configs
 */
declare function validateDeriveMap(derive: DeriveMap): DeriveOrderError[]

/**
 * ExprScope — passed to evalExpr. Immutable by convention except for row (see below).
 *
 * Performance contract (P-1 — single mutable innerScope):
 *   evalExpr MUST NOT cache the scope reference.
 *   It reads scope fields by value at call time.
 *   This allows collection op impls to mutate innerScope.row in place
 *   rather than spreading { ...scope, row } per iteration:
 *
 *   ❌ const innerScope = rows.map(r => evalExpr(expr, { ...scope, row: r }))
 *      → N object allocations for N rows
 *
 *   ✅ const inner = { ...scope, row: undefined }
 *      rows.some(r => { inner.row = r; return evalExpr(expr, inner) })
 *      → 1 object allocation total
 *
 *   Contract: evalExpr reads scope.row once per call. No caching.
 *   TypeScript: row is intentionally mutable (not readonly).
 */
interface ExprScope {
  dims:    Record<string, DimVal>   // filter params from defineFilters()
  derived: Record<string, DimVal>   // evalDerived() / evalNodeDerive() output — caller assigns,
                                    // evalExpr never mutates.
  rows?:   DataRow[]                // bound by collection ops (list: ListRef resolves here)
  row?:    DataRow                  // mutable — collection op sets per-iteration (see contract above)
                                    // undefined outside collection op → $row ref returns null (never throws)
  // store: DataStore — REMOVED (circular dep — engine handles DataLookupOp)
}

/**
 * evalDerived — @geostat/expr. Pure ExprVal entries only.
 *
 * Pure function — returns NEW derived record. Never mutates scope.
 * Caller assigns: const derived = evalDerived(map, scope)
 * DAG contract: entries evaluated sequentially; $derived[K] available to entries after K.
 */
declare function evalDerived(
  map:   DeriveMap,
  scope: ExprScope
): Record<string, DimVal>

/**
 * evalExpr — @geostat/expr. Core expression evaluator. Generic — caller specifies T.
 * Resolves any ExprVal (literal DimVal, ExprRef, or Expr) against a scope.
 *
 * Inline DimVal  → returned as-is (zero cost)
 * ExprRef        → { $ctx: 'key' }     → scope.dims['key']
 *                  { $derived: 'key' } → scope.derived['key']
 *                  { $row: 'field' }   → scope.row?.['field'] (null outside collection op)
 *                  { $literal: v }     → v
 * Expr           → evaluated recursively (all ops in Expr union)
 *
 * visibleWhen:  evalExpr<boolean>(node.visibleWhen, ctx.scope)
 * derive entry: evalExpr<DimVal>(entry.expr, scope)
 * view field:   evalExpr<string>(view.subtitle, scope)
 *
 * Performance contract (P-1):
 *   evalExpr reads scope fields at call time. It does NOT cache the scope reference.
 *   Collection op callers rely on this to mutate scope.row in place (one object, not N).
 *   See ExprScope for the innerScope mutation pattern.
 */
declare function evalExpr<T = DimVal>(expr: ExprVal, scope: ExprScope): T

/**
 * evalTemplate — @geostat/expr. Template string evaluator.
 * Sugar: evalTemplate(tmpl, scope) = evalExpr<string>({ op: 'template', tmpl }, scope)
 * '{time} · მლნ ₾'  →  '2024 · მლნ ₾'
 * Bracket syntax: {key} replaced by scope.dims[key] or scope.derived[key].
 */
declare function evalTemplate(tmpl: string, scope: ExprScope): string

// ═══════════════════════════════════════════════════════════════════════════
// @geostat/engine — engine/core/
// ═══════════════════════════════════════════════════════════════════════════

// ── SDMX types ──────────────────────────────────────────────────────────────

/**
 * Raw observation from the data cube. One row per observation cell.
 * Immutable by convention. Fields = any SDMX dimension + built-in 'value', 'measure'.
 * Produced by fromSDMX() and fromRawSQL() at the format boundary.
 */
type Observation = Readonly<Record<string, DimVal>>

/**
 * CtxRef — runtime reference to SectionContext.dims, resolved at interpretSpec time.
 * { $ctx: 'time' } → ctx.dims['time'].  Analogous to Vega-Lite signals.
 * JSON-serializable — can be stored in config objects (Constructor-safe).
 */
type CtxRef = { $ctx: string }

/**
 * NeRef — negation filter: exclude a literal value from a dimension.
 * { $ne: '_T' } → WHERE sector != '_T'   (SDMX total code exclusion).
 * JSON-serializable.
 */
type NeRef = { $ne: DimVal }

/**
 * NeCtxRef — negation + optional ctx narrowing (combined pattern).
 * { $ne: '_T', $ctx: 'sector' }:
 *   always excludes $ne value AND, if ctx[$ctx] is set, also restricts to that value.
 */
type NeCtxRef = { $ne: DimVal; $ctx: string }

/** Filter value — literal, array, CtxRef, NeRef, or NeCtxRef. All JSON-serializable. */
type FilterValue = DimVal | DimVal[] | CtxRef | NeRef | NeCtxRef

/**
 * ObsQuery — dimension-agnostic store query. The engine's N-dimensional cube slice.
 *
 * measure: one or more indicator codes ('B1G', '*' = all).
 * filter:  per-dim filter values — any SDMX dimension key, no hardcoded names.
 *   { geo: 'GE' }                    → filter by geography
 *   { geo: ['GE-TB', 'GE-AJ'] }      → multi-value (IN)
 *   { isCarryForward: { $ne: 1 } }   → SNA carry-forward dedup
 *   { sector: { $ctx: 'sector' } }   → runtime ctx ref
 * orderBy: result ordering (applied after filtering).
 *
 * DataSpecBase.dims:   Record<string, ExprVal> — resolved → ObsQuery.filter at query time.
 * DataSpecBase.filter: additional row-level filter AFTER fetch (isCarryForward, OBS_STATUS, …).
 */
interface ObsQuery {
  measure:   string | string[]                       // indicator code(s); '*' = all measures
  filter?:   Partial<Record<string, FilterValue>>    // open — any SDMX dimension key
  orderBy?:  { field: string; dir: 'asc' | 'desc' }
}

// ── Classifier / DisplayMap — structural ↔ presentational separation ─────────
//
//  Kimball surrogate-key pattern:
//    Facts carry numeric surrogate ids. The Classifier maps id → { code, parent? }.
//    DimResolver translates code → leaf ids on query input; ids → code on output.
//    Consumers (config, UI) always see stable SDMX codes. Ids never leak.
//
//  Display (DisplayMap) is intentionally separate from structure (Classifier):
//    Classifier = stable, structural (code, parent, structural attrs only).
//    DisplayMap = presentational overlay (label, color, fullLabel, i18n).
//    One classifier, many display overlays → i18n/theming without data duplication.

interface ClassifierEntry {
  code:    DimVal           // stable SDMX business code (e.g. 'tbilisi', 'P1')
  parent?: DimVal           // parent id (in Kimball Record form) or code (in Array form)
  [attr: string]: DimVal | undefined   // open structural attrs (isoCode, nutsLevel, …)
}

/**
 * Classifier — dimension codelist. Two equivalent forms:
 *   Array  — SDMX-native: [{ code:'P1', … }]. code IS the key (code = id).
 *   Record — Kimball surrogate-key: { '1': { code:'tbilisi', parent: 0 } }.
 * Engine functions accept both. DimResolver normalizes internally.
 */
type Classifier = ClassifierEntry[] | Record<string, ClassifierEntry>

/**
 * DisplayMap — presentational overlay for one dim. Keyed by id (same space as Classifier).
 * Open attribute bag: label, color, fullLabel, i18n keys — anything UI needs.
 * Engine never reads this directly. Joined with Classifier at $d ref resolution.
 * Per-locale i18n: swap one DisplayMap, leave Classifier untouched.
 */
type DisplayMap = Record<string, Record<string, DimVal | undefined>>

/** Classifier view — which view of the codelist to return when resolving a ref. */
type ClassifierView = 'byCode' | 'items' | 'leaves' | 'rollups'

/**
 * ClassifierRef — structural reference. Resolves to classifier entries (code, parent, attrs).
 * NO display merge. Use when consumers need hierarchy edges or structural attrs only.
 * e.g. lookup.from: { $cl: 'geo' } → code-keyed dict of { code, parent, nutsLevel }
 */
interface ClassifierRef {
  $cl:   string
  view?: ClassifierView
}

/**
 * DisplayRef — UI reference. Resolves to display entries with classifier 'code' injected.
 * Use for label/color joins in pipelines and filter option sources.
 * e.g. lookup.from: { $d: 'geo' } → code-keyed dict of { code, label, color }
 */
interface DisplayRef {
  $d:    string
  view?: ClassifierView
}

/** Union of dim refs — resolved by engine via resolveDimRef(). */
type DimRef = ClassifierRef | DisplayRef

/**
 * DataBundle<F> — universal contract every dataset module exports.
 * Structural (classifiers) and presentational (display) concerns stay split.
 * Passed to ExternalStore constructor. JSON-serializable.
 */
interface DataBundle<F extends Observation = Observation> {
  facts:        readonly F[]
  classifiers?: Record<string, Classifier>
  display?:     Record<string, DisplayMap>
}

// ── EngineRow / DataRow — two layers of the data pipeline ────────────────────
//
//  EngineRow: raw pipe output from store.query() + applyPipeline().
//    Plain record. No semantic field names. Renderer-agnostic.
//    Analogous to Grafana DataFrames (raw) or Vega-Lite 'data'.
//
//  DataRow: structured output after applyEncoding(rows, encodingSpec).
//    Well-known fields: label, value, series, pct, color, level, parentId, …
//    Both Chart and Table receive DataRow[] — same type, same encoding spec.
//    Analogous to Grafana panel field overrides, Vega-Lite mark+encoding layer.
//
//  Pipeline:
//    store.query() → EngineRow[] → applyPipeline() → EngineRow[] → applyEncoding() → DataRow[]

/** Intermediate pipe output — raw field→value record, renderer-agnostic. */
type EngineRow = Record<string, DimVal>

/**
 * DataRow — structured output of applyEncoding(). Input to Chart and Table renderers.
 * Both renderers receive the same DataRow[]; visual logic lives in the renderer.
 * Grammar of Graphics separation: data layer (DataRow[]) ≠ rendering (Chart/Table).
 *
 * status: SDMX OBS_STATUS — data quality flag (IMF/Eurostat standard).
 *   A = normal (default, not displayed) | p = preliminary | e = estimate | r = revised | c = confidential
 */
interface DataRow {
  id:           string
  label:        string
  value:        number
  series?:      string      // grouping dimension → Chart: multi-series; Table: pivot columns
  pct?:         number
  color?:       string
  isTotal?:     boolean
  isSeparator?: boolean
  level?:       number      // hierarchy depth (0=root). SDMX HierarchicalCodelist / OLAP drill-down.
  parentId?:    string      // parent DataRow.id — enables tree rendering and roll-up aggregation
  status?:      'A' | 'p' | 'e' | 'r' | 'c'
}

// ── EncodingSpec — Grammar of Graphics field→channel mapping ─────────────────
//
//  Declarative mapping: observation/pipe fields → DataRow visual channels.
//  Analogous to Vega-Lite encoding block / Grafana field overrides.
//  100% JSON-serializable — Constructor can generate these without code.
//
//  One EncodingSpec drives BOTH Table (column mapping) and Chart (axis mapping).
//  Golden rule: data is never pivoted inside the spec. EncodingSpec tells
//  the renderer HOW to pivot. DataRow[] is always long format (one obs per row).

/**
 * EncodingSpec — maps EngineRow fields to DataRow visual channels.
 * Applied by applyEncoding() as the final step of interpretSpec.
 * Part of DataSpecBase so it travels with the data declaration (not the renderer).
 */
interface EncodingSpec {
  label:          string           // which field → DataRow.label (x-axis / table row label)
  value?:         string           // which field → DataRow.value. Default: 'value'.
  series?:        string           // which field → DataRow.series (grouping / pivot dim)
  color?:         string           // which field → DataRow.color (per-row explicit color)

  /** Compute DataRow.pct:
   *   { of: 'CODE' }     → value / store.val('CODE', ctx) × 100   (OLAP denominator lookup)
   *   { sumOf: 'field' } → value / Σ obs[field] × 100             (Tableau % of total)
   *   { field: 'pct' }   → read directly from observation field (pre-computed)
   */
  pct?:           { of: string } | { sumOf: string } | { field: string }

  negate?:        string[]         // measure codes whose values are negated (debit/outflow rows)

  seriesFormat?:  Record<string, string>   // { seriesName: formatterName } — references FORMATTERS
  seriesOrder?:   string[]                 // explicit left-to-right column / legend order

  tooltip?:       string[]         // extra fields shown in chart tooltip + table row hover

  // Structural / hierarchy channels (mapped from pipe metadata fields like _level, _parentId)
  id?:            string           // field → DataRow.id (overrides auto-generated id)
  isSeparator?:   string           // truthy field → DataRow.isSeparator
  isTotal?:       string           // truthy field → DataRow.isTotal
  level?:         string           // integer field → DataRow.level (indent / nesting depth)
  parentId?:      string           // field → DataRow.parentId (tree linking)
}

/**
 * applyEncoding — @geostat/engine. Pure function: EngineRow[] + EncodingSpec → DataRow[].
 * No store, no context, no side effects.
 * The 'lookup' callback handles pct.of variant: (code) => store.val(code, ctx).
 * Callers curry it from the store; defaults to () => 0 when no store is available.
 */
declare function applyEncoding(
  rows:   readonly EngineRow[],
  enc:    EncodingSpec,
  lookup?: (code: string) => number
): DataRow[]

// ── DataStore ─────────────────────────────────────────────────────────────────

/**
 * DataStore interface — all store implementations must satisfy.
 * SYNC — store handles caching internally. Engine never awaits.
 *
 * Three outcomes from query():
 *   return EngineRow[] → cache hit          → render proceeds (interpretSpec applies encoding)
 *   throw Promise      → cache miss/loading → React Suspense → skeleton shown
 *   throw StoreError   → fetch failed       → NodeErrorBoundary → error shell
 *
 * classifiers: per-dim surrogate-key codelists. Engine uses for code↔id translation + rollup.
 * display:     per-dim presentational overlay. Engine ignores; consumer-facing $d refs join it.
 * invalidate() — force cache clear. Triggers re-fetch on next render cycle.
 */
interface DataStore {
  query(q: ObsQuery): EngineRow[]
  invalidate(href?: string): void        // href omitted → clear all. href provided → clear that entry.
  readonly classifiers?: Record<string, Classifier>
  readonly display?:     Record<string, DisplayMap>
  // Optional — implemented by plugin-created stores (not required for static/test stores)
  testConnection?(): Promise<{ ok: boolean; message?: string }>
  getMetadata?():   Promise<DatasourceMetadata>
}

/**
 * StoreError — thrown by HttpDataStore on fetch failure (instead of raw Error).
 * Carries retry metadata so NodeErrorBoundary can offer a "Retry" button.
 *
 * retryable: true  = transient (5xx, network timeout) → show "Retry" button
 * retryable: false = permanent (4xx: 401/403/404)    → show permanent error, no retry
 * attempts: how many times this href has been tried (for backoff/max-retry logic)
 */
interface StoreError extends Error {
  retryable: boolean
  attempts:  number
  status?:   number   // HTTP status code if available (undefined = network error)
}

// ── Datasource plugin system ───────────────────────────────────────────────
//
// Framework-level: agnostic to format (SDMX, REST-JSON, CSV, SQL, static, …).
// Each plugin type is registered once. Multiple instances per plugin (different URLs/auth).
//
// Grafana analogue: DataSourcePlugin + DataSourceSettings + DataSourceApi
// Retool analogue:  ResourcePlugin  + ResourceConfig      + ResourceClient

/**
 * AuthConfig — JSON-serializable auth descriptor. Plugin's create() reads this
 * and applies headers/credentials to its fetch/client. Engine never reads AuthConfig.
 *
 * Discriminated union — new auth schemes added without breaking existing ones.
 * Stored in DB as JSON alongside DatasourceInstanceConfig.
 */
type AuthConfig =
  | { type: 'none' }
  | { type: 'bearer';  token: string }
  | { type: 'basic';   username: string; password: string }
  | { type: 'apikey';  header: string;   value: string }
  | { type: 'custom';  headers: Record<string, string> }

/**
 * ResponseMeta — present in every API response envelope.
 * Aligned with SDMX-JSON `meta` block and JSON:API `meta` field.
 * All endpoints return the same outer shape — meta is always present.
 */
interface ResponseMeta {
  id:       string    // dataset/resource identifier: 'NA_GE', 'GDP_GE'
  prepared: string    // ISO 8601 timestamp — when the response was generated
  label?:   string    // human-readable name — for Constructor datasource list
  version?: string    // optional data revision label: '2024Q3', 'preliminary'
}

/**
 * DatasourceStructure — classifiers + display bundle.
 * Appears in ApiResponse.structure (both combined and structure-only responses).
 * Mirrors SDMX-JSON `structure` block — but format-agnostic.
 */
interface DatasourceStructure {
  classifiers?: Record<string, Classifier>
  display?:     Record<string, DisplayMap>
}

/**
 * ApiResponse<T> — standard envelope for all datasource API responses.
 *
 * Every endpoint our platform calls returns this shape. Plugins parse it.
 * Aligned with SDMX-JSON (meta + data + structure) and JSON:API (meta always present).
 *
 * Three response modes (discriminated by which fields are present):
 *   structure-only: { meta, structure }           — fast, cacheable, classifiers + display
 *   data-only:      { meta, data }                — observations, no structure overhead
 *   combined:       { meta, structure, data }     — one request gets everything
 *
 * T = payload type. Observation[] for datasources. Generic for other endpoints.
 * JSON-safe: yes — all fields are plain objects. Constructor stores as-is.
 */
interface ApiResponse<T = unknown> {
  meta:       ResponseMeta
  structure?: DatasourceStructure   // classifiers + display — present when type has structure
  data?:      T                     // observations or other payload
}

/**
 * DatasourceInstanceConfig — JSON-serializable datasource configuration.
 * Stored in DB. Constructor writes it. buildStoreManifest() reads it.
 *
 * Resolution priority for classifiers/display (highest to lowest):
 *   Tier 1 — config.classifiers / config.display   : in-manifest (DB or TypeScript). Zero HTTP.
 *   Tier 2 — config.structureUrl                   : fetched at bootstrap, before React mounts.
 *   Tier 3 — config.url response.structure          : arrives with observations (Suspense timing).
 *
 * Tier 1 is fastest (no HTTP). Use for Phase 1 (TypeScript) and Phase 2 (DB).
 * Tier 2 guarantees filters are populated before any page renders — separate cacheable request.
 * Tier 3 is simplest config — one URL — but filter dropdowns wait for data load.
 *
 * url:          data endpoint → ApiResponse<Observation[]>
 * structureUrl: structure-only endpoint → ApiResponse (structure field) — fetched at bootstrap.
 *               Absent → structure comes from Tier 1 (config) or Tier 3 (data response).
 * classifiers/display: Tier 1 — universal fields, top-level (NOT in options).
 *   Engine and OptionsSource read these regardless of plugin. Never nest in options.
 * options:      plugin-private — engine ignores, plugin reads for format-specific config.
 *
 * JSON-safe: yes. JSON.parse(JSON.stringify(config)) === config ✅
 */
interface DatasourceInstanceConfig<TOptions = Record<string, unknown>> {
  id:            string
  plugin:        string
  url?:          string         // data endpoint  → ApiResponse<Observation[]>
  structureUrl?: string         // structure endpoint → ApiResponse (structure only, bootstrap)
  auth?:         AuthConfig
  classifiers?:  Record<string, Classifier>   // Tier 1: in-manifest — universal, zero HTTP
  display?:      Record<string, DisplayMap>   // Tier 1: in-manifest — universal, zero HTTP
  options?:      TOptions                     // plugin-private — engine ignores
}

/**
 * DatasourceMetadata — what a datasource exposes for Constructor query builder UI.
 * Returned by DatasourcePlugin.getMetadata() — optional, not required for data rendering.
 * Pattern: Grafana getMetricMetadata() / getTagValues().
 */
interface DatasourceMetadata {
  indicators: Array<{ code: string; label: string; unit?: string }>
  dimensions: Array<{ key: string; label: string; values: Array<{ code: string; label: string }> }>
}

/**
 * DatasourcePlugin — factory for DataStore instances. Registered once per plugin type.
 * engine.registerDatasource(plugin) → available to buildStoreManifest().
 *
 * id:          unique plugin identifier ('sdmx-api', 'rest-json', 'csv', 'sql', 'static')
 * displayName: shown in Constructor datasource picker
 * create():    called once per DatasourceInstanceConfig → returns DataStore
 * testConnection(): optional — Constructor "Test connection" button
 * getMetadata():    optional — Constructor query builder dimension/indicator picker
 *
 * TOptions generic: plugin defines its own option shape. Engine treats as unknown.
 * No SDMX-specific fields here — plugin file adds what it needs in TOptions.
 */
interface DatasourcePlugin<TOptions = Record<string, unknown>> {
  id:          string
  displayName: string
  // resolvedClassifiers/Display: merged from Tier 1 (config fields) + Tier 2 (structureUrl fetch)
  // by buildStoreManifest before create() is called. Plugin handles Tier 3 inside fetcher.
  create:      (
    config:               DatasourceInstanceConfig<TOptions>,
    resolvedClassifiers?: Record<string, Classifier>,
    resolvedDisplay?:     Record<string, DisplayMap>,
  ) => DataStore
  testConnection?: (config: DatasourceInstanceConfig<TOptions>) => Promise<{ ok: boolean; message?: string }>
  getMetadata?:    (config: DatasourceInstanceConfig<TOptions>) => Promise<DatasourceMetadata>
}

/**
 * DataSpecBase — shared fields for all named-query DataSpec types
 *
 * Store resolution order in interpretSpec:
 *   1. href    → HttpDataStore (Phase 2: no registry, URL is identity)
 *   2. storeId → ctx.stores[storeId] (Phase 1: named store)
 *   3. (none)  → ctx.stores[pageStoreKey] ?? ctx.stores['default']
 */
interface DataSpecBase {
  storeId?:   string                          // Phase 1: named store registry key
  href?:      string                          // Phase 2: direct URL → HttpDataStore (C-4)
  transform?: string                          // parse fn key registered via engine.registerTransform()
                                              // absent:      store returns EngineRow[] directly — no transform
                                              // 'fromSDMX':  SDMX-JSON raw → Observation[] → EngineRow[]
                                              // unknown key: interpretSpec throws → NodeErrorBoundary (masks bugs)
  dims?:      Record<string, ExprVal>         // dimensional slice — open, no hardcoded keys:
                                              //   { geo: {$ctx:'geo'}, time: {$ctx:'time'} }
                                              //   { OBS_STATUS: {$literal:'P'} }  ← vintage/preliminary
                                              //   { BREAKDOWN: {$ctx:'sector'} }  ← any SDMX dimension
  filter?:    Record<string, FilterValue>     // row-level filter AFTER fetch — open key set:
                                              //   { isCarryForward: 0 }            ← SNA dedup
                                              //   { OBS_STATUS: { $ne: 'P' } }    ← final obs only
                                              //   { sector: { $ctx: 'sector' } }  ← runtime ctx ref
  sort?:      { field: string; dir: 'asc' | 'desc' }
  derive?:    DeriveMap                       // post-fetch derived fields (ExprVal entries only)
  pipe?:      TransformStep[]                 // inline transform pipeline (15 operations):
                                              //   melt · rename · cast · filter · sort · derive ·
                                              //   aggregate · rollup · lookup · join · group · concat ·
                                              //   template · addField · select
                                              //   Applied by applyPipeline() AFTER store.query(), BEFORE encoding.
                                              //   JSON-serializable ✅ — Constructor-safe ✅
  encoding?:  EncodingSpec                    // Grammar of Graphics channel mapping.
                                              //   Applied by applyEncoding() AFTER pipe → DataRow[].
                                              //   Both Chart and Table receive same DataRow[].
                                              //   JSON-serializable ✅ — Constructor can generate these.
  ttl?:       number                          // cache TTL in seconds. 0 = session cache (default).
                                              // After TTL: stale-while-revalidate (return cached, re-fetch in bg)
                                              // Constructor stores as plain number — JSON-safe.
}

// ── TransformStep — declarative, JSON-serializable pipeline step ─────────────
//
//  A pipeline of TransformSteps mirrors Vega-Lite's 'transform' array.
//  All steps are plain objects — Constructor/admin panel can generate them without code.
//  Applied in sequence by applyPipeline(rows, steps, ctx?).
//  PipelineContext injects classifiers + display for $cl/$d ref resolution in lookup/join.
//
//  15 operations — see examples/transform-pipeline.md for detailed examples.
//  DeriveExpr: row-level expression tree or string formula ('value / total * 100').

/** Pipeline execution context — injected into steps that need runtime resolution. */
interface PipelineContext {
  classifiers?: Record<string, Classifier>
  display?:     Record<string, DisplayMap>
  section?:     SectionContext               // for filter CtxRef ({ $ctx: '…' }) resolution
}

/**
 * TransformStep — discriminated union of 15 pipeline operations.
 *
 * melt      — wide → long (pandas pivot_longer / Vega-Lite fold)
 * rename    — field name normalization
 * cast      — coerce field types (string → number / number → string)
 * filter    — row filter with CtxRef resolution
 * sort      — stable multi-key sort with explicit order (using:[]) and sentinel (last:)
 * derive    — compute new field via DeriveExpr tree or string formula
 * aggregate — GROUP BY + reduce (sum/avg/min/max/count)
 * rollup    — APPEND aggregate rows, preserve originals (OLAP totals-row pattern)
 * lookup    — LEFT JOIN against code-keyed dict ($cl/$d ref or inline)
 * join      — LEFT JOIN against array source ($cl/$d ref or inline rows)
 * group     — N-level hierarchy materializer (inject header rows + _level/_parentId)
 * concat    — join field values into composite key or label
 * template  — string template '{field}' → new field
 * addField  — add constant field to every row
 * select    — projection (keep listed fields only)
 *
 * Full type union definition: engine/core/src/data/transform.ts
 * Example showcase: examples/transform-pipeline.md
 */
type TransformStep =
  | { op: 'melt';      idFields: string[]; valueFields: string[]; seriesKey?: string; valueKey?: string }
  | { op: 'rename';    fields: Record<string, string> }
  | { op: 'cast';      fields: Partial<Record<string, 'number' | 'string'>> }
  | { op: 'filter';    where: Record<string, FilterValue> }
  | { op: 'sort';      by: string | ReadonlyArray<{ field: string; dir?: 'asc'|'desc'; using?: readonly DimVal[]; last?: DimVal|readonly DimVal[] }>; dir?: 'asc'|'desc'; using?: readonly DimVal[] }
  | { op: 'derive';    as?: string; name?: string; expr: DeriveExpr | string }
  | { op: 'aggregate'; by: string[]; measure: string; agg: 'sum'|'avg'|'min'|'max'|'count'; as?: string }
  | { op: 'aggregate'; groupBy: string[]; aggregations: { field: string; op: 'sum'|'avg'|'min'|'max'|'count'; as?: string }[] }
  | { op: 'rollup';    dim: string; as: DimVal; of: '*'|readonly DimVal[]; agg: 'sum'|'avg'|'min'|'max'|'count'; field?: string }
  | { op: 'lookup';    key: string; from: DimRef|Record<string, Record<string, DimVal|undefined>>; fields: string[]; rename?: Record<string, string> }
  | { op: 'join';      with: DimRef|readonly Record<string, unknown>[]; on: string; onRight?: string; fields?: string[]; rename?: Record<string, string> }
  | { op: 'group';     by: Array<{ field: string; inject?: { from?: Record<string,string>; set?: Record<string, DimVal|boolean>; idFrom?: string } }>; levelField?: string; parentField?: string; idPrefix?: string }
  | { op: 'concat';    fields: string[]; as: string; sep?: string }
  | { op: 'template';  as: string; tpl: string }
  | { op: 'addField';  name: string; value: DimVal }
  | { op: 'select';    fields: string[] }

/**
 * DeriveExpr — row-level expression tree (used by TransformStep 'derive').
 * Operates on a single EngineRow. Not the same as @geostat/expr Expr (which operates on scope).
 * String form: 'value / total * 100' — parsed by ExprParser (recursive descent).
 */
type DeriveExpr =
  | { op: 'field';                        field: string }
  | { op: 'literal';                      value: number | string }
  | { op: 'add'|'sub'|'mul'|'div';        a: DeriveExpr; b: DeriveExpr }
  | { op: 'abs'|'neg';                    a: DeriveExpr }
  | { op: 'eq'|'neq';                     a: DeriveExpr; b: DeriveExpr }
  | { op: 'gt'|'gte'|'lt'|'lte';          a: DeriveExpr; b: DeriveExpr }
  | { op: 'and'|'or';                     a: DeriveExpr; b: DeriveExpr }
  | { op: 'not';                           a: DeriveExpr }
  | { op: 'if'; cond: DeriveExpr; then: DeriveExpr; else: DeriveExpr }

/** applyStep — execute one TransformStep against a row array. */
declare function applyStep(rows: EngineRow[], step: TransformStep, ctx?: PipelineContext): EngineRow[]

/** applyPipeline — execute an ordered list of TransformSteps in sequence. */
declare function applyPipeline(rows: EngineRow[], steps: TransformStep[], ctx?: PipelineContext): EngineRow[]

// ── Filter option sources — pipe-backed dynamic options ──────────────────────
//
//  Filter controls (year-select, cascade, select, multi-select, chip-select) can
//  draw their options from any of these sources. The 'query' and 'inline' variants
//  support an optional pipe: TransformStep[] for normalization/sorting.
//  'api' sources are resolved asynchronously in the filter component; pure
//  resolveOptions/resolveChips/resolveYears return [] for them (async fills state).
//
//  See: resolveOptions(), resolveChips(), resolveYears() in engine/core/src/data/resolve.ts

interface SelectOption { value: string; label: string }
interface ChipOption   { value: string; label: string; color?: string }

type OptionsSource =
  | { type: 'static';  items: SelectOption[] }
  //  ^ hardcoded — Constructor palette, quick prototypes. JSON-safe.
  | { type: 'inline';  items: DimRef | readonly Record<string, unknown>[];
      valueField: string; labelField?: string; pipe?: TransformStep[] }
  //  ^ from store classifiers/display ($d/$cl). Goes through PipelineContext.
  //    { $d: 'sector', view: 'leaves' } → display-augmented atomic codes only
  //    { $cl: 'geo'  , view: 'items'  } → structural codes + hierarchy
  | { type: 'query';   data: DataSpec;
      valueField: string; labelField?: string; pipe?: TransformStep[] }
  //  ^ DataStore query → interpretSpec(data, ctx) → rows → options.
  //    DataSpec (NOT ObsQuery) — goes through full interpretSpec pipeline:
  //    storeId routing, dim resolution, DataSpec.pipe transforms, encoding.
  //    Cascade pattern: data.dims has { $ctx: 'parent' } refs.
  | { type: 'api' }   // async — filter component resolves independently

type ChipSource =
  | { type: 'static';  items: ChipOption[] }
  | { type: 'inline';  items: DimRef | readonly Record<string, unknown>[];
      valueField: string; labelField?: string; colorField?: string; pipe?: TransformStep[] }
  | { type: 'query';   data: DataSpec;
      valueField: string; labelField?: string; colorField?: string; pipe?: TransformStep[] }
  | { type: 'api' }

type YearsSource =
  | { type: 'static';  items: number[] }
  | { type: 'inline';  items: DimRef | readonly Record<string, unknown>[];
      field: string; pipe?: TransformStep[] }
  | { type: 'query';   data: DataSpec; field: string; pipe?: TransformStep[] }
  | { type: 'api' }

// ── SectionContext (engine-level — consumed by interpretSpec and resolve.*) ──
//
//  Defined in engine/core/src/core/context.ts.
//  This is the minimal context visible to the data layer (no React, no theme).

interface SectionContext {
  timeMode: 'year' | 'range'
  dims:     Record<string, DimVal>   // all active filter params: time, geo, sector, …
}

/**
 * DataSpec union — declarative data declaration (JSON-serializable)
 *
 * Built-in types only. Extended types registered via engine.extendSpec() are NOT here.
 * Pattern mirrors NodeDef: built-ins in the union, app-specific via registration.
 *   engine.extendSpec('account-sequence', fn) → config: { type: 'account-sequence', ... }
 *   interpretSpec: unknown type → extendSpec registry → resolver(spec, ctx, stores)
 */
type DataSpec =
  | (DataSpecBase & { type: 'query';      indicator?: string })
  | (DataSpecBase & { type: 'row-list';   indicators: string[] })
  | (DataSpecBase & { type: 'timeseries'; indicator: string })
  | (DataSpecBase & { type: 'growth';     indicator: string; base?: 'yoy' | 'period' })
  | (DataSpecBase & { type: 'ratio-list'; pairs: { numerator: string; denominator: string; label?: string }[] })
  | (DataSpecBase & { type: 'pivot';      indicator: string; rows: string; cols: string })
  | (DataSpecBase & { type: 'by-param'; param: string; specs: Record<string, DataSpec> })
  //   Resolves to specs[ctx.dims[param]] ?? specs['default'] ?? [].
  //   DataSpecBase = shared dims/filter/derive inherited by ALL branch specs.
  //   Branch spec inherits from wrapper; branch fields override: branch.storeId > wrapper.storeId.
  //   param: 'timeMode'  → specs: { year: yearSpec, range: rangeSpec }  (replaces old by-mode)
  //   param: 'geoMode'   → specs: { single: singleSpec, multi: multiSpec }
  //   param: 'breakdown' → specs: { total: totalSpec, sector: sectorSpec, age: ageSpec }
  //   Any ctx.dims key — dimension-agnostic. No hardcoded time semantics. ✅
  | { type: 'url';     href: string; transform?: string }   // raw URL fetch — no query filtering
  // type: 'custom' REMOVED — use engine.extendSpec() with explicit type string instead

/**
 * DeriveEntry — engine-level derive entries
 * ExprVal: pure expression → evalExpr (@geostat/expr)
 * DataLookupOp: data-access → interpretSpec + field lookup
 */
type DeriveEntry = ExprVal | DataLookupOp

/**
 * NodeDeriveMap — engine-level ordered derive entries on NodeBase
 * Superset of DeriveMap (@geostat/expr): allows DataLookupOp in addition to ExprVal.
 * Array (NOT Record) — explicit evaluation order, JSON-safe, Constructor-safe.
 * Constructor references this type in JSON Schema for the derive field on any node.
 */
type NodeDeriveMap = Array<{ key: string; expr: DeriveEntry }>

/**
 * DataLookupOp — data-access derive entry. Resolved by engine (not @geostat/expr).
 * Fetches a DataSpec, then reads one field from the result for a given ref key.
 *
 * Evaluation context (C-2 semantics):
 *   ctx at lookup time  = ctx AFTER all preceding derive entries (DAG order).
 *   ctx.rows at lookup  = parent node's inherited rows — NOT this node's data
 *                         (node.data / interpretSpec runs at renderNode step 3,
 *                          derive runs at step 1 — before node.data is resolved).
 *   data: DataSpec      = freshly resolved via interpretSpec(op.data, ctx) — not cached.
 *   ref: ExprVal        = evaluated via evalExpr(op.ref, ctx.scope) → lookup key.
 *
 * tree-field: rows form a tree (parent/child). ref = node key. field = value to read.
 *   Traverse: find row where row[keyField] === ref. Return row[field].
 *   Use case: region name lookup: ref = { $ctx: 'geo' }, field = 'label'.
 *
 * map-field: rows form a flat map. ref = lookup key. field = value to read.
 *   Find: rows.find(r => r[keyField] === ref)?.[field].
 *   Use case: indicator label lookup: ref = { $literal: 'B1G' }, field = 'label'.
 *
 * Error / miss semantics:
 *   interpretSpec blocked/empty  → lookup treated as miss → fallback (or null).
 *   ref resolves to null         → miss → fallback (or null).
 *   row found, field missing     → null (not an error — DataRow is open Record).
 *   fallback absent + miss       → derived[key] = null (same as ExprVal null result).
 *   Engine never throws on miss  → caller decides if null is acceptable.
 */
type DataLookupOp =
  | { op: 'tree-field'; data: DataSpec; ref: ExprVal; field: string; fallback?: DimVal }
  | { op: 'map-field';  data: DataSpec; ref: ExprVal; field: string; fallback?: DimVal }

/**
 * evalNodeDerive — @geostat/engine. NodeDeriveMap superset (ExprVal + DataLookupOp).
 * Naming mirrors DeriveMap → evalDerived / NodeDeriveMap → evalNodeDerive.
 *
 * Pure function — returns NEW derived record. Never mutates ctx.
 * renderNode step 1: ctx = { ...ctx, derived: evalNodeDerive(node.derive, ctx) }
 *
 * DataLookupOp → interpretSpec(op.data, ctx) + field lookup (see DataLookupOp above)
 * ExprVal      → evalDerived (@geostat/expr)
 * Entries evaluated in declaration order (DAG contract):
 *   entry N may reference derived[key] from entries 0..N-1 via { $derived: key }.
 *   Forward reference ($derived key not yet computed) → null at that point.
 */
declare function evalNodeDerive(
  map: NodeDeriveMap,
  ctx: RenderContext
): Record<string, DimVal>

/**
 * fromSDMX — @geostat/engine. Only SDMX format boundary: raw API response → Observation[].
 * Input: SDMX-JSON (any structure — open raw type).
 * Output: Observation[] — normalized engine rows (= EngineRow[] / Readonly<Record<string,DimVal>>[]).
 *
 * "Adapter rule": fromSDMX() = only place API format → Observation[].
 * Store swap (API change) = only fromSDMX changes. DataSpec/config: zero changes.
 * Registered via: engine.registerTransform('fromSDMX', fromSDMX)
 * Used in: DataSpec.transform field (string) → resolved at interpretSpec time.
 * Pipeline: SDMX-JSON → fromSDMX() → Observation[] → pipe? → encoding? → DataRow[]
 */
declare function fromSDMX(raw: unknown): Observation[]

/**
 * interpretSpec — @geostat/engine. Core data resolver: DataSpec + RenderContext → DataRow[].
 * renderNode step 3: ctx = { ...ctx, rows: interpretSpec(node.data, ctx).rows }
 *
 * Returns InterpretResult (discriminated union — not DataRow[] directly):
 *   'ok':      rows resolved → ctx.rows populated
 *   'blocked': required dim is null → rows=[], EmptyState shown
 *   'empty':   'empty' contract + null → rows=[], no store query
 *
 * Per-node evaluation: each node resolves independently.
 * ctx.stores used internally — stores not passed separately (already in ctx).
 * Store resolution order: DataSpec.href → storeId → pageStoreKey → stores['default']
 */
declare function interpretSpec(spec: DataSpec, ctx: RenderContext): InterpretResult

// ═══════════════════════════════════════════════════════════════════════════
// @geostat/react — engine/react/
// ═══════════════════════════════════════════════════════════════════════════

/** Layout hints — CSS-first positioning. Engine wraps, CSS positions. */
interface LayoutHints {
  position?: 'sticky-top' | 'sticky-bottom' | 'flow' | 'overlay' | string
  order?:    number                          // render order within parent
  span?:     'full' | 'half' | 'third' | 'auto' | string
  label?:    string                          // tab header, accordion title
  role?:     string                          // 'chart' | 'table' | 'panel'
}

/** Base for all node types */
interface NodeBase {
  type:         string
  variant?:     string        // visual variation — shell reads via def pass-through
  visibleWhen?: ExprVal       // STRUCTURAL visibility (engine step 2).
                              // false → node removed from tree entirely. No DOM. No ChildrenArg entry.
                              // Use for: different node sets per mode/state.
  enabledWhen?: ExprVal       // boolean → for interactive nodes (future)
  layout?:      LayoutHints
  derive?:      NodeDeriveMap                // engine-level derive (ExprVal | DataLookupOp) — Array, not Record
  data?:        DataSpec
  view?:        ViewParams
  /**
   * storeKey — nearest-ancestor store scope (CSS cascade / React Context pattern).
   * Sets ctx.pageStoreKey for THIS node and ALL its descendants.
   * Nearest ancestor with storeKey wins — inner overrides outer.
   *
   * Engine step (renderNode): if (node.storeKey) ctx = { ...ctx, pageStoreKey: node.storeKey }
   *
   * Resolution chain (DataSpecBase.storeId):
   *   href → storeId → pageStoreKey (nearest ancestor) → 'default'
   *
   * Use cases:
   *   PageConfigBase.storeKey: 'gdp'            → whole page defaults to gdp store
   *   SectionNode.storeKey: 'accounts'          → this section + all children default to accounts
   *   child with storeId: 'regional'            → overrides nearest storeKey for that node only
   *   child with no storeId or storeKey         → inherits nearest ancestor's storeKey
   *
   * JSON-serializable: string. Constructor stores as-is. ✅
   * See: examples/store-access.md
   */
  storeKey?:    string
  /**
   * navLabel — opt-in section nav registration (ONS/Eurostat TOC pattern).
   * Present → node appears in SectionNav TOC. node.id required when navLabel is set.
   * Absent  → node invisible to SectionNav. No IntersectionObserver entry.
   *
   * Shell does NOT read navLabel — engine sets data-section-id on the root DOM element.
   * SectionNavProvider observes elements with data-section-id via IntersectionObserver.
   * useSectionNav() returns activeId → chrome sidebar highlights matching entry.
   */
  navLabel?:    string
}

/** Display options — evaluated from ExprVal to plain scalars before renderer */
interface ViewParams {
  subtitle?:    ExprVal        // string
  hero?:        ExprVal        // boolean
  noCollapse?:  ExprVal        // boolean
  defaultOpen?: ExprVal        // boolean
  exportable?:  ExprVal        // boolean
  visibleWhen?: ExprVal        // VISUAL visibility (engine step 6, slot wrapper).
                               // false → slot--hidden class added. Node stays in DOM.
                               // Use for: animated collapse, progressive disclosure (ONS pattern).
                               // Shell never checks either visibleWhen — engine owns both.
}

/** Resolved view params — all ExprVal fields resolved to plain scalars */
interface ResolvedViewParams {
  subtitle?:    string
  hero?:        boolean
  noCollapse?:  boolean
  defaultOpen?: boolean
  exportable?:  boolean
  visibleWhen?: boolean        // resolved from ViewParams.visibleWhen — applied by slot wrapper
}

/**
 * evalViewParams — @geostat/react. Resolves ViewParams ExprVals → ResolvedViewParams.
 * renderNode step 4: ctx = { ...ctx, view: evalViewParams(node.view, ctx.scope) }
 *
 * Each ExprVal field (subtitle, hero, ...) resolved via evalExpr<T>(val, scope).
 * undefined ViewParams → all fields undefined (default: open, no subtitle, exportable).
 * Result passed to shell as ctx.view — shell never reads def.view directly.
 *
 * scope at step 4 has rows populated (renderNode synced it at step 3).
 * Collection ops in ViewParams fields — e.g. exportable: { op:'gt', left:{op:'count',...}, right:0 }
 * — see THIS node's resolved rows. Not parent rows. Not [].
 */
declare function evalViewParams(
  view:  ViewParams | undefined,
  scope: ExprScope,
): ResolvedViewParams

// ── Built-in node types ──────────────────────────────────────────────────

interface SectionNode extends NodeBase {
  type:     'section'
  children: NodeDef[]
  // layout.role = open string — shell groups by distinct roles, toggle between them
  // e.g. role:'chart'+role:'table', role:'map'+role:'table', role:'annual'+role:'quarterly'
  // no role → child always visible. label in layout → toggle button text (else role string)
  // chart?: ChartNode — REMOVED (Agreement #16)
  // table?: TableNode — REMOVED (Agreement #16)
}

interface ChartNode extends NodeBase {
  type: 'chart'
  def:  ChartDef   // Grammar of Graphics encoding — see examples/chart-def.md
}

interface TableNode extends NodeBase {
  type: 'table'
}

interface FilterBarNode extends NodeBase {
  type:           'filter-bar'
  bars:           Record<string, BarDef>   // raw schema — JSON-serializable config input
  effects?:       Effect[]                 // side-effect rules (when X → set Y)
  crossValidate?: CrossValidator[]         // cross-field validation rules
  // derive? → NodeBase.derive (NodeDeriveMap)
  // store  → NodeBase.data: DataSpec (storeId or href) — NOT DataStore instance
}

interface KpiStripNode extends NodeBase {
  type: 'kpi-strip'
  // data: DataSpec — inherited from NodeBase (use type: 'row-list')
  // No items[] — data drives the strip via ctx.rows after interpretSpec
  //
  // Semantic boundary (Grafana stat panel / ONS headline-stats pattern):
  //   strip = registration unit. Shell receives rows[], iterates internally.
  //   Individual cards are NOT NodeDef — no type, no children, engine never traverses them.
  //
  // ❌ nodeRegistry.register('kpi-card', ...) — 'kpi-card' is not a node type.
  //    Cards have no type, no DataSpec, no layout, no visibleWhen.
  //    They are an internal rendering detail of KpiStripShell, not engine nodes.
  //    Card-level customization → implement inside KpiStripShell (map rows → KpiCardProps).
  //    Card-level data variation → use DataSpec derive on the strip node, not separate nodes.
}

// ── Geo-map node ─────────────────────────────────────────────────────────
//
// Platform: Grafana Geomap panel (layers + location lookup).
// Agnostic to map library — shell handles Leaflet/MapLibre/Mapbox.
// data?: inherit ctx.rows or own DataSpec (Grafana: panel.targets[]).
// source: GeoSource — three tiers (URL fetch / key registry / inline dev).
// onSelect?: filter key updated on feature click — parameterized, not hardcoded.
// See: architecture/27-geo-map.md + examples/geo-map.md

interface GeoMapNode extends NodeBase {
  type:          'geo-map'
  data?:         DataSpec          // own data; absent = inherit ctx.rows from parent
  geoField?:     string            // row field containing geo code (default: 'geo')
  valueField?:   string            // row field for choropleth value (default: 'value')
  source:        GeoSource         // GeoJSON geometry source
  options?:      GeoMapOptions
}

/**
 * GeoSource — where to load GeoJSON geometry.
 * Three tiers, same pattern as DatasourceInstanceConfig classifiers:
 *   inline  — dev/test only, no HTTP
 *   key     — engine.registerGeoJson(key, geojson) at bootstrap
 *   url     — fetch + cache (TTL defaults to 24h — geometry rarely changes)
 */
type GeoSource =
  | { type: 'inline';  geojson: object }                       // dev/test: embedded
  | { type: 'key';     key: string }                           // registered at bootstrap
  | { type: 'url';     href: string; ttl?: number }            // HTTP + cache

interface GeoMapOptions {
  center?:       [number, number]  // [lat, lng] — absent = auto-fit bounds
  zoom?:         number            // absent = auto-fit
  interactive?:  boolean           // default: true
  tooltipField?: string            // row field shown on hover (absent = none)
  onSelect?:     string            // filter param key updated on feature click
                                   // feature.properties[geoField] → sets filter[onSelect]
                                   // absent = map is display-only (no click interaction)
}

// ── Links node ───────────────────────────────────────────────────────────
//
// Platform: ONS "Further information" block · Eurostat "Related publications".
// Standard in statistical publications — methodology, source, download links.
// Shell renders icon + label + optional description.

interface LinksNode extends NodeBase {
  type:   'links'
  title?: string      // section heading (e.g. "მეთოდოლოგია", "გადმოწერა")
  items:  LinkItem[]
}

interface LinkItem {
  label:        string
  href:         string
  icon?:        string    // icon key from icon registry (shell resolves; absent = default)
  description?: string    // secondary text line (e.g. PDF · 2.4 MB)
  external?:    boolean   // default: true for http/https hrefs (adds rel="noopener")
}

// ── Page-header node ─────────────────────────────────────────────────────
//
// Platform: ONS "Publication" header · Eurostat title block · IMF working paper header.
// Renders title + subtitle + data-status badge within the page content flow.
// Optional — pages without explicit page-header use InnerPageNode.title only.
// Badge: static (always shown) or data-driven (reads obs_status from ctx.rows[0]).

interface PageHeaderNode extends NodeBase {
  type:         'page-header'
  title?:       ExprVal      // overrides page title; absent = reads InnerPageNode.title
  subtitle?:    ExprVal      // secondary line (unit, period, methodology note)
  description?: ExprVal      // longer text rendered as paragraph
  badge?:       BadgeSpec    // data-status indicator (preliminary, revised, final)
}

/**
 * BadgeSpec — data-status indicator (IMF/Eurostat standard).
 *   static:  always shown with fixed label + variant.
 *   data:    reads field from ctx.rows[0], maps code → { label, variant }.
 *
 * Standard obs_status map: 'P' → preliminary, 'E' → estimate, 'F' → final.
 * Shell renders as colored pill. Variant maps to CSS token (--badge-warning etc.).
 */
type BadgeSpec =
  | { type: 'static'; label: string; variant?: 'warning' | 'info' | 'success' | 'error' }
  | { type: 'data';   field: string; map: Record<string, { label: string; variant: 'warning' | 'info' | 'success' | 'error' }> }

// ── Page node types ──────────────────────────────────────────────────────

interface PageConfigBase extends NodeBase {
  id:            string
  type:          string
  title:         string
  // storeKey inherited from NodeBase — sets page-level store scope for all children
  color?:        string             // page accent (breadcrumb, header) — NOT nav concern
  filterSchema?: FilterSchemaInput  // page-level filter schema (JSON-serializable, Constructor stores in DB)
                                    // SiteRenderer: defineFilters(filterSchema) → useFilters(schema) → baseCtx.dims
                                    // omitted → SiteRenderer falls back to EMPTY_FILTER_BAR (no filters, URL params ignored)
  children:      NodeDef[]
  // nav: NavItemDef — REMOVED (Agreement I-1). Nav is site-level concern.
}

interface InnerPageNode extends PageConfigBase {
  type:   'inner-page'
}

interface TabPageNode extends PageConfigBase {
  type:       'tab-page'
  defaultTab?: number
}

interface ContainerPageNode extends PageConfigBase {
  type:     'container-page'
  columns?: number
}

/**
 * NodeTypeMap — open map of all registered node types.
 *
 * TypeScript module augmentation pattern (Vite / Express / React Router precedent):
 *   engine/react/ declares built-in keys.
 *   App extends via 'declare module' in src/ — no cast, no packages/ change.
 *
 *   // src/features/landing/types.ts:
 *   declare module '@geostat/react' {
 *     interface NodeTypeMap {
 *       'landing-hero':  LandingHeroNode
 *       'landing-stats': LandingStatsNode
 *       'map':           MapNode
 *     }
 *   }
 *   // After augmentation: NodeDef = ... | LandingHeroNode | LandingStatsNode | MapNode
 *   // Config call site — no cast needed:
 *   { type: 'landing-hero', layout: { span: 'full' } }   // ← LandingHeroNode ∈ NodeDef ✅
 *
 * App-specific PAGE layouts — variant, not new type:
 *   ❌ augmenting NodeTypeMap with a page layout type (same violation: app content in packages/)
 *   ✅ ContainerPageNode { variant: 'landing' } — shell reads variant, zero NodeTypeMap change
 *   See: examples/landing-page.md
 */
interface NodeTypeMap {
  'section':        SectionNode
  'chart':          ChartNode
  'table':          TableNode
  'filter-bar':     FilterBarNode
  'kpi-strip':      KpiStripNode
  'inner-page':     InnerPageNode
  'tab-page':       TabPageNode
  'container-page': ContainerPageNode
  // Content nodes (ONS/Eurostat publication standard):
  'geo-map':        GeoMapNode
  'links':          LinksNode
  'page-header':    PageHeaderNode
}

/**
 * NodeDef — derived from NodeTypeMap. Automatically extends when NodeTypeMap is augmented.
 * App adds a key to NodeTypeMap → NodeDef gains that member. No cast. No packages/ change.
 */
type NodeDef = NodeTypeMap[keyof NodeTypeMap]

/**
 * PageConfig — union of built-in page types.
 * App-specific page layouts use variant on an existing type — no new union member needed.
 * SiteManifest.pages: Record<string, PageConfig> — always type-safe, no casting required.
 */
type PageConfig = InnerPageNode | TabPageNode | ContainerPageNode

// ── ChildrenArg — array-only (Agreement #16) ────────────────────────────

/**
 * Pre-rendered children + original defs + lazy render accessor.
 *
 * Invariant (engine guarantee):
 *   defs.length === rendered.length
 *   rendered[i] === renderChild(i)  (same node, referentially stable)
 *   rendered / renderChild contain no null (visibleWhen:false filtered before build)
 *
 * Shell code never needs to null-check rendered[i] or renderChild(i).
 *
 * rendered vs renderChild — two access modes:
 *   rendered:    eager array — engine pre-renders ALL children before calling renderer.
 *                Use for: simple layout, displaying all children always (section body, container grid).
 *
 *   renderChild: lazy function — engine renders child i on first call, memoizes result.
 *                Use for: deferred rendering (lazy tabs, virtual scroll, conditional panels).
 *                renderChild(activeTab) — only active tab pays render cost. ✅
 *                renderChild(i) on repeated calls — returns same ReactNode (stable reference).
 *
 * Pattern: use rendered for simplicity; switch to renderChild when shell controls timing.
 *
 * Nodes where visibleWhen evaluated to false are filtered out by the engine
 * before ChildrenArg is built — shell never receives invisible children.
 */
interface ChildrenArg {
  defs:        NodeDef[]                  // original defs — layout metadata (role, label, span, position)
  rendered:    ReactNode[]                // eager — all pre-rendered (same index as defs)
  renderChild: (i: number) => ReactNode   // lazy — render on demand, memoized by engine
}

/**
 * NodeRenderer — sync, pure function, three args always.
 * No hooks in renderer body (hooks rule — renderer is a plain call, not a React component).
 *
 * Performance pattern (L-4) — inner component wrapper for expensive computations:
 *
 *   function ChartRenderer(def, ctx, children): ReactNode {
 *     return <ChartRendererInner def={def} ctx={ctx} />   // ← returns React element, allowed
 *   }
 *
 *   function ChartRendererInner({ def, ctx }) {           // ← NOT React.memo (no custom comparator)
 *     const output = useMemo(                             // ← useMemo for expensive computation
 *       () => interpretChart(def.def, ctx.rows),
 *       [def.def, ctx.rows],                             // ctx.rows stable on cache hit → output stable
 *     )
 *     return <Shell def={def} output={output} />         // ← Shell is React.memo in src/
 *   }
 *
 * Why no React.memo on inner component:
 *   React.memo default shallow-compares props. ctx is a new spread object per node → always misses.
 *   Custom comparator risks stale renders if a field is missed — correctness bug, no compile error.
 *   Solution: useMemo inside (stable output) + React.memo on the Shell (ISP-clean, minimal props).
 *   Shell sees stable output reference → skips re-render. No custom comparator needed.
 *
 * ctx is ALWAYS passed in full — never destructured into individual fields in the props type.
 *   Narrowing renderer props (rows, theme instead of ctx) = Rule 1 violation.
 *   Future ctx fields must remain accessible without changing inner component's prop type.
 */
type NodeRenderer<D extends NodeBase = NodeBase> =
  (def: D, ctx: RenderContext, children: ChildrenArg) => ReactNode

/**
 * SpecResolver — custom DataSpec type handler registered via engine.extendSpec().
 * Input: raw JSON config (unknown shape — open, not closed DataSpec union).
 * Output: DataRow[] — same contract as built-in spec types.
 * engine.extendSpec('account-sequence', resolver) → config { type:'account-sequence', ... }
 */
type SpecResolver = (spec: Record<string, unknown>, ctx: RenderContext) => DataRow[]

/**
 * TransformFn — raw API response → DataRow[].
 * Registered via engine.registerTransform(key, fn).
 * DataSpec.transform: string → resolved from TRANSFORM_MAP at interpretSpec time.
 * key is open string — Constructor's transform dropdown lists all registered keys.
 *
 * Unknown key behavior (Grafana/Builder.io "fail visibly" pattern):
 *   absent        → no-op (data passed through as DataRow[] from store)
 *   knownKey      → fn(raw) applied → DataRow[]
 *   unknownKey    → interpretSpec throws Error('Unknown transform: "key"')
 *                   → NodeErrorBoundary catches → error shell rendered in place of node
 *   Rationale: silent fallback on unknown key masks config authoring bugs; error shell is visible.
 */
type TransformFn = (raw: unknown) => DataRow[]

/**
 * RegistrySnapshot — opaque snapshot for test isolation (Backstage TestApiRegistry pattern).
 * Captured by registry.snapshot(); restored by registry.restore(snap).
 * Type is intentionally opaque — callers never construct it directly.
 * Saves the full internal state (all registered entries) at snapshot time.
 * Restore: reverts the registry to exactly that state — as if intermediate register() calls never ran.
 */
type RegistrySnapshot = { readonly _brand: 'RegistrySnapshot' }

/**
 * NodeRegistry — variant-aware open registry for node types (Grafana plugin pattern + Backstage factory pattern).
 *
 * Core contract: register(type, variant, renderer) — one call = renders ✅ + Constructor sees it ✅.
 *   get(type, variant)  — pure table lookup. No if/switch anywhere.
 *   list(type?)         — Constructor palette: all registered (type, variant) pairs, auto-updating.
 *   dump()              — dev introspection: Record<type, Record<variant, renderer>>.
 *
 * variant = 'default' for all standard registrations.
 *   nodeRegistry.register('inner-page',     'default', GeostatInnerPageShell)
 *   nodeRegistry.register('container-page', 'default', DefaultContainerLayout)
 *   nodeRegistry.register('container-page', 'landing', GeostatLandingShell)
 * All pages equal citizens — same registration call, same dispatch table, no special cases.
 *
 * TypeScript safety (generic constraint — single generic, not overloads):
 *   register<K extends keyof NodeTypeMap>(type: K, ..., renderer: NodeRenderer<NodeTypeMap[K]>)
 *   Renderer signature must match the node type — compile-time error if mismatched.
 *   App-augmented types (via declare module '@geostat/react') covered automatically.
 *
 * Test isolation (Backstage TestApiRegistry pattern):
 *   createNodeRegistry() → factory for isolated instances (not the global singleton).
 *   Tests inject via createTestRegistryProvider() — no global state mutation.
 *   Production: nodeRegistry = global singleton, all registrations in setupRegistrations.ts.
 *
 * Discoverability: ALL register() calls centralized in src/app/setupRegistrations.ts.
 *   One file = complete picture of what the app registers. No scattered registration side-effects.
 */
interface NodeRegistry {
  // ── Typed overload (compile-time NodeTypeMap constraint) ─────────────────
  // TypeScript enforces that renderer signature matches the node type.
  // App module augmentation adds keys to NodeTypeMap → coverage extends automatically.
  register<K extends keyof NodeTypeMap>(
    type:     K,
    variant:  string,
    renderer: NodeRenderer<NodeTypeMap[K]>,
    meta?:    NodeRegistryMeta,
  ): void

  // ── Open overload (augmented types not yet in NodeTypeMap, runtime-only registration) ──
  register(
    type:     string,
    variant:  string,
    renderer: NodeRenderer,
    meta?:    NodeRegistryMeta,
  ): void

  // ── Typed lookup ──────────────────────────────────────────────────────────
  get<K extends keyof NodeTypeMap>(
    type:    K,
    variant: string,
  ): NodeRenderer<NodeTypeMap[K]> | undefined

  // ── Open lookup ───────────────────────────────────────────────────────────
  get(type: string, variant: string): NodeRenderer | undefined

  getMeta(type: string, variant?: string):   NodeRegistryMeta | undefined
  getSchema(type: string):                   Record<string, unknown> | undefined

  /**
   * list — Constructor palette feed.
   * type provided → all variants for that type only. Omit → every registered entry.
   * Returns { type, variant, ...meta } per (type, variant) pair.
   * Auto-updates when register() is called — Constructor palette is always current.
   */
  list(type?: string): Array<{ type: string; variant: string } & Partial<NodeRegistryMeta>>

  /**
   * dump — dev/debug introspection. Record<type, Record<variant, NodeRenderer>>.
   * console.table(nodeRegistry.dump()) in browser DevTools → full palette overview.
   * Never call in production hot paths.
   */
  dump(): Record<string, Record<string, NodeRenderer>>

  /**
   * snapshot / restore — test isolation (Backstage TestApiRegistry pattern).
   * Before test: const snap = registry.snapshot()
   * After  test: registry.restore(snap)   → state as if test never ran
   * Prevents register() calls in one test from leaking into subsequent tests.
   */
  snapshot(): RegistrySnapshot
  restore(snap: RegistrySnapshot): void
}

/** createNodeRegistry — factory for isolated registry instances (tests, sandboxes). */
declare function createNodeRegistry(): NodeRegistry

/** nodeRegistry — global singleton. All registrations in setupRegistrations.ts. */
declare const nodeRegistry: NodeRegistry

/**
 * EngineInstance — engine singleton API exported from @geostat/react.
 * declare const engine: EngineInstance
 *
 * extend():           wire engine to a NodeRegistry (called once in setupEngine()).
 * extendSpec():       register custom DataSpec type resolver (open extension point).
 * registerTransform():register named parse function for DataSpec.transform field.
 * listTransforms():   returns all registered transform keys → Constructor dropdown.
 * renderNode():       main engine entry — renders full node tree synchronously.
 */
interface EngineInstance {
  extend(registry: NodeRegistry): void
  extendSpec(type: string, resolver: SpecResolver): void
  registerTransform(key: string, fn: TransformFn): void
  listTransforms(): string[]
  renderNode(root: NodeDef, ctx: RenderContext): ReactNode
  // Datasource plugin system
  registerDatasource(plugin: DatasourcePlugin): void
  listDatasources(): string[]                                               // → Constructor datasource type picker
  buildStoreManifest(datasources: DatasourceInstanceConfig[]): Promise<Record<string, DataStore>>
  // async — awaits Tier 2 structure fetches (structureUrl) before resolving.
  // Tier 1 (config.classifiers): synchronous. Tier 3 (data response): lazy per render.
  // Call: const stores = await engine.buildStoreManifest(manifest.datasources)
  //       → React mounts with classifiers ready → filter dropdowns populated ✅
}

declare const engine: EngineInstance

/**
 * ChromeMeta — display metadata for Constructor chrome palette.
 * label:   human-readable variant name shown in Constructor ("სრული", "მინიმალური").
 * preview: path to static thumbnail image shown in Constructor palette tile.
 */
interface ChromeMeta {
  label:    string
  preview?: string    // static thumbnail path — Constructor palette tile only
}

/**
 * ChromeRegistry — variant-aware registry for app-frame (chrome) slots.
 *
 * Why separate from nodeRegistry:
 *   Chrome = singleton per slot. Signature: () => ReactNode — zero props.
 *   Data from useSiteNav() / useLocation() hooks inside the component.
 *   Node  = called per tree node, receives (def, ctx, children).
 *   ISP: different caller signatures → different registries.
 *
 * Known slots: 'AppHeader' | 'AppSidebar' | 'AppFooter' + any custom slot (AppBanner, etc.)
 * Variants per slot: 'default' | 'minimal' | 'compact' | 'hidden' — app defines.
 *
 * Active variant selected by SiteManifest.chrome: Record<string, string>.
 *   Constructor sets this field (JSON, stored in DB) — no code change to switch variants.
 *
 * AppChrome dispatch (no if/switch):
 *   const key    = siteChrome?.['AppHeader'] ?? 'default'
 *   const Header = chromeRegistry.get('AppHeader', key)   // ← pure table lookup
 *
 * NullChromeSlot = pre-registered () => null — use as 'hidden' variant for any slot.
 *   chromeRegistry.register('AppSidebar', 'hidden', NullChromeSlot)
 *   → manifest.chrome.AppSidebar = 'hidden' → sidebar renders nothing
 */
interface ChromeRegistry {
  register(slot: string, key: string, component: () => ReactNode, meta?: ChromeMeta): void
  get(slot: string, key: string): (() => ReactNode) | undefined

  /**
   * list — Constructor chrome palette: all registered variants for a given slot.
   * Constructor shows thumbnails of header/footer variants → user picks one.
   * Returns { key, ...meta } per registered variant.
   */
  list(slot: string): Array<{ key: string } & Partial<ChromeMeta>>

  /**
   * dump — dev/debug introspection. Record<slot, Record<key, component>>.
   * console.table(chromeRegistry.dump()) → all chrome slots + registered variants.
   */
  dump(): Record<string, Record<string, () => ReactNode>>

  snapshot(): RegistrySnapshot
  restore(snap: RegistrySnapshot): void
}

/** createChromeRegistry — factory for isolated chrome registry instances (tests, sandboxes). */
declare function createChromeRegistry(): ChromeRegistry

/** chromeRegistry — global singleton. All registrations in setupRegistrations.ts. */
declare const chromeRegistry: ChromeRegistry

/**
 * NullChromeSlot — zero-render chrome component.
 * Register as 'hidden' variant on any slot that can be toggled off.
 *   chromeRegistry.register('AppSidebar', 'hidden', NullChromeSlot, { label: 'გამოთიშული' })
 * Constructor: selecting 'hidden' = renders nothing. No conditional in AppChrome. ✅
 */
declare const NullChromeSlot: () => null

/**
 * createTestRegistryProvider — test isolation factory (Backstage TestApiRegistry pattern).
 *
 * Creates a React Provider that injects isolated registry instances for testing.
 * Tests create their own nodeRegistry/chromeRegistry — no global singleton mutation.
 *
 *   const testNodes = createNodeRegistry()
 *   testNodes.register('section', 'default', MockSectionShell)
 *   const TestProvider = createTestRegistryProvider({ nodeRegistry: testNodes })
 *
 *   render(<TestProvider><ComponentUnderTest /></TestProvider>)
 *   // ComponentUnderTest resolves 'section' → MockSectionShell (not GeostatSectionShell)
 *
 * Components resolve registries from context — test instances shadow globals.
 * No cleanup needed after test — isolated instances are GC'd normally.
 *
 * Unspecified registries (e.g. only nodeRegistry provided) → chromeRegistry uses global.
 */
declare function createTestRegistryProvider(registries: {
  nodeRegistry?:   NodeRegistry
  chromeRegistry?: ChromeRegistry
}): (props: { children: ReactNode }) => ReactNode

/**
 * ShellOverrideProvider — scoped registry override for production use cases (print, embed, A/B).
 *
 * Provides overrides without modifying the global nodeRegistry.
 * Components inside resolve overrides first; falls back to global registry.
 *
 * Usage — print view:
 *   <ShellOverrideProvider
 *     shells={{ 'section/default': PrintSectionShell, 'chart/default': PrintChartShell }}
 *   >
 *     <PageLoader pageId="gdp" />
 *   </ShellOverrideProvider>
 *
 * Key format: '{type}/{variant}' — same namespace as nodeRegistry.
 * Chrome overrides: chromeOverrides={{ 'AppHeader/minimal': PrintHeaderShell }}
 *
 * Why not a new nodeRegistry + ThemeProvider:
 *   Global nodeRegistry mutation = leaks across unrelated components.
 *   ThemeProvider nesting was the old pattern — shells moved out of ThemeConfig.
 *   ShellOverrideProvider = correct scoped override mechanism for the registry architecture.
 */
declare function ShellOverrideProvider(props: {
  shells?:         Record<string, NodeRenderer>    // '{type}/{variant}' → renderer
  chromeOverrides?: Record<string, () => ReactNode> // '{slot}/{key}' → component
  children:        ReactNode
}): ReactNode

/**
 * NodeRegistryMeta — optional Constructor introspection metadata.
 * All fields optional — absence never blocks rendering.
 * Without any meta: node renders fine, Constructor shows JSON editor fallback.
 *
 * variants: UI hint for Constructor variant picker (string → node.variant → CSS modifier).
 *   Source of truth = component's exported const (e.g. SECTION_VARIANTS).
 *   Registration imports from component — never hardcoded here.
 *   CSS accepts any string; list is not enforced.
 *
 * preview: static thumbnail path for Constructor palette tile.
 *   Canvas preview = iframe of actual app (not this field).
 */
interface NodeRegistryMeta {
  label?:    string                    // 'სექცია' — Constructor type picker label
  icon?:     string                    // 'layout-section' — icon key in Constructor UI
  category?: string                    // 'layout' | 'data' | 'page' — palette grouping
  variants?: string[]                  // CSS modifier hints — derived from component constant
  schema?:   Record<string, unknown>   // JSON Schema → form UI (else JSON editor fallback)
  preview?:  string                    // path to static thumbnail (palette tile only)
                                       // canvas preview = iframe of actual app
  skeleton?: SkeletonFn                // default loading state for this node type
                                       // ThemeConfig.skeletons?.[type] overrides (brand skeleton)
                                       // omit → engine generic: <div className="node-skeleton node-skeleton--{type}" />
}

// ── ConstructorSchema — formal type for Constructor form + palette metadata ──
//
//  Shared across ALL registries: nodeRegistry, chromeRegistry, filterControlRegistry.
//  schemaCompiler.compile(type, registry) → ConstructorSchema (see examples/constructor-schema.md)
//
//  Platform precedents:
//    Grafana:    PanelOptionsEditorRegistry — compiled editor config, not raw JSON Schema
//    Builder.io: inputs: Input[] — compiled field list with UI metadata per component
//    Sanity CMS: defineField({ name, type, title, group, hidden }) — compiled, UI-aware
//
//  Rule: JSON.parse(JSON.stringify(schema)) === schema ✅
//  Rule: ConstructorSchema lives in engine/core (pure) — no React, no UI deps.
//  schemaCompiler lives in engine/react (can import React for editor components).

interface ConstructorFieldDef {
  name:        string
  type:        string                           // 'string' | 'number' | '[number,number]' | 'DataSpec' | …
  label?:      string                           // friendly label for Constructor form
  description?: string
  required?:   boolean
  group?:      string                           // field grouping in Constructor form
  hidden?:     boolean                          // always-hidden fields (internal, not shown in UI)
  options?:    Array<{ value: string; label: string }>  // for enum fields
}

interface ConstructorSchema {
  fields:    ConstructorFieldDef[]             // ordered — Constructor renders in this order
  groups?:   Array<{ key: string; label: string; collapsed?: boolean }>
  preview?:  string                           // thumbnail path for palette tile
  palette: {
    label:     string
    icon?:     string
    category?: string
  }
}

// ── RenderContext ────────────────────────────────────────────────────────

/**
 * RenderContext — passed to every renderer and interpretSpec call.
 *
 * Reference stability contract (P-2/P-3 — required for SiteRenderer useMemo):
 *   SiteRenderer wraps engine.renderNode in useMemo([page.id, ctx]).
 *   For this to skip re-evaluation, ctx must be a STABLE reference when nothing changed.
 *   SiteRenderer builds ctx with useMemo([theme, stores, filters.ctx.dims, page.storeKey]).
 *   Each field must therefore be stable when its inputs are unchanged:
 *
 *   stores:  created once in SiteProvider.setup — same reference for the session lifetime.
 *   dims:    produced by useFilters — memoized by URL string (same URL → same dims object).
 *   rows:    starts as [] in baseCtx; per-node rows are spread-copies — not the base reference.
 *   theme:   ThemeProvider creates once — same reference unless theme prop changes.
 *
 *   Violation: if useFilters returns a new dims object on every render (e.g. not memoized),
 *   ctx will never be stable → useMemo misses every time → full tree re-evaluation on every render.
 *   See examples/performance.md for the full stability chain.
 */
interface RenderContext {
  theme:          ThemeConfig
  stores:         Record<string, DataStore>    // stable for session lifetime — SiteProvider creates once
  dims:           Record<string, DimVal>       // stable per URL — useFilters must memoize by URL string
  derived:        Record<string, DimVal>       // per-node: spread-copy from base ctx
  rows:           DataRow[]                    // per-node: interpretSpec() output
  view:           ResolvedViewParams           // per-node: evalViewParams() output
  scope:          ExprScope                    // mirrors dims/derived/rows — renderNode keeps in sync:
                                               //   step 1: ctx = { ...ctx, derived, scope: { ...scope, derived } }
                                               //   step 3: ctx = { ...ctx, rows,    scope: { ...scope, rows    } }
                                               // After step 3: scope.rows = THIS node's resolved rows.
                                               // evalViewParams (step 4) and renderers (step 6) receive
                                               // a fully populated scope — collection ops on { $rows: true }
                                               // see the current node's rows, not the parent's.
                                               // ❌ wrong: ctx = { ...ctx, rows } only — scope.rows stays stale.
                                               // ✅ correct: always spread scope alongside the field it mirrors.
  pageStoreKey?:  string                       // nearest ancestor NodeBase.storeKey in the tree.
                                               // engine sets: if (node.storeKey) ctx = { ...ctx, pageStoreKey: node.storeKey }
                                               // interpretSpec resolution: href → storeId → pageStoreKey → 'default'
                                               // page storeKey: 'gdp' + section storeKey: 'accounts'
                                               //   → section + its children: pageStoreKey = 'accounts'
                                               //   → siblings of section:    pageStoreKey = 'gdp' (page level)
                                               // child with explicit storeId always overrides pageStoreKey for that node only.
  dimContracts:   Record<string, DimContract>  // per-dim null semantics (from FilterSchemaInput.contracts)
                                               // engine treats as opaque map; interpretSpec evaluates per node
}

/**
 * InterpretResult — discriminated union returned by interpretSpec.
 *
 * Per-node evaluation: each node resolves its own data independently.
 * Page-level "isDataBlocked" flag is wrong — SectionA needing geo=null does not
 * block SectionB whose query only requires time. (Grafana: per-panel variable check.)
 *
 * 'ok':      data resolved normally → ctx.rows populated
 * 'blocked': a 'required' dim is null for THIS node's query → user must select
 *            rows=[], EmptyState shown. dim = which key was unset (for UI message).
 * 'empty':   'empty' contract + null → [] immediately, no store query
 *            rows=[], EmptyState shown. Used for dependent selectors without parent.
 */
type InterpretResult =
  | { status: 'ok';      rows: DataRow[] }
  | { status: 'blocked'; dim: string }
  | { status: 'empty';   dim: string }

// ── ThemeConfig ──────────────────────────────────────────────────────────

/**
 * ChromeMap — known app-frame slots (documentation reference).
 *
 * These are the three required chrome slots + open extensibility.
 * In the registry architecture, ChromeMap is NOT a dispatch table.
 * Chrome dispatch goes through chromeRegistry, not ThemeConfig.
 *
 * All slots: () => ReactNode — zero props.
 *   Data comes from useSiteNav() / useLocation() internally.
 *   Engine never passes props to chrome — no coupling between platform and app frame.
 *
 * Extensible: AppBanner, AppBreadcrumb, AppAnnouncement — add slots without interface change.
 *
 * See: chromeRegistry for the actual dispatch mechanism.
 */
type ChromeMap = {
  AppHeader:  () => ReactNode   // global header  — required by AppChrome.tsx
  AppSidebar: () => ReactNode   // global sidebar — required by AppChrome.tsx
  AppFooter:  () => ReactNode   // global footer  — required by AppChrome.tsx
} & Record<string, () => ReactNode>   // open — custom slots extend freely

/**
 * ThemeConfig — loading state overrides and CSS token delivery.
 *
 * Component dispatch (shells + chrome) is NO LONGER part of ThemeConfig.
 * It moved to registries:
 *   shells → nodeRegistry.register(type, variant, renderer)  — variant-aware dispatch
 *   chrome → chromeRegistry.register(slot, key, component)   — slot+variant dispatch
 *
 * ThemeConfig remains for concerns that are NOT component dispatch:
 *   skeletons — per-type loading state brand overrides.
 *   (CSS tokens live in tokens.css and SiteManifest.tokens, not here.)
 *
 * Skeleton three-level resolution (renderNode — per-node):
 *   1. ctx.theme.skeletons?.[type]          ← brand override  (this field)
 *   2. nodeRegistry.getMeta(type)?.skeleton ← type default    (NodeRegistryMeta)
 *   3. <div className="node-skeleton node-skeleton--{type}" />  ← engine generic
 *   Prefer level 2 (skeleton co-located with renderer registration).
 *   Use level 1 only for brand-specific skeleton treatment that differs from type default.
 *
 * Override rule: single ThemeProvider at app root.
 *   For scoped overrides (print, embed) → ShellOverrideProvider (registry context override).
 *   mergeTheme still valid for skeleton overrides: mergeTheme(base, { skeletons: { ... } })
 */
interface ThemeConfig {
  skeletons?: SkeletonMap  // optional brand loading state overrides — three-level fallback above
}

/**
 * DEFAULT_THEME — @geostat/react. Minimal brand-free ThemeConfig. Zero skeletons.
 * Ships with engine/react/. A new project renders immediately — node types resolved via
 * nodeRegistry (app registers shells in setupRegistrations.ts).
 *
 * CSS: import '@geostat/react/styles' for base CSS (skeleton shimmer, node-slot reset).
 *   See: engine/react/src/styles/base.css — brand-free, required for engine to function.
 */
declare const DEFAULT_THEME: ThemeConfig

/**
 * mergeTheme — @geostat/react. Explicit theme composition utility for skeleton overrides.
 *
 * Pure function — never mutates base.
 * Merge semantics:
 *   skeletons: { ...base.skeletons, ...overrides.skeletons } — per-type override
 *
 * Usage:
 *   // Brand skeleton override:
 *   const GEOSTAT_THEME = mergeTheme(DEFAULT_THEME, {
 *     skeletons: { 'kpi-strip': GeostatKpiStripSkeleton }
 *   })
 *
 * Note: shells and chrome are no longer in ThemeConfig — dispatch moved to registries.
 *   Shell variant: nodeRegistry.register(type, variant, renderer)
 *   Chrome variant: chromeRegistry.register(slot, key, component)
 *   Scoped shell override: ShellOverrideProvider (not a new ThemeProvider)
 *
 * See: examples/theme-config.md
 */
declare function mergeTheme(
  base:      ThemeConfig,
  overrides: {
    skeletons?: Partial<SkeletonMap>
  }
): ThemeConfig

/**
 * ThemeProvider — @geostat/react. Provides ThemeConfig (skeletons) via React context.
 *
 * Placement: ONE ThemeProvider at app root — inside createRoot, outside SiteProvider.
 *
 *   <ThemeProvider theme={GEOSTAT_THEME}>     // skeletons override, if any
 *     <SiteProvider stores={...} pages={...} nav={...}>
 *       <Router />
 *     </SiteProvider>
 *   </ThemeProvider>
 *
 * Scoped shell override (print, embed) → ShellOverrideProvider (not nested ThemeProvider).
 *   Nested ThemeProvider causes outer skeletons to be lost — same issue as before.
 *   ✅ mergeTheme(GEOSTAT_THEME, { skeletons: { ... } }) for skeleton-only overrides.
 */
declare function ThemeProvider(props: { theme: ThemeConfig; children: ReactNode }): ReactNode

/**
 * ShellMap — reference type: maps node type → shell component signature.
 *
 * This type documents the shell prop contract for each built-in node type.
 * It is NOT a dispatch table — component dispatch moved to nodeRegistry.
 *
 * Engine shell dispatch (renderNode step 8 — new architecture):
 *   const Shell = nodeRegistry.get(node.type, node.variant ?? 'default')
 *   if (!Shell) throw new Error(`No renderer for: ${node.type}/${node.variant}`)
 *   return Shell(node, ctx, children)
 *
 * Registration pattern (replaces ThemeConfig.shells):
 *   nodeRegistry.register('section', 'default', GeostatSectionShell)
 *   nodeRegistry.register('container-page', 'landing', GeostatLandingShell)
 *   All registered in setupRegistrations.ts (discoverability rule).
 *
 * ShellMap remains useful as a TypeScript helper for verifying shell prop signatures:
 *   type MyShell = ShellMap['section']   // (props: SectionShellProps) => ReactNode
 */
type ShellMap = {
  'section'?:         (props: SectionShellProps)                 => ReactNode
  'chart'?:           (props: ChartShellProps)                   => ReactNode
  'table'?:           (props: TableShellProps)                   => ReactNode
  'filter-bar'?:      (props: FilterBarShellProps)               => ReactNode
  'kpi-strip'?:       (props: KpiStripShellProps)                => ReactNode
  'inner-page'?:      (props: PageShellProps<InnerPageNode>)     => ReactNode
  'tab-page'?:        (props: PageShellProps<TabPageNode>)       => ReactNode
  'container-page'?:  (props: PageShellProps<ContainerPageNode>) => ReactNode
} & Record<string, (props: any) => ReactNode>   // open — app types extend freely

/**
 * SkeletonContext — minimal context passed to every SkeletonFn.
 * Grafana pattern: skeleton receives panel dimensions → adapts size.
 * type: node.type — skeleton can vary per type if needed.
 * layout: span/position — skeleton adapts to node's grid slot.
 */
interface SkeletonContext {
  type:    string
  layout?: LayoutHints
}

/**
 * SkeletonFn — loading state renderer for one node type.
 * () => ReactNode was too narrow: no way to adapt to layout.span without breaking change.
 * Receives SkeletonContext — use or ignore as needed.
 */
type SkeletonFn = (ctx: SkeletonContext) => ReactNode

/**
 * SkeletonMap — optional brand override for loading states.
 * Built-in keys typed. Open index signature for app custom types.
 *
 * Three-level resolution (renderNode step 8):
 *   1. ctx.theme.skeletons?.[type]          ← ThemeConfig brand override  (this map)
 *   2. nodeRegistry.getMeta(type)?.skeleton ← NodeRegistryMeta type default
 *   3. <div className="node-skeleton node-skeleton--{type}" />  ← engine generic
 *
 * Register default skeletons at node type level (NodeRegistryMeta.skeleton) — less coupling.
 * Use ThemeConfig.skeletons only when brand skeleton differs from type default.
 */
type SkeletonMap = {
  'section'?:    SkeletonFn
  'chart'?:      SkeletonFn
  'table'?:      SkeletonFn
  'filter-bar'?: SkeletonFn
  'kpi-strip'?:  SkeletonFn
} & Record<string, SkeletonFn>

// ── Shell Props ──────────────────────────────────────────────────────────

interface SectionShellProps {
  def:      SectionNode
  children: ChildrenArg
  view:     ResolvedViewParams   // engine resolves def.view (ExprVal) → ctx.view before renderer call
                                 // renderer passes ctx.view — shell never reads def.view directly
}

interface ChartShellProps {
  def:    ChartNode
  output: ChartOutput   // resolved by ChartRenderer; shell calls toApexOptions(output) itself.
                        // ISP: shell receives only what it needs — no ctx, no theme.
                        // useTheme() in shell REMOVED — shell has zero theme dependency:
                        //   static colors → CSS variables in toApexOptions()
                        //   dynamic colors → ChartRenderer sets output.palette (has ctx.theme)
}

interface TableShellProps {
  def:  TableNode
  rows: DataRow[]              // ISP: shell gets data, not full context
  view: ResolvedViewParams     // resolved from def.view — same pattern as SectionShellProps
}

interface FilterBarShellProps {
  def:        FilterBarNode
  filterBars: FilterBarSpec[]   // runtime state — renamed to avoid shadowing def.bars (Record<string,BarDef>)
                                // Convention: shell runtime props must not shadow def field names
                                // where the type difference is not self-evident from type names alone.
                                // Exception: children: ChildrenArg — ChildrenArg vs NodeDef[] is obvious.
}

/**
 * KpiStripShellProps — shell receives ALL rows at once (not per-card).
 * Shell has full layout control: grid, responsive columns, spacing.
 * Shell iterates rows internally and renders one card per row.
 * ONS/Eurostat: KPI strip = visual group — shell decides layout.
 *
 * rows: ALL DataRow[] — engine never splits per card.
 * Shell maps: rows.map(row => <KpiCard row={row} />) — internal to shell impl.
 * Engine renders one KpiStripShell call. Card count = rows.length at runtime.
 */
interface KpiStripShellProps {
  def:  KpiStripNode
  rows: DataRow[]    // ALL rows — shell iterates, engine never renders individual cards
  view: ResolvedViewParams
}

/**
 * KpiCardProps — props shape for one KPI card inside KpiStripShell.
 * Exported from @geostat/react for shell implementers.
 *
 * Shell pattern:
 *   function KpiStripShell({ rows }: KpiStripShellProps) {
 *     return <div className="kpi-strip">{rows.map(row => <KpiCard key={String(row['indicator'])} row={row} />)}</div>
 *   }
 *   function KpiCard({ row }: KpiCardProps) { ... }
 *
 * NOT a registered node type — nodeRegistry has no 'kpi-card' entry.
 * NOT in ShellMap — engine never calls a KpiCard renderer.
 * NOT a NodeDef — no type, no children, no visibleWhen, no DataSpec.
 * Card is a local React component inside the shell. Engine boundary = KpiStripShellProps.
 */
interface KpiCardProps {
  row: DataRow   // one row: row['indicator'], row['value'], row['label'], row['pct'], row['status'], ...
}

interface PageShellProps<T extends PageConfigBase = PageConfigBase> {
  def:      T
  children: ChildrenArg
  // tab-page:       children.defs[i].layout.label = tab header
  // container-page: children.defs[i].layout.span  = column span
}

// ── Filter System ────────────────────────────────────────────────────────

/**
 * ParamDefBase — shared fields for all filter parameter types.
 * Grafana pattern: dependency is variable-level, not type-specific.
 * Any filter type can declare one or more parent keys — not just cascade.
 */
interface ParamDefBase {
  dependsOn?: string[]  // ALL listed keys must be non-null (AND logic).
                        // Any null key → ActiveFilter.waitingFor = [that key, ...]
                        // cascade: additionally skips optionsQuery until all parents set.
                        // other types: disabled with "select X first" message, value treated as unset.
                        // string[] always (not string | string[]) — consumer never needs to normalize.
}

// ── ParamDefMap — module-augmentable (same pattern as NodeTypeMap) ───────────
//
//  Closed union ParamDef → open map: new control type = one module augmentation,
//  zero changes to engine or existing slices.
//
//  Platform precedent: Grafana VariableType discriminated union is NOT augmentable
//  → every new variable type requires Grafana core PR. We avoid this trap.
//
//  Usage in plugins/controls/date-picker:
//    declare module '@geostat/engine' {
//      interface ParamDefMap {
//        'date-picker': ParamDefBase & { type: 'date-picker'; format?: string }
//      }
//    }
//
//  Extract typed config in slice:
//    type DatePickerDef = ParamDefMap['date-picker']
//    function DatePickerShell({ config }: FilterControlProps<DatePickerDef>) { … }

interface ParamDefMap {
  'hidden':       ParamDefBase & { type: 'hidden';       defaultValue:  DefaultSpec }
  'year-select':  ParamDefBase & { type: 'year-select';  defaultValue?: DefaultSpec; years?: YearsSource }
  //   years?: YearsSource — replaces range?: [number, number].
  //   { type: 'inline', items: { $cl: 'time' }, field: 'code' } = dynamic from classifier ✅
  //   { type: 'static', items: [2020, 2021, 2022, 2023] }       = hardcoded list ✅
  'range':        ParamDefBase & { type: 'range';        defaultValue?: DefaultSpec }
  'select':       ParamDefBase & { type: 'select';       options: OptionsSource;     defaultValue?: DefaultSpec }
  //   options: OptionsSource — replaces options: SelectOption[] (static only).
  //   { type: 'static',  items: SelectOption[] }                   = old pattern, still valid ✅
  //   { type: 'inline',  items: { $d: 'sector' }, valueField, pipe } = classifier/display ref ✅
  //   { type: 'query',   query: ObsQuery, valueField }              = DataStore query ✅
  'multi-select': ParamDefBase & { type: 'multi-select'; options: OptionsSource;     defaultValue?: DefaultSpec }
  'cascade':      ParamDefBase & { type: 'cascade';      options: OptionsSource;     defaultValue?: DefaultSpec }
  //   cascade vs select: cascade uses dependsOn + options.type='query' with { $ctx: 'parent' } dims.
  //   options: OptionsSource — replaces storeId? + optionsQuery: DataSpec.
  //   storeId removed: options.type='query' ObsQuery handles store routing.
  //   Parent-filtered cascade: { type: 'query', query: { dims: { country: { $ctx: 'country' } } }, valueField }
  'chip-select':  ParamDefBase & { type: 'chip-select';  options: OptionsSource;     defaultValue?: DefaultSpec; multiple?: boolean }
  //   chip-select vs select: same OptionsSource + DefaultSpec. Different render only.
  //   select     → hidden dropdown (opened on click). Best for long option lists.
  //   chip-select → all options always visible as toggle buttons. Best for ≤6 options.
  //   multiple: false (default) = radio-like (single selection, same semantic as select).
  //   multiple: true            = multi-select semantic, chip render (toggleable).
  //   Platform: Grafana "Segmented control" · Retool "Segmented Control" · ONS metric toggle.
  //   Shell provides chip render; engine treats it identically to select for ctx.dims.
}

type ParamDef = ParamDefMap[keyof ParamDefMap]

interface SelectOption { value: string; label: string }

interface BarDef {
  position: 'sticky' | 'float'
  order?:   number
  filters:  Record<string, ParamDef>
}

/**
 * DimContract — explicit null semantics per filter dimension (Grafana variable contracts).
 *
 * 'required':  null → data blocked. Engine skips interpretSpec, rows=[]. EmptyState shown.
 *              Use for: indicator selector, region selector — page meaningless without value.
 *
 * 'wildcard':  null → all values for that dimension (ONS/Eurostat aggregate default).
 *              Use for: time range on aggregate pages, optional breakdowns.
 *              interpretSpec skips the filter clause → store returns all values.
 *
 * 'empty':     null → [] immediately. No store query. EmptyState shown (Tableau strict mode).
 *              Use for: dependent selectors where parent drives child (null parent → no child data).
 *
 * Default when contracts[key] is omitted: 'required'.
 * JSON-serializable — Constructor can store and edit per-dim contracts.
 */
type DimContract = 'required' | 'wildcard' | 'empty'

/**
 * FilterSchemaInput — 100% JSON-serializable (I-4 architectural fix).
 * Constructor stores this in DB as JSON. defineFilters() is a pure function.
 *
 * store?: DataStore — REMOVED. DataStore is a runtime object, not JSON-serializable.
 * Cascade option loading: useFilters() hook resolves stores via useStores() (SiteContext).
 * defineFilters() never touches stores — it only validates the schema.
 */
interface FilterSchemaInput {
  bars:           Record<string, BarDef>
  params?:        Record<string, ParamDef>     // page-level params — always tracked, never in UI.
                                               // Declared once here; not duplicated across bars.
                                               // Grafana: variable with hide:2. Retool: App State.
                                               // Use for: measure, account, priceBase — any cross-bar hidden state.
  contracts?:     Record<string, DimContract>  // per-dim null semantics; default = 'required'
  effects?:       Effect[]
  crossValidate?: CrossValidator[]             // complex cross-dim rules — complementary to contracts
  computed?:      DeriveMap    // pure ExprVal — evaluated by useFilters → filter dims only.
                               // NOT NodeBase.derive: that is engine-level → ctx.derived (different scope).
                               // 'computed' = Pinia/MobX convention: reactive derived state in filter system.
  context?:       { timeMode?: 'year' | 'range'; dims?: Record<string, DimVal> }
}

interface SectionContext {
  timeMode: 'year' | 'range'
  dims:     Record<string, DimVal>
}

interface FiltersResult {
  ctx:       SectionContext
  bars:      FilterBarSpec[]
  isLoading: boolean   // convenience aggregate: bars.flatMap(b=>b.filters).some(f=>f.isLoading)
                       // use for FilterBar header spinner only.
                       // for per-filter granularity: read ActiveFilter.isLoading directly.
  errors:    Record<string, string>
  // isDataBlocked REMOVED — page-level flag is wrong granularity.
  // Each node evaluates its own contract via interpretSpec → InterpretResult.
  // SectionA needing geo=null does not block SectionB's time-only query.
}

/**
 * FilterProvider — @geostat/react. Provides FiltersResult via React context.
 * Shell components call useFilter() to read state and commit changes.
 * Receives the output of useFilters() — wiring pattern:
 *
 *   const filtersResult = useFilters(schema)
 *   return <FilterProvider value={filtersResult}>{children}</FilterProvider>
 *
 * FilterBarRenderer handles this internally — app code rarely needs FilterProvider directly.
 */
declare function FilterProvider(props: { value: FiltersResult; children: ReactNode }): ReactNode

/**
 * FlatFilters — full TypeScript inference of all filter values across bars
 * Usage: const filters: FlatFilters<typeof schema.bars> = useFilters(schema)
 * Flattens all bar filter records into a single intersection type for typed access.
 */
type FlatFilters<B extends Record<string, BarDef>> =
  { [K in keyof B]: B[K]['filters'] }[keyof B] extends infer U
    ? { [K in keyof U]: U[K] }
    : never
// Equivalent to: UnionToIntersection<B[keyof B]['filters']>
// Result: { time: number; geo: string; timeFrom: number; ... } — all filter keys typed

interface FilterBarSpec {
  barId:    string
  position: 'sticky' | 'float'
  order:    number
  filters:  ActiveFilter[]   // display info only — see examples/filter-shell.md
  errors:   string[]
}

/**
 * ActiveFilter — display data for one filter control (runtime, not config).
 * Shell reads these to know WHAT to render and what state to show.
 * Shell uses useFilter() hook to know HOW to update state.
 * Communication pattern: examples/filter-shell.md
 *
 * Three loading states (mutually exclusive, checked in order):
 *   waitingFor set  → parent filter not yet selected  → disabled, "select X first"
 *   isLoading=true  → options loading from store       → show spinner
 *   (neither)       → ready                           → render normally
 */
interface ActiveFilter {
  key:         string
  paramDef:    ParamDef
  value:       DimVal | DimVal[]
  isLoading:   boolean    // cascade options in-flight (useStoreQuery pending)
  waitingFor?: string[]   // subset of dependsOn keys that are currently null
                          // shell: disabled, placeholder "ჯერ X და Y აირჩიეთ"
                          // empty array treated same as undefined — always check .length
  // onChange REMOVED — shell owns state updates via useFilter() hook
  // See examples/filter-shell.md for the communication pattern
}

// ── useFilter — per-key hook (TanStack Form / React Hook Form pattern) ──────
//
//  useFilter<T>(key) — per-key accessor. Shell calls this internally.
//  No onChange prop drilling. Shell owns its own state access.
//
//  useFilterContext() — full context (batch updates, reading multiple keys at once).
//  Rename of old useFilter() — keeps full context access for edge cases.
//
//  Platform precedents:
//    TanStack Form: useField<T>('name') → { state, handleChange } per field
//    React Hook Form: register('field') / watch('field') per field
//    Grafana: useVariable(name) per variable

interface UseFilterKeyResult<T = unknown> {
  value:  T | undefined     // undefined = not yet set → slice.defaultValue kicks in
  set:    (v: T) => void    // writes to FilterContext → URL → re-render
  reset:  () => void        // removes key → URL clears → defaultValue restored
}

declare function useFilter<T = unknown>(key: string): UseFilterKeyResult<T>

// useFilterContext — full context for batch updates, reading all dims at once
interface UseFilterContextResult {
  state:   Record<string, DimVal>
  setMany: (updates: Record<string, DimVal>) => void
}
declare function useFilterContext(): UseFilterContextResult

// useFilterBars — FilterBarSpec[] from FilterBarProvider context
// FilterBarRenderer injects this. Shell reads to know which filters to render.
declare function useFilterBars(): FilterBarSpec[]

/**
 * Effect — filter side-effect rule: when condition true → merge set into dims.
 *
 * Evaluated in useFilters step 3 — after URL params + defaults, before CrossValidators.
 * Evaluation order: array order, single pass — no re-evaluation after effects run.
 *
 * Cascading is a deliberate non-feature (Grafana: same decision — prevents infinite loops).
 * If Effect B depends on a value set by Effect A, place A before B in the effects array.
 *
 * set fields evaluated against dims AT the moment this effect runs.
 * Result merged into dims: dims[key] = evalExpr(val, scope) for each key in set.
 * Subsequent effects and CrossValidators see the updated dims (single pass).
 *
 * Full examples + useFilters order: examples/filter-effects.md
 */
interface Effect {
  when: Expr
  set:  Record<string, ExprVal>
}

/**
 * CrossValidator — cross-field validation rule.
 * Complementary to DimContract: DimContract handles per-dim null semantics;
 * CrossValidator handles relational rules across multiple dims (e.g. timeFrom ≤ timeTo).
 *
 * Evaluated in useFilters step 4 — after all Effects have run, dims fully settled.
 * All CrossValidators run regardless of earlier failures (full pass, collect all errors).
 *
 * expr:    evalExpr<boolean>(expr, scope) → false = validation fails.
 * message: evalExpr<string>(message, scope) → stored in FiltersResult.errors[key].
 * key:     which filter control shows this error. Shell reads errors[filter.key] per control.
 *
 * Full examples: examples/filter-effects.md
 */
interface CrossValidator {
  key:     string    // filter key to attach error to — FiltersResult.errors[key] = message
  expr:    Expr
  message: ExprVal
}

// ── Filter Control Registry ──────────────────────────────────────────────
//
//  Platform precedents:
//    Grafana variableAdapters — component + codec + validation per type, full slice
//    Builder.io registered inputs — type + component + schema (palette + form editor)
//    TanStack Form — field.value + field.set, no onChange prop drilling
//
//  One slice = Shell + META + codec + defaultValue + validate? + formatValue? + editor?
//  New control type = one ControlSlice file + one barrel entry. Zero other changes.

// ── FilterCodec — URL serialization contract ─────────────────────────────
//
//  Grafana variableAdapters: getValueForUrl / setValueFromUrl / normalize
//  Our additions: isEmpty (clear button) + normalize (type coercion on every write)
//
//  normalize is CRITICAL: without it URL string "2023" stays as string, not number.
//  Called on every value write (fromUrl, defaultValue, set) → type always T, never any.

interface FilterCodec<T = unknown> {
  toUrl:     (value: T)             => string | null  // null = omit from URL (hidden filters)
  fromUrl:   (param: string | null) => T | null       // null = absent → use defaultValue
  isEmpty:   (value: T)             => boolean        // drives clear button + required validation
  normalize: (raw: unknown)         => T              // string|number|any → T, always
}

// ── OptionsLoader — async options loading protocol ────────────────────────
//
//  Grafana: updateOptions(variable): Promise<void> — formal per-type contract
//  Our version: async fn injected by FilterBarProvider → cascade Shell calls it
//  Phase 2: Constructor live preview calls same loader
//
//  Returns SelectOption[] — generic, not cascade-specific (select can also use async opts)

interface OptionsLoader {
  load: (ctx: SectionContext) => Promise<SelectOption[]>
  // ctx: current filter dims → allows parent-driven cascade queries ({ $ctx: 'geo' })
}

// ── FilterControlMeta — JSON-serializable, Constructor-facing ─────────────
//
//  Stored in DB. Drives Constructor filter palette + form editor.
//  JSON.parse(JSON.stringify(META)) === META ✅

interface FilterControlMeta {
  controlType:   string             // registry key — matches ParamDefMap key
  label:         string             // Constructor palette display name
  description?:  string
  icon?:         string
  category?:     'time' | 'geo' | 'indicator' | 'comparison' | string
  schema?:       ConstructorSchema  // formally typed — drives Constructor form editor
}

// ── FilterControlProps — what Shell receives ──────────────────────────────
//
//  No onChange prop. Shell calls useFilter<T>(filterKey) internally.
//  config = static ParamDef from defineFilters — not live state.
//  Typed via ParamDefMap: FilterControlProps<ParamDefMap['year-select']>

interface FilterControlProps<C extends ParamDef = ParamDef> {
  filterKey: string   // → useFilter<T>(filterKey) inside Shell
  config:    C
}

// ── FilterControlSlice — the full registration unit ───────────────────────
//
//  Consistent with NodeSlice { Shell, Skeleton?, META }:
//    runtime functions (codec, defaultValue, validate, formatValue) NOT in META
//    META is JSON-serializable ✅
//    editor? = Phase 2 slot (Constructor config UI for this control type)
//              Phase 1: omit → Constructor uses generic form from META.schema
//              Phase 2: fill with React component → custom Constructor UI

interface FilterControlSlice<T = unknown, C extends ParamDef = ParamDef> {
  Shell:         ComponentType<FilterControlProps<C>>
  META:          FilterControlMeta                                           // JSON ✅
  defaultValue:  (config: C) => T                                           // config-aware factory
  codec:         FilterCodec<T>
  validate?:     (value: T, config: C, ctx: SectionContext) => string | null // null = valid
  formatValue?:  (value: T, config: C) => string                            // chip label: [2020,2023]→"2020–2023"
  editor?:       ComponentType<{ config: C; onChange: (c: C) => void }>     // Phase 2: Constructor form UI
                                                                             // Phase 1: omit
}

// ── DependencyGraph — formal filter dependency tracking ───────────────────
//
//  Built by FilterBarProvider from ParamDefBase.dependsOn declarations.
//  Topological sort → resolve order. Circular dep → error at schema parse time.
//  Constructor uses graph for filter palette ordering + dependency visualization.
//
//  Grafana: variables.resolveOrder() — same concept, our explicit type.

interface DependencyNode {
  key:      string
  deps:     string[]   // direct dependencies (dependsOn)
  level:    number     // topological level: 0 = no deps, 1 = depends on level-0, …
}

interface DependencyGraph {
  nodes:    DependencyNode[]
  order:    string[]            // topological sort result — resolve in this order
  hasCycle: boolean             // true = schema error, useFilters throws
}

// ── FilterControlRegistry — open, full-slice storage ─────────────────────
//
//  register(slice) — keyed by slice.META.controlType. Stores full slice.
//  get(type)       → full FilterControlSlice (Shell + codec + validate + …)
//  list()          → Constructor filter palette (META for each type)
//
//  Old API (REMOVED):
//    register(type, control, codec)  ← split storage, drift possible
//    getCodec(type)                  ← redundant: slice.codec

interface FilterControlRegistry {
  register<T, C extends ParamDef>(slice: FilterControlSlice<T, C>): void
  get(type: string):  FilterControlSlice | undefined
  list():             Array<FilterControlMeta>   // Constructor palette introspection
}

declare const filterControlRegistry: FilterControlRegistry

// ── Site Manifest + Navigation ───────────────────────────────────────────

/** Navigation item — site-level, independent of PageConfig */
interface NavItem {
  label:   string
  icon?:   NavIconKey
  path:    string              // '/gdp'
  pageId?: string              // → PageConfig.id (optional: external links have no pageId)
  color?:  string              // sidebar accent
  items?:  NavSubItem[]        // in-page anchors
  hidden?: boolean             // in system, not shown in nav
}

interface NavSubItem {
  label:  string
  anchor: string
}

type NavIconKey = string  // known: 'bar-chart' | 'document' | 'pin' — open for extensibility

/**
 * SiteManifest — 100% JSON-serializable. Returned by fetchSiteManifest() / GET /api/site.
 * Constructor stores all fields in DB. Zero code files change when content changes.
 *
 * datasources: DatasourceInstanceConfig[] — NOT DataStore[]. Stores are runtime objects;
 *   configs are JSON. buildStoreManifest(manifest.datasources) builds the runtime stores.
 *   Phase 1: datasources built from TypeScript config objects (same shape, no DB yet).
 *   Phase 2: GET /api/site returns datasources array → engine.buildStoreManifest() → stores.
 *
 * stores: NOT in manifest. Built after fetch: stores = engine.buildStoreManifest(manifest.datasources).
 *   SiteProvider receives stores (runtime), not datasources (config).
 */
interface SiteManifest {
  datasources: DatasourceInstanceConfig[]   // JSON-safe — Constructor stores in DB ✅
  pages:       Record<string, PageConfig>   // keyed by id
  nav:         NavItem[]
  tokens?: Record<string, string>      // CSS variable overrides — Phase 2: per-tenant brand tokens
                                       // e.g. { '--geostat-color-primary': '#005A9C' }
                                       // Applied by applyTokens() in app bootstrap — before createRoot.
                                       // Keys not starting with '--' → warn + skip (never throws).
                                       // tokens.css = base defaults; manifest.tokens = runtime overrides.
                                       // Phase 2: fetchSiteManifest() returns per-tenant tokens from DB.
                                       // JSON-serializable: Record<string, string> → Constructor stores as-is.
  chrome?: Record<string, string>      // chrome slot → variant key — Constructor sets, JSON-serializable.
                                       // e.g. { 'AppHeader': 'minimal', 'AppSidebar': 'hidden' }
                                       // AppChrome: chromeRegistry.get(slot, manifest.chrome?.[slot] ?? 'default')
                                       // Omitted or key absent → 'default' variant used for that slot.
                                       // Phase 2: Constructor stores chrome config in DB → fetchSiteManifest() returns it.
                                       // Zero code change to switch header variants — pure data decision.
}

/**
 * applyTokens — @geostat/react. Applies SiteManifest.tokens as CSS custom properties on :root.
 * Called in app bootstrap BEFORE ReactDOM.createRoot — synchronous, no flash of unstyled content.
 *
 * Implementation: document.documentElement.style.setProperty(k, v) per entry.
 * Validation: keys not starting with '--' → console.warn + skip (never throws).
 * Update: call again with new tokens → setProperty overwrites in place (Phase 2: tenant switch).
 *
 * SiteProvider does NOT call this (SRP: context provision ≠ DOM mutation).
 *
 * Bootstrap pattern:
 *   // main.tsx
 *   const manifest = await fetchSiteManifest()
 *   applyTokens(manifest.tokens ?? {})      // ← before React, no FOUC
 *   createRoot(document.getElementById('root')!).render(<App manifest={manifest} />)
 *
 * Precedence (standard CSS cascade):
 *   tokens.css     = base defaults    (stylesheet, lowest priority)
 *   manifest.tokens = runtime overrides (inline style on :root, wins over stylesheet)
 *   component scoped = always wins    (more specific selector or inline style on element)
 */
declare function applyTokens(tokens: Record<string, string>): void

/**
 * SiteProvider — @geostat/react. Provides stores, pages, nav via SiteContext.
 * Must wrap the app inside ThemeProvider. Enables useStores(), useSiteNav(), usePageById().
 *
 * Phase 1: datasources built from TypeScript config objects → stores built locally.
 * Phase 2: fetchSiteManifest() returns datasources array → engine.buildStoreManifest() builds stores.
 * SiteProvider props shape unchanged between phases — only how stores are built changes.
 *
 *   const manifest = await fetchSiteManifest()       // { datasources, pages, nav, tokens, chrome }
 *   const stores   = engine.buildStoreManifest(manifest.datasources)  // plugin.create() per config
 *   applyTokens(manifest.tokens ?? {})
 *   <ThemeProvider theme={GEOSTAT_THEME}>
 *     <SiteProvider stores={stores} pages={manifest.pages} nav={manifest.nav}>
 *       <Router />
 *     </SiteProvider>
 *   </ThemeProvider>
 */
declare function SiteProvider(props: {
  stores:   Record<string, DataStore>
  pages:    Record<string, PageConfig>
  nav:      NavItem[]
  chrome?:  Record<string, string>  // SiteManifest.chrome — chrome slot → variant key
  children: ReactNode
}): ReactNode

/**
 * SiteRenderer — @geostat/react. Renders a single PageConfig via the engine.
 * Called by PageLoader after usePageById() resolves the page.
 * Wires useTheme() + useStores() + useFilters() → baseCtx → engine.renderNode(page, baseCtx).
 * key={page.id} forces remount on navigation (FIX-17: stale filter state between pages).
 *
 * Performance contract (P-2 — render gate):
 *   SiteRenderer wraps engine.renderNode in useMemo([page.id, ctx]).
 *   engine.renderNode is a pure function — same inputs → same ReactNode tree.
 *   useMemo prevents full tree re-evaluation on unrelated parent re-renders.
 *
 *   Effective only when ctx is a stable reference (P-3 — see RenderContext stability contract).
 *   baseCtx = useMemo(() => buildCtx(...), [theme, stores, filters.ctx.dims, page.storeKey])
 *
 *   Result: collection ops on scope.rows are re-evaluated ONLY when dims or rows change
 *   (i.e., when the user actually changes a filter or new data arrives from the store).
 *   Unrelated parent re-renders: zero re-evaluation. See examples/performance.md.
 */
declare function SiteRenderer(props: { page: PageConfig }): ReactNode

/**
 * PageLoader — @geostat/react. Resolves pageId → PageConfig → SiteRenderer.
 * Route handler: every page route renders <PageLoader pageId="..." />.
 * usePageById(pageId) → null → PageNotFound | PageConfig → SiteRenderer.
 * Wraps SiteRenderer in Suspense + ErrorBoundary (page-level boundaries).
 *
 * Works with ANY PageConfig — including those containing app-specific child node types.
 * engine.renderNode dispatches children by type string → nodeRegistry → renderer.
 * PageLoader has no knowledge of child node types — open/closed: ✅.
 *
 * Landing page pattern:
 *   <PageLoader pageId="landing" />
 *   → usePageById('landing') → ContainerPageNode { variant: 'landing', children: [...] }
 *   → SiteRenderer → engine.renderNode → ContainerPageNode shell (landing layout)
 *   → children: 'landing-hero', 'landing-stats' resolved from nodeRegistry
 *   No special-casing in PageLoader or SiteRenderer. No lazy-loading divergence.
 *   See: examples/landing-page.md
 */
declare function PageLoader(props: { pageId: string }): ReactNode

/**
 * NodeErrorFallbackProps — props received by a custom error fallback component.
 * Engine passes nodeType so fallback can adapt message per node kind.
 * retry defined only when the caught error is StoreError with retryable: true.
 */
interface NodeErrorFallbackProps {
  error:    Error
  nodeType: string    // node.type — 'chart' | 'table' | 'filter-bar' | any registered type
  retry?:  () => void // present → show Retry button (StoreError.retryable === true)
                      // absent  → permanent error (4xx), no retry offered
}

/**
 * NodeErrorBoundaryProps — props for NodeErrorBoundary.
 * fallback omitted → built-in error node (generic message + conditional Retry button).
 * nodeType passed by engine on every renderer call — richer fallback messages.
 */
interface NodeErrorBoundaryProps {
  children:  ReactNode
  nodeType?: string                                       // passed by engine (node.type)
  fallback?: (props: NodeErrorFallbackProps) => ReactNode // custom override — optional
}

/**
 * NodeErrorBoundary — @geostat/react. Per-node React Error Boundary.
 * Engine wraps every renderer call: <NodeErrorBoundary nodeType={node.type}>{renderer()}</NodeErrorBoundary>
 * One node fails → error node shown in place. Rest of page continues rendering.
 *
 * Catches two error classes:
 *   StoreError (retryable)   → error node + Retry button → retry → re-render
 *   StoreError (permanent)   → error node only (4xx: 401/403/404)
 *   Any other Error          → error node only (renderer crash)
 *
 * Grafana: PanelErrorBoundary — same pattern, per-panel, first-class @grafana/ui export.
 */
declare function NodeErrorBoundary(props: NodeErrorBoundaryProps): ReactNode

// ── Chart types ──────────────────────────────────────────────────────────

/**
 * FieldEncoding — how one DataRow field maps to a visual channel
 * Vega-Lite / Grammar of Graphics pattern.
 */
interface FieldEncoding {
  field:   string                                              // DataRow field name
  type?:   'quantitative' | 'ordinal' | 'temporal' | 'nominal'
  format?: string                                             // number/date format string
  title?:  string                                             // axis/legend label
}

/**
 * ChartDef — Grammar of Graphics chart declaration (JSON-serializable)
 * Full examples + ApexCharts bridge: examples/chart-def.md
 *
 * encoding: known channels documented, open record for extensibility.
 * interpretChart(def, rows, ctx) → ChartOutput → toApexOptions() → ApexCharts
 */
interface ChartDef {
  type:     'bar' | 'line' | 'area' | 'pie' | 'scatter' | string  // open — add freely
  encoding: {
    x?:       FieldEncoding    // x-axis / category
    y?:       FieldEncoding    // y-axis / value
    color?:   FieldEncoding    // color channel / series grouping
    label?:   FieldEncoding    // data labels
    size?:    FieldEncoding    // bubble size
    tooltip?: FieldEncoding    // tooltip field override
    [channel: string]: FieldEncoding | undefined   // fully open — add any channel
  }
  stacked?:  boolean
  legend?:   boolean
  title?:    string
}

/**
 * ChartSeries — one data series (library-agnostic)
 */
interface ChartSeries {
  name: string                   // series label (from color channel field values, or indicator label)
  data: (number | null)[]        // null = missing observation — chart library renders gap
}

/**
 * ChartOutput — intermediate representation between ChartDef and chart library.
 * interpretChart(def, rows, ctx) → ChartOutput → toApexOptions() → ApexCharts.ApexOptions
 *
 * ChartRenderer (engine/react/) produces ChartOutput — stays agnostic of chart library.
 * Shell (src/) calls toApexOptions() and renders library component.
 * Swap chart library → only toApexOptions() changes. ChartDef + ChartOutput: unchanged.
 *
 * Color resolution (shell never needs useTheme()):
 *   palette present → toApexOptions() uses palette[i] per series (data-driven colors from renderer)
 *   palette absent  → toApexOptions() uses CSS variables: var(--geostat-chart-color-1), etc.
 *   Static colors  → CSS variables (theme change = CSS change, zero JS)
 *   Dynamic colors → ChartRenderer computes from ctx.theme, sets palette in ChartOutput
 */
interface ChartOutput {
  type:        string                    // mirrors ChartDef.type — 'bar' | 'line' | 'pie' | string
  series:      ChartSeries[]
  categories?: (string | number)[]       // x-axis labels (resolved from encoding.x field)
  title?:      string
  stacked?:    boolean
  legend?:     boolean
  palette?:    string[]                  // per-series colors — set by ChartRenderer for data-driven colors.
                                         // omitted → toApexOptions() falls back to CSS variables.
                                         // ChartRenderer has ctx.theme; shell does not need it.
}

/**
 * interpretChart — @geostat/engine. ChartDef + DataRow[] → ChartOutput.
 *
 * Pure function — no ctx, no side effects, no store calls.
 * rows already resolved by engine (renderNode step 3) before ChartRenderer runs.
 * ChartRenderer calls: const output = interpretChart(node.def, ctx.rows)
 *
 * Grammar of Graphics mapping:
 *   encoding.x     → categories   (temporal/ordinal axis values)
 *   encoding.y     → series.data  (quantitative values; null = missing observation, renders gap)
 *   encoding.color → series grouping (nominal → one series per unique value)
 *   encoding.label / tooltip / size → carried into ChartOutput for toApexOptions()
 *
 * Unknown channels: silently ignored (open encoding — forward-compatible).
 */
declare function interpretChart(
  def:  ChartDef,
  rows: DataRow[],
): ChartOutput

/**
 * toApexOptions — src/ boundary. ChartOutput → ApexCharts.ApexOptions.
 *
 * NOT in packages/ — packages stay library-agnostic (Rule 1).
 * Lives in src/shared/chart/toApexOptions.ts (Geostat-specific, ApexCharts-specific).
 * Shell calls: const apexOpts = toApexOptions(output) → <ReactApexChart options={apexOpts} />
 *
 * Color resolution:
 *   output.palette present → use palette[i] per series
 *   output.palette absent  → use CSS variables: var(--geostat-chart-color-1), ...
 *
 * Swap chart library → write toRechartsProps(output) or toEchartsOpts(output).
 * ChartDef + ChartOutput + interpretChart: zero changes.
 */
declare function toApexOptions(output: ChartOutput): Record<string, unknown>
// Return typed as Record<string,unknown> here — ApexCharts.ApexOptions at src/ call site.

/**
 * FilterSchema — JSON-serializable filter schema (stored in DB by Constructor)
 * Input to defineFilters(). Alias of FilterSchemaInput (store field removed).
 */
type FilterSchema = FilterSchemaInput

/**
 * defineFilters — @geostat/react. Pure schema builder — no hooks, no URL state.
 * Validates FilterSchemaInput statically: bar structure, ParamDef types, DeriveMap order.
 * Returns FilterSchema (= FilterSchemaInput) — validated pass-through for type safety.
 *
 * Counterpart of useFilters (hook):
 *   defineFilters(schema) → validate once at module level (static)
 *   useFilters(schema)    → live runtime: reads URL state, loads cascade options
 *
 * Constructor stores defineFilters input in DB as JSON.
 * JSON.parse(JSON.stringify(schema)) === schema → ✅ always.
 * store?: DataStore — REMOVED (not JSON-serializable). Cascade resolves via useStores().
 */
declare function defineFilters(schema: FilterSchemaInput): FilterSchema

// KpiDef REMOVED — KpiStrip is data-driven via DataSpec (type:'row-list') → ctx.rows
// KpiCardProps.row: DataRow replaces it. Shell reads row fields directly.

// ── Constructor Catalog ──────────────────────────────────────────────────

/**
 * DimensionMeta — one dimension as served by GET /api/catalog.
 * Constructor data picker: shows dimension keys + labels + available values.
 * values[] = known codes from the SDMX DSD. Constructor binds each to { $ctx: key }.
 *
 * Grafana pattern: DataSourceInstanceSettings.jsonData carries dimension meta.
 * Our catalog endpoint pre-processes the DSD → Constructor never parses raw SDMX.
 */
interface DimensionMeta {
  key:    string                               // 'geo' | 'time' | 'sector' — DataSpec dim key
  label:  string                               // 'გეოგრაფია' | 'პერიოდი' — display label
  values: Array<{ code: string; label: string }>  // known SDMX codes (empty = dynamic / too many)
}

/**
 * IndicatorMeta — one indicator as served by GET /api/catalog.
 * Constructor data picker: shows indicator codes + labels → DataSpec.indicator.
 */
interface IndicatorMeta {
  code:  string   // 'B1G' | 'P3' | 'P51G' — SDMX concept code
  label: string   // 'მშპ' | 'მოხმარება' — display label
}

/**
 * DatasetEntry — one dataset entry as served by GET /api/catalog.
 * Backend derives this from SDMX DSD — Constructor never fetches raw SDMX.
 *
 * Two separate catalogs (never mix):
 *   nodeRegistry.list()   = UI component types   (section, chart, table…)
 *   GET /api/catalog      = data datasets         (GDP_GE, ACCOUNTS_GE…)
 *
 * href + transform mirror DataSpec fields:
 *   buildDataSpecFromCatalog() maps entry.href → DataSpec.href
 *                                   entry.transform → DataSpec.transform
 *   Constructor never types URLs manually — always from catalog.
 *
 * JSON-serializable: all string fields. ✅ Constructor stores as-is.
 * "New dataset in backend → DSD published → catalog returns new entry → Constructor sees it."
 */
interface DatasetEntry {
  id:         string            // 'GDP_GE' — stable identifier
  label:      string            // 'მთლიანი შიდა პროდუქტი'
  href:       string            // API URL — HttpDataStore uses this
  transform:  string            // matches engine.listTransforms() key (e.g. 'fromSDMX')
  dimensions: DimensionMeta[]
  indicators: IndicatorMeta[]
}

// ── Hook Signatures ──────────────────────────────────────────────────────
//
// All hooks exported from @geostat/react.
// Grafana pattern: public hooks declared with full signatures — not inferred from impl.
// Each hook below is a declare — canonical contract, not implementation.

/**
 * useTheme — reads ThemeConfig (skeletons) from ThemeContext.
 * Must be called inside <ThemeProvider>.
 * Note: shells and chrome are resolved via registries, not useTheme().
 *   nodeRegistry.get(type, variant) — shell dispatch
 *   chromeRegistry.get(slot, key)   — chrome dispatch
 */
declare function useTheme(): ThemeConfig

/**
 * useSiteChrome — reads SiteManifest.chrome from SiteContext.
 * Returns the active chrome variant keys selected for this site/tenant.
 * AppChrome uses this to resolve active chrome components:
 *   const chromeConfig = useSiteChrome()
 *   const Header = chromeRegistry.get('AppHeader', chromeConfig?.AppHeader ?? 'default')
 */
declare function useSiteChrome(): Record<string, string> | undefined

/**
 * useStores — reads the DataStore registry from SiteContext.
 * Must be called inside <SiteProvider>. Returns all registered stores by key.
 * Used by renderers that need direct store access (imperative data path).
 */
declare function useStores(): Record<string, DataStore>

/**
 * useSiteNav — reads NavItem[] from SiteContext.
 * Must be called inside <SiteProvider>. Used by AppHeader/AppSidebar (chrome components).
 */
declare function useSiteNav(): NavItem[]

/**
 * usePageById — sync O(1) PageConfig lookup from SiteContext.
 * Must be called inside <SiteProvider>.
 * Returns null if id not found (PageLoader shows 404 state).
 */
declare function usePageById(id: string): PageConfig | null

/**
 * useFilters — derives FiltersResult from FilterSchemaInput + live URL state.
 * Hook — reads FilterContext (set by FilterProvider).
 * Pure schema in, live runtime state out.
 * Cascade option loading resolved via useStores() internally (stores not passed as arg).
 *
 * defineFilters(schema) → validate once (static)
 * useFilters(schema)    → live runtime (URL state + option loading)
 */
declare function useFilters(schema: FilterSchemaInput): FiltersResult

/**
 * useFilter — FilterContext accessor for shell components.
 * Must be called inside <FilterProvider>.
 * state:   current filter values (from URL / FilterContext)
 * setMany: batch-update keys → URL state → re-render → new ctx.dims
 *
 * Shell pattern: filter control reads currentValue from ActiveFilter,
 * calls setMany({ [key]: newValue }) on user interaction.
 */
declare function useFilter(): UseFilterResult

/**
 * useStoreQuery — imperative data path for components that need reactive loading state.
 * Third path (after declarative DataSpec and inherited ctx.rows).
 * Wraps store.query() with React state — no specific caching library imposed.
 *
 * StaticDataStore → sync → data immediately, isLoading: false
 * HttpDataStore   → cache hit: sync | cache miss: isLoading: true → resolves
 *
 * Usage: inner component of a NodeRenderer (hooks forbidden in plain renderer fn).
 */
declare function useStoreQuery(
  stores:  Record<string, DataStore>,
  storeId: string,
  spec:    DataSpec,
): { data: DataRow[]; isLoading: boolean; error?: Error }

// ═══════════════════════════════════════════════════════════════════════════
// SectionNav — in-page table of contents + scrollspy
// ═══════════════════════════════════════════════════════════════════════════
//
// Platform: ONS "Contents" sidebar · Eurostat publication TOC · Wikipedia TOC.
// Framework-level: agnostic to sidebar implementation.
//
// Registration: NodeBase.navLabel? — opt-in per node.
//   navLabel present + node.id present → IntersectionObserver entry.
//   Engine sets data-section-id={node.id} on the root DOM element of that node.
//   SectionNavProvider collects [data-section-id] elements, runs IntersectionObserver.
//   useSectionNav() → chrome reads activeId for sidebar highlight.
//
// See: architecture/28-section-nav.md + examples/section-nav.md

/**
 * SectionNavEntry — one TOC item built by the engine from the node tree.
 * Built at render time from all NodeBase nodes with navLabel set.
 * depth: nesting level (0 = direct children of page root).
 * order: document order (position among siblings).
 */
interface SectionNavEntry {
  id:     string    // node.id — used as IntersectionObserver target + href anchor
  label:  string    // node.navLabel
  depth:  number    // nesting level (0 = top-level)
  order:  number    // document order index
}

/**
 * SectionNavCtxValue — provided by SectionNavProvider (engine/react/).
 * Chrome reads this to render and highlight the in-page TOC sidebar.
 *
 * entries:   all registered sections in document order.
 * activeId:  id of the section currently most visible in the viewport (IntersectionObserver).
 * scrollTo:  programmatic scroll to a section (smooth, accounts for sticky offset).
 */
interface SectionNavCtxValue {
  entries:   SectionNavEntry[]
  activeId:  string | null
  scrollTo:  (id: string) => void
}

/**
 * useSectionNav — reads SectionNavCtxValue from SectionNavProvider.
 * Use in chrome shells (sidebar, breadcrumbs) to highlight the active section.
 * Must be called inside SectionNavProvider scope (SiteRenderer wraps with it).
 */
declare function useSectionNav(): SectionNavCtxValue

/**
 * GeoRegistry — registered GeoJSON keyed by name (engine.registerGeoJson).
 * GeoMapNode.source = { type: 'key', key } looks up here at render time.
 * Populated at bootstrap in setupRegistrations() — zero HTTP if key found.
 * Agnostic to GeoJSON content — any feature collection with a code property works.
 */
interface GeoRegistry {
  register:  (key: string, geojson: object) => void
  get:       (key: string) => object | undefined
  has:       (key: string) => boolean
}
```
