// ── applyPanelStyles ──────────────────────────────────────────────────
//
//  Panel-col wrapper — placement + width ONLY. The wrapper's single
//  responsibility is where the panel sits in its row (the grid/flex cell)
//  and how wide it is; HEIGHT belongs to the panel body (applyNodeStyles →
//  data-height → the cqi-bounded band in node-styles.css), measured against
//  the panel's OWN container (.section). Emitting height here too would (a)
//  duplicate the body's authority and (b) resolve `cqi` against the row
//  container, not the panel, defeating per-column proportionality. So this
//  resolver no longer reads `styles.height`.
//
//  view.width is a layout shorthand ('full' | 'half' | 'third'), not raw CSS,
//  so it maps to panel-col modifier classes the panel grid reads.
//

import type { NodeStyles, StyleAttrs } from '../types'

export function applyPanelStyles(config: {
  width?:  'full' | 'half' | 'third'
  /** Accepted for call-site symmetry with applyNodeStyles; height is the body's
   *  concern, so nothing here is read from it today. */
  styles?: NodeStyles
}): StyleAttrs {
  const { width } = config
  let cls = 'panel-col'
  if (width) cls += ` panel-col--w-${width}`
  return { className: cls }
}
