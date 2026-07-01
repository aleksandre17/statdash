---
name: engine_core_dataspec_capabilities
description: Complete catalog of DataSpec discriminant types and their fields for Constructor Panel UI
metadata:
  type: reference
  source: engine/core/src/config/section.ts, engine/core/src/data/spec.ts
---

# @geostat/engine — DataSpec Type Catalog

Complete declarative specification of data pipelines. 100% JSON-serializable. No functions. Constructor-ready.

## DataSpec — Discriminated Union

### 1. `query` — Universal SDMX + Pipeline

```typescript
{
  type: 'query'
  query: ObsQuery              // SDMX observation query (dimension filters, measure codes)
  pipe?: TransformStep[]       // optional declarative transform pipeline
  encoding: EncodingSpec       // maps observation fields to visual channels
  fromDim?: string             // dimension name for time-to-dimension mapping
  toDim?: string               // target dimension name
}
```

**Use when:** Querying any dimensions, any measures, complex transformations needed.

**Pattern:** ObsQuery → store.observe() → clamp year range → applyPipeline() → applyEncoding()

---

### 2. `row-list` — Explicit Rows

```typescript
{
  type: 'row-list'
  rows: RowSpec[]
}
```

**RowSpec:**
```typescript
{
  code: string          // measure/indicator code
  label?: string        // display label
  color?: string        // explicit row color
  negate?: boolean      // invert sign (outflow/debit)
  isTotal?: boolean     // aggregate row marker
  pctOf?: string        // denominator code for % computation
}
```

**Use when:** Year mode with small fixed row set. Convenient shorthand for dashboards.

**Pattern:** Store lookup by code + context dims → one row per RowSpec → encoding

---

### 3. `timeseries` — Single Measure × Time Range

```typescript
{
  type: 'timeseries'
  code: string          // measure code
  years: YearsSpec      // number[] | 'all'
  fromDim?: string      // dimension name mapping (optional)
  toDim?: string        // target dimension (optional)
}
```

**YearsSpec:**
- `'all'` — query all distinct time values from store at runtime
- `number[]` — explicit year list (JSON-serializable, Constructor-generated)

**Use when:** Time-axis data visualization (line chart, area chart).

**Pattern:** Store.observe(code, { ...ctx.dims, time: year }) for each year

---

### 4. `growth` — Year-over-Year Growth Rates

```typescript
{
  type: 'growth'
  code: string | string[]     // single measure or array for pivot table
  years: YearsSpec            // number[] | 'all'
  fromDim?: string
  toDim?: string
}
```

**Use when:** Growth rate visualization. Multi-code → pivot table columns.

**Pattern:** Compute (val[year] - val[year-1]) / val[year-1] × 100

---

### 5. `ratio-list` — Measure / Denominator Pairs

```typescript
{
  type: 'ratio-list'
  pairs: Array<{
    code: string       // numerator measure code
    denom: string      // denominator measure code
    label?: string     // custom row label
  }>
  pipe?: TransformStep[]   // optional post-compute pipeline
}
```

**Use when:** Computing percentages, shares, ratios (e.g., GVA % of GDP).

**Pattern:** For each pair: (value[code] / value[denom]) × 100

---

### 6. `by-mode` — Branch on Time Mode

```typescript
{
  type: 'by-mode'
  modes: Record<ModeId, DataSpec>
}
```

**Use when:** Same section renders differently in 'year' vs 'range' mode.

**Example:**
```json
{
  "type": "by-mode",
  "modes": {
    "year": { "type": "row-list", "rows": [...] },
    "range": { "type": "query", "query": {...}, "pipe": [...], "encoding": {...} }
  }
}
```

**Pattern:** interpretSpec() dispatches to modes[ctx.timeMode]

---

### 7. `pivot` — Wide → Long Transform Shorthand

```typescript
{
  type: 'pivot'
  rows: Record<string, DimVal>[]    // input row array (wide format)
  keyField: string                   // field name carrying series names
  valueFields: string[]              // field names to unpivot
  colors?: Record<string, string>    // optional series → color map
}
```

**Use when:** Converting wide input (e.g., CSV) to long format before encoding.

**Pattern:** applyMelt() — one row per (row fields, field name, field value)

---

### 8. `transform` — Full Declarative Pipeline

```typescript
{
  type: 'transform'
  source: Record<string, DimVal>[]   // inline data (e.g., CSV rows)
  steps: TransformStep[]              // arbitrary transformation pipeline
  encoding: EncodingSpec              // final visual encoding
}
```

**Use when:** Complete data pipeline on inline/embedded data.

**Pattern:** applyPipeline(source, steps, ctx) → applyEncoding()

---

### 9. `custom` — Escape Hatch

```typescript
{
  type: 'custom'
  fn: (ctx: SectionContext) => DataRow[]
}
```

**Use when:** Complex logic not expressible in declarative specs (rare).

**Pattern:** Function runs at interpret time, returns ready-to-render DataRow[]

⚠️ **Constructor-incompatible** — fn is not JSON-serializable. For Phase 1 only; Phase 2 Constructor avoids this type.

---

## Transformation Pipeline (TransformStep)

All steps are 100% JSON-serializable. Used in `query.pipe`, `ratio-list.pipe`, `transform.steps`.

### Steps Reference

| Step | Type | Fields | Purpose |
|---|---|---|---|
| `melt` | wide→long | idFields, valueFields, seriesKey, valueKey | Unpivot columns |
| `rename` | normalize | fields: Record<old, new> | Field name mapping |
| `cast` | coerce | fields: { name: 'number'\|'string' } | Type conversion |
| `filter` | subset | where: Record<field, FilterValue> | Keep matching rows |
| `sort` | order | by: string\|[{field, dir?, using?, last?}...] | Multi-key sort |
| `addField` | inject | name, value | Constant field |
| `select` | project | fields: string[] | Keep only named fields |
| `derive` | compute | as, expr: DeriveExpr\|string | New computed field |
| `aggregate` | group | by, measure, agg \| groupBy, aggregations | GROUP BY + reduce |
| `rollup` | append | dim, as, of, agg, field | Append aggregate rows |
| `lookup` | join | key, from: DimRef\|Record, fields, rename? | LEFT JOIN codelist |
| `join` | merge | with, on, onRight?, fields?, rename? | LEFT JOIN array |
| `group` | hierarchy | by: [{field, inject?}...], levelField, parentField, idPrefix | N-level headers |
| `concat` | merge | fields: string[], as: string, sep? | Concatenate fields |
| `template` | format | as: string, tpl: string | String template (like printf) |

### DeriveExpr — Inline Expression Trees

```typescript
type DeriveExpr =
  | { op: 'field'; field: string }
  | { op: 'literal'; value: number | string }
  | { op: 'add' | 'sub' | 'mul' | 'div'; a: DeriveExpr; b: DeriveExpr }
  | { op: 'abs' | 'neg'; a: DeriveExpr }
  | { op: 'eq' | 'neq'; a: DeriveExpr; b: DeriveExpr }
  | { op: 'gt' | 'gte' | 'lt' | 'lte'; a: DeriveExpr; b: DeriveExpr }
  | { op: 'and' | 'or'; a: DeriveExpr; b: DeriveExpr }
  | { op: 'not'; a: DeriveExpr }
  | { op: 'if'; cond: DeriveExpr; then: DeriveExpr; else: DeriveExpr }
```

**Or string form (Vega-Lite analogue):** `'value / total * 100'`, `'side == "R" && seqPos > 0 ? 1 : 0'`

---

## EncodingSpec — Grammar of Graphics Channel Mapping

Maps observation fields to visual channels (Vega-Lite analogue).

```typescript
{
  label: string                          // row label (x-axis / table row label)
  value?: string                         // measure value (default: 'value')
  color?: string                         // explicit per-row color field
  series?: string                        // grouping dimension (multi-series)
  pct?: { of: string } | { sumOf: string } | { field: string }  // percentage
  negate?: string[]                      // measure codes to invert
  seriesFormat?: Record<string, string>  // series → formatter name map
  seriesOrder?: string[]                 // legend/column order
  tooltip?: string[]                     // extra fields on hover
  id?: string                            // explicit row id field
  isSeparator?: string                   // boolean field → separator row
  isTotal?: string                       // boolean field → total row
  level?: string                         // hierarchy depth field
  parentId?: string                      // parent row id field (tree linking)
}
```

---

## Example: Multi-Step Data Pipeline

```json
{
  "type": "query",
  "query": {
    "measure": ["GVA_REAL", "GVA_NOMINAL"],
    "filter": {
      "sector": ["production", "distribution"],
      "geo": [{ "$ctx": "region" }]
    }
  },
  "pipe": [
    { "op": "sort", "by": "sector", "using": ["production", "distribution"] },
    {
      "op": "group",
      "by": [
        {
          "field": "sector",
          "inject": { "from": { "label": "sectorName" }, "set": { "_isGroup": 1 } }
        }
      ]
    },
    {
      "op": "derive",
      "as": "pct_total",
      "expr": "value / total * 100"
    }
  ],
  "encoding": {
    "label": "label",
    "value": "value",
    "series": "measure",
    "pct": { "sumOf": "value" },
    "seriesFormat": {
      "GVA_REAL": "mln_gel",
      "GVA_NOMINAL": "mln_gel"
    },
    "tooltip": ["status", "unit"]
  }
}
```
