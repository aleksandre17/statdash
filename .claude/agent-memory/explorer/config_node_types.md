---
name: config_node_types
description: All NodeDef types used in page config trees (section, chart, table, columns, repeat, georgraph, hero, stats-carousel)
metadata:
  type: reference
---

# NodeDef Types — Complete Catalog

## section
```ts
{
  type:        'section'
  id:          string
  title:       string
  color?:      string
  label?:      string              // template: '{_regionTitle}'
  children:    NodeDef[]
  data:        DataSpec
  fieldConfig?: { unit?, decimals? }
  view?: {
    hero?:        boolean
    noCollapse?:  boolean
    subtitle?:    string            // template
    toggle?:      boolean
    styles?:      { height?, aspectRatio? }
    legend?:      'none'
    visibleWhen?: { op, param, is }
  }
  vars?: { [key]: ExprOp }
}
```

## chart
```ts
{
  type:        'chart'
  chartType:   'donut'|'contribution'|'combo'|'line'|'treemap'|'bar'|'hbar-diverging'|'hbar'|'area'
  label:       string
  fieldConfig?: { unit?, decimals?, format? }
  axes?:       { y: { decimals? } }
  dataLabels?: boolean
  view:        { role: 'chart', label: string }
  data:        DataSpec
  dataLinks?:  [{ title: i18n, target: 'page', page: string, params: object }]
  compact?:    boolean
  stacked?:    boolean
}
```

## table
```ts
{
  type:         'table'
  colLabel?:    string
  valueLabel?:  string
  columns:      [{ key, label, format?, bar? }]
  indent?:      boolean
  statusFlags?: boolean
  footer?:      { value: 'sum'|'avg' }
  color?:       string
  view:         { role: 'table', label: string, ...styles }
  data:         DataSpec
  transforms?:  TransformStep[]
}
```

## wrap
```ts
{
  type:     'wrap'
  styles:   { aspectRatio: { default, sm? } }
  children: NodeDef[]
}
```

## columns
```ts
{
  type:     'columns'
  count:    { default: number, md?, sm? }
  view?:    { visibleWhen? }
  children: NodeDef[]
}
```

## repeat
Iterates items (e.g. SNA accounts), rendering child once per item with injected vars:
```ts
{
  type:     'repeat'
  as:       string                // 'account'
  view?:    { visibleWhen? }
  each:     [{ code, label, color? }]
  children: NodeDef[]             // templates use {account_code}, {account_label}, {account_color}
}
```

## georgraph
Regional interactive map node — custom plugin type:
```ts
{
  type:           'georgraph'
  id:             string
  title:          string
  label:          string          // template: '{_regionTitle}'
  color:          string
  data:           DataSpec
  children:       NodeDef[]
  view:           { styles: { height } }
  geoJsonUrl:     string
  paramKey:       string          // 'region'
  isoField:       string          // 'shapeISO' in GeoJSON
  multiSelect?:   boolean
  maxSelect?:     number
  geoCodeMap:     { [isoCode]: string }     // ISO→internal code map
  labelOverrides: { [isoCode]: string }
}
```

## hero
Landing page hero card grid — custom plugin:
```ts
{
  id:    string
  type:  'hero'
  title:    i18n
  subtitle: i18n
  cards: [{
    id:     string
    title:  i18n
    sub:    i18n
    color:  string
    img:    string              // URL
    pageBg: string              // CSS gradient
  }]
}
```

## stats-carousel
Landing page stat slides — custom plugin:
```ts
{
  id:         string
  type:       'stats-carousel'
  autoplayMs: number
  slides: [{
    tab:   i18n
    title: i18n
    stats: [{
      icon:       string         // emoji
      iconBg:     string
      label:      i18n
      value:      string
      unit:       string
      change?:    number
      changeText? i18n
    }]
  }]
}
```

## Built-in layout nodes (no data)
```ts
{ type: 'page-header', title, badge: { year, range }, crumbs: [{ label }] }
{ type: 'filter-bar' }
{ type: 'mode-bar', modes: ['year', 'range'] }
{ type: 'kpi-strip', items: KpiSpec[] }
{ type: 'links', items: [{ href, label, icon: 'doc'|'info'|'ext' }] }
```
