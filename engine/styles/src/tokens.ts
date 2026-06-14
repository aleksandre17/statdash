// ── @geostat/styles — Design token registry ──────────────────────────
//
//  Single source of truth for all platform design tokens.
//  CSS side: tokens.css emits :root custom properties.
//  TS side: these constants reference those custom properties.
//  Usage in config: { padding: SPACING.md } → 'var(--spacing-md)'
//

export const SPACING = {
  xs:    'var(--spacing-xs)',
  sm:    'var(--spacing-sm)',
  md:    'var(--spacing-md)',
  lg:    'var(--spacing-lg)',
  xl:    'var(--spacing-xl)',
  '2xl': 'var(--spacing-2xl)',
} as const satisfies Record<string, string>

export const RADII = {
  sm:   'var(--radius-sm)',
  md:   'var(--radius-md)',
  lg:   'var(--radius-lg)',
  card: 'var(--radius-card)',
  pill: 'var(--radius-pill)',
} as const satisfies Record<string, string>

export const SHADOW = {
  sm:      'var(--shadow-sm)',
  md:      'var(--shadow-md)',
  card:    'var(--shadow-card)',
  overlay: 'var(--shadow-overlay)',
} as const satisfies Record<string, string>

// Canonical aspect-ratio strings — '16 / 9' format (CSS aspect-ratio value).
export const ASPECT = {
  '16:9': '16 / 9',
  '4:3':  '4 / 3',
  '1:1':  '1 / 1',
  '21:9': '21 / 9',
  '3:2':  '3 / 2',
} as const satisfies Record<string, string>

// Breakpoints in px (media query thresholds, not container queries).
export const BREAKPOINTS = {
  sm: 640,
  md: 960,
  lg: 1280,
} as const satisfies Record<string, number>

// Platform transition tokens — reference CSS custom properties.
export const TRANSITION = {
  none:   'none',
  fast:   'var(--transition-fast)',
  smooth: 'var(--transition-smooth)',
  slow:   'var(--transition-slow)',
} as const satisfies Record<string, string>

export type SpacingToken    = typeof SPACING[keyof typeof SPACING]
export type RadiiToken      = typeof RADII[keyof typeof RADII]
export type ShadowToken     = typeof SHADOW[keyof typeof SHADOW]
export type AspectToken     = typeof ASPECT[keyof typeof ASPECT]
export type TransitionToken = typeof TRANSITION[keyof typeof TRANSITION] | (string & {})