// @vitest-environment node
//
// ── Gauge panel — pure logic unit tests ──────────────────────────────
//
// Tests pct calculation in isolation (no React, no DOM).
// Shell rendering smoke tests live in gauge.render.test.tsx (jsdom).

import { describe, it, expect } from 'vitest'
import { toGaugePct } from './gaugeUtils'

describe('toGaugePct', () => {
  it('maps min value to 0%', () => {
    expect(toGaugePct(0, 0, 100)).toBe(0)
  })

  it('maps max value to 100%', () => {
    expect(toGaugePct(100, 0, 100)).toBe(100)
  })

  it('maps midpoint correctly', () => {
    expect(toGaugePct(50, 0, 100)).toBe(50)
  })

  it('works with non-zero min', () => {
    expect(toGaugePct(15, 10, 20)).toBe(50)
  })

  it('clamps below min to 0', () => {
    expect(toGaugePct(-5, 0, 100)).toBe(0)
  })

  it('clamps above max to 100', () => {
    expect(toGaugePct(150, 0, 100)).toBe(100)
  })

  it('returns 0 when range is zero (degenerate case)', () => {
    expect(toGaugePct(50, 50, 50)).toBe(0)
  })

  it('rounds to nearest integer', () => {
    // 1/3 of 100 ≈ 33.33 → rounds to 33
    expect(toGaugePct(1, 0, 3)).toBe(33)
  })
})
