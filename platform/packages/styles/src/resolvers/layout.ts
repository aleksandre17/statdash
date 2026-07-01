// ── Layout resolvers ──────────────────────────────────────────────────
//
//  applyContainerVars — gap → CSS custom property for layout containers.
//  resolveColumns     — ResponsiveVal<number> → breakpoint column counts.
//  resolveAlign       — ResponsiveVal<LayoutAlign> → data-align value.
//  resolveLayoutItem  — placement props → CSS grid/flex item styles.
//

import { resolveResponsive, BREAKPOINT_KEYS_CASCADE } from '../resolve'
import type { NodeStyles, ResponsiveVal } from '../types'

// Cross-axis alignment vocabulary for the layout container primitives
// (columns / grid / stack). `stretch` is the default (equal-height contract)
// and the CSS baseline, so it emits no attribute — every other value projects
// a `data-align` the co-located layout CSS reads. Shared SSOT so the schema
// field, the shell emit, and the fitness guard all reference one union.
export type LayoutAlign = 'start' | 'center' | 'end' | 'stretch'

// Default-first, large → small — mirrors the node.ts gap-var cascade. SSOT in resolve.ts.
const BP_KEYS = BREAKPOINT_KEYS_CASCADE

// Translates a gap value into CSS custom properties for layout containers.
//
// Flat gap (no per-breakpoint overrides):
//   Returns { '--layout-gap': value } — CSS reads var(--layout-gap, fallback).
//
// Responsive gap ({ default, lg, sm, … }):
//   Returns { '--layout-gap-default': v, '--layout-gap-lg': v, … } — matching
//   the per-breakpoint var pattern `node.ts` uses for setResponsive(). Shell CSS
//   reads them via the same cascade: var(--layout-gap-lg, var(--layout-gap-default)).
//
// Returns undefined when no gap — safe to spread as React style prop.
export function applyContainerVars(
  gap?: ResponsiveVal<string>,
): Record<string, string> | undefined {
  if (!gap) return undefined
  const r = resolveResponsive(gap)
  const hasBp = BP_KEYS.slice(1).some(k => r[k] !== undefined) // any non-default bp?

  if (!hasBp) {
    // Flat path — single var, cheapest (old behavior preserved).
    return r.default ? { '--layout-gap': r.default } : undefined
  }

  // Responsive path — emit per-breakpoint vars (mirrors setResponsive in node.ts).
  const vars: Record<string, string> = {}
  for (const k of BP_KEYS) {
    const v = r[k]
    if (v !== undefined) vars[`--layout-gap-${k}`] = v
  }
  return Object.keys(vars).length ? vars : undefined
}

// Translates a ResponsiveVal<number> column count into concrete breakpoint values.
// Result is applied as data-attrs (data-cols, data-cols-xl, data-cols-lg,
// data-cols-md, data-cols-sm, data-cols-xs) that CSS container queries read
// to set grid-template-columns. Matches the 6-point breakpoint scale:
//   xs≤480  sm≤640  md≤768  lg≤1024  xl≤1280  2xl≤1536
// Columns collapse to 1 at md and below; lg preserves the default unless overridden.
export function resolveColumns(
  val?:     ResponsiveVal<number>,
  fallback = 2,
): { default: number; xl: number; lg: number; md: number; sm: number; xs: number } {
  const r = resolveResponsive(val)
  return {
    default: r.default ?? fallback,
    xl:      r.xl      ?? r.default ?? fallback,
    lg:      r.lg      ?? r.default ?? fallback,
    md:      r.md      ?? 1,
    sm:      r.sm      ?? 1,
    xs:      r.xs      ?? 1,
  }
}

// Resolves a container's authorable cross-axis `align` into the concrete
// `data-align` value the layout CSS reads. Flat (default-breakpoint) resolution:
// container alignment has no live responsive consumer, and the CSS is flat, so
// keeping this flat avoids emitting dead per-breakpoint attrs (open to extend
// to the setResponsive var+flag pattern when a consumer appears).
//   • `stretch` / unset  → undefined  (the CSS default — no attribute, clean DOM)
//   • start|center|end    → the value  (emitted as data-align)
export function resolveAlign(
  val?: ResponsiveVal<LayoutAlign>,
): LayoutAlign | undefined {
  const a = resolveResponsive(val).default
  return a && a !== 'stretch' ? a : undefined
}

// ── resolveGrid — the MAXIMAL CSS-Grid grammar (JSON → grid-template) ──
//
//  Exposes the full power of CSS Grid as declarative, per-breakpoint config
//  (Every-Layout intrinsic grids · Builder.io/Framer breakpoint overrides ·
//  the Grid+Flex standard). Every prop is a ResponsiveVal; the three TEMPLATE
//  props (columns/rows/areas) are container-query-driven via the SAME
//  var+flag cascade the node.ts / applyContainerVars engines already use
//  (SSOT — no new runtime CSS system). Two mutually-exclusive delivery routes,
//  chosen per prop by whether any non-default breakpoint is set:
//    • Flat-only  → inline `style` (wins directly; the intrinsic auto-fit form
//      reflows by container width with zero vars — the strongest single line).
//    • Responsive → per-breakpoint `--grid-<axis>-<bp>` vars + a
//      `data-grid-<axis>-responsive` flag; the @container cascade in
//      layout.css assigns the property from the winning breakpoint var
//      (large→small, smaller wins) — CONTAINER-driven, not viewport-coupled.
//  The renderer stays pure: the shell spreads { style, data } and NEVER inspects.
export interface GridSpec {
  columns?:         ResponsiveVal<number>   // shorthand → repeat(N, minmax(0,1fr))
  templateColumns?: ResponsiveVal<string>   // full track list (repeat/minmax/auto-fit/fr/named lines)
  templateRows?:    ResponsiveVal<string>
  templateAreas?:   ResponsiveVal<string>
  autoFlow?:        ResponsiveVal<string>
  autoColumns?:     ResponsiveVal<string>
  autoRows?:        ResponsiveVal<string>
  gap?:             ResponsiveVal<string>
}

export interface GridAttrs {
  style?: Record<string, string>
  data:   Record<string, string>
}

// The three responsive TEMPLATE props: inline CSS prop (React camelCase) + the
// per-breakpoint var stem / flag stem the layout.css @container cascade reads.
const GRID_RESPONSIVE: Record<'templateColumns' | 'templateRows' | 'templateAreas', { inline: string; stem: string }> = {
  templateColumns: { inline: 'gridTemplateColumns', stem: 'grid-cols'  },
  templateRows:    { inline: 'gridTemplateRows',    stem: 'grid-rows'  },
  templateAreas:   { inline: 'gridTemplateAreas',   stem: 'grid-areas' },
}

// Flat-inline props — the default-breakpoint value goes straight to inline style.
// Declared as the maximal seam; each opens to the responsive var+flag pattern
// above the day a per-breakpoint consumer is real (YAGNI-on-population).
// (align/justify are handled by the shell via resolveAlign → data-align/data-justify,
//  mirroring the columns/stack cross-axis contract — kept out of here for symmetry.)
const GRID_FLAT: Record<'autoFlow' | 'autoColumns' | 'autoRows', string> = {
  autoFlow:    'gridAutoFlow',
  autoColumns: 'gridAutoColumns',
  autoRows:    'gridAutoRows',
}

// Lower the numeric `columns` shorthand to a real track list, per breakpoint.
// minmax(0,1fr) (not bare 1fr) so a wide child can never push the track past the
// grid (WCAG 1.4.10 reflow — the same overflow guard `.layout-columns > *` gives).
function columnsToTemplate(cols: ResponsiveVal<number>): ResponsiveVal<string> {
  const r = resolveResponsive(cols)
  const out: Record<string, string> = {}
  for (const k of BP_KEYS) {
    const n = r[k]
    if (n !== undefined) out[k] = `repeat(${n}, minmax(0, 1fr))`
  }
  return out
}

export function resolveGrid(spec: GridSpec): GridAttrs {
  const style: Record<string, string> = {}
  const data:  Record<string, string> = {}

  // gap → --layout-gap var(s) (the existing container-var contract, responsive-aware).
  const gapVars = applyContainerVars(spec.gap)
  if (gapVars) Object.assign(style, gapVars)

  // `columns` is a convenience alias for templateColumns — the explicit template wins.
  const templateColumns =
    spec.templateColumns ?? (spec.columns !== undefined ? columnsToTemplate(spec.columns) : undefined)

  const templates: Array<['templateColumns' | 'templateRows' | 'templateAreas', ResponsiveVal<string> | undefined]> = [
    ['templateColumns', templateColumns],
    ['templateRows',    spec.templateRows],
    ['templateAreas',   spec.templateAreas],
  ]
  for (const [key, raw] of templates) {
    if (raw === undefined) continue
    const { inline, stem } = GRID_RESPONSIVE[key]
    const r = resolveResponsive(raw)
    const hasBp = BP_KEYS.slice(1).some(k => r[k] !== undefined)
    if (!hasBp) {
      // Flat-only → inline (precedence path). Intrinsic auto-fit lives here.
      if (r.default !== undefined && r.default !== '') style[inline] = String(r.default)
      continue
    }
    // Responsive → route the whole property through vars + the @container cascade.
    for (const k of BP_KEYS) {
      const v = r[k]
      if (v !== undefined) style[`--${stem}-${k}`] = String(v)
    }
    data[`data-${stem}-responsive`] = ''
  }

  for (const key of Object.keys(GRID_FLAT) as (keyof typeof GRID_FLAT)[]) {
    const v = resolveResponsive(spec[key]).default
    if (v !== undefined && v !== '') style[GRID_FLAT[key]] = String(v)
  }

  return { style: Object.keys(style).length ? style : undefined, data }
}

// Translates NodeStyles placement props into a CSS grid/flex item object.
// Consumed by LayoutItemProvider — returns null when there is nothing to apply,
// so the provider renders a Fragment instead of a Context.Provider (zero DOM).
export function resolveLayoutItem(
  styles?: NodeStyles,
): Record<string, string | number> | null {
  if (!styles) return null
  const colSpan  = resolveResponsive(styles.colSpan).default
  const rowSpan  = resolveResponsive(styles.rowSpan).default
  const align    = resolveResponsive(styles.align).default
  const justify  = resolveResponsive(styles.justify).default
  const order    = resolveResponsive(styles.order).default
  if (!colSpan && !rowSpan && !align && !justify && !order) return null
  return {
    ...(colSpan  && { gridColumn:  `span ${colSpan}` }),
    ...(rowSpan  && { gridRow:     `span ${rowSpan}` }),
    ...(align    && { alignSelf:   align              }),
    ...(justify  && { justifySelf: justify            }),
    ...(order    && { order                           }),
  }
}