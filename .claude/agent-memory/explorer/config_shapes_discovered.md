---
name: config_shapes_discovered
description: Full page config JSON shapes, node types, filter schemas, KPI specs, and manifest structure from geostat/src/pages and data files
metadata:
  type: reference
---

# Page Config Shapes — Complete Catalog

## Scope
All 15 .ts files in `apps/geostat/src/pages/`:
- 3 page entry points: gdp.config, accounts.config, regional.config, landing.config (4)
- 3 sections files: gdp.sections, accounts.sections, regional.sections
- 3 kpi files: gdp.kpis, accounts.kpis, regional.kpis  
- 3 filter schema files: gdp.filters, accounts.filters, regional.filters
- Landing subcomponents: landing.hero, landing.stats

Plus:
- `site-manifest.ts` — SiteManifest & SiteBootstrap interfaces
- `store-manifest.ts` — DataStore registry

---

## 1. NodePageConfig Types (Page-Level Entry Points)

### InnerPageNode & PageConfigBase (gdp, accounts, regional)
```ts
{
  id:           string           // 'gdp', 'accounts', 'regional'
  type:         'inner-page'     // fixed
  path:         string           // '/gdp', '/accounts', '/regional'
  storeKey:     string           // 'gdp', 'accounts', 'regional'
  color:        string           // hex color, e.g. '#0080BE'
  filterSchema: FilterSchemaInput // see section 5
  vars?:        VarMap           // optional, see section 6
  modeOrder:    string[]         // ['year', 'range']
  children:     NodeDef[]        // page structure tree
}
```

### ContainerPage (landing)
```ts
{
  type:    'container-page'
  variant: 'landing'
  id:      'landing'
  children: [LANDING_HERO, LANDING_STATS]
}
```

---

## 2. Node Types (from NodeDef tree)

### page-header
```ts
{
  type:   'page-header'
  title:  string
  badge:  { year: string, range: string }
  crumbs: { label: string }[]
}
```

### filter-bar
```ts
{ type: 'filter-bar' }
```

### mode-bar
```ts
{
  type:  'mode-bar'
  modes: string[]  // ['year', 'range']
}
```

### kpi-strip
```ts
{
  type:  'kpi-strip'
  items: KpiSpec[]  // see section 3
}
```

### links
```ts
{
  type:  'links'
  items: {
    href:  string
    label: string
    icon:  string  // 'doc', 'info', 'ext'
  }[]
}
```

### section
```ts
{
  type:        'section'
  id:          string           // 'production', 'expenditure', etc.
  title:       string
  color?:      string           // hex color
  label?:      string           // template string, e.g. '{_regionTitle}'
  children:    NodeDef[]        // chart, table, etc.
  data:        DataSpec         // see section 4
  fieldConfig?: { unit?: string, decimals?: number }
  view?: {
    hero?:        boolean
    noCollapse?:  boolean
    subtitle?:    string         // template string
    toggle?:      boolean
    styles?:      { height?: string, aspectRatio?: ... }
    legend?:      'none'
    visibleWhen?: { op, param, is }
  }
  vars?: { [key]: ExprOp }       // derived variables
}
```

### chart
```ts
{
  type:        'chart'
  chartType:   'donut' | 'contribution' | 'combo' | 'line' | 'treemap' | 'bar' | 
               'hbar-diverging' | 'hbar' | 'area'
  label:       string
  fieldConfig?: { unit?: string, decimals?: number, format?: string }
  axes?:       { y: { decimals?: number } }
  dataLabels?: boolean
  view:        { role: 'chart', label: string }
  data:        DataSpec
  dataLinks?:  { title: i18n, target: 'page', page: string, params: object }[]
  compact?:    boolean
  stacked?:    boolean
}
```

### table
```ts
{
  type:         'table'
  colLabel?:    string           // column header prefix
  valueLabel?:  string
  columns:      {
    key:     string
    label:   string
    format?: string              // 'pct', 'mln_gel', 'sign_pct'
    bar?:    { max?: number } | boolean
  }[]
  indent?:      boolean
  statusFlags?: boolean
  footer?:      { value?: 'sum' | 'avg' }
  color?:       string           // hex color
  view:         { role: 'table', label: string, ...styles }
  data:         DataSpec
  transforms?:  TransformStep[]
}
```

### wrap
```ts
{
  type:     'wrap'
  styles:   { aspectRatio: { default: string, sm?: string } }
  children: NodeDef[]
}
```

### columns
```ts
{
  type:     'columns'
  count:    { default: number, md?: number, sm?: number }
  view?:    { visibleWhen?: { op, param, is } }
  children: NodeDef[]
}
```

### repeat
```ts
{
  type:     'repeat'
  as:       string              // 'account'
  view?:    { visibleWhen?: { op, param, is } }
  each:     { code: string, label: string, color?: string }[]
  children: NodeDef[]           // uses {code}_-like templates
}
```

### georgraph (Regional custom node)
```ts
{
  type:           'georgraph'
  id:             string
  title:          string
  label:          string              // template, e.g. '{_regionTitle}'
  color:          string
  data:           DataSpec
  children:       NodeDef[]
  view:           { styles: { height: string } }
  geoJsonUrl:     string
  paramKey:       string              // 'region'
  isoField:       string              // 'shapeISO'
  multiSelect?:   boolean
  maxSelect?:     number
  geoCodeMap:     { [isoCode]: string }
  labelOverrides: { [isoCode]: string }
}
```

### hero (Landing custom node)
```ts
{
  id:    string
  type:  'hero'
  title:    i18n                    // { ka: string, en: string }
  subtitle: i18n
  cards: {
    id:     string
    title:  i18n
    sub:    i18n
    color:  string
    img:    string                  // URL
    pageBg: string                  // CSS gradient
  }[]
}
```

### stats-carousel (Landing custom node)
```ts
{
  id:         string
  type:       'stats-carousel'
  autoplayMs: number               // 7000
  slides: {
    tab:   i18n
    title: i18n
    stats: {
      icon:       string           // emoji
      iconBg:     string           // hex color
      label:      i18n
      value:      string
      unit:       string
      change?:    number
      changeText? i18n
    }[]
  }[]
}
```

---

## 3. KpiSpec

```ts
{
  id:        string
  label:     string
  unit:      string
  color:     string
  mode:      'year' | 'range'
  value:     ValueSpec
  trend:     TrendSpec
  trendSub:  string
}
```

### ValueSpec types
```ts
// point
{ type: 'point', measure: string, format?: string, time?: number, abs?: boolean }

// yoy (year-over-year)
{ type: 'yoy', measure: string }

// cagr (compound annual growth rate)
{ type: 'cagr', measure: string, from: number, to: number }

// share (ratio of two measures)
{ type: 'share', num: ValueSpec, denom: ValueSpec }
```

### TrendSpec types
```ts
// yoy
{ type: 'yoy', measure: string, time?: number }

// cagr
{ type: 'cagr', measure: string, from: number, to: number }

// static
{ type: 'static', value: string, dir: 'up' | 'down' | 'flat' }
```

---

## 4. DataSpec Types

### query
```ts
{
  type:      'query'
  query: {
    measure?:  string | string[]     // '*' for all
    filter?:   { [dim]: { $ctx: string } | { $ne: string } }
    orderBy?:  { field: string, dir: 'asc' | 'desc' }
  }
  pipe:       TransformStep[]
  encoding:   EncodingSpec           // field→channel mapping
  fromDim?:   string                 // 'fromYear' for range context
  toDim?:     string                 // 'toYear' for range context
}
```

### ratio-list
```ts
{
  type:   'ratio-list'
  pairs: {
    code:  string                     // numerator measure code
    denom: string                     // denominator measure code
  }[]
  pipe:   TransformStep[]
}
```

### EncodingSpec
```ts
{
  label?:       string
  value?:       string
  series?:      string
  color?:       string
  id?:          string
  pct?:         { of?: string, sumOf?: string }
  isTotal?:     string
  isSeparator?: string
  level?:       string
  parentId?:    string
  // additional custom channels per chart type
}
```

### TransformStep operations
Available in `pipe:` arrays:
- `derive` — create computed field
- `lookup` — join classifier data
- `filter` — where clause
- `sort` — order by
- `aggregate` — group & summarize
- `rollup` — subtotals
- `join` — explicit table join
- `template` — format string
- `concat` — concatenate fields
- `rename` — rename fields
- `group` — hierarchical grouping

---

## 5. FilterSchemaInput

```ts
{
  context: {
    timeMode: string              // 'mode'
    dims: {
      [dimName]: string           // context key, e.g. { time: 'year', fromYear: 'fromYear' }
    }
  }
  effects: {
    when:  { [param]: value | { neq?: value } }
    set:   { [param]: string }    // '' clears the value
  }[]
  bars: {
    [barId]: {
      position:  'sticky'
      order:     number
      showWhen?: { [param]: value | { neq?: value } }
      filters: {
        [paramName]: FilterInput
      }
    }
  }
}
```

### FilterInput types
```ts
// hidden
{ type: 'hidden', default: string }

// year-select
{
  type:   'year-select'
  default: string
  years:  {
    type:   'inline'
    items:  { $cl: 'time' }        // classifier reference
    field:  'code'
  }
}

// select
{
  type:       'select'
  label?:     string
  suffix?:    string
  default:    string
  emptyLabel? string
  options: {
    type:       'inline'
    items:      { $d: 'dimension' }  // dataset dimension reference
    pipe?:      TransformStep[]      // filter, sort before display
    valueField: string
    labelField: string
  }
}
```

---

## 6. VarMap (Derived Variables)

Located at page level or section level. Maps variable names to expression operations:

```ts
{
  [varName]: ExprOp
}
```

### ExprOp types
```ts
// lookup — map one value to another
{
  op:       'lookup'
  key:      string                      // dimension to look up
  map:      { [fromValue]: toValue }   // mapping table
  fallback: any
}

// find — locate record in classifier
{
  op:       'find'
  source:   { $d: 'dimension' }        // classifier reference
  by:       string                      // param name to match
  idField:  string                      // field to match against
  field?:   string                      // field to extract
  fallback: any
}

// breadcrumbs — build breadcrumb trail
{
  op:         'breadcrumbs'
  prefix:     { label: string }[]
  source:     { $cl: 'dimension' }      // classifier reference
  by:         string                    // param name
  idField:    string
  labelField: string
}

// if — conditional
{
  op:    'if'
  cond:  ExprOp                         // condition expression
  then:  any
  else:  any
}

// includes — check if left includes right value
{
  op:    'includes'
  left:  { $ctx: string }               // context dimension
  right: string                         // value to check
}

// join-labels — concatenate multiple label values
{
  op:        'join-labels'
  source:    { $d: 'dimension' }
  by:        string                     // param name
  idField:   string
  labelField: string
  maxItems:  number
  overflow:  string                     // fallback if > maxItems
}

// template — format string
{
  op:   'template'
  tmpl: string                          // template with {field} placeholders
}
```

---

## 7. SiteManifest & SiteBootstrap

### SiteManifest interface
```ts
{
  pages:        Record<string, NodePageConfig>
  nav:          NavEntry[]
  chrome:       Record<string, ChromeEntry>
  chromeConfig: ChromeConfig
  i18n:         I18nConfig
}
```

### SiteBootstrap interface
```ts
{
  manifest: SiteManifest
  stores:   Record<string, DataStore>  // keyed by storeKey
}
```

### store-manifest.ts
```ts
export const STORE_MANIFEST: Record<string, DataStore> = {
  gdp:      gdpStore,
  accounts: accountsStore,
  regional: regionalStore,
}
```

---

## 8. Notable Patterns Observed

### Template Strings
Used in `view.subtitle`, `label`, `title` — resolved at render with context:
- `{time}` — current year context
- `{_regionTitle}` — derived from vars
- `{account_label}` — from repeat loop injection
- Static ranges: `${FIRST}–${LAST}` (computed at build time)

### Classifier & Dimension References
- `{ $cl: 'dimension' }` — reference to static classifier
- `{ $d: 'dimension' }` — reference to dataset dimension
- `{ $ctx: 'param' }` — reference to filter context param

### Filter Effects
Auto-clearing on mode switch:
- When `mode='range'` → clears `account`, `measure`, `sector`
- When `mode!='range'` → clears `fromYear`, `toYear`

### DataLinks
Used to navigate between pages:
```ts
{
  title:  i18n
  target: 'page'
  page:   '/regional'
  params: { region: { $row: 'id' } }
}
```
where `{ $row: 'id' }` extracts the `id` field from the clicked row.

### Repeat Pattern
For iterating SNA accounts in accounts.sections:
```ts
{
  type: 'repeat',
  as: 'account',
  each: [ { code: 'production', label: '...', color: '...' }, ... ],
  children: [...]  // {account_code}, {account_label}, {account_color} injected
}
```

### Georgraph Custom Node
Regional-only custom node for interactive map:
- Loads GeoJSON from URL
- Maps ISO codes → internal codes
- Supports multi-select with `maxSelect`
- Integrates with filter context (`region` param)

---

## 9. Three Datasources (store-manifest)

1. **gdp** — 1 storeKey, GDP measures + time classifier
2. **accounts** — 1 storeKey, SNA T-accounts + time, account, aggregates classifiers
3. **regional** — 1 storeKey, Regional GVA + time, geo, sector classifiers

Each has adapter (`fromGDPFacts`, `fromSDMX`, `fromRegionalFacts`) + raw classifiers.
