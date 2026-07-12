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
import { PartAnchor }                          from './partAnchor'
import type { ChromeEntry }                   from './types'

function pickVariant(e: ChromeEntry | undefined): string | undefined {
  if (typeof e === 'string') return e
  return e?.variant
}

// Returns the entry's config ONLY when it actually carries one. A string
// shorthand ('default') or an object without `config` yields undefined — NOT an
// empty object — so each facet resolves independently down the priority chain
// (page ?? site ?? {}). Mirrors resolveChrome's pickConfig: a page override that
// only changes the VARIANT must not erase the site-level slot config.
function pickConfig(e: ChromeEntry | undefined): Record<string, unknown> | undefined {
  if (typeof e === 'string' || e == null) return undefined
  return e.config
}

export function ChromeSlot({ slot }: { slot: string }): ReactNode {
  const pageChrome   = useChromeOverrides()
  const globalChrome = useSiteChrome()
  const pageEntry    = pageChrome[slot]
  const siteEntry    = globalChrome[slot]
  const key          = pickVariant(pageEntry) ?? pickVariant(siteEntry) ?? 'default'
  // Resolve config per-facet down the same priority chain as the variant:
  // page override → site default → empty. A variant-only page override (the
  // inner-page META default `{ InnerSidebar: 'default' }`) leaves config to fall
  // through to the site-level slot config (Grafana override-chain semantics).
  const config       = pickConfig(pageEntry) ?? pickConfig(siteEntry) ?? {}
  const Shell        = chromeRegistry.get(slot, key) ?? NullChromeSlot
  const rendered = (
    <ChromeSlotConfigProvider config={config}>
      {createElement(Shell)}
    </ChromeSlotConfigProvider>
  )
  // S6 — chrome is a declared `sourced` Part of the site-frame. Wrap the rendered slot in
  // the ONE generic `<PartAnchor field={slot} index={0}>` — keyed by the slot name (no
  // global ordinal), the SAME anchor every band-owning shell stamps. The CanvasOverlay
  // frames it by enumerating the site-frame's chrome parts through the port and querying
  // this anchor; a click selects the ONE `PartAddress` ({ SITE_FRAME_ID, chrome.<slot> }).
  // PartAnchor is INERT (zero DOM) off the authoring canvas — byte-identical runtime.
  return <PartAnchor field={slot} index={0}>{rendered}</PartAnchor>
}