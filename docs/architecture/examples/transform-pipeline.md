# transform-pipeline.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — TransformStep pipeline
 *
 * Demonstrates all 15 transform operations and their composition.
 * applyPipeline(rows, steps, ctx?) — pure, no store, no React.
 * JSON-serializable — Constructor/admin panel can generate these without code.
 *
 * Standards:
 *   Tidy Data (Hadley Wickham) — one observation = one row, long format always.
 *   Vega-Lite transform array  — declarative step pipeline.
 *   Cube.dev                   — rollup/totals pattern.
 *   Pandas                     — melt/aggregate analogues.
 */

import type { TransformStep, EngineRow, PipelineContext } from '@geostat/engine'
import { applyPipeline, applyStep }                      from '@geostat/engine'

// ── 1. melt — wide → long (pandas pivot_longer / Vega-Lite fold) ──────────
//
//  Input row (wide):   { time: 2024, production: 12000, income: 11500 }
//  Output rows (long): { time: 2024, series: 'production', value: 12000 }
//                      { time: 2024, series: 'income',     value: 11500 }

const meltStep: TransformStep = {
  op:          'melt',
  idFields:    ['time', 'geo'],        // dimensions to keep
  valueFields: ['production', 'income', 'capital'],   // columns to unpivot
  seriesKey:   'series',               // default: 'series'
  valueKey:    'value',                // default: 'value'
}


// ── 2. rename — field name normalization ──────────────────────────────────
//  Use when backend returns non-standard field names.
//  e.g. SDMX DSD uses YEAR, REGION → normalize to time, geo.

const renameStep: TransformStep = {
  op:     'rename',
  fields: { YEAR: 'time', REGION: 'geo', INDICATOR: 'measure' },
}


// ── 3. cast — coerce field types ──────────────────────────────────────────
//  JSON/CSV often delivers all values as strings. Cast before arithmetic.

const castStep: TransformStep = {
  op:     'cast',
  fields: { time: 'number', value: 'number' },
}


// ── 4. filter — row filter with CtxRef resolution ────────────────────────
//  Conditions: literal | array (IN) | CtxRef | NeRef | NeCtxRef.
//  CtxRef { $ctx: '...' } resolves from SectionContext.dims at runtime.
//  Empty ctx value = wildcard (dimension skipped).

const filterLiteralStep: TransformStep = {
  op:    'filter',
  where: {
    time:          { $ctx: 'time' },   // runtime: ctx.dims.time
    geo:           { $ctx: 'geo'  },   // runtime: ctx.dims.geo
    isCarryForward: 0,                 // literal: exclude carry-forward rows
    measure:       ['B1G', 'P3'],      // IN: only these indicators
  },
}

const filterNeStep: TransformStep = {
  op:    'filter',
  where: {
    sector: { $ne: '_T' },   // exclude SDMX total code
  },
}


// ── 5. sort — stable multi-key sort ──────────────────────────────────────
//
//  Single-field form (shorthand):
//    { op: 'sort', by: 'time', dir: 'asc' }
//
//  Multi-key form — order of keys = priority:
//    { op: 'sort', by: [{ field, dir, using?, last? }] }
//
//  using: explicit order list — unlisted values sorted last.
//  last:  sentinel value(s) always sorted after all real values (e.g. -1 = "no data").

const sortSingleStep: TransformStep = {
  op:  'sort',
  by:  'time',
  dir: 'asc',
}

const sortMultiStep: TransformStep = {
  op: 'sort',
  by: [
    { field: 'accountOrder', dir: 'asc' },
    { field: 'side',         using: ['R', 'U'] },   // R first, then U, others last
    { field: 'seqPos',       dir: 'asc', last: -1 }, // -1 sorted after everything
    { field: 'isClosing',    dir: 'asc' },
  ],
}


// ── 6. derive — compute new field per row ────────────────────────────────
//
//  expr: DeriveExpr tree OR string formula.
//  String form: 'value / total * 100'  — parsed by ExprParser (recursive descent).
//  Supported: +, -, *, /, (), ==, !=, <, >, &&, ||, !, ? : , field names, numbers, 'string'.

const deriveSharePct: TransformStep = {
  op:  'derive',
  as:  'share',
  expr: 'value / total * 100',
}

const deriveCarryForwardFlag: TransformStep = {
  op:  'derive',
  as:  'isCarryForward',
  expr: { op: 'if',
    cond: { op: 'and',
      a: { op: 'eq', a: { op: 'field', field: 'side' },   b: { op: 'literal', value: 'R' } },
      b: { op: 'gt', a: { op: 'field', field: 'seqPos' }, b: { op: 'literal', value: 0  } },
    },
    then: { op: 'literal', value: 1 },
    else: { op: 'literal', value: 0 },
  },
}


// ── 7. aggregate — GROUP BY + reduce ─────────────────────────────────────
//
//  Short form (one measure):
//    { op: 'aggregate', by: ['time', 'sector'], measure: 'value', agg: 'sum' }
//  Multi-measure form:
//    { op: 'aggregate', groupBy: [...], aggregations: [...] }

const aggregateStep: TransformStep = {
  op:      'aggregate',
  by:      ['time', 'sector'],
  measure: 'value',
  agg:     'sum',
}

const aggregateMultiStep: TransformStep = {
  op:      'aggregate',
  groupBy: ['time'],
  aggregations: [
    { field: 'value', op: 'sum', as: 'total_value' },
    { field: 'pop',   op: 'avg', as: 'avg_pop' },
  ],
}


// ── 8. rollup — APPEND aggregate rows, preserve originals ────────────────
//
//  Cube.dev / OLAP totals-row pattern.
//  Unlike aggregate, rollup KEEPS original rows and APPENDS new aggregate rows.
//
//  Example: add a 'total' row per (time, sector) summing all geo values.

const rollupStep: TransformStep = {
  op:   'rollup',
  dim:  'geo',
  as:   'total',           // value injected for the rollup row's 'geo' field
  of:   '*',               // include all distinct dim values ('*' = all)
  agg:  'sum',
  field: 'value',          // default: 'value'
}

const rollupSelectStep: TransformStep = {
  op:   'rollup',
  dim:  'sector',
  as:   '_T',              // SDMX total code for the rollup row
  of:   ['AGRI', 'IND', 'SERV'],   // only sum these sectors
  agg:  'sum',
}


// ── 9. lookup — LEFT JOIN against code-keyed dict ────────────────────────
//
//  For each row, look up row[key] in 'from' dict; copy 'fields' onto the row.
//  from: inline dict | { $cl: 'dim' } (structural) | { $d: 'dim' } (display)
//  Vega-Lite 'lookup' transform analogue (SQL LEFT JOIN).

const lookupInlineStep: TransformStep = {
  op:     'lookup',
  key:    'geo',
  from:   { GE: { label: 'Georgia', color: '#005A9C' }, GE_TB: { label: 'Tbilisi' } },
  fields: ['label', 'color'],
}

const lookupDisplayStep: TransformStep = {
  op:     'lookup',
  key:    'geo',
  from:   { $d: 'geo' },        // resolves DisplayMap for 'geo' dim via store
  fields: ['label', 'color'],
  rename: { label: 'geoLabel' },
}

const lookupClassifierStep: TransformStep = {
  op:     'lookup',
  key:    'sector',
  from:   { $cl: 'sector' },    // resolves Classifier entries (code, parent, attrs)
  fields: ['code', 'parent'],
}


// ── 10. join — LEFT JOIN against array source ─────────────────────────────
//
//  'join' when the right side is an array (not a code-keyed dict).
//  on: left-side join column. onRight: right-side join column (default: 'code' for dim refs).

const joinDisplayStep: TransformStep = {
  op:      'join',
  with:    { $d: 'region' },      // DisplayRef → array of { code, label, color, … }
  on:      'geo',                  // row.geo === displayEntry.code
  fields:  ['label', 'color'],
  rename:  { label: 'regionLabel' },
}

const joinInlineStep: TransformStep = {
  op:      'join',
  with:    [
    { id: 'P1',  name: 'გამოშვება',      order: 1 },
    { id: 'B1G', name: 'მთლიანი ღირ.',  order: 2 },
  ],
  on:      'measure',
  onRight: 'id',
  fields:  ['name', 'order'],
}


// ── 11. group — N-level hierarchy materializer ────────────────────────────
//
//  Injects synthetic header rows before each new group.
//  Adds _level, _parentId, _isGroup, _id fields to the row stream.
//  Renderer-agnostic: engine materializes hierarchy metadata, renderer decides style.
//
//  ⚠ Rows MUST be pre-sorted (outermost dimension first).

const groupStep: TransformStep = {
  op: 'group',
  by: [
    {
      field:  'account',
      inject: {
        from:   { name: 'accountName', badge: 'accountBadge' },   // copy from first member
        set:    { isSeparator: 1 },                                 // literal override
        idFrom: 'accountCode',                                      // use this field for _id
      },
    },
  ],
  levelField:  '_level',
  parentField: '_parentId',
}

const groupTwoLevelStep: TransformStep = {
  op: 'group',
  by: [
    { field: 'country', inject: { from: { name: 'countryName' } } },
    { field: 'region',  inject: { from: { name: 'regionName'  } } },
  ],
}


// ── 12–15. Utility steps ─────────────────────────────────────────────────

const concatStep: TransformStep = {
  op:     'concat',
  fields: ['account', 'measure', 'side'],
  as:     '_id',
  sep:    '-',
}

const templateStep: TransformStep = {
  op:  'template',
  as:  'label',
  tpl: '{label} ({measure})',   // {field} replaced by row value
}

const addFieldStep: TransformStep = {
  op:    'addField',
  name:  'source',
  value: 'national_accounts',
}

const selectStep: TransformStep = {
  op:     'select',
  fields: ['time', 'geo', 'measure', 'value', 'label'],
}


// ═══════════════════════════════════════════════════════════════════════════
// COMPOSITION — real pipeline examples
// ═══════════════════════════════════════════════════════════════════════════

// Accounts sequence — normalize wide SQL result → tidy long format:
const accountsPipeline: TransformStep[] = [
  { op: 'rename', fields: { wlebi: 'time', angarishebi: 'account', mnisvnelobebi: 'value' } },
  { op: 'cast',   fields: { time: 'number', value: 'number' } },
  { op: 'filter', where: { isCarryForward: 0 } },
  { op: 'sort',   by: [{ field: 'accountOrder', dir: 'asc' }, { field: 'side', using: ['R', 'U'] }] },
]

// Regional breakdown — join display labels + rollup total:
const regionalPipeline: TransformStep[] = [
  { op: 'filter',  where: { time: { $ctx: 'time' }, measure: 'B1G' } },
  { op: 'join',    with: { $d: 'geo' }, on: 'geo', fields: ['label', 'color'] },
  { op: 'sort',    by: 'value', dir: 'desc' },
  { op: 'rollup',  dim: 'geo', as: 'total', of: '*', agg: 'sum' },
]

// GVA structure — pivot multi-sector wide format to long:
const gvaPipeline: TransformStep[] = [
  { op: 'melt', idFields: ['time'], valueFields: ['AGRI', 'IND', 'SERV', 'CONS'] },
  { op: 'lookup', key: 'series', from: { $d: 'sector' }, fields: ['label', 'color'] },
  { op: 'derive', as: 'share', expr: 'value / total * 100' },
]

// applyPipeline usage:
const ctx: PipelineContext = {
  classifiers: { geo: { GE: { code: 'GE' }, GE_TB: { code: 'GE_TB', parent: 'GE' } } },
  display:     { geo: { GE: { label: 'Georgia' }, GE_TB: { label: 'Tbilisi' } } },
  section:     { timeMode: 'year', dims: { time: 2024, geo: 'GE' } },
}

const rawRows: EngineRow[] = [/* store.query() result */]
const transformed: EngineRow[] = applyPipeline(rawRows, accountsPipeline, ctx)
// → tidy EngineRow[] ready for applyEncoding()
```
