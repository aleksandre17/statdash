// @vitest-environment jsdom
//
// ── FF-FEATURED-A11Y — the featured slider's WCAG behavioural contract ────────
//
//  axe cannot see roving-tabindex, arrow-key handlers, or colour-only trend — they
//  are behavioural, so this gate exercises the real shell with fireEvent and asserts:
//    • carousel/tablist/tabpanel roles (WAI-ARIA),
//    • roving tabindex + Left/Right/Home/End keyboard nav,
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

import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { FeaturedSliderShell } from './FeaturedSliderShell'
import type { RenderContext } from '@statdash/react/engine'
import type { FeaturedSliderNode } from './FeaturedSliderNode'

function renderSlider(locale = 'en') {
  const def = { type: 'featured-slider', id: 'fs', items: [], autoplayMs: 0 } as FeaturedSliderNode
  const ctx = { locale } as unknown as RenderContext
  return render(FeaturedSliderShell(def, ctx, { rendered: [], byName: {} } as never) as ReactElement)
}

afterEach(() => cleanup())

describe('FF-FEATURED-A11Y — carousel + tabs roles', () => {
  it('exposes a carousel region and one tab per group', () => {
    const { container } = renderSlider()
    expect(container.querySelector('[aria-roledescription="carousel"]')).not.toBeNull()
    expect(screen.getByRole('tablist')).toBeTruthy()
    expect(screen.getAllByRole('tab')).toHaveLength(2)   // National Accounts + Regional
  })

  it('roving tabindex — only the active tab is tabbable; the panels are tabpanels', () => {
    renderSlider()
    const [t0, t1] = screen.getAllByRole('tab')
    expect(t0).toHaveAttribute('tabindex', '0')
    expect(t1).toHaveAttribute('tabindex', '-1')
    expect(t0).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByRole('tabpanel', { hidden: true }).length).toBeGreaterThan(0)
  })

  it('ArrowRight/Home/End move selection (APG Tabs keyboard model)', () => {
    renderSlider()
    const tablist = screen.getByRole('tablist')
    fireEvent.keyDown(tablist, { key: 'ArrowRight' })
    expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(tablist, { key: 'Home' })
    expect(screen.getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'true')
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
    // The "down" trend card: visible signed value + an sr-only "trend-down" label.
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
    renderSlider()
    // Move to the Regional group where the preliminary GDP card lives.
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'End' })
    const regional = screen.getAllByRole('tabpanel', { hidden: true }).find(p => !p.hidden)!
    expect(within(regional).getByText('preliminary')).toBeTruthy()   // sr-only preliminary label
  })
})
