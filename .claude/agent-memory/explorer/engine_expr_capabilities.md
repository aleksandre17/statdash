---
name: engine_expr_capabilities
description: Complete catalog of @geostat/expr ExprOp string literals and their argument structures for Constructor Panel UI
metadata:
  type: reference
  source: engine/expr/src/**/*.ts
---

# @geostat/expr — Expression Operation Catalog

Pure TypeScript JSON-serializable expression evaluator. Zero dependencies. All ops are fully JSON-serializable and Constructor-ready.

## Core Types

- **DimVal** = string | number | boolean | null (all values)
- **ExprRef** = { $ctx | $derived | $row | $literal } (where values come from)
- **ListRef** = { $rows: true } (collection reference only)
- **ExprVal** = Expr | ExprRef | DimVal (anything that resolves to a value)

## Operation Categories

### Comparison Ops

| Op | Signature | Returns | Notes |
|---|---|---|---|
| `eq` | `{ op: 'eq', left: ExprVal, right: ExprVal }` | boolean | Equality (===) |
| `ne` | `{ op: 'ne', left: ExprVal, right: ExprVal }` | boolean | Inequality (!==) |
| `gt` | `{ op: 'gt', left: ExprVal, right: ExprVal }` | boolean | Greater than (numeric) |
| `lt` | `{ op: 'lt', left: ExprVal, right: ExprVal }` | boolean | Less than (numeric) |
| `gte` | `{ op: 'gte', left: ExprVal, right: ExprVal }` | boolean | Greater or equal (numeric) |
| `lte` | `{ op: 'lte', left: ExprVal, right: ExprVal }` | boolean | Less or equal (numeric) |
| `in` | `{ op: 'in', left: ExprVal, right: ExprVal[] }` | boolean | Membership test (left in right array) |
| `nin` | `{ op: 'nin', left: ExprVal, right: ExprVal[] }` | boolean | Not in (left not in any right value) |
| `null` | `{ op: 'null', value: ExprVal }` | boolean | Is null |
| `exists` | `{ op: 'exists', value: ExprVal }` | boolean | Is not null |

### Logic Ops

| Op | Signature | Returns | Notes |
|---|---|---|---|
| `and` | `{ op: 'and', exprs: Expr[] }` | boolean | All true (short-circuit) |
| `or` | `{ op: 'or', exprs: Expr[] }` | boolean | Any true (short-circuit) |
| `not` | `{ op: 'not', expr: Expr }` | boolean | Logical negation |
| `if` | `{ op: 'if', cond: Expr, then: ExprVal, else?: ExprVal }` | ExprVal | Ternary; else defaults to null |

### Math Ops

| Op | Signature | Returns | Notes |
|---|---|---|---|
| `add` | `{ op: 'add', left: ExprVal, right: ExprVal }` | number | Addition |
| `sub` | `{ op: 'sub', left: ExprVal, right: ExprVal }` | number | Subtraction |
| `mul` | `{ op: 'mul', left: ExprVal, right: ExprVal }` | number | Multiplication |
| `div` | `{ op: 'div', left: ExprVal, right: ExprVal }` | number | Division (div-by-zero → null) |
| `mod` | `{ op: 'mod', left: ExprVal, right: ExprVal }` | number | Modulo |

### String Ops

| Op | Signature | Returns | Notes |
|---|---|---|---|
| `template` | `{ op: 'template', tmpl: string }` | string | `{key}` placeholder replacement from dims/derived |
| `concat` | `{ op: 'concat', values: ExprVal[] }` | string | Join values; nulls → '' |
| `startsWith` | `{ op: 'startsWith', left: ExprVal, right: string }` | boolean | String prefix test |
| `includes` | `{ op: 'includes', left: ExprVal, right: string }` | boolean | String substring test |

### Lookup Ops

| Op | Signature | Returns | Notes |
|---|---|---|---|
| `get` | `{ op: 'get', ref: ExprRef, path: string }` | DimVal | Deep path navigation; 'a.b.c' → current object support only |
| `coalesce` | `{ op: 'coalesce', values: ExprVal[] }` | DimVal | First non-null value |

### Collection Ops

| Op | Signature | Returns | Notes |
|---|---|---|---|
| `some` | `{ op: 'some', list: ListRef, expr: Expr }` | boolean | Any row satisfies expr (requires scope.rows) |
| `every` | `{ op: 'every', list: ListRef, expr: Expr }` | boolean | All rows satisfy expr (requires scope.rows) |
| `filter` | `{ op: 'filter', list: ListRef, expr: Expr }` | ExprRow[] | Filtered row array (requires scope.rows) |
| `count` | `{ op: 'count', list: ListRef }` | number | Row count (requires scope.rows) |
| `map` | `{ op: 'map', list: ListRef, expr: ExprVal }` | unknown[] | Map expr over rows; returns DimVal[] (requires scope.rows) |

## Evaluation Context (ExprScope)

```typescript
interface ExprScope {
  dims:    Record<string, DimVal>  // filter params — user selections
  derived: Record<string, DimVal>  // evalDerived() output
  rows?:   ExprRow[]               // DataRow[] for collection ops
  row?:    ExprRow                 // current item in per-row iteration
  ctx?:    unknown                 // injectable context (e.g. classifiers, display)
}
```

## DeriveMap — Ordered Derived Expressions

```typescript
type DeriveMap = Array<{ key: string; expr: ExprVal }>
```

- Evaluated in declaration order
- Each entry may reference $derived values from **EARLIER entries only** (DAG contract)
- Forward references return null (fail-safe, no throw)
- Use `validateDeriveMap()` to detect cycles and forward refs at config time

## Plugin Extension Pattern

Engine-registered ops via `registerExprOp(op: string, handler)`:
- FilterDerive ops: 'lookup', 'find', 'tree-field', 'if-else', 'breadcrumbs', 'contains', 'join-labels'
- Handler: `(expr: Record<string, unknown>, scope: ExprScope) => unknown`

## Examples

### Boolean Condition
```json
{
  "op": "and",
  "exprs": [
    { "op": "eq", "left": { "$ctx": "region" }, "right": "tbilisi" },
    { "op": "gte", "left": { "$ctx": "year" }, "right": 2020 }
  ]
}
```

### String Template
```json
{
  "op": "template",
  "tmpl": "Region: {region}, Year: {year}"
}
```

### Collection Filter
```json
{
  "op": "filter",
  "list": { "$rows": true },
  "expr": { "op": "gt", "left": { "$row": "value" }, "right": 0 }
}
```

### Computed Field (Derive)
```json
{
  "key": "share_pct",
  "expr": {
    "op": "mul",
    "left": { "op": "div", "left": { "$row": "value" }, "right": { "$derived": "total" } },
    "right": 100
  }
}
```
