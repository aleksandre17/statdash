// ── Standard 2: SDMX Observation Model (ISO 17369) ───────────────────
//
//  Core data layer — dimensions, observations, multi-dimensional queries.
//
//  Field naming follows SDMX conventions:
//    time    → TIME_PERIOD   (number, not string)
//    geo     → REF_AREA      (code: 'GE-TB', not label)
//    measure → INDICATOR     (code: 'gdp', 'fdi')
//    value   → OBS_VALUE     (always number)
//
//  No dimension is privileged — time, geo, breakdown are all equal fields
//  in the observation. SectionContext.dims is a generic map for the same reason.
//
//  CtxRef — runtime signal reference (Vega-Lite signals / SDMX parameterised
//  queries analogue). Resolved via ctx.dims[key] at interpretSpec call time.
//

import type { DimVal } from '@statdash/expr'
export type { DimVal }

/**
 * Runtime reference to SectionContext.dims — resolved at interpretSpec call time.
 * e.g. { $ctx: 'time' } → ctx.dims['time']
 *
 * Analogous to Vega-Lite signals / SDMX parameterised queries.
 * JSON-serializable — can be stored in config objects.
 */
export type CtxRef = { $ctx: string }

/**
 * Negation filter — SDMX excludeCode / SQL WHERE dim != val.
 * e.g. { $ne: '_T' } excludes the SDMX total code from sector queries.
 */
export type NeRef = { $ne: DimVal }

/**
 * Exclusion + optional ctx narrowing.
 * { $ne: '_T', $ctx: 'sector' }
 *   → always excludes $ne value
 *   → if ctx[$ctx] is non-empty, also restricts to that value
 * Analogue of SDMX "excludeCode + optional parameterised filter".
 */
export type NeCtxRef = { $ne: DimVal; $ctx: string }

/** A single filter value — literal, array of literals, CtxRef, NeRef, or NeCtxRef. */
export type FilterValue = DimVal | DimVal[] | CtxRef | NeRef | NeCtxRef

/**
 * A single observation from the data cube (SDMX: DataSet row).
 * Fields = any dimension combination + built-in 'value', 'label', 'color'.
 * Immutable by convention — observations are never mutated after creation.
 */
export type Observation = Readonly<Record<string, DimVal>>

/**
 * Multi-dimensional query against a DataStore — SDMX Dataflow / OLAP slice analogue.
 * Supports any dimension combination the store knows about.
 * 100% JSON-serializable — usable in config objects.
 */
export interface ObsQuery {
  /** One or more measure codes (indicator codes). */
  measure:   string | string[]
  /**
   * Dimension filters. Each value is a literal, array, or { $ctx } reference.
   * All conditions are ANDed — an observation must satisfy every filter to be included.
   */
  filter?:   Partial<Record<string, FilterValue>>
  /** Result ordering — applied after filtering. */
  orderBy?:  { field: string; dir: 'asc' | 'desc' }
}

// ── Classifier — Kimball dimension table (structural only, no presentation) ──
//
//  Facts carry surrogate IDs. The classifier maps id → { code, parent? } —
//  stable business code + optional hierarchy edge. No label, no color:
//  those live in app-level display/ dicts keyed by code.
//
//  Hierarchy is emergent from `parent` edges (SDMX HierarchicalCodelist
//  pattern). A rollup member (e.g. 'total') is just another entry whose
//  descendants are resolved via parent-edge traversal.
//
//  JSON-serializable — Constructor Phase 2 emits this verbatim.

export interface ClassifierEntry {
  /** Stable business code — what consumers see at query boundary. */
  code:    DimVal
  /** Parent id (as map key) — optional; absent = root. */
  parent?: DimVal
  /** Open bag for additional structural attrs (isoCode, nutsLevel, …). No display. */
  [attr: string]: DimVal | undefined
}

/**
 * Classifier — dimension codelist. Two equivalent forms:
 *
 *   Array   — SDMX-native: `[{ code: 'P1', … }]`. Code IS the key (code = id).
 *             New datasets and manually-authored codelists use this form.
 *
 *   Record  — Kimball surrogate-key: `{ '1': { code: 'tbilisi', parent: 0 } }`.
 *             Auto-generated datasets with numeric surrogate ids use this form.
 *
 * Engine functions accept both. `codelistOf` / `DimResolver` normalize internally.
 */
export type Classifier = ClassifierEntry[] | Record<string, ClassifierEntry>

/**
 * DisplayMap — UI/presentation overlay for one dim. Keyed by the SAME id
 * space as the classifier (number/string id, NOT business code) — uniform
 * with `Classifier`. Open attribute bag: labels, colors, ordering, fullLabel,
 * anything UI needs.
 *
 * Engine NEVER reads this directly. `resolveDisplayRef` joins it against the
 * classifier at consumer-facing `{ $d: 'dim' }` refs (id → entry), then emits
 * code-keyed views with the classifier `code` injected.
 *
 * Per-locale i18n: swap one DisplayMap, leave classifier untouched.
 */
export type DisplayMap = Record<string /*id*/, Record<string /*attr*/, DimVal | undefined>>

/**
 * DataBundle — universal contract every dataset module exports. Datasets
 * differ in shape only by what they populate; `classifiers` and `display`
 * are optional. Structural and presentational concerns stay split.
 */
export interface DataBundle<F extends Observation = Observation> {
  facts:        readonly F[]
  classifiers?: Record<string, Classifier>
  display?:     Record<string, DisplayMap>
}

/**
 * ClassifierRef — declarative reference resolved by the engine against the
 * store's classifier registry. Pattern: Vega-Lite signals, Grafana variables,
 * MongoDB operators ($ prefix). JSON-serializable — Constructor Phase 2 stores
 * this verbatim; no imperative derivation in config files.
 *
 *   view  — which view to return at resolve time:
 *     byCode  — code-keyed dict    (used by `lookup.from`)
 *     items   — array, rollups first (used by filter derive `source`)
 *     leaves  — leaf entries only   (used by selectors over atomic codes)
 *     rollups — aggregate entries   (used by total/group pickers)
 *   Omitted → consumer picks default for its context.
 */
export type ClassifierView = 'byCode' | 'items' | 'leaves' | 'rollups'

/**
 * ClassifierRef — STRUCTURAL ref. Resolves to classifier entries
 * (`{ code, parent?, …structural attrs }`). NO display merge — engine reads
 * pure codelist data. Use this when consumers need hierarchy edges or
 * structural attrs only.
 */
export interface ClassifierRef {
  $cl:   string
  view?: ClassifierView
}

/**
 * DisplayRef — UI ref. Resolves to display entries with the classifier `code`
 * injected as a field (`{ code, …display attrs }`). Used by UI consumers
 * (lookup.from for label/color join, InlineSource.items for selectors,
 * filter-derive source for find/breadcrumbs).
 *
 * Views interplay: classifier provides the structural `view` filter (leaves /
 * rollups / etc.), but each emitted entry carries display attrs only — no
 * `parent` edge or other structural fields.
 */
export interface DisplayRef {
  $d:    string
  view?: ClassifierView
}

/** Union of dim refs. Resolved by engine via `resolveDimRef`. */
export type DimRef = ClassifierRef | DisplayRef