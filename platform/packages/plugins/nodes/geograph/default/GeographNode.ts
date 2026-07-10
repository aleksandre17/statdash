import type { NodeBase, NodeDef, ViewParams, PropertyGroup, SlotDef } from '@statdash/react/engine'
import type { DataSpec, LocaleString }                                 from '@statdash/engine'
import { defineSchema, type AssertSchemaCovers, type Expect } from '../../../schema-contract'

export interface GeographNode extends NodeBase {
  type:             'geograph'
  id:               string
  /** Panel title — LocaleString (plain or { ka, en }); resolved by the shell. */
  title:            LocaleString
  /** Optional secondary label — LocaleString; resolved by the shell. */
  label?:           LocaleString
  anchor?:          string
  color?:           string
  data?:            DataSpec
  children?:        NodeDef[]
  view?:            ViewParams
  geoJsonUrl:       string
  paramKey:         string
  isoField:         string
  /** ISO feature code → store geo dim value (a DATA binding, never user-facing prose). */
  geoCodeMap:       Record<string, string>
  /**
   * ISO feature code → tooltip label for regions with NO data row (e.g. occupied
   * territory). User-facing content — each override is a LocaleString, resolved to the
   * active locale by the shell before it reaches the (locale-agnostic) GeoMap.
   */
  labelOverrides?:  Record<string, LocaleString>
  /** ISO codes of occupied territories — painted the semantic occupied red (config-declared,
   *  agnostic: the engine never hardcodes which regions are occupied). */
  occupiedIso?:     string[]
  /** Unit suffix for region tooltips — tenant content (the measure's unit). LocaleString. */
  unit?:            LocaleString
  /**
   * Vestigial map-viewport hints (Leaflet era). The declarative SVG choropleth fits
   * its viewBox from the geojson data, so these are accepted for config-contract
   * stability but no longer affect the render.
   */
  initialCenter?:   [number, number]
  initialZoom?:     number
  multiSelect?:     boolean
  maxSelect?:       number
}

export const GeographSchema = defineSchema([
  { field: 'title',       type: 'string',  label: { ka: 'სათაური',          en: 'Title' }, required: true },
  // Content props (label/color/anchor) — previously referenced by GeographGroups
  // but ABSENT from the schema (dead group fields → nothing rendered). Added here
  // (root-cause, Wave 8 tier b) so the panel authors them, mirroring SectionSchema.
  { field: 'label',       type: 'string',  label: { ka: 'წარწერა',           en: 'Label' } },
  { field: 'color',       type: 'color',   label: { ka: 'ფერი',             en: 'Colour' } },
  { field: 'anchor',      type: 'string',  label: { ka: 'მიმაგრების ID',      en: 'Anchor ID' } },
  { field: 'geoJsonUrl',  type: 'string',  label: { ka: 'GeoJSON URL',       en: 'GeoJSON URL' }, required: true },
  { field: 'paramKey',    type: 'string',  label: { ka: 'პარამეტრის გასაღები', en: 'Param key' }, required: true },
  { field: 'isoField',    type: 'string',  label: { ka: 'ISO ველი',          en: 'ISO field' }, required: true },
  { field: 'geoCodeMap',  type: 'object',  label: { ka: 'გეო-კოდების რუკა',    en: 'Geo code map' }, required: true },
  { field: 'unit',        type: 'string',  label: { ka: 'ერთეული',           en: 'Unit' } },
  { field: 'multiSelect', type: 'boolean', label: { ka: 'მრავლობითი არჩევა',   en: 'Multiple select' } },
  { field: 'maxSelect',   type: 'number',  label: { ka: 'მაქს. არჩევანი',      en: 'Max select' }, default: 2 },
])

// FF-SCHEMA-COMPLETE (tier b): 1:1 with editable keys (id/data/view/children
// excluded as system/slot). Documented deferrals (SCHEMA_TODO):
//   labelOverrides — Record<iso, LocaleString>: nested per-region tooltip overrides,
//                    awaiting the tier-c itemSchema seam (opaque object today).
//   occupiedIso    — string[]: nested list of occupied-territory ISO codes (tier c).
//   initialCenter / initialZoom — VESTIGIAL (Leaflet-era viewport hints; the
//                    declarative SVG choropleth ignores them) → intentionally NOT
//                    authorable.
export type _GeographCovers = Expect<AssertSchemaCovers<
  GeographNode,
  typeof GeographSchema,
  'labelOverrides' | 'occupiedIso' | 'initialCenter' | 'initialZoom'
>>

export const GeographSlots: Record<string, SlotDef> = {
  children: {
    field:   'children',
    label:   { ka: 'ცხრილი', en: 'Table' },
    accepts: ['table'],
    multi:   false,
    max:     1,
  },
}

export const GeographGroups: PropertyGroup[] = [
  { label: { ka: 'შიგთავსი',   en: 'Content'  }, fields: ['title', 'label', 'color', 'anchor'] },
  { label: { ka: 'კარტოგრაფია', en: 'Map'      }, fields: ['geoJsonUrl', 'paramKey', 'isoField', 'unit', 'multiSelect', 'maxSelect'] },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'geograph': GeographNode }
}
