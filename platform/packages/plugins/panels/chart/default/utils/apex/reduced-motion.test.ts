// @vitest-environment node
//
// ── Apex reduced-motion honouring (RX-23, JS half) ────────────────────────────
//
//  The CSS @media baseline cannot reach ApexCharts — it draws to SVG via JS. So
//  the shared BASE config gates `chart.animations.enabled` on prefersReducedMotion()
//  via a getter, read at spread time (render). This pins that the chart actually
//  disables its entrance/update animation when the user requests reduced motion.
//

import { describe, it, expect, afterEach } from 'vitest'
import { REDUCED_MOTION_QUERY }            from '@statdash/styles'
import { BASE }                            from './base'

function stubMatchMedia(reduce: boolean): void {
  ;(globalThis as { window?: unknown }).window = {
    matchMedia: (q: string) => ({ matches: reduce && q === REDUCED_MOTION_QUERY }),
  }
}
afterEach(() => { delete (globalThis as { window?: unknown }).window })

// Spread mirrors ApexRenderer/toApexOptions ({ ...BASE.chart }) — evaluates the getter.
function resolvedAnimations(): { enabled: boolean; animateGradually: { enabled: boolean } } {
  return { ...BASE.chart }.animations as { enabled: boolean; animateGradually: { enabled: boolean } }
}

describe('Apex BASE — prefers-reduced-motion', () => {
  it('disables entrance + gradual animation when reduced motion is requested', () => {
    stubMatchMedia(true)
    const a = resolvedAnimations()
    expect(a.enabled).toBe(false)
    expect(a.animateGradually.enabled).toBe(false)
  })

  it('keeps animation enabled when motion is allowed', () => {
    stubMatchMedia(false)
    const a = resolvedAnimations()
    expect(a.enabled).toBe(true)
    expect(a.animateGradually.enabled).toBe(true)
  })
})
