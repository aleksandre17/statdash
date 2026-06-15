import type { NodeBase, NodeDef, ViewParams, PropertyGroup, SlotDef, PropSchema } from '@geostat/react/engine'
import type { DataSpec }                                               from '@geostat/engine'

export interface SectionNode extends NodeBase {
  type:          'section'
  id:            string
  title:         string
  label?:        string
  anchor?:       string
  color?:        string
  data?:         DataSpec
  children:      NodeDef[]
  view?:         ViewParams
  prependLabel?: string
}

export const SectionSchema: PropSchema = [
  { field: 'title',        type: 'string', label: 'სათაური',    required: true },
  { field: 'label',        type: 'string', label: 'ლეიბლი' },
  { field: 'color',        type: 'color',  label: 'ფერი' },
  { field: 'anchor',       type: 'string', label: 'Anchor ID' },
  { field: 'prependLabel', type: 'string', label: 'Drill Label' },
]

export const SectionDefaults: Partial<SectionNode> = {
  view: { toggle: true, defaultOpen: true },
}

export const SectionSlots: Record<string, SlotDef> = {
  children: {
    field:   'children',
    label:   { ka: 'შიგთავსი', en: 'Content' },
    accepts: ['chart', 'table', 'kpi-strip', 'row', 'wrap', 'georgraph'],
    multi:   true,
  },
}

export const SectionGroups: PropertyGroup[] = [
  { label: { ka: 'შიგთავსი',   en: 'Content'  }, fields: ['title', 'label', 'color', 'prependLabel'] },
  { label: { ka: 'ქცევა',      en: 'Behaviour' }, fields: ['view.toggle', 'view.defaultOpen', 'view.noCollapse', 'view.hero'] },
  { label: { ka: 'განლაგება',  en: 'Layout'    }, fields: ['view.width', 'view.compact', 'anchor'] },
]

declare module '@geostat/react/engine' {
  interface NodeTypeMap { 'section': SectionNode }
}