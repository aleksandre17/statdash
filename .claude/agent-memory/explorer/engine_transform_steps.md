---
name: engine_transform_steps
description: Complete TransformStep operation reference for Constructor UI pipelines
metadata:
  type: reference
  source: engine/core/src/data/transform.ts
---

# TransformStep — Declarative Pipeline Operations

All 100% JSON-serializable. Used in `query.pipe`, `ratio-list.pipe`, `transform.steps`.

## Step Operations Reference

### Data Shape

| Step | Fields | Purpose |
|---|---|---|
| **melt** | idFields, valueFields, seriesKey?, valueKey? | Wide → long unpivot |
| **rename** | fields: Record<old, new> | Normalize field names |
| **cast** | fields: {name: 'number'\|'string'} | Type coercion |
| **select** | fields: string[] | Keep only named fields |
| **addField** | name, value | Inject constant field |

### Filtering & Sorting

| Step | Fields | Purpose |
|---|---|---|
| **filter** | where: Record<field, FilterValue> | Keep matching rows (AND) |
| **sort** | by: string\|[{field, dir?, using?, last?}...], dir?, using? | Multi-key sort; `last` = always last |

### Grouping & Aggregation

| Step | Fields | Purpose |
|---|---|---|
| **aggregate** | by, measure, agg \| groupBy, aggregations | GROUP BY + reduce (collapse) |
| **rollup** | dim, as, of, agg, field? | Append aggregate rows (keep originals) |
| **group** | by: [{field, inject?}...], levelField?, parentField?, idPrefix? | N-level hierarchy materialization |

### Joining & Enrichment

| Step | Fields | Purpose |
|---|---|---|
| **lookup** | key, from: DimRef\|Record, fields, rename? | LEFT JOIN codelist; from = {code→fields} |
| **join** | with: DimRef\|Record[], on, onRight?, fields?, rename? | LEFT JOIN array; with = classifier or rows |

### Computed Fields

| Step | Fields | Purpose |
|---|---|---|
| **derive** | as, expr: DeriveExpr\|string | Compute field via expression |
| **concat** | fields: string[], as: string, sep? | Join field values into string |
| **template** | as: string, tpl: string | String template rendering |

## Filter Values

FilterValue used in `filter.where` conditions:

```typescript
type FilterValue = 
  | DimVal                        // literal: time: 2024
  | DimVal[]                      // array (IN): geo: ['tbilisi', 'kutaisi']
  | { $ctx: string }              // context ref: time: { $ctx: 'time' }
  | { $ne: DimVal }               // negation: sector: { $ne: 'agriculture' }
```

## Aggregation Functions

Used in `aggregate.agg` and `rollup.agg`:
- `'sum'` — total
- `'avg'` — mean
- `'min'` — minimum
- `'max'` — maximum
- `'count'` — row count

## DeriveExpr — Inline Expressions

Expressions in `derive.expr`:

```typescript
type DeriveExpr =
  | { op: 'field'; field: string }
  | { op: 'literal'; value: number | string }
  | { op: 'add' | 'sub' | 'mul' | 'div'; a: DeriveExpr; b: DeriveExpr }
  | { op: 'abs' | 'neg'; a: DeriveExpr }
  | { op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'; a: DeriveExpr; b: DeriveExpr }
  | { op: 'and' | 'or'; a: DeriveExpr; b: DeriveExpr }
  | { op: 'not'; a: DeriveExpr }
  | { op: 'if'; cond: DeriveExpr; then: DeriveExpr; else: DeriveExpr }
```

**String form (parser):** `'value / total * 100'`, `'side == "R" && qty > 0 ? 1 : 0'`

## Sort Specification

Single-field form (backward compatible):
```json
{ "op": "sort", "by": "accountOrder", "dir": "asc" }
{ "op": "sort", "by": "side", "using": ["R", "U"] }
```

Multi-key form (preferred):
```json
{
  "op": "sort",
  "by": [
    { "field": "accountOrder", "dir": "asc" },
    { "field": "side", "using": ["R", "U"] },
    { "field": "seqPos", "dir": "asc", "last": -1 }
  ]
}
```

Options:
- `dir`: `'asc'` | `'desc'` (default: asc)
- `using`: explicit order; unlisted values sort last
- `last`: value(s) always sorted after all others (e.g., -1, 'total')

## Group Specification

Materializes N-level hierarchy into row stream. Must be pre-sorted (outermost first).

```json
{
  "op": "group",
  "by": [
    {
      "field": "category",
      "inject": {
        "from": { "name": "categoryName", "badge": "categoryBadge" },
        "set": { "_isHeader": 1 },
        "idFrom": "code"
      }
    }
  ],
  "levelField": "_level",
  "parentField": "_parentId",
  "idPrefix": "_grp"
}
```

Fields added to every row:
- `_level` (or levelField) — hierarchy depth (0 = injected header, N = leaf data)
- `_parentId` (or parentField) — id of nearest ancestor

Fields added to injected HEADER rows only:
- `_isGroup: 1` (truthy sentinel)
- `_id` — deterministic composite key

## Formatter Registry

Referenced by `encoding.seriesFormat`:
- `'mln_gel'` — million GEL, no decimals
- `'sign_pct'` — +/- percentage (1 decimal)
- `'pct'` — percentage (1 decimal)
- `'usd'` — $ USD (no decimals)
- `'number'` — string coercion
- `'decimal1'`, `'decimal2'` — fixed decimals
- `'default'` — no decimals, space thousands
