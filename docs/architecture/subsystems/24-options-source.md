# Options Source — Architecture

> How filter controls get their options. One discriminated union covers all cases.
> `$d` / `$cl` references, inline pipes, DataStore queries — same `OptionsSource` type.

---

## Context — where this came from

Old project (`src/features/`) implemented these patterns directly:

```ts
// accounts.filters.ts — inline options with pipe:
options: {
  type:       'inline',
  items:      { $d: 'account' },            // display ref — label + color from DisplayMap
  pipe:       [{ op: 'sort', by: 'order', dir: 'asc' }],
  valueField: 'code',
  labelField: 'label',
}

// accounts.filters.ts — classifier ref for years:
years: { type: 'inline', items: { $cl: 'time' }, field: 'code' }

// regional.filters.ts — pipe filters out rollup code:
options: {
  type:       'inline',
  items:      { $d: 'sector' },
  pipe:       [{ op: 'filter', where: { code: { neq: '_T' } } }],
  valueField: 'code',
  labelField: 'label',
}
```

These types (`OptionsSource`, `YearsSource`, `DimRef`, `ClassifierRef`, `DisplayRef`) are already
defined in `types/all-types.md`. They were merged during the 2026-04-27 old-project sync.

**The gap:** `ParamDefMap` still uses `SelectOption[]` (static) and raw `DataSpec` (cascade).
Fix: update `ParamDefMap` to use `OptionsSource`/`YearsSource`.

---

## `DimRef` — two shapes

```ts
// ClassifierRef — structural data only (code, parent, attrs). No display merge.
// Use for: hierarchy traversal, lookup ops, structural filters
{ $cl: 'geo',    view?: 'items' | 'leaves' | 'rollups' | 'byCode' }

// DisplayRef — display-augmented (code + label + color + custom fields from DisplayMap).
// Use for: filter dropdowns, chip selectors, legend labels
{ $d: 'sector',  view?: 'items' | 'leaves' | 'rollups' | 'byCode' }
```

**View variants:**

| View | Returns | Use for |
|------|---------|---------|
| `'items'` (default) | rollups + leaves, ordered | full selector (all levels) |
| `'leaves'` | atomic codes only | selector when only terminal values valid |
| `'rollups'` | aggregate codes only | total/subtotal picker |
| `'byCode'` | Record\<code, entry\> | lookup in transforms / LookupSpec |

---

## `OptionsSource` — full discriminated union

```ts
type OptionsSource =
  | { type: 'static';  items: SelectOption[] }
  //  ^ hardcoded array — Constructor palette, quick demos
  //  JSON-safe: yes. Dynamic: no.

  | { type: 'inline';  items: DimRef | readonly Record<string, unknown>[];
      valueField: string; labelField?: string; pipe?: TransformStep[] }
  //  ^ from store classifiers/display — the $d/$cl pattern
  //  JSON-safe: yes ($d/$cl are plain objects). Dynamic: yes (updates when store refreshes).
  //  pipe: sort, filter, etc. applied at resolve time.

  | { type: 'query';   data: DataSpec;
      valueField: string; labelField?: string; pipe?: TransformStep[] }
  //  ^ DataStore query → interpretSpec(data, ctx) → rows → options.
  //    DataSpec (NOT ObsQuery) — full interpretSpec pipeline: storeId routing, dims, pipe.
  //    Cascade pattern: data.dims has { $ctx: 'parent' } refs.
  //  JSON-safe: yes. Dynamic: yes, re-fetches when dims change.

  | { type: 'api' }
  //  ^ async — filter component resolves independently. Use for external lookups.
```

`YearsSource` — same shape, `field` instead of `valueField`/`labelField` (years are plain numbers).
`ChipSource` — same shape + optional `colorField` (chip selectors need color).

---

## Updated `ParamDefMap`

```ts
// BEFORE (old):
'select':       ParamDefBase & { type: 'select';       options: SelectOption[]; defaultValue?: string }
'multi-select': ParamDefBase & { type: 'multi-select'; options: SelectOption[]; defaultValue?: string[] }
'cascade':      ParamDefBase & { type: 'cascade';      storeId?: string; optionsQuery: DataSpec; defaultValue?: string }
'year-select':  ParamDefBase & { type: 'year-select';  defaultValue?: number; range?: [number, number] }

// AFTER (correct):
'select':       ParamDefBase & { type: 'select';       options: OptionsSource; defaultValue?: DefaultSpec }
'multi-select': ParamDefBase & { type: 'multi-select'; options: OptionsSource; defaultValue?: DefaultSpec }
'cascade':      ParamDefBase & { type: 'cascade';      options: OptionsSource; defaultValue?: DefaultSpec }
'year-select':  ParamDefBase & { type: 'year-select';  years?:  YearsSource;  defaultValue?: DefaultSpec }
'hidden':       ParamDefBase & { type: 'hidden';                               defaultValue:  DefaultSpec }
'range':        ParamDefBase & { type: 'range';                                defaultValue?: DefaultSpec }
```

**What changed:**
- `select.options`: `SelectOption[]` → `OptionsSource` (covers static + inline $d/$cl + query)
- `multi-select.options`: same
- `cascade.options`: `storeId? + optionsQuery: DataSpec` → `options: OptionsSource`
  - `storeId` removed: `OptionsSource.type='query'` DataSpec handles store routing
  - `optionsQuery: DataSpec` removed: `options: { type: 'query', data: DataSpec }` replaces it
  - `cascade` vs `select` distinction: `cascade` uses `dependsOn` + `options.type='query'` with `{ $ctx }` parent refs
- `year-select.years`: `range?: [number, number]` → `YearsSource` (covers static + inline $cl + query)
- All `defaultValue`: `DimVal | string | number` → `DefaultSpec` (from defaults system, `23-defaults-system.md`)

**Backward compatibility note:**
`SelectOption[]` (static) = `OptionsSource { type: 'static', items: SelectOption[] }`.
No silent breakage — just a different shape. Old configs must be migrated.

---

## Usage patterns — before/after

### select with inline classifier options

```ts
// BEFORE (old src/):
{
  type:    'select',
  key:     'account',
  options: {
    type:       'inline',
    items:      { $d: 'account' },
    pipe:       [{ op: 'sort', by: 'order', dir: 'asc' }],
    valueField: 'code',
    labelField: 'label',
  },
}

// AFTER (new defineFilters):
account: {
  type:    'select',
  options: { type: 'inline', items: { $d: 'account' },
             pipe: [{ op: 'sort', by: 'order', dir: 'asc' }],
             valueField: 'code', labelField: 'label' },
  defaultValue: '',
}
```

### year-select with inline classifier

```ts
// BEFORE (old src/):
{ type: 'year-select', key: 'year',
  years: { type: 'inline', items: { $cl: 'time' }, field: 'code' } }

// AFTER (new defineFilters):
year: {
  type:         'year-select',
  years:        { type: 'inline', items: { $cl: 'time' }, field: 'code' },
  defaultValue: { from: 'options', pick: 'last' },   // last year = most recent
}
```

### cascade with parent-filtered query

```ts
// BEFORE (old src/):
{ type: 'cascade', storeId: 'geo', optionsQuery: { type: 'query', indicator: 'REGIONS',
  dims: { country: { $ctx: 'country' } } }, dependsOn: ['country'] }

// AFTER (new defineFilters):
region: {
  type:         'cascade',
  options:      { type: 'query',
                  query: { type: 'query', storeId: 'geo', indicator: 'REGIONS',
                           dims: { country: { $ctx: 'country' } } },
                  valueField: 'code', labelField: 'label' },
  dependsOn:    ['country'],
  defaultValue: { from: 'options', pick: 'first' },
}
```

### select with pipe filter (strip rollup)

```ts
// BEFORE (old src/):
{ type: 'select', options: { type: 'inline', items: { $d: 'sector' },
  pipe: [{ op: 'filter', where: { code: { neq: '_T' } } }],
  valueField: 'code', labelField: 'label' } }

// AFTER (new defineFilters):
sector: {
  type:    'select',
  options: { type: 'inline', items: { $d: 'sector' },
             pipe: [{ op: 'filter', where: { code: { neq: '_T' } } }],
             valueField: 'code', labelField: 'label' },
  defaultValue: '_T',
}
```

---

## Filter-level derives — mapping to LookupSpec

Old project used `FilterBarNode.derive` with ops like `find`, `breadcrumbs`, `join-labels`.
New architecture maps these to `LookupSpec` in `NodeBase.derive` (see `22-derive-effects.md`):

| Old op | Old example | New LookupSpec |
|--------|-------------|----------------|
| `'find'` (flat lookup by code) | `{ op: 'find', key: 'region', from: { $cl: 'geo' } }` | `{ type: 'map', data: GEO_QUERY, by: { $ctx: 'region' }, idField: 'code', field: '*' }` |
| `'breadcrumbs'` (tree path) | `{ op: 'breadcrumbs', key: 'region', from: { $cl: 'geo' } }` | `{ type: 'tree', data: GEO_QUERY, by: { $ctx: 'region' }, idField: 'code', field: 'crumbs' }` |
| `'join-labels'` (multi-value labels) | `{ op: 'join-labels', key: 'sectors', sep: ', ' }` | ExprVal `{ op: 'join', source: { $ctx: 'sectors' }, sep: ', ', from: { $d: 'sector' } }` |

**Note:** `join-labels` may need `op: 'join'` added to ExprVal if not present — check `06-expression-system.md`.

---

## Implementation checklist (for migration session)

```
☐ Update ParamDefMap in types/all-types.md:
    select.options:       SelectOption[] → OptionsSource
    multi-select.options: SelectOption[] → OptionsSource
    cascade:              storeId? + optionsQuery: DataSpec → options: OptionsSource
    year-select:          range?: [number, number] → years?: YearsSource
    all defaultValue:     DimVal → DefaultSpec

☐ Update 07-filter-system.md ParamDef section

☐ Update filter-schema.ts example (use OptionsSource in gdpFilterSchema)

☐ Update defaults.ts example (cascade: options: OptionsSource instead of optionsQuery)

☐ Migrate src/features/accounts/accounts.filters.ts (when migration starts):
    - mode hidden → ModeBarNode
    - account in range-bar → remove
    - measure → investigate (dead code or params field)
    - options: { type: 'inline' } → OptionsSource shape ← already compatible
    - year-select range → YearsSource { type: 'inline', items: { $cl: 'time' } }

☐ Check op: 'join' exists in ExprVal (for join-labels → LookupSpec mapping)
```

---

## Code reference

```
types/all-types.md       lines 590–624  — OptionsSource, ChipSource, YearsSource
types/all-types.md       lines 305–328  — ClassifierRef, DisplayRef, DimRef, ClassifierView
types/all-types.md       lines 1693–1703 — ParamDefMap (needs update per checklist above)
architecture/22-derive-effects.md      — LookupSpec (replaces old find/breadcrumbs ops)
architecture/23-defaults-system.md    — DefaultSpec (replaces DimVal in defaultValue)
```