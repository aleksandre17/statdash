// ── ChromeOverrideContext — per-page chrome slot overrides ────────────
//
//  Set by LocaleGuard per route from manifest.pages[pageId].chrome.
//  ChromeSlot resolution priority:
//    1. page override   pageChrome[slot]      ← this context
//    2. site default    SiteProvider.chrome[slot]
//    3. fallback        'default'
//
//  Default value {} = no overrides — graceful degradation without provider.
//  Pattern: Builder.io page.meta.chrome, Grafana route.meta variant override.
//
import { createContext, useContext, type ReactNode } from 'react'
import type { ChromeEntry }                          from '../engine/types'

const ChromeOverrideContext = createContext<Record<string, ChromeEntry>>({})

export function ChromeOverrideProvider({
  overrides,
  children,
}: {
  overrides: Record<string, ChromeEntry>
  children:  ReactNode
}) {
  return (
    <ChromeOverrideContext.Provider value={overrides}>
      {children}
    </ChromeOverrideContext.Provider>
  )
}

export function useChromeOverrides(): Record<string, ChromeEntry> {
  return useContext(ChromeOverrideContext)
}