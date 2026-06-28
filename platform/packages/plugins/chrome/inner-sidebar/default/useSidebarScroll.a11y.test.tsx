// @vitest-environment jsdom
//
// ── Anchor-nav focus + motion (RX-11) ─────────────────────────────────────────
//
//  axe cannot see focus management or scroll behaviour — these are asserted by
//  interaction. After an in-page anchor jump, focus MUST land on the target
//  section (WCAG 2.4.3) and the scroll MUST be motion-safe (WCAG 2.3.3).
//

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { REDUCED_MOTION_QUERY } from '@statdash/styles'
import { scrollToAnchor }       from './useSidebarScroll'

let scrollSpy: ReturnType<typeof vi.fn>

function stubMatchMedia(reduce: boolean): void {
  window.matchMedia = ((q: string) => ({
    matches: reduce && q === REDUCED_MOTION_QUERY,
    media: q, addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

beforeEach(() => {
  document.body.innerHTML = ''
  scrollSpy = vi.fn()
  window.scrollTo = scrollSpy as unknown as typeof window.scrollTo
})
afterEach(() => { vi.restoreAllMocks() })

function mountTarget(id: string): HTMLElement {
  const el = document.createElement('section')
  el.id = id
  el.textContent = 'Target section'
  document.body.appendChild(el)
  return el
}

describe('scrollToAnchor — focus management', () => {
  it('moves focus to the target section after the jump', () => {
    stubMatchMedia(false)
    const el = mountTarget('sec-gdp')
    scrollToAnchor('sec-gdp')
    expect(document.activeElement).toBe(el)
  })

  it('grants a programmatic-only tabindex (-1, off the Tab order) when absent', () => {
    stubMatchMedia(false)
    const el = mountTarget('sec-cpi')
    scrollToAnchor('sec-cpi')
    expect(el.getAttribute('tabindex')).toBe('-1')
  })

  it('does not clobber an authored tabindex', () => {
    stubMatchMedia(false)
    const el = mountTarget('sec-trade')
    el.setAttribute('tabindex', '0')
    scrollToAnchor('sec-trade')
    expect(el.getAttribute('tabindex')).toBe('0')
  })

  it('no-ops cleanly when the anchor does not exist', () => {
    stubMatchMedia(false)
    expect(() => scrollToAnchor('missing')).not.toThrow()
    expect(scrollSpy).not.toHaveBeenCalled()
  })
})

describe('scrollToAnchor — motion safety', () => {
  it('uses smooth scroll when motion is allowed', () => {
    stubMatchMedia(false)
    mountTarget('sec-a')
    scrollToAnchor('sec-a')
    expect(scrollSpy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }))
  })

  it('falls back to an instant jump under prefers-reduced-motion', () => {
    stubMatchMedia(true)
    mountTarget('sec-b')
    scrollToAnchor('sec-b')
    expect(scrollSpy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }))
  })
})
