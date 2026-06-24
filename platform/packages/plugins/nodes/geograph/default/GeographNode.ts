import type { NodeBase, NodeDef, ViewParams, PropertyGroup, SlotDef, PropSchema } from '@statdash/react/engine'
import type { DataSpec }                                               from '@statdash/engine'

export interface GeographNode extends NodeBase {
  type:             'geograph'
  id:               string
  title:            string
  label?:           string
  anchor?:          string
  color?:           string
  data?:            DataSpec
  children?:        NodeDef[]
  view?:            ViewParams
  geoJsonUrl:       string
  paramKey:         string
  isoField:         string
  geoCodeMap:       Record<string, string>
  labelOverrides?:  Record<string, string>
  /** Unit suffix for region tooltips — tenant content (the measure's unit). */
  unit?:            string
  /** Initial map viewport before FitBounds reframes to the data extent. */
  initialCenter?:   [number, number]
  initialZoom?:     number
  multiSelect?:     boolean
  maxSelect?:       number
}

export const GeographSchema: PropSchema = [
  { field: 'title',       type: 'string',  label: 'სათაური',     required: true },
  { field: 'geoJsonUrl',  type: 'string',  label: 'GeoJSON URL',  required: true },
  { field: 'paramKey',    type: 'string',  label: 'Param Key',    required: true },
  { field: 'isoField',    type: 'string',  label: 'ISO Field',    required: true },
  { field: 'geoCodeMap',  type: 'object',  label: 'Geo Code Map', required: true },
  { field: 'unit',        type: 'string',  label: { ka: 'ერთეული', en: 'Unit' } },
  { field: 'multiSelect', type: 'boolean', label: 'Multiple Select' },
  { field: 'maxSelect',   type: 'number',  label: 'Max Select',   default: 2 },
]

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
  { label: { ka: 'შიგთავსი',   en: 'Content'  }, fields: ['title', 'label', 'color'] },
  { label: { ka: 'კარტოგრაფია', en: 'Map'      }, fields: ['geoJsonUrl', 'paramKey', 'isoField', 'unit', 'multiSelect', 'maxSelect'] },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'geograph': GeographNode }
}
