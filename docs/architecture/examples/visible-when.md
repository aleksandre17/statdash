# visible-when.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — visibleWhen: ExprVal on NodeDef
 *
 * Demonstrates:
 * - visibleWhen on any NodeBase — conditional rendering
 * - Engine evaluates visibleWhen BEFORE rendering the node
 * - Uses full ExprVal: eq, and, or, not, $ctx, $derived
 * - Parent is blind — engine handles visibility, shell never sees hidden nodes
 * - Phase 2 compatible — ExprVal is JSON-serializable
 */

import type { InnerPageNode, SectionNode, ExprVal } from '@geostat/react'

// ── Basic: show section only when a specific year is selected ─────────────

export const GDP_PAGE_WITH_CONDITIONAL: InnerPageNode = {
  id:       'gdp',
  type:     'inner-page',
  title:    'მთლიანი შიდა პროდუქტი',
  storeKey: 'gdp',
  color:    '#0080BE',

  children: [
    { type: 'filter-bar', layout: { position: 'sticky-top' }, bars: [] },
    { type: 'kpi-strip',  layout: { position: 'flow' } },

    // Always visible
    {
      type: 'section',
      data: { type: 'timeseries', indicator: 'B1G' },
      children: [
        { type: 'chart', layout: { role: 'chart' } },
        { type: 'table', layout: { role: 'table' } },
      ],
    },

    // Only visible in 'year' mode — range mode hides this section
    {
      type: 'section',
      visibleWhen: { op: 'eq', left: { $ctx: 'timeMode' }, right: 'year' },
      data: { type: 'row-list', indicators: ['P3', 'P51G', 'B8G'] },
      children: [
        { type: 'chart', layout: { role: 'chart' } },
      ],
    },

    // Only visible in 'range' mode
    {
      type: 'section',
      visibleWhen: { op: 'eq', left: { $ctx: 'timeMode' }, right: 'range' },
      data: { type: 'growth', indicator: 'B1G', base: 'period' },
      children: [
        { type: 'chart', layout: { role: 'chart' } },
        { type: 'table', layout: { role: 'table' } },
      ],
    },
  ],
}

// Engine during renderNode():
//   visibleWhen = evalExpr(node.visibleWhen, scope)
//   if (!visibleWhen) → skip this node entirely (not in children.rendered)
//   parent shell never receives the hidden node


// ── Compound condition: multiple dims ─────────────────────────────────────

const visibleOnlyForTbilisi: ExprVal = {
  op: 'and',
  exprs: [
    { op: 'eq', left: { $ctx: 'geo' }, right: 'GE-TB' },
    { op: 'eq', left: { $ctx: 'timeMode' }, right: 'year' },
  ],
}

const tbilisiSection: SectionNode = {
  type:        'section',
  visibleWhen: visibleOnlyForTbilisi,
  data:        { type: 'query', indicator: 'B1G' },
  children: [
    { type: 'chart', layout: { role: 'chart' } },
  ],
}


// ── Using $derived — from DeriveMap ──────────────────────────────────────
// DeriveMap on the page derives 'isYearMode'.
// Sections reference it via $derived.

export const PAGE_WITH_DERIVE: InnerPageNode = {
  id:       'accounts',
  type:     'inner-page',
  title:    'ეროვნული ანგარიშები',
  storeKey: 'accounts',

  // Node-level derive (engine evalDerived — DeriveEntry, not just ExprVal)
  derive: {
    isYearMode: { op: 'eq', left: { $ctx: 'timeMode' }, right: 'year' },
    hasRegion:  { op: 'ne', left: { $ctx: 'geo' },      right: 'GE' },
  },

  children: [
    { type: 'filter-bar', layout: { position: 'sticky-top' }, bars: [] },

    // $derived references isYearMode — computed above
    {
      type:        'section',
      visibleWhen: { $derived: 'isYearMode' },   // true when timeMode = 'year'
      data:        { type: 'row-list', indicators: ['B1G', 'D1', 'P51G'] },
      children:    [{ type: 'kpi-strip', layout: { role: 'panel' } }],
    },

    // Visible only for sub-regions (not national GE)
    {
      type:        'section',
      visibleWhen: { $derived: 'hasRegion' },
      data:        { type: 'query', indicator: 'B1G' },
      children: [
        { type: 'chart', layout: { role: 'chart' } },
        { type: 'table', layout: { role: 'table' } },
      ],
    },
  ],
}


// ── Filter-level visibleWhen: hiding an individual filter ─────────────────
// ParamDef also supports visibleWhen — hides a filter widget based on state.

import type { FilterSchemaInput } from '@geostat/react'
import { defineFilters }          from '@geostat/react'

const schema = defineFilters({
  bars: {
    main: {
      position: 'sticky',
      filters: {
        time: {
          type:         'year-select',
          years:        { type: 'inline', items: { $cl: 'time' }, field: 'code' },
          defaultValue: { from: 'options', pick: 'last' },
        },
        timeFrom: {
          type:         'year-select',
          years:        { type: 'inline', items: { $cl: 'time' }, field: 'code' },
          defaultValue: { from: 'options', pick: 'first' },
          visibleWhen:  { op: 'eq', left: { $ctx: 'timeMode' }, right: 'range' },
          // hidden when timeMode = 'year' — no point showing range start in year mode
        },
        timeTo: {
          type:         'year-select',
          years:        { type: 'inline', items: { $cl: 'time' }, field: 'code' },
          defaultValue: { from: 'options', pick: 'last' },
          visibleWhen:  { op: 'eq', left: { $ctx: 'timeMode' }, right: 'range' },
        },
        geo: {
          type:         'select',
          options:      { type: 'static', items: [
            { value: 'GE',    label: 'საქართველო' },
            { value: 'GE-TB', label: 'თბილისი'    },
            { value: 'GE-KA', label: 'კახეთი'     },
            { value: 'GE-AJ', label: 'აჭარა'      },
          ]},
          defaultValue: 'GE',
        },
      },
    },
  },
})

// timeFrom and timeTo: hidden in year mode, visible in range mode
// Shell reads FilterBarSpec[].filters[i].hidden — rendered conditionally
// Parent blind: FilterBarShell reads layout/visible flags, not filter type


// ── Engine evaluation order ───────────────────────────────────────────────
//
// renderNode(node, ctx):
//   1. evalDerived(node.derive, scope)      → adds to scope.derived
//   2. evalExpr(node.visibleWhen, scope)    → false → return null (skip)
//   3. interpretSpec(node.data, ctx, store) → DataRow[]
//   4. resolve node.view fields             → ViewHints
//   5. render children (recursive)
//   6. call renderer(node, enrichedCtx, children)
//
// visibleWhen = false → node entirely absent from children.rendered[]
// Parent shell index remains contiguous — no gaps, no nulls


// ── Phase 2 compatibility ─────────────────────────────────────────────────
// visibleWhen: ExprVal — fully JSON-serializable ✅
// Constructor stores in DB:
//   { "op": "eq", "left": { "$ctx": "timeMode" }, "right": "year" }
// Constructor edits it via expression builder UI — no code change needed ✅
```
