// ── desugar — convenience DataSpec → primitive DataSpec [ADR R3] ──────
//
//  The DESUGARING layer of the data-reference model (adr_data_reference_
//  render_vision, R3 / fault line F-A). The DataSpec union carries a handful
//  of CONVENIENCE discriminants that are authoring affordances over the few
//  orthogonal primitives (`query` · `transform`). This module is
//  the single, pure rewrite that lowers a convenience spec to its EQUIVALENT
//  primitive form so the engine resolves ONE set of primitives.
//
//  Contract (FF-DESUGAR-EQUIV): for every spec it rewrites, the desugared
//  resolution is ROW-IDENTICAL (same rows, order, values, nulls, status) to
//  the prior bespoke resolver — proven by `desugar.fitness.test.ts`.
//
//  Strangler-Fig, partial by design: a convenience spec is desugared ONLY
//  when it is provably row-identical with the CURRENT transform op set. Specs
//  whose equivalence depends on a store-port primitive the pipe cannot express
//  are passed through UNCHANGED and keep their direct resolver (see the R3
//  gap report). desugar is total — every spec maps to a DataSpec (itself when
//  no rule applies).
//
//  Pure + JSON-serializable: no functions, no ctx/store access. The rewrite is
//  a value→value transform the Constructor never sees (the friendly per-type
//  editors are preserved; lowering happens at resolve time only).
//

import type { DataSpec } from '../config/data-spec'
import type { DimVal }    from '../sdmx'

// ── pivot → transform + melt ──────────────────────────────────────────
//
//  `pivot` is the textbook sugar: its own resolver is "melt + shape", touches
//  no store, and is fully deterministic. The bespoke PivotResolver did:
//
//    melt({ idFields:[keyField], valueFields, seriesKey:'series', valueKey:'value' })
//    → per melted row: {
//        id:    `${label}::${series}`,   label = String(row[keyField] ?? ''),
//        label, series: String(row.series ?? ''),
//        value: Number(row.value ?? 0),
//        ...(colors[series] ? { color } : {}),
//      }
//
//  The equivalent primitive pipe (every step already exists, all pure):
//    1. melt                       — identical fold (same keys/defaults)
//    2. cast value → number        — Number(value ?? 0); melt already defaulted ?? 0
//    3. rename keyField → label    — carry the id column into `label`
//    4. cast label  → string       — String(...) coercion the resolver applied
//    5. cast series → string       — String(row.series ?? '') (melt sets series = field name,
//                                     already a string; cast is a row-identical no-op-shaped step)
//    6. concat [label, series] → id (sep '::')  — `${label}::${series}` (String-joined)
//    7. lookup color BY series      — adds `color` ONLY when colors[series] exists
//                                     (inline `from` map; absent ⇒ field omitted, matching
//                                      the resolver's conditional spread)
//
//  Field set after the pipe = { label, series, value, id, (color?) } — the same
//  set the resolver emitted (key insertion order differs, which no consumer reads:
//  encoding/table address fields by name). Rows, order, values, the color
//  presence/absence, and the id string are byte-identical.
//
function desugarPivot(spec: Extract<DataSpec, { type: 'pivot' }>): DataSpec {
  const { rows, keyField, valueFields, colors } = spec

  // colors: Record<series, color>  →  lookup `from`: Record<series, { color }>
  const colorFrom: Record<string, Record<string, DimVal | undefined>> = {}
  if (colors) for (const [series, color] of Object.entries(colors)) colorFrom[series] = { color }

  return {
    type:   'transform',
    source: rows,
    steps:  [
      { op: 'melt',   idFields: [keyField], valueFields, seriesKey: 'series', valueKey: 'value' },
      { op: 'cast',   fields: { value: 'number' } },
      { op: 'rename', fields: { [keyField]: 'label' } },
      { op: 'cast',   fields: { label: 'string', series: 'string' } },
      { op: 'concat', fields: ['label', 'series'], as: 'id', sep: '::' },
      ...(colors && Object.keys(colors).length > 0
        ? [{ op: 'lookup' as const, key: 'series', from: colorFrom, fields: ['color'] }]
        : []),
    ],
    // pivot rows feed straight into the renderer's encoder by field name, exactly
    // as the resolver's EngineRow[] did; the transform resolver returns the rows
    // untouched (no encoding stage in the resolver — that is the renderer boundary).
    encoding: { label: 'label', value: 'value', series: 'series', color: 'color' },
  }
}

// ── desugar — the single entry point ──────────────────────────────────
//
//  Lowers a convenience spec to its primitive equivalent. Total: any spec with
//  no rule (incl. all primitives) is returned UNCHANGED (same reference) so the
//  primitive path is allocation-free and provably untouched.
//
//  Called FIRST by interpretSpec + extractRequirements (one resolution path).
//
export function desugar(spec: DataSpec): DataSpec {
  switch (spec.type) {
    case 'pivot': return desugarPivot(spec)
    default:      return spec
  }
}
