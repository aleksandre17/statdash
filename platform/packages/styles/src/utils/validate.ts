// ── validateNodeStyles ────────────────────────────────────────────────
//
//  Validates a NodeStyles object and returns a list of issues.
//  Used by Constructor form builder to surface inline warnings/errors.
//  Zero side effects — pure function.
//

import type { NodeStyles }           from '../types'
import { resolveResponsive, isFluidValue } from '../resolve'

export interface StyleIssue {
  field:    keyof NodeStyles
  code:     string
  message:  string
  severity: 'error' | 'warning' | 'info'
}

export function validateNodeStyles(styles: NodeStyles | undefined): StyleIssue[] {
  if (!styles) return []
  const issues: StyleIssue[] = []

  const heightVal  = resolveResponsive(styles.height).default
  const arDefault  = resolveResponsive(styles.aspectRatio).default

  // Conflict: explicit height + aspectRatio.default — aspect-ratio ignored at desktop
  if (heightVal !== undefined && arDefault !== undefined && !isFluidValue(heightVal)) {
    issues.push({
      field:    'aspectRatio',
      code:     'CONFLICT_HEIGHT_ASPECT',
      message:  'aspectRatio.default has no effect when an explicit height is set',
      severity: 'warning',
    })
  }

  // Opacity must be 0–1
  const op = resolveResponsive(styles.opacity).default
  if (op !== undefined && (op < 0 || op > 1)) {
    issues.push({
      field:    'opacity',
      code:     'OPACITY_OUT_OF_RANGE',
      message:  `opacity must be 0–1, got ${op}`,
      severity: 'error',
    })
  }

  // FluidValue: max must be greater than min (basic sanity)
  if (heightVal !== undefined && isFluidValue(heightVal)) {
    if (!heightVal.min || !heightVal.max) {
      issues.push({
        field:    'height',
        code:     'FLUID_MISSING_BOUNDS',
        message:  'FluidValue requires both min and max',
        severity: 'error',
      })
    }
  }

  // Warn on both margin and padding being set — common copy-paste mistake
  if (styles.padding !== undefined && styles.margin !== undefined) {
    issues.push({
      field:    'margin',
      code:     'BOTH_MARGIN_PADDING',
      message:  'Both margin and padding are set — verify this is intentional',
      severity: 'info',
    })
  }

  // Pseudo-state opacity must be 0–1 (same constraint as base opacity)
  for (const state of ['hover', 'focus', 'active'] as const) {
    const pseudoOp = styles[state]?.opacity
    if (pseudoOp !== undefined && (pseudoOp < 0 || pseudoOp > 1)) {
      issues.push({
        field:    state,
        code:     'PSEUDO_OPACITY_OUT_OF_RANGE',
        message:  `${state}.opacity must be 0–1, got ${pseudoOp}`,
        severity: 'error',
      })
    }
  }

  return issues
}