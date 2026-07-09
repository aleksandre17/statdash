// @vitest-environment jsdom
//
// ── Fitness: chrome shells fail SOFT on an absent chromeConfig ────────────────
//
//  The jsdom-level net under the Playwright boot proof (apps/panel/e2e/boot.e2e.ts).
//
//  THE DEFECT this locks out (a textbook "green ≠ works" the e2e caught, jsdom
//  masked): the Constructor's live authoring canvas (apps/panel CanvasView) mounts
//  a <SiteProvider> WITHOUT a chromeConfig, but the inner-page shell unconditionally
//  mounts <ChromeSlot slot="InnerSidebar" />, whose InnerSidebarShell calls
//  useChromeConfig(). That hook USED to throw "chromeConfig not provided" on an
//  absent config; NodeErrorBoundary swallowed the throw into a "Failed to load
//  component" card, so the whole page rendered blank in a real browser while all
//  468 unit tests stayed green (0-rect jsdom geometry + a sibling test that passed
//  its OWN chromeConfig, compensating for what the product omitted).
//
//  Root cause: a chrome shell hard-crashed on ABSENT OPTIONAL context. An absent
//  chromeConfig is indistinguishable — to every consumer — from the sanctioned
//  `emptyManifest()` `chromeConfig: {}` offline fallback: both mean "no tenant
//  brand", and every shell already guards every field (AppHeader's `hasBrand`
//  logo guard, footer/sidebar `config.copyright &&`, locale-switcher
//  `config.localeLabels?.[l]`). The fix (packages/react useChromeConfig) folds an
//  absent config to EMPTY_CHROME_CONFIG instead of throwing.
//
//  This fitness asserts the CLASS can't silently return: EVERY chrome shell that
//  reads useChromeConfig must render gracefully (no throw, brand-free) when mounted
//  in a SiteProvider WITHOUT a chromeConfig — the exact CanvasView mount shape.
//
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup }                 from '@testing-library/react'
import { MemoryRouter }                    from 'react-router-dom'
import { SiteProvider }                    from '@statdash/react'
import { ChromeSlotConfigProvider }        from '@statdash/react/engine'
import { AnchorNavProvider }               from '@statdash/react/context/AnchorNavContext'
import type { I18nConfig, NavEntry }       from '@statdash/react'
import type { DataStore }                  from '@statdash/engine'
import type { ReactNode }                  from 'react'

import { AppHeaderShell }     from './app-header/default/AppHeaderShell'
import { AppFooterShell }     from './app-footer/default/AppFooterShell'
import { LocaleSwitcherShell } from './locale-switcher/default/LocaleSwitcherShell'
import { InnerSidebarShell }  from './inner-sidebar/default/InnerSidebarShell'

afterEach(() => cleanup())

// A two-locale i18n so the LocaleSwitcher actually renders (it early-returns when
// locales.length <= 1) — it must reach its `config.localeLabels?.[l]` read.
const I18N: I18nConfig = { locales: ['ka', 'en'], defaultLocale: 'ka', fallbackLocale: 'ka' }
const NAV: NavEntry[] = [
  { id: 'a', path: '/a', label: { ka: 'ა', en: 'Alpha' }, color: '#000', icon: 'bar-chart', items: [] },
]

// Mount a chrome shell the EXACT way the Constructor's live canvas does: a
// SiteProvider with NO `chromeConfig` prop (note its absence below), inside the
// router + slot-config the runner supplies. The InnerSidebar additionally needs
// its AnchorNavProvider, which the inner-page shell mounts for it.
function mountChromeless(node: ReactNode) {
  return () =>
    render(
      <MemoryRouter initialEntries={['/ka']}>
        <SiteProvider
          stores={{} as Record<string, DataStore>}
          nav={NAV}
          i18n={I18N}
          /* chromeConfig deliberately OMITTED — the CanvasView mount shape. */
        >
          <ChromeSlotConfigProvider config={{}}>
            <AnchorNavProvider sections={[]} perspectiveKey="mode">
              {node}
            </AnchorNavProvider>
          </ChromeSlotConfigProvider>
        </SiteProvider>
      </MemoryRouter>,
    )
}

// Every chrome shell that reads useChromeConfig — the full consumer set. A new
// chrome shell reading the base joins this table; the gate then covers it too.
const CHROME_SHELLS: Array<[label: string, node: ReactNode]> = [
  ['AppHeaderShell',     <AppHeaderShell />],
  ['AppFooterShell',     <AppFooterShell />],
  ['LocaleSwitcherShell', <LocaleSwitcherShell />],
  ['InnerSidebarShell',  <InnerSidebarShell />],
]

describe('chrome shells fail soft on an absent chromeConfig (no hard crash)', () => {
  for (const [label, node] of CHROME_SHELLS) {
    it(`${label} renders WITHOUT a chromeConfig instead of throwing`, () => {
      // The whole point: mounting must not throw. Before the fix, useChromeConfig
      // threw "chromeConfig not provided to <SiteProvider>" here.
      expect(mountChromeless(node), `${label} must not hard-crash on an absent chromeConfig`)
        .not.toThrow()
    })
  }

  it('the InnerSidebar (the exact defect) renders its <aside> landmark brand-free', () => {
    // Direct reproduction of the swallowed throw: the inner-page's InnerSidebar
    // slot mounted in a chrome-less SiteProvider now paints its shell (no brand
    // copyright footer, since chromeConfig.copyright is absent), rather than being
    // caught by NodeErrorBoundary into a "Failed to load component" card.
    const { container } = mountChromeless(<InnerSidebarShell />)()
    expect(container.querySelector('aside'), 'the sidebar shell renders').not.toBeNull()
    // Brand-free: the copyright footer (config.copyright) is absent, not crashed.
    expect(container.textContent ?? '').not.toContain('©')
  })
})
