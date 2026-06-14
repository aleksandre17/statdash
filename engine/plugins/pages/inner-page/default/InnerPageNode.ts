import type { NodeBase, NodeDef, SlotDef } from '@geostat/react/engine'

export interface InnerPageNode extends NodeBase {
  type:     'inner-page'
  /** Inner layout variant — open string. Known: 'sidebar' | 'full-width' | 'centered'.
   *  New variant = CSS block in page-layout.css only. Zero shell changes (OCP). */
  pageLayout?: string
  children: NodeDef[]
}

export const InnerPageSlots: Record<string, SlotDef> = {
  sticky: {
    field:   'sticky',
    label:   { ka: 'Sticky ზოლი', en: 'Sticky Bar' },
    accepts: ['filter-bar', 'mode-bar'],
    multi:   false,
  },
  main: {
    field:   'children',
    label:   { ka: 'შიგთავსი', en: 'Content' },
    accepts: ['section', 'repeat', 'page-header'],
    multi:   true,
  },
}

declare module '@geostat/react/engine' {
  interface NodeTypeMap { 'inner-page': InnerPageNode }
}