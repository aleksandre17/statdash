// ── ChromeSlot — platform primitive for nested chrome slot dispatch ─────
//
//  Used by shells that embed other chrome slots — e.g. AppHeader embeds
//  LocaleSwitcher, InnerPageShell embeds InnerSidebar.
//
//  Resolution chain (priority):
//    1. page override   manifest.pages[pageId].chrome[slot]   (ChromeOverrideContext)
//    2. site default    SiteProvider.chrome[slot]
//    3. fallback        'default'
//
//  ChromeEntry shorthand: 'transparent' → variant='transparent', config={}.
//  ChromeEntry object:  { variant, config }  → full form with per-instance config.
//
//  Config is injected via ChromeSlotConfigProvider so the shell reads it
//  via useSlotConfig() — zero-prop pattern preserved.
//
import { createElement }                      from 'react'
import type { ReactNode }                     from 'react'
import { useSiteChrome }                      from '../context/SiteContext'
import { useChromeOverrides }                 from '../context/ChromeOverrideContext'
import { chromeRegistry, NullChromeSlot }     from './chromeRegistry'
import { ChromeSlotConfigProvider }           from '../context/ChromeSlotConfigContext'
import type { ChromeEntry }                   from './types'

function pickVariant(e: ChromeEntry | undefined): string | undefined {
  if (typeof e === 'string') return e
  return e?.variant
}

function pickConfig(e: ChromeEntry | undefined): Record<string, unknown> {
  if (typeof e === 'string' || e == null) return {}
  return e.config ?? {}
}

export function ChromeSlot({ slot }: { slot: string }): ReactNode {
  const pageChrome   = useChromeOverrides()
  const globalChrome = useSiteChrome()
  const pageEntry    = pageChrome[slot]
  const siteEntry    = globalChrome[slot]
  const key          = pickVariant(pageEntry) ?? pickVariant(siteEntry) ?? 'default'
  const config       = pageEntry != null ? pickConfig(pageEntry) : pickConfig(siteEntry)
  const Shell        = chromeRegistry.get(slot, key) ?? NullChromeSlot
  return (
    <ChromeSlotConfigProvider config={config}>
      {createElement(Shell)}
    </ChromeSlotConfigProvider>
  )
}