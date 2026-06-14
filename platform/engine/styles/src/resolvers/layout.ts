// ── Layout resolvers ──────────────────────────────────────────────────
//
//  applyContainerVars — gap → CSS custom property for layout containers.
//  resolveColumns     — ResponsiveVal<number> → breakpoint column counts.
//  resolveLayoutItem  — placement props → CSS grid/flex item styles.
//

import { resolveResponsive }       from '../resolve'
import type { NodeStyles, ResponsiveVal } from '../types'

// Translates a gap value into a CSS custom property object for layout containers.
// CSS reads: var(--layout-gap, var(--spacing-md, 1rem)).
// Returns undefined when no gap — safe to spread as style prop.
export function applyContainerVars(
  gap?: ResponsiveVal<string>,
): Record<string, string> | undefined {
  const g = resolveResponsive(gap).default
  return g ? { '--layout-gap': g } : undefined
}

// Translates a ResponsiveVal<number> column count into concrete breakpoint values.
// Result is applied as data-attrs (data-cols, data-cols-md, data-cols-sm) that
// CSS container queries read to set grid-template-columns.
export function resolveColumns(
  val?:     ResponsiveVal<number>,
  fallback = 2,
): { default: number; md: number; sm: number } {
  const r = resolveResponsive(val)
  return {
    default: r.default ?? fallback,
    md:      r.md      ?? 1,
    sm:      r.sm      ?? 1,
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