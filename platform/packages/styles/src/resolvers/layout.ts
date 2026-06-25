// ── Layout resolvers ──────────────────────────────────────────────────
//
//  applyContainerVars — gap → CSS custom property for layout containers.
//  resolveColumns     — ResponsiveVal<number> → breakpoint column counts.
//  resolveLayoutItem  — placement props → CSS grid/flex item styles.
//

import { resolveResponsive, BREAKPOINT_KEYS_CASCADE } from '../resolve'
import type { NodeStyles, ResponsiveVal } from '../types'

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