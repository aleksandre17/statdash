// ── styleKeys — the app-header slice's typed class-name + variant SSOT ──
//
//  The static BEM class names live in EXACTLY ONE place (a CSS rename is a single
//  typed edit), and the appearance VARIANT is expressed as a `data-*` attribute,
//  never a modifier class or a wrapper-div scope. Mirrors the section slice's
//  styleKeys.ts. No hashed names → byte-identical with the global `.app-header*`
//  selectors and the token cascade.
//

export const HEADER = {
  block:       'app-header',
  inner:       'app-header__inner',
  brand:       'app-header__brand',
  logo:        'app-header__logo',
  nav:         'app-header__nav',
  navLink:     'app-header__nav-link',
  actions:     'app-header__actions',
  social:      'app-header__social',
  socialLink:  'app-header__social-link',
  socialIcon:  'app-header__social-icon',
  /** Appearance variant attribute — CSS reads `[data-surface="…"]`. */
  surfaceAttr: 'data-surface',
} as const

// ── HeaderSurface — the header's appearance variant axis ──────────────
//
//  'opaque'      — the default solid header (attr omitted; base CSS applies).
//  'transparent' — frosted-glass overlay (the former app-header/transparent
//                  wrapper-div hack, now a declared `[data-surface]` attribute).
//
//  A new appearance = one value here + one `.app-header[data-surface="…"]` rule.
export type HeaderSurface = 'opaque' | 'transparent'
