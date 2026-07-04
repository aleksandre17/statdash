// @vitest-environment jsdom
//
// ── FF-FEATURED-A11Y — the featured slider's WCAG behavioural contract ────────
//
//  The slider is a CAROUSEL, not a tab set (AR-40 presentation rework): a uniform
//  fixed-height frame that shows ONE group's cards at a time and cross-fades between
//  them. axe cannot see the carousel semantics, auto-rotation, or colour-only trend —
//  they are behavioural — so this gate exercises the real shell with fireEvent + fake
//  timers and asserts:
//    • carousel/slide roles (WAI-ARIA APG carousel), and NO tab/tablist/tabpanel,
//    • a UNIFORM fixed frame — exactly ONE group is in the DOM at a time (no stacking),
//    • auto-advance cross-fades to the next group AND pauses on hover / prefers-reduced-motion,
//    • real prev/next <button>s with i18n labels (no hardcoded chrome strings → no leak),
//    • NO colour-only trend (glyph + sr-only text + visible value),
//    • a real crawlable drill <a href> (locale-prefixed) + preliminary badge (Law 9),
//    • the value is the LIVE resolved figure (from useFeaturedRows), never hardcoded.
//
//  useT (@statdash/react) and useFeaturedRows (@statdash/react/engine) are mocked
//  so this stays a focused unit on the shell's markup/keyboard, not the store/i18n.
//

import { describe, it, expect, vi, afterEach } from 'vitest'
import type { FeaturedSlideDef } from '@statdash/engine'

const FIXTURE: FeaturedSlideDef[] = [
  { card: { label: 'GNI',         value: '98 035',  unit: 'GEL mn', trend: 'flat', trendValue: '', color: 'var(--color-accent)' }, href: 'accounts', group: 'National Accounts', order: 1 },
  { card: { label: 'Net lending', value: '-2 836',  unit: 'GEL mn', trend: 'down', trendValue: '-3.2%', trendSub: 'YoY', color: 'var(--color-accent)', methodologyUrl: 'https://ex.org/m' }, href: 'accounts', group: 'National Accounts', order: 2 },
  { card: { label: 'Tbilisi',     value: '49 374',  unit: 'GEL mn', trend: 'flat', trendValue: '', color: 'var(--color-accent)' }, href: 'regional', group: 'Regional', order: 1 },
  { card: { label: 'GDP',         value: '104 598', unit: 'GEL mn', trend: 'flat', trendValue: '', color: 'var(--color-accent)', preliminary: true }, href: 'gdp', group: 'Regional', order: 2 },
]

vi.mock('@statdash/react', () => ({ useT: () => (k: string) => k }))
vi.mock('@statdash/react/engine', async (importActual) => {
  const actual = await importActual<typeof import('@statdash/react/engine')>()
  return { ...actual, useFeaturedRows: () => FIXTURE }
})

import { render, screen, cleanup, fireEvent, within, act } from '@testing-library/react'
import type { ReactElement } from 'react'
import { FeaturedSliderShell } from './FeaturedSliderShell'
import type { RenderContext } from '@statdash/react/engine'
import type { FeaturedSliderNode } from './FeaturedSliderNode'

// The shell's cross-fade hold (private const in the shell). Advancing timers by at
// least this + the autoplay dwell lands on the swapped-in group.
const FADE_OUT_MS = 200

function renderSlider(locale = 'en', autoplayMs = 0) {
  const def = { type: 'featured-slider', id: 'fs', items: [], autoplayMs } as FeaturedSliderNode
  const ctx = { locale } as unknown as RenderContext
  return render(FeaturedSliderShell(def, ctx, { rendered: [], byName: {} } as never) as ReactElement)
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  // Reset any matchMedia stub a test installed (reduced-motion case).
  delete (globalThis as { matchMedia?: unknown }).matchMedia
})

describe('FF-FEATURED-A11Y — carousel roles (NOT tabs)', () => {
  it('exposes a carousel region and a single slide group — and NO tab semantics', () => {
    const { container } = renderSlider()
    expect(container.querySelector('[aria-roledescription="carousel"]')).not.toBeNull()

    const slides = container.querySelectorAll('[aria-roledescription="slide"]')
    expect(slides).toHaveLength(1)                    // one slide visible at a time

    // The tab pattern must be GONE.
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    expect(screen.queryAllByRole('tabpanel', { hidden: true })).toHaveLength(0)
  })

  it('the active slide is a live region, position-labelled from i18n (no hardcoded chrome)', () => {
    const { container } = renderSlider()
    const slide = container.querySelector('[aria-roledescription="slide"]')!
    expect(slide.getAttribute('aria-label')).toBe('slide 1 / 2')  // t('slide') key + N / M
    // autoplayMs:0 ⇒ not rotating ⇒ region is announced (polite), per APG.
    expect(slide.getAttribute('aria-live')).toBe('polite')
  })

  it('prev/next are real <button>s with i18n-sourced labels (no leak)', () => {
    renderSlider()
    // Accessible names equal the i18n KEYS (useT mocked) ⇒ text flows through t(),
    // never a hardcoded ka/en string in the markup.
    expect(screen.getByRole('button', { name: 'prev' }).tagName).toBe('BUTTON')
    expect(screen.getByRole('button', { name: 'next' }).tagName).toBe('BUTTON')
  })
})

describe('FF-FEATURED-A11Y — uniform fixed frame (one group at a time)', () => {
  it('renders ONLY the active group — the other group is not stacked in the DOM', () => {
    renderSlider()
    // Group 0 (National Accounts) is visible…
    expect(screen.getByText('98 035')).toBeTruthy()   // GNI
    expect(screen.getByText('-2 836')).toBeTruthy()    // Net lending
    // …Group 1 (Regional) is NOT in the DOM at all (fixed frame, no height stacking).
    expect(screen.queryByText('49 374')).toBeNull()    // Tbilisi
    expect(screen.queryByText('104 598')).toBeNull()   // GDP
  })

  it('prev/next cross-fade to the next group (advances after the fade hold)', () => {
    vi.useFakeTimers()
    renderSlider('en', 0)                              // manual only, no autoplay
    fireEvent.click(screen.getByRole('button', { name: 'next' }))
    act(() => { vi.advanceTimersByTime(FADE_OUT_MS + 50) })

    // Now the Regional group is shown, National Accounts is gone.
    expect(screen.getByText('49 374')).toBeTruthy()    // Tbilisi
    expect(screen.getByText('104 598')).toBeTruthy()   // GDP
    expect(screen.queryByText('98 035')).toBeNull()    // GNI gone
  })
})

describe('FF-FEATURED-A11Y — auto-advance + pause (WCAG 2.2.2)', () => {
  it('auto-advances to the next group after the dwell + fade', () => {
    vi.useFakeTimers()
    renderSlider('en', 500)                            // autoplay on
    expect(screen.getByText('98 035')).toBeTruthy()    // start on group 0
    act(() => { vi.advanceTimersByTime(500 + FADE_OUT_MS + 50) })
    expect(screen.getByText('49 374')).toBeTruthy()    // advanced to group 1
  })

  it('pauses auto-advance on hover (mouseEnter) — Pause/Stop', () => {
    vi.useFakeTimers()
    const { container } = renderSlider('en', 500)
    fireEvent.mouseEnter(container.querySelector('.featured-slider')!)
    act(() => { vi.advanceTimersByTime(500 + FADE_OUT_MS + 50) })
    expect(screen.getByText('98 035')).toBeTruthy()    // still on group 0 — paused
    expect(screen.queryByText('49 374')).toBeNull()
  })

  it('does NOT auto-advance under prefers-reduced-motion', () => {
    ;(globalThis as { matchMedia?: unknown }).matchMedia = (q: string) => ({
      matches: q.includes('reduce'), media: q,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
    })
    vi.useFakeTimers()
    renderSlider('en', 500)
    act(() => { vi.advanceTimersByTime(500 + FADE_OUT_MS + 50) })
    expect(screen.getByText('98 035')).toBeTruthy()    // no motion ⇒ no rotation
    expect(screen.queryByText('49 374')).toBeNull()
  })
})

describe('FF-FEATURED-A11Y — no colour-only info + live values + drill', () => {
  it('renders the LIVE resolved value from useFeaturedRows (never a hardcoded string)', () => {
    renderSlider()
    expect(screen.getByText('98 035')).toBeTruthy()
    expect(screen.getByText('-2 836')).toBeTruthy()
  })

  it('trend carries a text value + sr-only direction (not colour alone)', () => {
    renderSlider()
    expect(screen.getByText('-3.2%')).toBeTruthy()
    expect(screen.getByText('trend-down')).toBeTruthy()   // sr-only text (mocked useT → key)
  })

  it('the drill target is a real, locale-prefixed <a href> (crawlable, SEO)', () => {
    renderSlider('ka')
    const links = screen.getAllByRole('link').filter(a => a.getAttribute('href')?.startsWith('/ka/'))
    expect(links.length).toBeGreaterThan(0)
    expect(links[0]).toHaveAttribute('href', '/ka/accounts')
  })

  it('a preliminary card renders the P badge with an sr-only label (Law 9)', () => {
    vi.useFakeTimers()
    renderSlider('en', 0)
    // Advance to the Regional group where the preliminary GDP card lives.
    fireEvent.click(screen.getByRole('button', { name: 'next' }))
    act(() => { vi.advanceTimersByTime(FADE_OUT_MS + 50) })
    const slide = document.querySelector('[aria-roledescription="slide"]') as HTMLElement
    expect(within(slide).getByText('preliminary')).toBeTruthy()   // sr-only preliminary label
  })
})
