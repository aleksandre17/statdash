# tab-page-config.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — TabPageNode + ContainerPageNode
 *
 * Demonstrates:
 * - Tab page: children with layout.label (tab headers)
 * - Container page: children with layout.span (column widths)
 * - Parent blind — shell reads layout metadata, never child type
 */

import type { TabPageNode, ContainerPageNode } from '@geostat/react'

// ── TabPageNode ───────────────────────────────────────────────────────────
export const ACCOUNTS_PAGE: TabPageNode = {
  id:       'accounts',
  type:     'tab-page',
  title:    'ეროვნული ანგარიშები',
  storeKey: 'accounts',
  color:    '#00A878',

  children: [
    // Each child: layout.label = tab header
    // Shell reads children.defs[i].layout.label — parent blind (doesn't know child type)
    {
      type:   'inner-page',
      layout: { label: 'წარმოების ანგარიში', order: 1 },
      children: [
        { type: 'filter-bar', layout: { position: 'sticky-top' }, bars: [] },
        {
          type:   'section',
          data:   { type: 'pivot', indicator: 'B1G', rows: 'time', cols: 'account' },
          children: [
            { type: 'chart', layout: { role: 'chart' } },
            { type: 'table', layout: { role: 'table' } },
          ],
        },
      ],
    },
    {
      type:   'inner-page',
      layout: { label: 'შემოსავლის ანგარიში', order: 2 },
      children: [
        { type: 'filter-bar', layout: { position: 'sticky-top' }, bars: [] },
        {
          type:   'section',
          data:   { type: 'pivot', indicator: 'D1', rows: 'time', cols: 'account' },
          children: [
            { type: 'chart', layout: { role: 'chart' } },
            { type: 'table', layout: { role: 'table' } },
          ],
        },
      ],
    },
    {
      type:   'inner-page',
      layout: { label: 'კაპიტალის ანგარიში', order: 3 },
      children: [
        { type: 'filter-bar', layout: { position: 'sticky-top' }, bars: [] },
        {
          type:   'section',
          data:   { type: 'timeseries', indicator: 'P51G' },
          children: [
            { type: 'chart', layout: { role: 'chart' } },
            { type: 'table', layout: { role: 'table' } },
          ],
        },
      ],
    },
  ],
}

// GeostatTabPageShell reads:
//   children.defs[0].layout.label = 'წარმოების ანგარიში'
//   children.defs[1].layout.label = 'შემოსავლის ანგარიში'
//   children.defs[2].layout.label = 'კაპიტალის ანგარიში'
//   children.rendered[activeTab] = active tab content


// ── ContainerPageNode ─────────────────────────────────────────────────────
export const CONTAINER_EXAMPLE: ContainerPageNode = {
  id:       'container-example',
  type:     'container-page',
  title:    'ორ-სვეტიანი განლაგება',
  storeKey: 'gdp',

  children: [
    // Left column — 2/3 width
    {
      type:   'section',
      layout: { span: 'two-thirds', order: 1 },
      data:   { type: 'timeseries', indicator: 'B1G' },
      children: [
        { type: 'chart', layout: { role: 'chart' } },
      ],
    },
    // Right column — 1/3 width
    {
      type:   'section',
      layout: { span: 'one-third', order: 2 },
      data:   { type: 'row-list', indicators: ['B1G', 'P3', 'P51G'] },
      children: [
        { type: 'kpi-strip', layout: { role: 'panel' } },
      ],
    },
  ],
}

// GeostatContainerPageShell reads:
//   children.defs[0].layout.span = 'two-thirds' → className="span--two-thirds"
//   children.defs[1].layout.span = 'one-third'  → className="span--one-third"
//   children.rendered[0] = chart section
//   children.rendered[1] = kpi section
```
