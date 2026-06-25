// ─────────────────────────────────────────────────────────────────────────────
// DataSource — universal data-fetching abstraction
//
//  Grafana/Retool/AppSmith pattern (B+C hybrid):
//    Generic core  — StaticSource<T> · QuerySource · InlineSource · RemoteSource
//    Field mapping — SelectFieldMap · ChipFieldMap · YearsFieldMap
//    Typed aliases — OptionsSource · ChipSource · YearsSource
//
//  Pure TypeScript — zero React, zero side effects.
//  Usable anywhere: filters · DataSpec · table columns · chart config · Constructor.
//
//  Extending: add a new source type to RemoteSource once →
//    OptionsSource, ChipSource, YearsSource all gain it automatically.
//
//  HREF in the SELECTOR layer is DELETED (was `ApiSource = { type:'api'; url }`,
//  a ghost whose resolver returned null and pointed at a deleted file). HREF
//  re-enters as a STORE kind (a DataStore behind buildStoreManifest), NOT a
//  selector source — see door D-HREF in adr_data_source_reference_spectrum.
// ─────────────────────────────────────────────────────────────────────────────

import type { DimRef, ObsQuery }       from '../sdmx'
import type { TransformStep }           from './transform'

// ── Value types ───────────────────────────────────────────────────────────────

export interface SelectOption { value: string; label: string }
export interface ChipOption   { value: string; label: string; color?: string }

// ── Generic core ──────────────────────────────────────────────────────────────

export type StaticSource<T>  = { type: 'static'; items: T[] }
/**
 * Query-driven source with optional pipeline. `pipe` runs AFTER
 * store.observe() — enables aggregate/lookup/rollup/filter on selector
 * data (Grafana / Malloy / Cube.dev pattern).
 */
export type QuerySource      = { type: 'query';  query: ObsQuery; pipe?: TransformStep[] }
/**
 * Inline-items source — arbitrary in-memory rows with optional pipeline.
 * Items are either a literal or a dim ref (`{ $cl: 'dim' }` for structural
 * codelist or `{ $d: 'dim' }` for display-keyed array) the engine resolves
 * at apply time. 100% JSON-serializable.
 */
export type InlineSource     = { type: 'inline'; items: DimRef | readonly Record<string, unknown>[]; pipe?: TransformStep[] }
/**
 * Remote (store-backed) selector source. Today only QuerySource — HREF (url) was
 * removed (door D-HREF). A future remote selector source is added here once and
 * OptionsSource/ChipSource/YearsSource gain it automatically.
 */
export type RemoteSource     = QuerySource

// ── Field mapping specs — per output type (no nesting, config stays flat) ────

export type SelectFieldMap = { valueField: string; labelField?: string }
export type ChipFieldMap   = { valueField: string; labelField?: string; colorField?: string }
export type YearsFieldMap  = { field: string }

// ── Typed aliases — base source & mapping intersection ──────────────────────
//
//  OptionsSource = StaticSource<SelectOption>
//               | (QuerySource  & SelectFieldMap)   → { type:'query',  …, valueField, labelField? }
//               | (InlineSource & SelectFieldMap)   → { type:'inline', items, valueField, labelField? }
//
//  Same pattern for ChipSource and YearsSource.

export type OptionsSource = StaticSource<SelectOption> | ((RemoteSource | InlineSource) & SelectFieldMap)
export type ChipSource    = StaticSource<ChipOption>   | ((RemoteSource | InlineSource) & ChipFieldMap)
export type YearsSource   = StaticSource<number>       | ((RemoteSource | InlineSource) & YearsFieldMap)