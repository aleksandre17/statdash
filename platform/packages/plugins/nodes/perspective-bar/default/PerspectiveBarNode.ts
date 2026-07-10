import type { NodeBase } from '@statdash/react/engine'
import { defineSchema, type AssertSchemaCovers, type Expect } from '../../../schema-contract'

// ── PerspectiveBarNode — the perspective-axis toggle (VISION #3) ──────────────
//
//  Renders ONE page perspective axis as a tab toggle. Options DERIVE from the page's
//  parsed `PerspectiveAxis` (id + PerspectiveDef.label + PerspectiveDef.icon) — the
//  axis OWNS its toggle presentation (decision B). `key?` selects WHICH axis param
//  (default: the page's conventional perspective param); a click writes that URL param.
//
//  No inline options list: SiteRenderer feeds the parsed axis into the RenderContext
//  `perspective` triad (id/label/icon from the axis), which this node reads.
export interface PerspectiveBarNode extends NodeBase {
  type: 'perspective-bar'
  /** URL param of the axis this toggle switches (default: the page perspective param). */
  key?: string
}

export const PerspectiveBarSchema = defineSchema([
  { field: 'key', type: 'string', label: { ka: 'ღერძის პარამეტრის გასაღები', en: 'Axis Param Key' } },
])

// FF-SCHEMA-COMPLETE (tier b): 1:1 with editable keys.
export type _PerspectiveBarCovers = Expect<AssertSchemaCovers<PerspectiveBarNode, typeof PerspectiveBarSchema>>

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'perspective-bar': PerspectiveBarNode }
}
