// ── FF-REDUCED-MOTION — the motion-baseline fitness function (RX-23) ──────────
//
//  Asserts the platform honours `prefers-reduced-motion` in BOTH halves of the
//  baseline, and that they key off the SAME media query (no drift):
//
//    CSS half — `css/animations.css` ships a `@media (prefers-reduced-motion:
//               reduce)` block that collapses animation/transition/scroll.
//    JS  half — `utils/motion.ts` exposes `prefersReducedMotion()` /
//               `motionSafeScrollBehavior()` that read `matchMedia` live and
//               return the safe value when reduce is requested.
//
//  Vestibular safety is WCAG-baseline for a public-sector (Law-9) platform; a
//  missing guard is invisible until a real reduced-motion user hits an animated
//  chart or smooth-scroll. This gate makes the guard's ABSENCE a red test.
//

import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync }                    from 'node:fs'
import { fileURLToPath }                   from 'node:url'
import { dirname, join }                   from 'node:path'
import {
  prefersReducedMotion,
  motionSafeScrollBehavior,
  REDUCED_MOTION_QUERY,
} from './utils/motion'

const here       = dirname(fileURLToPath(import.meta.url))
const animCss     = readFileSync(join(here, 'css', 'animations.css'), 'utf8')

// ── matchMedia stub — node env has no window; install/remove per case ─────────
function stubMatchMedia(reduce: boolean): void {
  ;(globalThis as { window?: unknown }).window = {
    matchMedia: (q: string) => ({ matches: reduce && q === REDUCED_MOTION_QUERY }),
  }
}
afterEach(() => { delete (globalThis as { window?: unknown }).window })

describe('FF-REDUCED-MOTION — CSS baseline', () => {
  it('animations.css ships the prefers-reduced-motion media query', () => {
    expect(animCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/)
  })

  it('the media block neutralises animation AND transition duration', () => {
    // Pull the body of the reduce block and assert both axes are collapsed.
    const block = animCss.slice(animCss.indexOf('prefers-reduced-motion'))
    expect(block).toMatch(/animation-duration:\s*0\.01ms\s*!important/)
    expect(block).toMatch(/transition-duration:\s*0\.01ms\s*!important/)
    expect(block).toMatch(/scroll-behavior:\s*auto\s*!important/)
  })
})

describe('FF-REDUCED-MOTION — JS guard', () => {
  it('REDUCED_MOTION_QUERY is the canonical query string both halves share', () => {
    expect(REDUCED_MOTION_QUERY).toBe('(prefers-reduced-motion: reduce)')
    // The CSS block must key off the very same query — no drift between halves.
    expect(animCss).toContain('prefers-reduced-motion: reduce')
  })

  it('prefersReducedMotion() reflects matchMedia live', () => {
    stubMatchMedia(true)
    expect(prefersReducedMotion()).toBe(true)
    stubMatchMedia(false)
    expect(prefersReducedMotion()).toBe(false)
  })

  it('SSR / no-window degrades to motion-on (false) — safe non-interactive default', () => {
    // no window installed
    expect(prefersReducedMotion()).toBe(false)
  })

  it('motionSafeScrollBehavior swaps smooth → auto under reduced motion', () => {
    stubMatchMedia(true)
    expect(motionSafeScrollBehavior('smooth')).toBe('auto')
    stubMatchMedia(false)
    expect(motionSafeScrollBehavior('smooth')).toBe('smooth')
  })
})
