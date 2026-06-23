import type { LocaleString } from '@statdash/engine'

export interface SocialLinkDef {
  href:   string
  label:  string       // aria-label for accessibility
  icon:   string       // SVG path d attribute
  fill?:  boolean      // true = filled, false = stroked
}

export interface FooterLinkDef {
  href:   string
  label:  LocaleString
}

// ── ChromeConfig — brand content channel ──────────────────────────────
//
//  Separates brand identity data from slot→variant routing
//  (which lives in SiteManifest.chrome: Record<string,string>).
//
//  Chrome shells read brand from useChromeConfig() — no hardcoded strings.
//  Constructor Phase 2: chromeConfig comes from the API alongside pages.
//
export interface ChromeConfig {
  // ── Brand identity
  logoUrl:       string
  logoAlt:       LocaleString

  // ── Locale display labels — replaces hardcoded 'ქარ', 'ENG'
  // Falls back to locale.toUpperCase() if key not present.
  localeLabels?: Record<string, string>

  // ── Header
  socialLinks?:  SocialLinkDef[]

  // ── Footer
  copyright?:    LocaleString
  footerLinks?:  FooterLinkDef[]
}