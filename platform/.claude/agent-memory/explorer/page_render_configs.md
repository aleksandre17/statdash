---
name: page_render_configs
description: Page config structure, DataSpec shapes, filter schema, KPI specs
metadata:
  type: reference
---

# Page Render Configs & DataSpec Patterns

## Files & Organization

**Path:** `apps/geostat/src/pages/`

Each page splits into 4 modules:
- `{name}.config.ts` → PageConfigBase + InnerPageNode (root)
- `{name}.sections.ts` → NodeDef[] (layout: columns, sections, charts, tables)
- `{name}.filters.ts` → FilterSchemaInput (bars, effects, computed)
- `{name}.kpis.ts` → KpiSpec[] (value + trend specs)

**Pages:** landing, gdp, accounts, regional

---

## Page Config Root (gdp.config.ts Example)

```typescript
export const GDP_PAGE: InnerPageNode & PageConfigBase = {
  id:           'gdp',
  type:         'inner-page',
  path:         '/gdp',
  storeKey:     'gdp',              //← resolves stores['gdp'] at runtime
  color:        '#0080BE',
  filterSchema: GDP_FILTER_SCHEMA,
  modeOrder:    ['year', 'range'],
  children: [
    { type: 'page-header', title: '...' },
    { type: 'filter-bar' },
    { type: 'mode-bar', modes: ['year', 'range'] },
    { type: 'kpi-strip', items: GDP_KPIS },
    ...GDP_SECTIONS,               //← nested sections with data + charts
    { type: 'links', items: [...] },
  ]
}
```

---

## Sections Layout (NodeDef Tree)

```typescript
// Responsive columns with visibility conditions
{
  type: 'columns',
  count: { default: 2, md: 1, sm: 1 },
  view: { visibleWhen: { op: 'eq', param: 'mode', is: 'year' } },
  children: [
    {
      type: 'section',
      id: 'production',
      title: 'მთლიანი შიდა პროდუქტი წარმოების მეთოდით',
      color: '#0080BE',
      fieldConfig: { unit: 'მლნ ₾' },
      vars: { periodLabel: { op: 'template', tmpl: '{time} წ.' } },
      view: { subtitle: '{periodLabel} · მლნ ₾' },
      
      // ← DataSpec (query mode, most common)
      data: {
        type: 'query',
        query: {
          measure: ['GDP_SVC', 'GDP_NET_TAX', 'GDP_IND', 'GDP_CON', 'GDP_AGRI', 'GDP'],
          filter: { time: { $ctx: 'time' } }  //← CtxRef resolved at query time
        },
        pipe: [
          { op: 'derive', as: 'isTotal', expr: "measure == 'GDP' ? 1 : 0" },
          { op: 'lookup', key: 'measure', from: { $d: 'measure' }, fields: ['label', 'color'] },
          { op: 'derive', as: 'label', expr: "isTotal == 1 ? 'მშპ სულ' : label" },
          { op: 'sort', by: [{ field: 'isTotal', dir: 'asc' }, { field: 'value', dir: 'desc' }] },
        ],
        encoding: {
          label: 'label',
          value: 'value',
          color: 'color',
          pct: { of: 'GDP' },
          isTotal: 'isTotal'
        }
      },

      children: [
        {
          type: 'wrap',
          styles: { aspectRatio: { default: '16:9', sm: '4:3' } },
          children: [
            { type: 'chart', chartType: 'donut', label: 'სექტორული სტრუქტურა' },
            { type: 'table', colLabel: 'სექტორი',
              columns: [
                { key: 'value', label: 'მლნ ₾' },
                { key: 'pct', label: 'წილი', format: 'pct', bar: { max: 100 } }
              ],
              transforms: [{ op: 'sort', by: 'label', dir: 'asc' }]  //← table-only override
            },
          ]
        }
      ]
    }
  ]
}
```

---

## DataSpec Modes

**Query (scalar × dimension filter):**
```typescript
{
  type: 'query',
  query: { measure: [...], filter: { time: { $ctx: 'time' } } },
  pipe: [...transform steps...],
  encoding: { label, value, color, ... }
}
```

**Timeseries (range mode plots):**
```typescript
{
  type: 'query',
  query: { measure: 'GDP' },
  encoding: { label: 'time', value: 'value' },
  fromDim: 'fromYear',  // range-mode filter
  toDim: 'toYear'       // range-mode filter
}
```

---

## Context & Display References

**CtxRef ($ctx):**
- `{ $ctx: 'time' }` → filter bar 'year' value
- `{ $ctx: 'fromYear' }` / `{ $ctx: 'toYear' }` → range mode
- `{ $ctx: 'geo' }` → future regional selector

**DisplayRef ($d):**
- `{ $d: 'measure' }` → GDP_DISPLAY classifiers
- `{ $d: 'geo' }` → geo display map
- Used in lookup: `{ op: 'lookup', key: 'measure', from: { $d: 'measure' }, fields: ['label', 'color'] }`

**ClassifierRef ($cl):**
- `{ $cl: 'time' }` → time classifier (code only, no labels)

---

## Filter Schema (gdp.filters.ts)

```typescript
{
  context: {
    timeMode: 'mode',                                    // derived from 'mode' filter
    dims: { time: 'year', fromYear: 'fromYear', toYear: 'toYear' }
  },
  effects: [
    { when: { mode: 'range' }, set: { year: '' } },     // clear year in range mode
    { when: { mode: { neq: 'range' } }, set: { fromYear: '', toYear: '' } }  // clear range in year
  ],
  bars: {
    'year-bar': {
      position: 'sticky',
      order: 0,
      showWhen: { mode: { neq: 'range' } },
      filters: {
        mode: { type: 'hidden', default: 'year' },
        year: {
          type: 'year-select',
          default: { from: 'options', pick: 'last' },
          years: { type: 'inline', items: { $cl: 'time' }, field: 'code' }
        }
      }
    },
    'range-bar': {
      position: 'sticky',
      order: 0,
      showWhen: { mode: 'range' },
      filters: {
        fromYear: {
          type: 'select',
          label: 'შუალედი:',
          suffix: '-დან',
          default: { from: 'options', pick: 'first' },
          options: {
            type: 'inline',
            items: { $d: 'time' },
            pipe: [{ op: 'sort', by: 'code', dir: 'asc' }],
            valueField: 'code',
            labelField: 'code'
          }
        },
        toYear: { /* symmetric: pick: 'last', dir: 'desc' */ }
      }
    }
  }
}
```

**ParamDef types:** hidden, year-select, select, range, multi-select, cascade

---

## KPI Specs (gdp.kpis.ts)

```typescript
export const GDP_KPIS: KpiSpec[] = [
  // Year mode
  {
    id: 'gdp-total',
    label: 'მშპ საბაზრო ფასებში',
    unit: 'მლნ ₾',
    color: '#0080BE',
    mode: 'year',
    value: { type: 'point', measure: 'GDP', format: 'mln_gel' },
    trend: { type: 'yoy', measure: 'GDP' },
    trendSub: 'წინა წელთან შედარებით'
  },
  // Range mode
  {
    id: 'gdp-cagr',
    label: 'მშპ — საშუალო წლიური ზრდა',
    unit: '%',
    color: '#0080BE',
    mode: 'range',
    value: { type: 'cagr', measure: 'GDP', from: { $ctx: 'fromYear' }, to: { $ctx: 'toYear' } },
    trend: { type: 'cagr', measure: 'GDP', from: { $ctx: 'fromYear' }, to: { $ctx: 'toYear' } },
    trendSub: '{fromYear}–{toYear}'
  }
]

// ValueSpec types: point, cagr, yoy, avg, sum
// TrendSpec types: yoy, cagr, static
```

---

## Transform Pipeline (op: ...)

Composable steps (order matters):
- `derive` — add computed field: `expr: "measure == 'GDP' ? 1 : 0"`
- `lookup` — join display labels: `{ key: 'measure', from: { $d: 'measure' }, fields: ['label', 'color'] }`
- `sort` — order rows: `by: [{ field: 'isTotal', dir: 'asc' }, { field: 'value', dir: 'desc' }]`
- `filter` — exclude rows
- `group` — aggregate
- `aggregate` — summary stats
- `melt` — unpivot

