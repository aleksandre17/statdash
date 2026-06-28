// ── applyPanelStyles ──────────────────────────────────────────────────
//
//  Panel-col wrapper — combines the shorthand width class with NodeStyles height.
//  view.width is a layout shorthand ('full' | 'half' | 'third'), not raw CSS,
//  so it is kept separate from NodeStyles and resolved to panel-col modifier classes.
//  Height → data-height attribute (same CSS contract as applyNodeStyles).
//

import { resolveResponsive }                        from '../resolve'
import type { NodeStyles, StyleAttrs, ResolvedResponsive, StyleValue } from '../types'

function heightAttrs(
  resolved: ResolvedResponsive<StyleValue>,
  base:     string,
): StyleAttrs {
  const h = resolved.default
  if (typeof h === 'string') return { className: base, 'data-height': h }
  if (typeof h === 'number') return { className: base, 'data-height': 'constrained', style: { height: `${h}px` } }
  return { className: base }
}

export function applyPanelStyles(config: {
  width?:  'full' | 'half' | 'third'
  styles?: NodeStyles
}): StyleAttrs {
  const { width, styles } = config
  const heightRes = heightAttrs(resolveResponsive(styles?.height), 'panel-col')
  let cls = 'panel-col'
  if (width) cls += ` panel-col--w-${width}`
  return {
    className: cls,
    ...(heightRes['data-height'] && { 'data-height': heightRes['data-height'] }),
    ...(heightRes.style          && { style: heightRes.style }),
  }
}