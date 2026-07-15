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

// The AUTHOR plane sees a friendly `columns` + `gap` abstraction (+ alignment). The
// raw CSS-Grid track syntax (templateColumns/Rows/Areas, auto-flow/cols/rows) is a
// legitimate but ADVANCED capability — projected to the STEWARD lens (root Law 11 ·
// AR-52 "no plumbing tokens on the author plane"), never a raw `var()`/`repeat()`
// string on the compose surface. Not `system`: it stays authorable behind the
// author⇄steward toggle, not un-authorable forever. Every grid field is `layout`
// concern (the REFINE canon — content·data·style·layout·behavior).
// The three TEMPLATE props + `columns` are RESPONSIVE-capable (the render layer already
// lowers each `ResponsiveVal` to the per-breakpoint container-query cascade — resolveGrid
// → layout.css `@container`). The `responsive` flag opts them into the inspector's
// per-breakpoint authoring MODE (Builder.io/Framer); the affordance is projected
// generically by the ONE value-authoring control — zero per-type wiring (Law 8).
export const GridSchema = defineSchema([
  { field: 'columns',         type: 'number', label: { ka: 'სვეტები', en: 'Columns' }, concern: 'layout', responsive: true },
  { field: 'gap',             type: 'string', label: { ka: 'დაშორება', en: 'Gap' }, default: 'var(--spacing-md)', concern: 'layout' },
  { field: 'align',   type: 'string', label: { ka: 'გასწორება',       en: 'Align' },   default: 'stretch', options: ALIGN_OPTIONS, concern: 'layout' },
  { field: 'justify', type: 'string', label: { ka: 'ჰორ. გასწორება', en: 'Justify' }, default: 'stretch', options: ALIGN_OPTIONS, concern: 'layout' },
  { field: 'templateColumns', type: 'string', label: { ka: 'სვეტების შაბლონი', en: 'Template columns' }, default: 'repeat(auto-fit, minmax(min(100%, 24rem), 1fr))', plane: 'steward', concern: 'layout', responsive: true },
  { field: 'templateRows',    type: 'string', label: { ka: 'რიგების შაბლონი',  en: 'Template rows' }, plane: 'steward', concern: 'layout', responsive: true },
  { field: 'templateAreas',   type: 'string', label: { ka: 'არეების შაბლონი',  en: 'Template areas' }, plane: 'steward', concern: 'layout', responsive: true },
  {
    field: 'autoFlow', type: 'string', label: { ka: 'ავტო-დინება', en: 'Auto flow' }, default: 'row', plane: 'steward', concern: 'layout',
    options: [
      { value: 'row',          label: { ka: 'რიგი',        en: 'Row' } },
      { value: 'column',       label: { ka: 'სვეტი',       en: 'Column' } },
      { value: 'dense',        label: { ka: 'მკვრივი',     en: 'Dense' } },
      { value: 'row dense',    label: { ka: 'რიგი მკვრივი', en: 'Row dense' } },
      { value: 'column dense', label: { ka: 'სვეტი მკვრივი', en: 'Column dense' } },
    ],
  },
  { field: 'autoColumns', type: 'string', label: { ka: 'ავტო-სვეტები', en: 'Auto columns' }, plane: 'steward', concern: 'layout' },
  { field: 'autoRows',    type: 'string', label: { ka: 'ავტო-რიგები',  en: 'Auto rows' }, plane: 'steward', concern: 'layout' },
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
