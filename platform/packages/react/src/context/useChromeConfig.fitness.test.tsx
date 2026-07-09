// @vitest-environment jsdom
//
// ── useChromeConfig contract — fail-soft on absent config, loud on misuse ─────
//
//  Locks the two halves of the hook contract at the layer the fix lives in:
//
//    1. ABSENT chromeConfig (a SiteProvider mounted without one — the Constructor's
//       live authoring canvas, any chrome-less preview) folds to EMPTY_CHROME_CONFIG
//       instead of throwing. A chrome shell must not hard-crash on absent OPTIONAL
//       context (ISP/Postel — the same posture as useResolveLocaleSafe). This is the
//       defect the Playwright boot proof caught (see apps/panel/e2e/boot.e2e.ts).
//
//    2. OUTSIDE a <SiteProvider> STILL throws — that is genuine programming misuse
//       (a required provider is missing), kept loud and consistent with every other
//       site hook. The fix widened ONLY the absent-config case, not this one.
//
import { describe, it, expect } from 'vitest'
import { renderHook }           from '@testing-library/react'
import type { ReactNode }       from 'react'
import { SiteProvider, useChromeConfig } from './SiteContext'
import { EMPTY_CHROME_CONFIG }  from './ChromeConfig'
import type { I18nConfig }      from './SiteContext'
import type { DataStore }       from '@statdash/engine'

const I18N: I18nConfig = { locales: ['en'], defaultLocale: 'en', fallbackLocale: 'en' }

function ChromelessProvider({ children }: { children: ReactNode }) {
  return (
    <SiteProvider stores={{} as Record<string, DataStore>} nav={[]} i18n={I18N}>
      {children}
    </SiteProvider>
  )
}

describe('useChromeConfig contract', () => {
  it('folds to EMPTY_CHROME_CONFIG when the SiteProvider carries no chromeConfig', () => {
    const { result } = renderHook(() => useChromeConfig(), { wrapper: ChromelessProvider })
    expect(result.current).toBe(EMPTY_CHROME_CONFIG)
    // The sentinel is the brand-free state every shell already supports: no fields.
    expect(result.current.logoUrl).toBeUndefined()
    expect(result.current.copyright).toBeUndefined()
    expect(result.current.localeLabels).toBeUndefined()
  })

  it('is frozen — a consumer cannot mutate the shared sentinel', () => {
    expect(Object.isFrozen(EMPTY_CHROME_CONFIG)).toBe(true)
  })

  it('STILL throws outside a <SiteProvider> (genuine misuse stays loud)', () => {
    // renderHook with no wrapper => no SiteContext => the ctx-null guard fires.
    expect(() => renderHook(() => useChromeConfig())).toThrow(/Must be called inside <SiteProvider>/)
  })
})
