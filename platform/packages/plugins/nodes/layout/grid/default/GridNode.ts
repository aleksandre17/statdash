import type { NodeBase, NodeDef, SlotDef, PropertyGroup } from '@statdash/react/engine'
import type { ResponsiveVal, LayoutAlign }                 from '@statdash/styles'
import { defineSchema, type AssertSchemaCovers, type Expect } from '../../../../schema-contract'

// grid-auto-flow vocabulary (the implicit-track placement algorithm).
export type GridAutoFlow = 'row' | 'column' | 'dense' | 'row dense' | 'column dense'

// ── grid — the MAXIMAL CSS-Grid grammar as a JSON layout node ──────────
//
//  Every prop is a ResponsiveVal so the arrangement is authorable PER
//  BREAKPOINT (Builder.io/Framer idiom), and the three TEMPLATE props are
//  container-query-driven (Every-Layout intrinsic grids). The renderer
//  (GridShell + resolveGrid) interprets this spec → CSS via the shared
//  var+flag engine. Config is pure data: no functions, no logic (Law 2).
//
//  Full CSS-Grid power exposed:
//    templateColumns/Rows — repeat(), minmax(), auto-fit/auto-fill, fr,
//                           min()/max()/clamp(), named lines, arbitrary track lists.
//    templateAreas        — named grid areas (rearrange per breakpoint).
//    autoFlow/autoColumns/autoRows — implicit-track placement + sizing.
//    columns              — numeric shorthand → repeat(N, minmax(0,1fr)).
//    gap · align (align-items) · justify (justify-items).
//  Per-child placement (colSpan/rowSpan/align/justify/order) rides the SAME
//  view.styles seam every layout container already honours (LayoutItemProvider).
export interface GridNode extends NodeBase {
  type:             'grid'
  /** Numeric shorthand → `repeat(N, minmax(0,1fr))`. templateColumns overrides it. */
  columns?:         ResponsiveVal<number>
  /** Full `grid-template-columns` track list. The core reflow axis. */
  templateColumns?: ResponsiveVal<string>
  templateRows?:    ResponsiveVal<string>
  /** Named-area map (`grid-template-areas`) — can rearrange per breakpoint. */
  templateAreas?:   ResponsiveVal<string>
  autoFlow?:        ResponsiveVal<GridAutoFlow>
  autoColumns?:     ResponsiveVal<string>
  autoRows?:        ResponsiveVal<string>
  gap?:             ResponsiveVal<string>
  /** Cross-axis (block) alignment of the cells. `stretch` (default) = equal-height. */
  align?:           ResponsiveVal<LayoutAlign>
  /** Inline-axis item alignment within each cell (`justify-items`). */
  justify?:         ResponsiveVal<LayoutAlign>
  children:         NodeDef[]
}

const ALIGN_OPTIONS = [
  { value: 'stretch', label: { ka: 'გაწელვა',   en: 'Stretch' } },
  { value: 'start',   label: { ka: 'დასაწყისი', en: 'Start' } },
  { value: 'center',  label: { ka: 'ცენტრი',    en: 'Center' } },
  { value: 'end',     label: { ka: 'დასასრული', en: 'End' } },
]

export const GridSchema = defineSchema([
  { field: 'templateColumns', type: 'string', label: { ka: 'სვეტების შაბლონი', en: 'Template columns' }, default: 'repeat(auto-fit, minmax(min(100%, 24rem), 1fr))' },
  { field: 'templateRows',    type: 'string', label: { ka: 'რიგების შაბლონი',  en: 'Template rows' } },
  { field: 'templateAreas',   type: 'string', label: { ka: 'არეების შაბლონი',  en: 'Template areas' } },
  { field: 'columns',         type: 'number', label: { ka: 'სვეტები',          en: 'Columns (shorthand)' } },
  { field: 'gap',             type: 'string', label: { ka: 'დაშორება',         en: 'Gap' }, default: 'var(--spacing-md)' },
  {
    field: 'autoFlow', type: 'string', label: { ka: 'ავტო-დინება', en: 'Auto flow' }, default: 'row',
    options: [
      { value: 'row',          label: { ka: 'რიგი',        en: 'Row' } },
      { value: 'column',       label: { ka: 'სვეტი',       en: 'Column' } },
      { value: 'dense',        label: { ka: 'მკვრივი',     en: 'Dense' } },
      { value: 'row dense',    label: { ka: 'რიგი მკვრივი', en: 'Row dense' } },
      { value: 'column dense', label: { ka: 'სვეტი მკვრივი', en: 'Column dense' } },
    ],
  },
  { field: 'autoColumns', type: 'string', label: { ka: 'ავტო-სვეტები', en: 'Auto columns' } },
  { field: 'autoRows',    type: 'string', label: { ka: 'ავტო-რიგები',  en: 'Auto rows' } },
  { field: 'align',   type: 'string', label: { ka: 'გასწორება',       en: 'Align' },   default: 'stretch', options: ALIGN_OPTIONS },
  { field: 'justify', type: 'string', label: { ka: 'ჰორ. გასწორება', en: 'Justify' }, default: 'stretch', options: ALIGN_OPTIONS },
])

// FF-SCHEMA-COMPLETE (tier b): 1:1 with the full CSS-Grid grammar (children slot excluded).
export type _GridCovers = Expect<AssertSchemaCovers<GridNode, typeof GridSchema>>

export const GridDefaults: Partial<GridNode> = {
  gap: 'var(--spacing-md)',
}

export const GridSlots: Record<string, SlotDef> = {
  children: {
    field: 'children',
    label: { ka: 'ელემენტები', en: 'Items' },
    multi: true,
  },
}

export const GridGroups: PropertyGroup[] = [
  { label: { ka: 'ბადე',      en: 'Grid' },      fields: ['templateColumns', 'templateRows', 'templateAreas', 'columns'] },
  { label: { ka: 'დინება',    en: 'Flow' },      fields: ['autoFlow', 'autoColumns', 'autoRows'] },
  { label: { ka: 'განლაგება', en: 'Alignment' }, fields: ['gap', 'align', 'justify'] },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'grid': GridNode }
}
