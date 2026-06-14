# gdp-page-config.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — GDP Page Config (InnerPageNode)
 *
 * Demonstrates:
 * - InnerPageNode structure
 * - filter-bar with sticky position
 * - kpi-strip
 * - section with chart + table (role-based children)
 * - DataSpec types (timeseries, row-list)
 * - ExprVal usage in filters
 * - visibleWhen
 */

import type { InnerPageNode } from '@geostat/react'

// ════════════════════════════════════════════════════════════════════════════
// PHASE 1 — hand-crafted src/ page (named stores, static STORE_MANIFEST)
// ════════════════════════════════════════════════════════════════════════════

export const GDP_PAGE: InnerPageNode = {
  id:       'gdp',
  type:     'inner-page',
  title:    'მთლიანი შიდა პროდუქტი',
  storeKey: 'gdp',
  color:    '#0080BE',

  children: [
    // ── Filter Bar (sticky at top) ──────────────────────────────────────
    // FilterBarNode.bars: Record<string, BarDef> — config input (JSON-serializable)
    // Runtime shape (FilterBarSpec[]) produced by useFilters() inside FilterBarRenderer
    {
      type:   'filter-bar',
      layout: { position: 'sticky-top', order: 1 },
      bars: {
        main: {
          position: 'sticky',
          order:    1,
          filters: {
            time: { type: 'year-select', years: { type: 'inline', items: { $cl: 'time' }, field: 'code' }, defaultValue: { from: 'options', pick: 'last' } },
            geo:  { type: 'cascade', options: { type: 'query', data: { type: 'query', indicator: 'GEO_LIST' }, valueField: 'code', labelField: 'label' }, defaultValue: 'ka' },
          },
        },
      },
    },

    // ── KPI Strip ────────────────────────────────────────────────────────
    // DataStore.query() → DataRow[]. Metadata (label, unit) is IN the DataRow —
    // fromSDMX enriches each row with CODE_MAP fields (J-8 Pattern A):
    //   row['indicator'] = 'B1G'
    //   row['label_ka']  = 'მთლიანი შიდა პროდუქტი'   ← fromSDMX CODE_MAP
    //   row['unit']      = 'მლნ ₾'                    ← fromSDMX CODE_MAP
    //   row['value']     = 48234.5
    //   row['obs_status'] = 'P' → shell shows "წინასწარი" badge
    // No store.meta() — DataStore interface has only query(). Metadata = DataRow fields.
    {
      type:   'kpi-strip',
      layout: { position: 'flow', order: 2, span: 'full' },
      data: {
        type:       'row-list',
        storeId:    'gdp',
        indicators: ['B1G', 'P3', 'P51G'],
      },
    },

    // ── Section: Annual GDP (chart + table) ────────────────────────────
    {
      type:   'section',
      layout: { position: 'flow', order: 3, span: 'full' },
      data: {
        type:      'timeseries',
        indicator: 'B1G',
        dims: {
          geo:  { $ctx: 'geo' },
          time: { $ctx: 'time' },
        },
      },
      view: {
        subtitle: {
          op:   'template',
          tmpl: 'მლნ ₾ · {time} · SNA 2008',
        },
        exportable: true,
      },
      children: [
        { type: 'chart', layout: { role: 'chart' } },   // inherits ctx.rows from section
        { type: 'table', layout: { role: 'table' } },   // inherits ctx.rows from section
      ],
    },

    // ── Section: GDP by Expenditure (visible only in year mode) ─────────
    {
      type:   'section',
      layout: { position: 'flow', order: 4, span: 'full' },
      visibleWhen: { op: 'eq', left: { $ctx: 'mode' }, right: 'year' },
      data: {
        type:      'pivot',
        indicator: 'B1G',
        rows:      'time',
        cols:      'sector',
        dims:      { geo: { $ctx: 'geo' } },
      },
      children: [
        { type: 'chart', layout: { role: 'chart' } },
        { type: 'table', layout: { role: 'table' } },
      ],
    },
  ],
}


// ════════════════════════════════════════════════════════════════════════════
// PHASE 2 — Constructor-generated config (Agreement C-4)
// Same page. href instead of storeId. No STORE_MANIFEST entry needed.
// ════════════════════════════════════════════════════════════════════════════
//
// Phase 1 → Phase 2: ONLY the data source changes.
//   storeKey: 'gdp'      → omitted
//   storeId:  'gdp'      → href: '...' + transform: 'fromSDMX'
//   everything else      → identical (dims, visibleWhen, children, layout, view)
//
// interpretSpec sees href → HttpDataStore (built-in) → fetch + cache → DataRow[]
// No store registration. No factory. No STORE_MANIFEST.

const GDP_API = 'https://api.geostat.ge/sdmx/v1/data/GDP_GE'

export const GDP_PAGE_PHASE2: InnerPageNode = {
  id:    'gdp',
  type:  'inner-page',
  title: 'მთლიანი შიდა პროდუქტი',
  color: '#0080BE',
  // storeKey: omitted — Constructor pages use href in each DataSpec

  children: [
    {
      type:   'filter-bar',
      layout: { position: 'sticky-top', order: 1 },
      bars: {
        main: {
          position: 'sticky',
          order:    1,
          filters: {
            time: { type: 'year-select', years: { type: 'inline', items: { $cl: 'time' }, field: 'code' }, defaultValue: { from: 'options', pick: 'last' } },
            geo:  { type: 'cascade', options: { type: 'query', data: { type: 'query', indicator: 'GEO_LIST' }, valueField: 'code', labelField: 'label' }, defaultValue: 'ka' },
          },
        },
      },
    },

    {
      type:   'kpi-strip',
      layout: { position: 'flow', order: 2, span: 'full' },
      data: {
        type:       'row-list',
        href:       GDP_API,        // ← was: storeId: 'gdp'
        transform:  'fromSDMX',
        indicators: ['B1G', 'P3', 'P51G'],
      },
    },

    {
      type:   'section',
      layout: { position: 'flow', order: 3, span: 'full' },
      data: {
        type:      'timeseries',
        href:      GDP_API,         // same endpoint, different query type
        transform: 'fromSDMX',
        indicator: 'B1G',
        dims: {
          geo:  { $ctx: 'geo' },
          time: { $ctx: 'time' },
        },
      },
      view: {
        subtitle:   { op: 'template', tmpl: 'მლნ ₾ · {time} · SNA 2008' },
        exportable: true,
      },
      children: [
        { type: 'chart', layout: { role: 'chart' } },
        { type: 'table', layout: { role: 'table' } },
      ],
    },

    {
      type:        'section',
      layout:      { position: 'flow', order: 4, span: 'full' },
      visibleWhen: { op: 'eq', left: { $ctx: 'mode' }, right: 'year' },
      data: {
        type:      'pivot',
        href:      GDP_API,
        transform: 'fromSDMX',
        indicator: 'B1G',
        rows:      'time',
        cols:      'sector',
        dims:      { geo: { $ctx: 'geo' } },
      },
      children: [
        { type: 'chart', layout: { role: 'chart' } },
        { type: 'table', layout: { role: 'table' } },
      ],
    },
  ],
}
// renderers · shells · children · dims · visibleWhen — zero changes.
// Only data source identity (storeId → href) changes between Phase 1 and Phase 2.
```
