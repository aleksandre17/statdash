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
