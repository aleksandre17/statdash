// ── canvasSiteChrome — project the authoring session into the canvas's site chrome
//
//  The live canvas (CanvasView) mounts the REAL @statdash/react chrome shells
//  (InnerPageShell → <ChromeSlot slot="InnerSidebar"/>), which read the SAME site
//  context the runner feeds: useSiteNav() for the rail links, useSiteChrome() for
//  the slot variant + per-slot config, useChromeConfig() for the brand base. When
//  the canvas SiteProvider is mounted with an EMPTY nav/chrome (the pre-fix state),
//  the InnerSidebar resolves to a hollow default rail with zero links — the owner's
//  "broken mystery left bar". This projector is the panel's analogue of the runner's
//  manifest.{nav,chrome,chromeConfig} — it maps the Constructor's authoring session
//  (SiteDef + pages) into the exact shapes SiteProvider consumes, so the canvas rail
//  renders FAITHFULLY (WYSIWYG parity with the runner).
//
//  Law 3: this lives in apps/panel — the engine stays app-agnostic; we only re-shape
//  the panel's domain model into the engine's published context contracts.
//
import type { NavEntry, ChromeConfig } from '@statdash/react'
import type { ChromeEntry }            from '@statdash/react/engine'
import type { SiteDef, CanvasPage }    from '../types/constructor'

export interface CanvasSiteChrome {
  /** NavEntry[] for useSiteNav() — the sidebar rail links. */
  nav:           NavEntry[]
  /** Record<slot, ChromeEntry> for useSiteChrome() — variant + per-slot config. */
  chrome:        Record<string, ChromeEntry>
  /** Brand base for useChromeConfig(); absent ⇒ SiteProvider folds to EMPTY_CHROME_CONFIG. */
  chromeConfig?: ChromeConfig
}

// The neutral fallback nav icon token. A Constructor NavItem carries a label +
// target only (no per-entry icon), so every canvas nav entry uses this token; the
// sidebar's resolveNavIcon folds an unknown/absent token to a neutral glyph, so the
// rail always paints a real icon rather than an empty box.
const CANVAS_NAV_ICON = 'document'

// Per-entry accent: the empty string yields NO --sc override (accentStyle returns
// undefined for a falsy colour), so the sidebar CSS falls through to its authored
// default — `var(--sc, var(--color-accent))`. Faithful WITHOUT hardcoding a token
// value here (Law: theming stays in the token layer, not in app literals).
const CANVAS_NAV_COLOR = ''

/**
 * Project the authoring session's site + pages into the canvas SiteProvider's
 * {nav, chrome, chromeConfig} — the runner-parity chrome inputs.
 *
 * - nav:    each NavItem → NavEntry; the route path is derived from the target
 *           page's slug (the same `/${slug}` shape the runner builds), so the rail
 *           links resolve to real page paths. A nav item pointing at a not-yet-
 *           loaded page falls back to its pageId (never an empty path).
 * - chrome: the SiteDef.chrome map IS the engine ChromeEntry map by contract
 *           (ChromeSlotConfig ⊂ ChromeEntry; it serializes straight to
 *           SiteManifest.chrome), so it passes through verbatim.
 * - chromeConfig: a minimal brand base built from the authored logo/name; omitted
 *           when no logo is set so the canvas stays fail-soft (EMPTY_CHROME_CONFIG).
 */
export function projectCanvasSiteChrome(site: SiteDef, pages: CanvasPage[]): CanvasSiteChrome {
  const slugByPageId = new Map(pages.map((p) => [p.id, p.slug]))

  const nav: NavEntry[] = site.nav.map((n) => ({
    id:    n.id,
    label: n.label,
    icon:  CANVAS_NAV_ICON,
    items: [],
    path:  `/${slugByPageId.get(n.pageId) ?? n.pageId}`,
    color: CANVAS_NAV_COLOR,
  }))

  const chrome = site.chrome as Record<string, ChromeEntry>

  const chromeConfig: ChromeConfig | undefined = site.logo
    ? { logoUrl: site.logo, logoAlt: site.name || site.logo }
    : undefined

  return { nav, chrome, chromeConfig }
}
