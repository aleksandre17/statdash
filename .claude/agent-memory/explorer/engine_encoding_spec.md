---
name: engine_encoding_spec
description: EncodingSpec Grammar of Graphics channel mapping for Constructor UI
metadata:
  type: reference
  source: engine/core/src/data/encoding.ts
---

# EncodingSpec — Grammar of Graphics Mapping

Maps observation/row fields to visual channels (Vega-Lite analogue). 100% JSON-serializable.

## Primary Channels

```typescript
interface EncodingSpec {
  label: string              // x-axis label / table row label (required)
  value?: string             // measure value field (default: 'value')
  color?: string             // explicit per-row color field
  series?: string            // grouping dimension (multi-series / pivot columns)
}
```

## Percentage Computation

```typescript
pct?: 
  | { of: string }           // |value| / store.val('CODE', ctx) × 100
  | { sumOf: string }        // |value| / Σ rows[FIELD] × 100 (query total)
  | { field: string }        // read directly from field (pre-computed)
```

## Visual Customization

```typescript
negate?: string[]            // measure codes to invert (outflow/debit)
seriesFormat?: Record<string, string>  // series → formatter registry key
seriesOrder?: string[]       // legend/column order (left-to-right)
tooltip?: string[]           // extra fields on hover (e.g. ['unit', 'status', 'source'])
```

## Structural / Hierarchy Channels

Map generic pipe-layer metadata to DataRow fields:

```typescript
id?: string                  // field with explicit row id
isSeparator?: string         // truthy field → DataRow.isSeparator = true
isTotal?: string             // truthy field → DataRow.isTotal = true
level?: string               // integer depth (indent level)
parentId?: string            // parent row id (tree linking)
```

## DataRow Output

applyEncoding() produces:

```typescript
interface DataRow {
  id: string                 // unique id
  label: string              // row label
  series?: string            // grouping dimension
  value: number              // numeric measure
  pct?: number               // computed or direct percentage
  color?: string             // explicit color
  isTotal?: boolean          // aggregate row flag
  isSeparator?: boolean      // visual separator
  level?: number             // hierarchy depth (0=root)
  parentId?: string          // parent id (tree linking)
  status?: 'A'|'p'|'e'|'r'|'c'  // SDMX OBS_STATUS
}
```

## Example: Multi-Series with Percentages

```json
{
  "label": "account_label",
  "value": "value",
  "series": "measure",
  "pct": { "sumOf": "value" },
  "negate": ["OUTFLOW"],
  "color": "measure_color",
  "seriesFormat": {
    "INFLOW": "mln_gel",
    "OUTFLOW": "mln_gel",
    "CHANGE": "sign_pct"
  },
  "seriesOrder": ["INFLOW", "OUTFLOW", "CHANGE"],
  "tooltip": ["unit", "status", "source"],
  "isSeparator": "_isSeparator",
  "isTotal": "_isTotal",
  "level": "_level",
  "parentId": "_parentId"
}
```

## Formatter Registry

Available formatter keys (referenced in seriesFormat):
- `'mln_gel'` — million GEL, no decimals, space thousands separator
- `'sign_pct'` — ±X.X%, 1 decimal
- `'pct'` — X.X%, 1 decimal
- `'usd'` — $ X millions, no decimals
- `'number'` — string coercion
- `'decimal1'` — 1 decimal place
- `'decimal2'` — 2 decimal places
- `'default'` — no decimals
