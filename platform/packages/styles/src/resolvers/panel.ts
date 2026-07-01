// ── applyPanelStyles ──────────────────────────────────────────────────
//
//  Panel-col wrapper — width/placement only.
//  view.width is a layout shorthand ('full' | 'half' | 'third'), not raw CSS,
//  so it is resolved to panel-col modifier classes.
//  Height belongs on the body (.panel__body via bodyProps), not the wrapper.
//

import type { StyleAttrs } from '../types'

export function applyPanelStyles(config: {
  width?:  'full' | 'half' | 'third'
}): StyleAttrs {
  const { width } = config
  let cls = 'panel-col'
  if (width) cls += ` panel-col--w-${width}`
  return { className: cls }
}
