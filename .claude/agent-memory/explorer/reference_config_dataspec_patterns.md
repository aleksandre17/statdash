---
name: config_dataspec_patterns
description: DataSpec types, TransformStep operations, EncodingSpec, and data pipeline patterns used in page configs
metadata:
  type: reference
---

# DataSpec & Data Pipeline Patterns

## DataSpec types

### query
Main data type — fetch from dataset + transform:
```ts
{
  type:      'query'
  query: {
    measure?:  string | string[] | '*'
    filter?:   { [dim]: { $ctx: param } | { $ne: value } }
    orderBy?:  { field, dir: 'asc'|'desc' }
  }
  pipe:       TransformStep[]
  encoding:   EncodingSpec
  fromDim?:   string              // 'fromYear' for range slice
  toDim?:     string              // 'toYear' for range slice
}
```

### ratio-list
Compute ratios of pairs of measures:
```ts
{
  type:   'ratio-list'
  pairs: [{ code: string, denom: string }]
  pipe:   TransformStep[]
  // encoding inferred from measure labels
}
```

## EncodingSpec — field→channel mapping
```ts
{
  label?:       string            // x-axis or row label
  value?:       string            // numeric value
  series?:      string            // color/group (stacked bar)
  color?:       string            // color field
  id?:          string            // unique row id (for dataLinks)
  pct?:         { of? | sumOf? }  // percentage calculation
  isTotal?:     string            // marks total rows
  isSeparator?: string            // group separator
  level?:       string            // hierarchy level
  parentId?:    string            // parent in tree
}
```

## TransformStep operations

### derive
Create computed field:
```ts
{ op: 'derive', as: 'fieldName', expr: "measure == 'GDP' ? 1 : 0" }
```

### lookup
Join classifier or map data:
```ts
{ op: 'lookup', key: 'measure', from: { $d: 'measure' }, fields: ['label', 'color'] }
{ op: 'lookup', key: 'side',
  from: { R: { series: 'რესურსები', color: '#4472C4' },
          U: { series: 'გამოყენება', color: '#E76F51' } },
  fields: ['series', 'color'] }
```

### filter
Where clause:
```ts
{ op: 'filter', where: { code: { $ne: '_T' } } }
{ op: 'filter', where: { isCarryForward: 0 } }
```

### sort
Order by field(s):
```ts
{ op: 'sort', by: 'code', dir: 'asc' }
{ op: 'sort', by: [{ field: 'isTotal', dir: 'asc' }, { field: 'value', dir: 'desc' }] }
{ op: 'sort', by: [{ field: 'measure', using: ['C', 'I_GFCF', 'X', 'M', 'GDP'] }] }
// using: custom order; last: -1 puts field last
```

### aggregate
Group & summarize:
```ts
{ op: 'aggregate', by: ['geo', 'time'], measure: 'value', agg: 'sum' }
```

### rollup
Subtotal row:
```ts
{ op: 'rollup', dim: 'sector', as: '__total__', of: '*', agg: 'sum' }
```

### join
Explicit table join:
```ts
{ op: 'join', with: { $cl: 'account' }, on: 'account', fields: ['order'] }
```

### template
Format string:
```ts
{ op: 'template', as: 'label', tpl: '{label} ({measure})' }
```

### concat
Concatenate fields:
```ts
{ op: 'concat', fields: ['prefix', 'fullLabel'], as: 'prefixedLabel', sep: '' }
{ op: 'concat', fields: ['account', 'measure', 'side'], as: '_id' }
```

### rename
Rename fields:
```ts
{ op: 'rename', fields: { isClosing: '_isTotal' } }
```

### group
Hierarchical grouping with value injection:
```ts
{ op: 'group',
  by: [{ field: 'account',
          inject: { from: { label, color }, set: { _isGroup: 1, value: 0 } } }]
}
```

## Classifier & Dimension References

In config (declarative):
- `{ $cl: 'dimension' }` — static classifier from store
- `{ $d: 'dimension' }` — dataset dimension (e.g. `$d: 'time'`)
- `{ $ctx: 'param' }` — filter context value (e.g. `$ctx: 'time'`)

## Filter Context References

Most common in `query.filter`:
```ts
filter: {
  time:    { $ctx: 'time' }       // year mode
  geo:     { $ctx: 'geo' }        // regional mode
  sector:  { $ctx: 'sector' }     // sector filter
  account: { $ctx: 'account' }    // SNA account
  measure: { $ctx: 'measure' }    // measure override (accounts range mode)
}
```

## Range Mode Slicing

For "compare two years" queries:
```ts
{
  ...dataSpec,
  fromDim: 'fromYear',  // filter start
  toDim:   'toYear',    // filter end
}
```
The renderer slices the data to `fromYear <= time <= toYear`.
