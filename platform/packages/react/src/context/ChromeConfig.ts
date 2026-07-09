import type { LocaleString } from '@statdash/engine'

// ── ChromeConfig — THIN cross-cutting brand base ──────────────────────
//
//  STRICT SOLID — the shared chrome base carries ONLY genuinely cross-cutting
//  brand identity: fields read by ≥2 chrome shells, OR true site singletons
//  (one logo / one locale-label set per site). Element-specific config — a
//  field read by exactly ONE shell that is NOT a site singleton — does NOT
//  belong here; it lives on that element's meta.ts PropSchema and is injected
//  as the slot's per-instance config (useSlotConfig). This is the ISP/OCP
//  boundary: a new chrome element is a new schema, this base untouched.
//
//  KEEP list (the SSOT, enforced by chrome-config.fitness.test.ts F1):
//    logoUrl, logoAlt   — site singleton: the one brand logo (app-header today;
//                         any future shell rendering the logo reads the same one).
//    copyright          — ≥2 consumers: app-footer + inner-sidebar.
//    localeLabels       — site singleton: the one locale-display-label map,
//                         read by the locale-switcher (and any future shell).
//
//  Migrated OUT (now per-element, see each element's meta.ts):
//    brandTitle, sectionsLabel → inner-sidebar/default/meta.ts (InnerSidebarConfig)
//    socialLinks               → app-header/default/meta.ts  (AppHeaderConfig)
//    footerLinks               → app-footer/default/meta.ts  (AppFooterConfig)
//
//  Chrome shells read the base from useChromeConfig(); element config from
//  useSlotConfig<T>(). Constructor Phase 2: chromeConfig + per-slot config both
//  come from the API alongside pages.
//
export interface ChromeConfig {
  // ── Brand identity — site singleton (the one logo).
  logoUrl:       LocaleString
  logoAlt:       LocaleString

  // ── Locale display labels — site singleton; replaces hardcoded locale codes.
  //  Falls back to locale.toUpperCase() if a key is absent.
  localeLabels?: Record<string, string>

  // ── Copyright — cross-cutting: read by ≥2 shells (footer + sidebar).
  copyright?:    LocaleString
}

// ── EMPTY_CHROME_CONFIG — the brand-free sentinel (fail-soft chrome) ───────
//
//  The canonical "no tenant brand configured" ChromeConfig: every field absent.
//  This is NOT a degraded/error state — it is a VALID chrome config that shells
//  already fully support, because each chrome shell reads every field defensively
//  (AppHeader's `hasBrand` logo guard, footer/sidebar `config.copyright &&`,
//  locale-switcher `config.localeLabels?.[l]`). Two independent call sites already
//  produce exactly this shape at runtime:
//    • an app-tier offline fallback manifest that ships `chromeConfig: {}` when the
//      bootstrap API is unreachable (the brand-free "site unavailable" state).
//    • any SiteProvider mounted WITHOUT a chromeConfig (e.g. the Constructor's live
//      authoring canvas), where useChromeConfig() folds to this sentinel.
//
//  Frozen so it is a shared singleton and can never be mutated by a consumer.
//  The `as ChromeConfig` mirrors the sanctioned app-tier offline-fallback cast: the
//  two required brand-identity fields are optional IN PRACTICE (the header guards
//  them), and this is the one blessed place that names that reality — so no other
//  call site needs its own cast (the offline-fallback manifest may adopt it).
export const EMPTY_CHROME_CONFIG: ChromeConfig = Object.freeze({}) as ChromeConfig
