import type { NodeBase, NodeDef, ViewParams, PropertyGroup, SlotDef } from '@geostat/react/engine'
import type { DataSpec }                                               from '@geostat/engine'

export interface GeorgraphNode extends NodeBase {
  type:             'georgraph'
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
  multiSelect?:     boolean
  maxSelect?:       number
}

export const GeorgraphSchema = {
  type: 'object',
  required: ['title', 'geoJsonUrl', 'paramKey', 'isoField', 'geoCodeMap'],
  properties: {
    title:      { type: 'string', title: 'სათაური' },
    geoJsonUrl: { type: 'string', title: 'GeoJSON URL' },
    paramKey:   { type: 'string', title: 'Param Key' },
    isoField:   { type: 'string', title: 'ISO Field' },
    multiSelect:{ type: 'boolean', title: 'Multiple Select' },
    maxSelect:  { type: 'number',  title: 'Max Select', default: 2 },
  },
} as const

export const GeorgraphSlots: Record<string, SlotDef> = {
  children: {
    field:   'children',
    label:   { ka: 'ცხრილი', en: 'Table' },
    accepts: ['table'],
    multi:   false,
    max:     1,
  },
}

export const GeorgraphGroups: PropertyGroup[] = [
  { label: { ka: 'შიგთავსი',   en: 'Content'  }, fields: ['title', 'label', 'color'] },
  { label: { ka: 'კარტოგრაფია', en: 'Map'      }, fields: ['geoJsonUrl', 'paramKey', 'isoField', 'multiSelect', 'maxSelect'] },
]

declare module '@geostat/react/engine' {
  interface NodeTypeMap { 'georgraph': GeorgraphNode }
}