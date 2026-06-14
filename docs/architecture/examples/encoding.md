# encoding.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — EncodingSpec + applyEncoding (Grammar of Graphics)
 *
 * Demonstrates:
 * - EncodingSpec: declarative field→channel mapping (Vega-Lite encoding analogue)
 * - applyEncoding(): pure function, EngineRow[] + spec → DataRow[]
 * - pct variants: of (OLAP lookup), sumOf (% of total), field (pre-computed)
 * - negate: debit/outflow rows
 * - seriesFormat + seriesOrder: pivot column control
 * - Structural channels: level, parentId, isSeparator, isTotal (hierarchy / tree)
 *
 * Standards:
 *   Grammar of Graphics (Wilkinson) — data ≠ rendering, encoding separates them
 *   Vega-Lite encoding block — label/value/color/series/tooltip channels
 *   Cube.dev resultSet — chartPivot/tablePivot in the renderer, not in data
 *   Grafana field overrides — per-series formatting after the data layer
 */

import type { EncodingSpec, EngineRow, DataRow } from '@geostat/engine'
import { applyEncoding }                         from '@geostat/engine'

// ── Principle: EngineRow → DataRow pipeline ───────────────────────────────
//
//   store.query(q)         → EngineRow[]   (raw, renderer-agnostic)
//   applyPipeline(rows, p) → EngineRow[]   (after transform steps)
//   applyEncoding(rows, e) → DataRow[]     (structured: label, value, series, …)
//
//   Both Chart and Table receive the same DataRow[].
//   Visual logic lives in the renderer — not in the data layer.
//
//   DataSpec.encoding?: EncodingSpec is applied inside interpretSpec automatically.
//   Can also be called manually: applyEncoding(rows, spec, lookup).


// ── 1. Basic chart encoding ─────────────────────────────────────────────────
//  Simple case: each row has 'time', 'value'. Map to label+value channels.

const basicEnc: EncodingSpec = {
  label: 'time',    // row.time → DataRow.label   (x-axis labels)
  value: 'value',   // row.value → DataRow.value  (bar height / y-axis)
}

const basicRows: EngineRow[] = [
  { time: 2021, value: 15230 },
  { time: 2022, value: 16840 },
  { time: 2023, value: 18120 },
]

const basicDataRows: DataRow[] = applyEncoding(basicRows, basicEnc)
// → [
//     { id: '2021', label: '2021', value: 15230 },
//     { id: '2022', label: '2022', value: 16840 },
//     { id: '2023', label: '2023', value: 18120 },
//   ]
// id auto-generated as String(label) when no series.


// ── 2. Multi-series (grouped/stacked chart) ───────────────────────────────
//  series field → Chart renders multi-series, Table renders pivot columns.

const multiSeriesEnc: EncodingSpec = {
  label:  'time',
  value:  'value',
  series: 'sector',   // each distinct sector value = one chart series / table column
  color:  'color',    // explicit per-row color from observation field
}

const multiSeriesRows: EngineRow[] = [
  { time: 2023, sector: 'AGRI', value: 3200, color: '#4CAF50' },
  { time: 2023, sector: 'IND',  value: 7800, color: '#2196F3' },
  { time: 2023, sector: 'SERV', value: 9100, color: '#FF9800' },
]

const multiSeriesDataRows: DataRow[] = applyEncoding(multiSeriesRows, multiSeriesEnc)
// → [
//     { id: '2023::AGRI', label: '2023', series: 'AGRI', value: 3200, color: '#4CAF50' },
//     { id: '2023::IND',  label: '2023', series: 'IND',  value: 7800, color: '#2196F3' },
//     { id: '2023::SERV', label: '2023', series: 'SERV', value: 9100, color: '#FF9800' },
//   ]
// id = '{label}::{series}' when series present.


// ── 3. pct variants ─────────────────────────────────────────────────────────

// 3a. pct.of — OLAP denominator lookup (e.g. % of GDP)
//  lookup callback: (code) => store.val(code, ctx) — OLAP point read.
const pctOfEnc: EncodingSpec = {
  label: 'sectorLabel',
  value: 'value',
  pct:   { of: 'B1G' },   // pct = |value| / store.val('B1G', ctx) × 100
}
// DataSpec also carries: filter: { isCarryForward: 0 }

// 3b. pct.sumOf — % of query total (Tableau pattern)
//  denominator = sum of all obs[sumOf] fields in the result set.
const pctSumOfEnc: EncodingSpec = {
  label: 'sectorLabel',
  value: 'value',
  pct:   { sumOf: 'value' },  // pct = |value| / Σ(value) × 100 within query result
}

// 3c. pct.field — pre-computed percentage in observation
const pctFieldEnc: EncodingSpec = {
  label: 'sectorLabel',
  value: 'value',
  pct:   { field: 'share' },  // read directly from row.share
}


// ── 4. negate — debit/outflow rows ───────────────────────────────────────
//  SNA T-accounts: some indicators are outflows (negative in the identity).
//  negate: ['P2', 'D1', 'D2'] → those rows: value = -rawValue.

const tAccountEnc: EncodingSpec = {
  label:  'accountLabel',
  value:  'value',
  negate: ['P2', 'D1', 'D21_D31'],   // measure codes whose values are negated
}


// ── 5. seriesFormat + seriesOrder ────────────────────────────────────────
//  pivot mode: format each column differently + control column order.
//  seriesFormat: { seriesName: 'formatterName' } — references FORMATTERS registry.
//  seriesOrder:  left-to-right column order in table; legend order in chart.

const gvaGrowthEnc: EncodingSpec = {
  label:       'time',
  value:       'value',
  series:      'indicator',
  seriesFormat: {
    gva:    'mln_gel',   // formatter: round to integer + thousands separator
    growth: 'sign_pct',  // formatter: +5.2% / -1.3%
    share:  'pct',       // formatter: 72.4%
  },
  seriesOrder: ['gva', 'growth', 'share'],   // column left-to-right order
}


// ── 6. tooltip ────────────────────────────────────────────────────────────
//  Extra obs fields shown in chart tooltip + table row hover.
//  Vega-Lite tooltip channel analogue.

const tooltipEnc: EncodingSpec = {
  label:   'time',
  value:   'value',
  tooltip: ['unit', 'status', 'source'],   // renderer reads these from the raw row
}


// ── 7. Structural / hierarchy channels ────────────────────────────────────
//  Used after 'group' TransformStep materializes hierarchy metadata into the row stream.
//  The group step adds _level, _parentId, _isGroup, _id fields.
//  Encoding maps them to DataRow structural channels.

const hierarchyEnc: EncodingSpec = {
  label:       'accountLabel',
  value:       'value',
  id:          '_id',           // use pipe-generated _id (stable composite key)
  isSeparator: '_isGroup',      // truthy → DataRow.isSeparator (group header rows)
  level:       '_level',        // integer depth → DataRow.level (indent)
  parentId:    '_parentId',     // → DataRow.parentId (tree linking)
  isTotal:     'isTotal',       // truthy → DataRow.isTotal (balancing items)
}

// Renderer uses these channels to:
// - Indent cells by DataRow.level
// - Render group headers as separator rows (DataRow.isSeparator)
// - Bold total/balancing rows (DataRow.isTotal)
// - Build expandable tree (DataRow.parentId → find children)


// ── 8. Full pipeline example ──────────────────────────────────────────────
//  DataSpec carries both pipe and encoding. interpretSpec applies both.

const accountsDataSpec = {
  type:    'query',
  storeId: 'accounts',
  filter:  { isCarryForward: 0 },
  pipe: [
    { op: 'sort',   by: [{ field: 'accountOrder', dir: 'asc' as const }] },
    { op: 'join',   with: { $d: 'account' }, on: 'measure', fields: ['label', 'order'] },
    { op: 'group',  by: [{ field: 'account', inject: { from: { name: 'label' }, set: { isSeparator: 1 } } }] },
  ],
  encoding: {
    label:       'label',
    value:       'value',
    id:          '_id',
    isSeparator: '_isGroup',
    level:       '_level',
    parentId:    '_parentId',
    isTotal:     'isBalancing',
    negate:      ['P2', 'D1'],
  } satisfies EncodingSpec,
}
// interpretSpec(accountsDataSpec, ctx, stores)
//   1. store.query({ measure: '*', filter: { isCarryForward: 0 } }) → EngineRow[]
//   2. applyPipeline(rows, pipe, ctx)                               → EngineRow[] (sorted + joined + grouped)
//   3. applyEncoding(rows, encoding)                                → DataRow[]   (structured)
// → ctx.rows: DataRow[]  — both ChartShell and TableShell receive this


// ── 9. Manual applyEncoding call (outside interpretSpec) ─────────────────
//  When the DataSpec already returns EngineRow[] and you want to encode manually.

const rawEngineRows: EngineRow[] = [
  { account: 'P1', accountLabel: 'გამოშვება', value: 178000, isBalancing: 0 },
  { account: 'B1G', accountLabel: 'მთლიანი',  value: 156000, isBalancing: 1 },
]

// OLAP lookup for pct.of: store.val('B1G', ctx) = 156000
const lookup = (code: string) => code === 'B1G' ? 156000 : 0

const resultRows: DataRow[] = applyEncoding(rawEngineRows, hierarchyEnc, lookup)
// DataRow.pct = |value| / 156000 × 100 (if pct.of was set)
```
