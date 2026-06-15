---
name: config_filter_kpi_specs
description: FilterSchemaInput, FilterInput types, and KpiSpec shape for page-level filters and KPI strip definitions
metadata:
  type: reference
---

# FilterSchemaInput & KpiSpec

## FilterSchemaInput — declarative filter UI

```ts
{
  context: {
    timeMode: string              // 'mode' (which param tracks year vs range)
    dims: {
      [dimName]: string           // e.g. { time: 'year', fromYear: 'fromYear', toYear: 'toYear' }
    }
  }
  effects: [
    { when: { [param]: value },              set: { [param]: '' } }  // clears values
    { when: { [param]: { neq: value } },     set: { [param]: '' } }  // on non-match
  ]
  bars: {
    [barId]: {
      position:  'sticky'
      order:     number
      showWhen?: { [param]: value }          // visibility condition
      filters: {
        [paramName]: FilterInput
      }
    }
  }
}
```

## FilterInput types

### hidden
No UI, just set default:
```ts
{ type: 'hidden', default: string }
```

### year-select
Year picker, uses classifier items:
```ts
{
  type:    'year-select'
  default: string
  years: {
    type:   'inline'
    items:  { $cl: 'time' }        // reference to time classifier
    field:  'code'                 // which field is the year value
  }
}
```

### select
Dropdown, can filter/sort items:
```ts
{
  type:       'select'
  label?:     string
  suffix?:    string              // '-დან' (from), '-მდე' (to)
  default:    string
  emptyLabel? string              // 'ყველა' (all)
  options: {
    type:       'inline'
    items:      { $d: 'dimension' }    // dataset dimension reference
    pipe?:      TransformStep[]        // filter, sort, derive before display
    valueField: string                 // which field is the param value
    labelField: string                 // which field is the display label
  }
}
```

## Effects Pattern — mode-driven clearing

GDP filters (year-bar vs range-bar):
```ts
effects: [
  { when: { mode: 'range' },          set: { year: '' } },
  { when: { mode: { neq: 'range' } }, set: { fromYear: '', toYear: '' } },
]
```

Accounts filters (year vs range mode changes):
```ts
effects: [
  { when: { mode: 'range' },          set: { account: '', measure: '' } },
  { when: { mode: { neq: 'range' } }, set: { fromYear: '', toYear: '' } },
]
```

Regional filters (range mode context):
```ts
effects: [
  { when: { mode: 'range' },          set: { year: '', sector: '_T' } },
  { when: { mode: { neq: 'range' } }, set: { fromYear: '', toYear: '' } },
]
```

---

# KpiSpec — Key performance indicators strip

```ts
{
  id:       string                 // 'gdp-total', 'gdp-growth', etc.
  label:    string
  unit:     string                 // 'მლნ ₾', '%', '$'
  color:    string                 // hex color
  mode:     'year' | 'range'       // which mode this KPI appears in
  value:    ValueSpec
  trend:    TrendSpec
  trendSub: string                 // subtitle for trend
}
```

## ValueSpec — how to compute the displayed value

### point
Single measure at specific time:
```ts
{ type: 'point', measure: string, format?: string, time?: number, abs?: boolean }
// format: 'mln_gel', 'sign_pct'
// time: override current context time
// abs: take absolute value
```

### yoy
Year-over-year percent change:
```ts
{ type: 'yoy', measure: string }
```

### cagr
Compound annual growth rate:
```ts
{ type: 'cagr', measure: string, from: number, to: number }
```

### share
Ratio of two measures (percentage):
```ts
{ type: 'share', num: ValueSpec, denom: ValueSpec }
// num.denom both can be point/yoy/cagr
```

## TrendSpec — arrow & text below value

### yoy
Year-over-year trend:
```ts
{ type: 'yoy', measure: string, time?: number }
```

### cagr
CAGR trend:
```ts
{ type: 'cagr', measure: string, from: number, to: number }
```

### static
Fixed text & direction:
```ts
{ type: 'static', value: string, dir: 'up' | 'down' | 'flat' }
// value: 'რეალური', 'სტაბილური', '−'
```

---

## Examples from codebase

GDP KPI (year mode):
```ts
{
  id: 'gdp-total',
  label: 'მშპ საბაზრო ფასებში',
  unit: 'მლნ ₾',
  color: '#0080BE',
  mode: 'year',
  value: { type: 'point', measure: 'GDP', format: 'mln_gel' },
  trend: { type: 'yoy', measure: 'GDP' },
  trendSub: 'წინა წელთან შედარებით',
}
```

Accounts CAGR (range mode):
```ts
{
  id: 'b1g-cagr',
  label: 'დამატებული ღირებულება — საშუალო წლიური ზრდა',
  unit: '%',
  color: '#00A896',
  mode: 'range',
  value: { type: 'cagr', measure: 'B1G', from: FIRST_YEAR, to: LAST_YEAR },
  trend: { type: 'cagr', measure: 'B1G', from: FIRST_YEAR, to: LAST_YEAR },
  trendSub: `${FIRST_YEAR}–${LAST_YEAR}`,
}
```

Regional share (range mode):
```ts
{
  id: 'labor-share',
  label: 'შრომის წილი დამატებულ ღირებულებაში',
  unit: '%',
  color: '#4ECDC4',
  mode: 'range',
  value: {
    type: 'share',
    num: { measure: 'D1', time: LAST_YEAR },
    denom: { measure: 'B1G', time: LAST_YEAR },
  },
  trend: { type: 'static', value: 'სტაბილური', dir: 'flat' },
  trendSub: String(LAST_YEAR),
}
```
