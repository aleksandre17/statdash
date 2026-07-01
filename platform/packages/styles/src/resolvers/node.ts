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
//    --ar-default / --ar-2xl / --ar-xl / --ar-lg / --ar-md / --ar-sm / --ar-xs
//      → read by [data-aspect] in node-styles.css (6-point breakpoint cascade)
//
//  Per-breakpoint responsive props (setResponsive, Option A):
//    --<prop>-default / -2xl / -xl / -lg / -md / -sm / -xs  inline vars
//    + data-<prop>-responsive=""  presence flag (only when ≥1 per-bp value set)
//      → read by [data-<prop>-responsive] media-query cascade in node-styles.css.
//    The flat .default is ALSO emitted directly (style precedence) so a
//    non-responsive value works with no data-attr. Same mechanism as --ar-*.
//
//  Shell contract: spread vs.body directly — no inspection, no if/switch.
//

import {
  resolveResponsive, parseStyleValue, isAspectRatio,
  BREAKPOINT_KEYS, BREAKPOINT_KEYS_CASCADE, BREAKPOINT_KEYS_NON_DEFAULT,
} from '../resolve'
import type {
  NodeStyles, StyleAttrs, BodyStyleAttrs, PseudoStyles,
  ResponsiveVal, StyleValue, ResolvedResponsive,
} from '../types'
import { applyPanelStyles }           from './panel'

// Per-breakpoint cascade keys (default-first, large → small) — the emission
// order must match the CSS max-width cascade so a smaller breakpoint's rule
// wins. The non-default keys drive the data-<prop>-responsive presence flag +
// the --<prop>-<bp> vars node-styles.css reads. SSOT in resolve.ts.
const BP_KEYS = BREAKPOINT_KEYS_CASCADE
const BP_NON_DEFAULT = BREAKPOINT_KEYS_NON_DEFAULT

// camelCase → kebab-case for the data-<prop>-responsive flag (backgroundColor →
// background-color). The --<prop>-<bp> vars keep the camelCase stem (CSS custom
// property names are case-sensitive and match what node-styles.css reads).
function kebab(s: string): string {
  return s.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)
}

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

// Pseudo-state flattener (D2 / Option A).
// Emits --on-<state>-<prop> custom properties for every set property and
// returns whether the state had any property (→ caller sets data-<state>).
// CSS string keys map to the kebab var names node-styles.css reads.
const PSEUDO_VAR: Record<keyof PseudoStyles, string> = {
  color:           'color',
  backgroundColor: 'bg',
  borderColor:     'border-color',
  boxShadow:       'shadow',
  opacity:         'opacity',
  transform:       'transform',
}

function applyPseudo(
  state:  'hover' | 'focus' | 'active',
  pseudo: PseudoStyles | undefined,
  extra:  Record<string, string>,
): boolean {
  if (!pseudo) return false
  let any = false
  for (const key of Object.keys(pseudo) as (keyof PseudoStyles)[]) {
    const v = pseudo[key]
    if (v === undefined) continue
    extra[`--on-${state}-${PSEUDO_VAR[key]}`] = String(v)
    any = true
  }
  return any
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

  // ── Sizing ───────────────────────────────────────────────────────
  const set = (prop: string, v: string | undefined) => { if (v !== undefined && v !== '') extra[prop] = v }

  // setResponsive — Option A delivery for a per-breakpoint property.
  //   prop    : the camelCase style key, also the CSS-var stem (--<prop>-<bp>)
  //             and the data-<kebab>-responsive flag stem.
  //   raw     : the raw ResponsiveVal off NodeStyles (flat OR per-bp object).
  //   parse   : 'value' → run parseStyleValue (number → px, fluid → clamp);
  //             'plain' → String() as-is (enums / unitless numbers).
  //
  // Two MUTUALLY EXCLUSIVE delivery routes — chosen by whether any NON-default
  // breakpoint is set — because inline `style` always beats a stylesheet rule:
  //   • Flat-only (no per-bp overrides) → emit the value inline via set().
  //     Cheapest path, no data-attr, identical to the old behavior.
  //   • Responsive (≥1 per-bp override) → emit NOTHING inline for the property
  //     itself; emit --<prop>-<bp> vars (INCLUDING --<prop>-default) + the
  //     data-<kebab>-responsive flag. node-styles.css applies the property from
  //     those vars. If we ALSO wrote the property inline, inline specificity
  //     would shadow every media-query override (the exact bug --ar-* avoids:
  //     aspectRatio never writes an inline aspect-ratio).
  const dataResponsiveFlags: Record<string, string> = {}
  const toCss = (v: unknown, parse: 'value' | 'plain'): string | undefined => {
    if (v === undefined || v === '') return undefined
    return parse === 'value' ? parseStyleValue(v as StyleValue) : String(v)
  }
  const setResponsive = (
    prop:  string,
    raw:   ResponsiveVal<StyleValue> | ResponsiveVal<string | number> | undefined,
    parse: 'value' | 'plain' = 'plain',
  ) => {
    const r = resolveResponsive(raw as ResponsiveVal<StyleValue>)
    if (!BP_NON_DEFAULT.some(k => r[k] !== undefined)) {
      // Flat-only → inline value, no data-attr (precedence path, as before).
      set(prop, toCss(r.default, parse))
      return
    }
    // Responsive → route the WHOLE property through vars + the cascade rule.
    for (const k of BP_KEYS) {
      const css = toCss(r[k], parse)
      if (css !== undefined) extra[`--${prop}-${k}`] = css
    }
    dataResponsiveFlags[`data-${kebab(prop)}-responsive`] = ''
  }

  setResponsive('width',     styles?.width,     'value')
  setResponsive('minHeight', styles?.minHeight, 'value')
  setResponsive('maxHeight', styles?.maxHeight, 'value')
  setResponsive('minWidth',  styles?.minWidth,  'value')
  setResponsive('maxWidth',  styles?.maxWidth,  'value')

  // ── Spacing ──────────────────────────────────────────────────────
  setResponsive('padding', styles?.padding)
  setResponsive('margin',  styles?.margin)
  setResponsive('gap',     styles?.gap)

  // ── Display / flex-self ──────────────────────────────────────────
  setResponsive('display',        styles?.display)
  setResponsive('flexDirection',  styles?.flexDirection)
  set('flexWrap',       resolveResponsive(styles?.flexWrap).default)
  set('alignItems',     resolveResponsive(styles?.alignItems).default)
  set('justifyContent', resolveResponsive(styles?.justifyContent).default)
  setResponsive('flex',       styles?.flex)
  setResponsive('flexGrow',   styles?.flexGrow)
  setResponsive('flexShrink', styles?.flexShrink)
  setResponsive('flexBasis',  styles?.flexBasis, 'value')

  // ── Position ─────────────────────────────────────────────────────
  set('position', resolveResponsive(styles?.position).default)
  setResponsive('top',    styles?.top,    'value')
  setResponsive('right',  styles?.right,  'value')
  setResponsive('bottom', styles?.bottom, 'value')
  setResponsive('left',   styles?.left,   'value')
  setResponsive('zIndex', styles?.zIndex)

  // ── Overflow ─────────────────────────────────────────────────────
  setResponsive('overflow',  styles?.overflow)
  setResponsive('overflowX', styles?.overflowX)
  setResponsive('overflowY', styles?.overflowY)

  // ── Typography ───────────────────────────────────────────────────
  set('fontFamily',    resolveResponsive(styles?.fontFamily).default)
  setResponsive('fontSize',   styles?.fontSize, 'value')
  setResponsive('fontWeight', styles?.fontWeight)
  set('fontStyle',     resolveResponsive(styles?.fontStyle).default)
  setResponsive('lineHeight',    styles?.lineHeight)
  setResponsive('letterSpacing', styles?.letterSpacing)
  setResponsive('textAlign',     styles?.textAlign)
  set('textTransform', resolveResponsive(styles?.textTransform).default)
  set('textOverflow',  resolveResponsive(styles?.textOverflow).default)
  set('whiteSpace',    resolveResponsive(styles?.whiteSpace).default)
  setResponsive('color', styles?.color)

  // ── Background ───────────────────────────────────────────────────
  setResponsive('backgroundColor', styles?.backgroundColor)
  setResponsive('background',      styles?.background)
  set('backgroundImage',    resolveResponsive(styles?.backgroundImage).default)
  set('backgroundSize',     resolveResponsive(styles?.backgroundSize).default)
  set('backgroundPosition', resolveResponsive(styles?.backgroundPosition).default)
  set('backgroundRepeat',   resolveResponsive(styles?.backgroundRepeat).default)

  // ── Border ───────────────────────────────────────────────────────
  set('border',       resolveResponsive(styles?.border).default)
  setResponsive('borderRadius', styles?.borderRadius, 'value')
  setResponsive('borderColor',  styles?.borderColor)
  setResponsive('borderWidth',  styles?.borderWidth, 'value')
  set('borderStyle',  resolveResponsive(styles?.borderStyle).default)

  // ── Box ──────────────────────────────────────────────────────────
  setResponsive('boxShadow', styles?.boxShadow)

  // ── Visual / transform / filters ─────────────────────────────────
  set('visibility',      resolveResponsive(styles?.visibility).default)
  setResponsive('transform',      styles?.transform)
  set('transformOrigin', resolveResponsive(styles?.transformOrigin).default)
  setResponsive('filter',         styles?.filter)
  setResponsive('backdropFilter', styles?.backdropFilter)
  set('isolation',       resolveResponsive(styles?.isolation).default)
  set('objectFit',       resolveResponsive(styles?.objectFit).default)
  set('objectPosition',  resolveResponsive(styles?.objectPosition).default)

  // ── Interaction ──────────────────────────────────────────────────
  set('cursor',        resolveResponsive(styles?.cursor).default)
  set('pointerEvents', resolveResponsive(styles?.pointerEvents).default)
  set('userSelect',    resolveResponsive(styles?.userSelect).default)

  // ── Visual / motion ──────────────────────────────────────────────
  // opacity is responsive — emit as a plain (unitless) responsive prop.
  setResponsive('opacity', styles?.opacity)
  if (styles?.transition) extra.transition = styles.transition

  // ── Pseudo-states (D2 / Option A) — vars + data-<state> flag ─────
  const pseudoFlags: Record<string, string> = {}
  if (applyPseudo('hover',  styles?.hover,  extra)) pseudoFlags['data-hover']  = ''
  if (applyPseudo('focus',  styles?.focus,  extra)) pseudoFlags['data-focus']  = ''
  if (applyPseudo('active', styles?.active, extra)) pseudoFlags['data-active'] = ''

  // aspectRatio → data-aspect presence flag + --ar-* CSS vars (per breakpoint).
  // node-styles.css handles all responsive behavior via [data-aspect].
  const ar = resolveResponsive(styles?.aspectRatio)
  const dataAspect: Record<string, string> = {}
  if (BREAKPOINT_KEYS.some(k => ar[k] !== undefined)) {
    dataAspect['data-aspect'] = ''
    for (const k of BREAKPOINT_KEYS) {
      const v = ar[k]
      if (v) extra[`--ar-${k}`] = v
    }
  }

  // printHide → data-print-hide flag; node-styles.css hides it in @media print.
  const printFlag: Record<string, string> = styles?.printHide ? { 'data-print-hide': '' } : {}

  const style = Object.keys(extra).length
    ? { ...attrs.style, ...extra }
    : attrs.style

  return {
    ...attrs,
    ...dataAspect,
    ...dataResponsiveFlags,
    ...printFlag,
    ...pseudoFlags,
    ...(style && { style }),
  }
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
  const panel                     = applyPanelStyles({ width: view?.width })
  const { className: _c, ...body } = applyNodeStyles(view?.styles)
  return { panel, body }
}