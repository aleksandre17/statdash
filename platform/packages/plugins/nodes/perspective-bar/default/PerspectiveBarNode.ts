import type { NodeBase, PropSchema } from '@statdash/react/engine'

// ── PerspectiveBarNode — the perspective-axis toggle (VISION #3 / P5.2 (1)) ────
//
//  The canonical replacement for `mode-bar`. It renders ONE page perspective axis
//  as a tab toggle. Options DERIVE from the page's parsed `PerspectiveAxis`
//  (id + PerspectiveDef.label + PerspectiveDef.icon) — the axis OWNS its toggle
//  presentation (decision B). `key?` selects WHICH axis param (default: the page's
//  conventional perspective param); a click writes that URL param.
//
//  No `modes` field (mode-bar's authored id list): the options come from the axis,
//  not a redundant inline list. SiteRenderer feeds the parsed axis into the
//  RenderContext `mode` triad (id/label/icon from the axis), which this node reads —
//  the `mode` triad field is renamed to `perspective` in P6.
export interface PerspectiveBarNode extends NodeBase {
  type: 'perspective-bar'
  /** URL param of the axis this toggle switches (default: the page perspective param). */
  key?: string
}

export const PerspectiveBarSchema: PropSchema = [
  { field: 'key', type: 'string', label: 'Axis Param Key' },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'perspective-bar': PerspectiveBarNode }
}
