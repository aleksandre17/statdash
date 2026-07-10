import type { NodeSliceMeta, PropertyGroup } from '@statdash/react/engine'
import type { FilterBarNode } from './FilterBarNode'
import { defineSchema, type AssertSchemaCovers, type Expect } from '../../../schema-contract'

// ── FilterBarSchema — the inspector-editable props of a filter-bar node ──
//
//  A filter-bar is a placeholder that renders the bars declared in the page's
//  filterSchema (Grafana: the variable-controls panel is separate from the
//  variable list). Its only authored prop is `barIds` — which named bars to
//  render. Absent ⇒ render all bars. This is an array of bar-id strings.
//
export const FilterBarSchema = defineSchema([
  {
    field: 'barIds',
    type:  'array',
    label: { ka: 'საჩვენებელი ბარები', en: 'Bars to show' },
  },
])

// FF-SCHEMA-COMPLETE (tier b): 1:1 with FilterBarNode's editable keys. `barIds`
// (string[]) is covered top-level as an opaque array; the bar-id picker is the
// tier-c backlog.
export type _FilterBarCovers = Expect<AssertSchemaCovers<FilterBarNode, typeof FilterBarSchema>>

export const FilterBarGroups: PropertyGroup[] = [
  { label: { ka: 'ფილტრები', en: 'Filters' }, fields: ['barIds'] },
]

// ── from→to span connector words (per-slice i18n CATALOG) ──────────────────────
//
//  A pair of adjacent select params tagged `spanRole:'from'|'to'` (the dynamics
//  year window: fromYear/toYear) renders as ONE localized template instead of two
//  bare dropdowns — the filter-bar wraps each endpoint select with a lead + trail
//  connector word so ONE grammar renders both reading conventions:
//    ka (postposition): [from-select] დან [to-select] მდე
//    en (preposition):  from [x] to [y]
//  Positional slots per endpoint (empty renders nothing — the shell guards on a
//  non-empty string):
//    from → lead='' / trail='დან'   (ka)  ·  lead='from' / trail='' (en)
//    to   → lead='' / trail='მდე'   (ka)  ·  lead='to'   / trail='' (en)
//
//  Catalog-class bilingual content lives in meta.ts — the tenant-content /
//  authoring-locale gates (INV1) scan the provisioning ARTIFACT, never slice meta,
//  so the empty ka-lead / en-trail slots are legal here (the same home the range
//  control's rangeI18n uses). This is why the words are NOT provisioning `suffix`:
//  a single suffix slot cannot render both conventions AND stay non-empty per locale.
export const spanI18n = {
  ka: {
    'span-from-lead': '', 'span-from-trail': 'დან',
    'span-to-lead':   '', 'span-to-trail':   'მდე',
  },
  en: {
    'span-from-lead': 'from', 'span-from-trail': '',
    'span-to-lead':   'to',   'span-to-trail':   '',
  },
} as const

export const META: NodeSliceMeta = {
  sliceType: 'node',
  type:      'filter-bar',
  variant:   'default',
  label:     { ka: 'ფილტრების პანელი', en: 'Filter Bar' },
  icon:      'sliders',
  category:  'layout',
  schema:    FilterBarSchema,
  groups:    FilterBarGroups,
  caps:      [],
  version:   1,
  // Registered under the 'filter-bar' namespace (registerSlice → useT('filter-bar')),
  // so FilterBarShell resolves the from→to connector words for the active locale.
  i18n:      spanI18n,
}
