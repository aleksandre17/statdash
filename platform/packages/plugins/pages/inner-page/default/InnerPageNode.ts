import type { NodeBase, NodeDef, SlotDef } from '@statdash/react/engine'

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
    accepts: ['filter-bar', 'perspective-bar'],
    multi:   false,
  },
  main: {
    field:   'children',
    label:   { ka: 'შიგთავსი', en: 'Content' },
    // De-privilege `section` (ADR-042 D3, FF-NO-PRIVILEGED-CONTAINER): the page content
    // region admits ANY `flow` block/layout DIRECTLY (grid/columns/stack/chart/…) — you can
    // start with a layout, not be force-wrapped in a section. `section`/`repeat`/`page-header`
    // stay in the identity list (section carries no `flow` cap); `accepts ∪ acceptsCaps` is a
    // disjunction (slotAdmits). Section is now one option among many, never the forced wrapper.
    accepts:     ['section', 'repeat', 'page-header'],
    acceptsCaps: ['flow'],
    multi:       true,
  },
}

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'inner-page': InnerPageNode }
}