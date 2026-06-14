// ── applyNodeStyles / applyViewStyles ─────────────────────────────────
//
//  Universal: NodeStyles → StyleAttrs (className + style + data-*)
//
//  Data-attribute contract:
//    data-height = '16:9' | '4:3' | ... | 'constrained'
//      → fixed height token; node-styles.css handles children
//    data-aspect = '' (presence flag)
//      → responsive aspect-ratio; node-styles.css reads --ar-* CSS vars
//    data-view   = 'hidden' | 'visible'
//      → visibility; from resolveViewState (see view.ts)
//
//  CSS custom properties emitted as inline style:
//    --ar-default, --ar-md, --ar-sm → read by [data-aspect] in node-styles.css
//
//  Shell contract: spread vs.body directly — no inspection, no if/switch.
//

import { resolveResponsive, parseStyleValue, isAspectRatio } from '../resolve'
import type {
  NodeStyles, StyleAttrs, BodyStyleAttrs,
  ResponsiveVal, StyleValue, ResolvedResponsive,
} from '../types'
import { applyPanelStyles }           from './panel'

// ── Internal helpers ──────────────────────────────────────────────────

function heightAttrs(
  resolved: ResolvedResponsive<StyleValue>,
  base:     string,
): StyleAttrs {
  const h = resolved.default
  if (isAspectRatio(h as StyleValue))
    return { className: base, 'data-height': h as string }
  if (typeof h === 'number' || (typeof h === 'string' && h))
    return { className: base, 'data-height': 'constrained', style: { height: parseStyleValue(h as StyleValue) } }
  return { className: base }
}

function dimensionStyle(val?: ResponsiveVal<StyleValue>): string | undefined {
  const v = resolveResponsive(val).default
  if (v === undefined) return undefined
  return parseStyleValue(v)
}

// ── applyNodeStyles ───────────────────────────────────────────────────
//
//  Translates NodeStyles into { className, style?, data-* }.
//  base = BEM block or element class (e.g. 'section__body').
//  Everything is computed here — shells spread and never inspect.
//
export function applyNodeStyles(
  styles?: NodeStyles,
  base    = '',
): StyleAttrs {
  const attrs = heightAttrs(resolveResponsive(styles?.height), base)
  const extra: Record<string, string> = {}

  const w   = dimensionStyle(styles?.width)
  const mnh = dimensionStyle(styles?.minHeight)
  const mxh = dimensionStyle(styles?.maxHeight)
  const p   = resolveResponsive(styles?.padding).default
  const m   = resolveResponsive(styles?.margin).default
  const gp  = resolveResponsive(styles?.gap).default
  const ov  = resolveResponsive(styles?.overflow).default
  const op  = resolveResponsive(styles?.opacity).default

  if (w)               extra.width      = w
  if (mnh)             extra.minHeight  = mnh
  if (mxh)             extra.maxHeight  = mxh
  if (p)               extra.padding    = p
  if (m)               extra.margin     = m
  if (gp)              extra.gap        = gp
  if (ov)              extra.overflow   = ov
  if (op !== undefined) extra.opacity   = String(op)
  if (styles?.transition) extra.transition = styles.transition

  // aspectRatio → data-aspect presence flag + --ar-* CSS vars.
  // node-styles.css handles all responsive behavior via [data-aspect].
  const ar = resolveResponsive(styles?.aspectRatio)
  const dataAspect: Record<string, string> = {}
  if (ar.default !== undefined || ar.md !== undefined || ar.sm !== undefined) {
    dataAspect['data-aspect'] = ''
    if (ar.default) extra['--ar-default'] = ar.default
    if (ar.md)      extra['--ar-md']      = ar.md
    if (ar.sm)      extra['--ar-sm']      = ar.sm
  }

  const style = Object.keys(extra).length
    ? { ...attrs.style, ...extra }
    : attrs.style

  return { ...attrs, ...dataAspect, ...(style && { style }) }
}

// ── applyViewStyles ───────────────────────────────────────────────────
//
//  Single entry point for every visible content shell.
//  Shell passes def.view (opaque) → gets panel + body attr objects to spread.
//  Shell never inspects what styles are set — just spreads onto DOM.
//
//  panel = outer wrapper attrs (className includes panel-col + width modifiers)
//  body  = content-area attrs without className (shell merges its own BEM class)
//
export type { BodyStyleAttrs }

export function applyViewStyles(view?: {
  width?:  'full' | 'half' | 'third'
  styles?: NodeStyles
}): { panel: StyleAttrs; body: BodyStyleAttrs } {
  const panel                     = applyPanelStyles({ width: view?.width, styles: view?.styles })
  const { className: _c, ...body } = applyNodeStyles(view?.styles)
  return { panel, body }
}