---
name: config_varmap_patterns
description: VarMap and ExprOp types for page-level and section-level derived variables
metadata:
  type: reference
---

# VarMap & ExprOp — Derived Variables

Located at page or section level. Maps variable names to expression operations evaluated at render time.

```ts
const VARS: VarMap = {
  [varName]: ExprOp,
  [varName]: ExprOp,
  ...
}
```

Variables are injected into template contexts (e.g., `{_regionTitle}`).

---

# ExprOp Types

## lookup
Map one value to another via a static map:
```ts
{
  op:       'lookup'
  key:      string                      // param to look up
  map:      { [fromValue]: toValue }    // mapping table
  fallback: any
}
```

**Example (accounts.config.ts):**
```ts
selectedSectionId: {
  op:  'lookup',
  key: 'account',
  map: {
    production:     'production-account',
    income_gen:     'income-formation',
    capital:        'capital-account',
  },
  fallback: null,
}
```

---

## find
Locate a record in a classifier by matching a parameter:
```ts
{
  op:       'find'
  source:   { $d: 'dimension' }         // classifier reference
  by:       string                      // param name to match against
  idField:  string                      // field in classifier to match
  field?:   string                      // field to extract from match
  fallback: any
}
```

**Example (regional.config.ts):**
```ts
regionObj: {
  op: 'find',
  source: { $d: 'geo' },
  by: 'region',
  idField: 'code',
  // returns full matched record
}

_pageColor: {
  op: 'find',
  source: { $d: 'geo' },
  by: 'region',
  idField: 'code',
  field: 'color',
  fallback: '#0080BE',
}
```

---

## breadcrumbs
Build a breadcrumb trail from a classifier:
```ts
{
  op:         'breadcrumbs'
  prefix:     [{ label: string }]       // static prefix breadcrumbs
  source:     { $cl: 'dimension' }      // classifier to traverse
  by:         string                    // param to look up
  idField:    string                    // field to match
  labelField: string                    // field to use as label
}
```

**Example (regional.config.ts):**
```ts
_pageCrumbs: {
  op:         'breadcrumbs',
  prefix:     [{ label: 'რეგიონული ანგარიშები' }],
  source:     { $cl: 'geo' },
  by:         'region',
  idField:    'code',
  labelField: 'label',
}
// Result: [{ label: 'რეგიონული ანგარიშები' }, { label: 'თბილისი' }]
```

---

## if
Conditional expression:
```ts
{
  op:    'if'
  cond:  ExprOp                         // condition (nested ExprOp)
  then:  any
  else:  any
}
```

**Example (regional.config.ts):**
```ts
_geoMode: {
  op: 'if',
  cond: { op: 'includes', left: { $ctx: 'region' }, right: ',' },
  then: 'multi',
  else: 'single',
}
// If region param contains comma (multi-select), _geoMode='multi'
```

---

## includes
Check if left string includes right value (used in `if.cond`):
```ts
{
  op:    'includes'
  left:  { $ctx: string }               // context dimension (usually comma-separated)
  right: string                         // substring to find
}
```

---

## join-labels
Concatenate labels from multiple records, with overflow handling:
```ts
{
  op:        'join-labels'
  source:    { $d: 'dimension' }        // classifier
  by:        string                     // param (can be comma-separated)
  idField:   string                     // field to match
  labelField: string                    // field to extract label from
  maxItems:  number                     // show up to N items
  overflow:  string                     // fallback if > maxItems
}
```

**Example (regional.config.ts):**
```ts
_regionTitle: {
  op: 'join-labels',
  source: { $d: 'geo' },
  by: 'region',
  idField: 'code',
  labelField: 'label',
  maxItems: 1,
  overflow: '',
}
// If region='tbilisi', returns 'თბილისი'
// If region='tbilisi,adjara' (2 items), returns '' because maxItems=1
```

---

## template
Format a string with field substitutions:
```ts
{
  op:   'template'
  tmpl: string                          // template with {field} placeholders
}
```

**Example (gdp.sections.ts - not in VarMap, but shows usage):**
```ts
vars: {
  periodLabel: {
    op: 'template',
    tmpl: '{time} წ.'
  }
}
// If time=2024, periodLabel='2024 წ.'
```

---

## Common Patterns

### Repeat Loop Injection
When using `repeat` node, injected variables follow pattern:
```ts
{account_code}   // from each item's 'code' field
{account_label}  // from each item's 'label' field
{account_color}  // from each item's 'color' field
```

Example in accounts.sections.ts:
```ts
{
  type: 'repeat',
  as: 'account',
  each: [
    { code: 'production', label: 'წარმოების ანგარიში', color: '#0080BE' },
    ...
  ],
  children: [
    {
      id: 'account-{account_code}',      // 'account-production', etc.
      title: '{account_label}',          // 'წარმოების ანგარიში', etc.
      // children sections use {account_code} in filter context
    }
  ]
}
```

### Context Injection
Page-level vars are available in all descendant templates:
- `{_pageColor}` — used in page header styling
- `{_pageCrumbs}` — used in page-header breadcrumbs
- `{_geoMode}` — used in `visibleWhen` conditions (not template string)

### Filter Context vs Variables
- **Filter context** (`{ $ctx: 'param' }`): user-selected values
- **Variables** (`{ op: ... }`): computed from context + classifiers
