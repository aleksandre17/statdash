// engine/core/src/data/fieldSchema.ts
//
// Typed column schema for DataRow result sets.
// Grafana analogue: DataFrame.schema.fields[].
// Used by engine/react targets (api.ts, html.tsx) to produce self-describing
// snapshots. Placed in engine/core so all targets share one derivation.

import type { DataSpec }  from '../config/data-spec'
import type { EngineRow } from './encoding'

export type FieldType = 'number' | 'string' | 'time' | 'boolean' | 'unknown'
export type FieldRole = 'dimension' | 'measure' | 'meta'

// ── FieldMeta — Constructor palette descriptor [N43] ─────────────────────────
//
//  Returned by querySync({type:'schema', indicator?}) — describes what fields
//  a store exposes for a given indicator (or all indicators when omitted).
//  Consumed by the Constructor field palette to drive encoding suggestions.
//  Pure data type: zero React dependency, lives in engine/core.

export interface FieldMeta {
  /** DataRow key (e.g. 'value', 'label', 'time', 'geo') */
  name:                string
  /** Semantic role in a tidy-data frame */
  role:                'dimension' | 'measure' | 'meta'
  /** Runtime value type */
  type:                'number' | 'string' | 'time' | 'boolean' | 'unknown'
  /** Unit string (e.g. '%', 'USD', 'persons') — optional */
  unit?:               string
  /** Human-readable column label for the Constructor palette */
  displayLabel?:       string
  /** Encoding channels this field is appropriate for (Constructor hint) */
  suggestedEncodings?: Array<'x' | 'y' | 'color' | 'size' | 'facet'>
}

export interface FieldSchema {
  /** DataRow key (e.g. 'value', 'label', 'pct', 'series') */
  name:           string
  type:           FieldType
  role:           FieldRole
  /** Human-readable column label from ColumnDef or encoding config */
  displayLabel?:  string
  /** Unit string from FieldConfig (e.g. '%', 'USD', 'persons') */
  unit?:          string
  /** Format key from formatters registry (e.g. 'number:2dp') */
  format?:        string
}

// ── suggestEncodings — Grammar of Graphics channel hints [P3-2] ───────────────
//
//  Pure, deterministic mapping from (role, type) → appropriate encoding channels.
//  Follows Vega-Lite / Grammar of Graphics conventions (Law 4: standards adopted
//  whole). Used by the Constructor encoding editor to surface relevant channels
//  per field. No store/DataStore dependency.

export function suggestEncodings(
  role: FieldRole,
  type: FieldType,
): Array<'x' | 'y' | 'color' | 'size' | 'facet'> {
  if (role === 'meta')    return []
  if (role === 'measure') return ['y', 'size']

  // role === 'dimension'
  switch (type) {
    case 'time':    return ['x']                    // time series always on x
    case 'boolean': return ['color', 'facet']       // binary split
    case 'string':
    case 'number':
    case 'unknown':
    default:        return ['x', 'color', 'facet']  // categorical
  }
}

// ── FieldSchema → FieldMeta conversion [P3-2] ─────────────────────────────────
//
//  FieldSchema (runtime) and FieldMeta (Constructor palette) stay separate types.
//  toFieldMeta enriches a runtime schema with derived encoding suggestions.

export function toFieldMeta(schema: FieldSchema): FieldMeta {
  return {
    name:               schema.name,
    role:               schema.role,
    type:               schema.type,
    unit:               schema.unit,
    displayLabel:       schema.displayLabel,
    suggestedEncodings: suggestEncodings(schema.role, schema.type),
  }
}

export function schemasToFieldMeta(schemas: FieldSchema[]): FieldMeta[] {
  return schemas.map(toFieldMeta)
}

// ── Derivation helpers ────────────────────────────────────────────────────────

function sniffType(val: unknown): FieldType {
  if (typeof val === 'number')  return 'number'
  if (typeof val === 'boolean') return 'boolean'
  if (typeof val === 'string') {
    // ISO date strings: YYYY, YYYY-MM, YYYY-MM-DD
    if (/^\d{4}(-\d{2}(-\d{2})?)?$/.test(val)) return 'time'
    return 'string'
  }
  return 'unknown'
}

const MEASURE_NAMES = new Set([
  'value', 'pct', 'base', 'prev', 'growth', 'ratio', 'share',
  'count', 'total', 'amount',
])
const META_NAMES = new Set(['id', 'code', 'key'])

function deriveFromFirstRow(row: EngineRow): FieldSchema[] {
  return Object.entries(row).map(([name, val]) => ({
    name,
    type: sniffType(val),
    role: MEASURE_NAMES.has(name) ? 'measure'
        : META_NAMES.has(name)    ? 'meta'
        : 'dimension',
  } satisfies FieldSchema))
}

// ── deriveFieldSchema — public API ────────────────────────────────────────────

/**
 * Derive a typed column schema from a resolved DataSpec + its result rows.
 *
 * Returns [] when rows is empty (no sample to sniff from).
 *
 * Per-spec heuristics produce known-good schemas for built-in spec types;
 * unknown/custom types fall back to first-row type-sniffing.
 */
export function deriveFieldSchema(spec: DataSpec, rows: EngineRow[]): FieldSchema[] {
  if (rows.length === 0) return []

  const type = (spec as { type?: string }).type ?? ''

  switch (type) {
    case 'query':
    case 'transform': {
      // Derive from the first row's keys — type-sniff values
      return deriveFromFirstRow(rows[0])
    }
    case 'timeseries': {
      return ([
        { name: 'time',   type: 'time'   as FieldType, role: 'dimension' as FieldRole },
        { name: 'value',  type: 'number' as FieldType, role: 'measure'   as FieldRole },
        { name: 'series', type: 'string' as FieldType, role: 'dimension' as FieldRole },
      ] satisfies FieldSchema[]).filter(f => f.name in rows[0])
    }
    case 'growth': {
      return ([
        { name: 'time',   type: 'time'   as FieldType, role: 'dimension' as FieldRole },
        { name: 'value',  type: 'number' as FieldType, role: 'measure'   as FieldRole },
        { name: 'growth', type: 'number' as FieldType, role: 'measure'   as FieldRole },
      ] satisfies FieldSchema[]).filter(f => f.name in rows[0])
    }
    case 'ratio-list':
    case 'row-list':
    default:
      return deriveFromFirstRow(rows[0])
  }
}
