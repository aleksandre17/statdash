// ── @statdash/styles — Spacing / sizing / structural tokens ────────────
//
//  Spacing scale, border radii, border widths, semantic sizes, blur,
//  opacity, z-index. All reference CSS custom properties in tokens.css.
//  SSOT: the value lives in CSS; these constants are typed var() refs.
//

export const SPACING = {
  '0':   'var(--spacing-0)',
  xs:    'var(--spacing-xs)',
  sm:    'var(--spacing-sm)',
  md:    'var(--spacing-md)',
  lg:    'var(--spacing-lg)',
  xl:    'var(--spacing-xl)',
  '2xl': 'var(--spacing-2xl)',
  '3xl': 'var(--spacing-3xl)',
  '4xl': 'var(--spacing-4xl)',
} as const satisfies Record<string, string>

export const RADII = {
  none: 'var(--radius-none)',
  xs:   'var(--radius-xs)',
  sm:   'var(--radius-sm)',
  md:   'var(--radius-md)',
  lg:   'var(--radius-lg)',
  xl:   'var(--radius-xl)',
  '2xl':'var(--radius-2xl)',
  card: 'var(--radius-card)',
  pill: 'var(--radius-pill)',
} as const satisfies Record<string, string>

export const BORDER_WIDTH = {
  thin:  'var(--border-width-thin)',
  base:  'var(--border-width-base)',
  thick: 'var(--border-width-thick)',
} as const satisfies Record<string, string>

// Semantic structural dimensions — icon sizes and container max-widths.
// For width/height/maxWidth on structural nodes (not arbitrary spacing).
export const SIZE = {
  iconSm:          'var(--size-icon-sm)',
  iconMd:          'var(--size-icon-md)',
  iconLg:          'var(--size-icon-lg)',
  containerNarrow: 'var(--size-container-narrow)',
  containerMid:    'var(--size-container-mid)',
  containerWide:   'var(--size-container-wide)',
} as const satisfies Record<string, string>

// Backdrop blur radii — for backdropFilter: var(--blur-md) (frosted glass).
export const BLUR = {
  sm: 'var(--blur-sm)',
  md: 'var(--blur-md)',
  lg: 'var(--blur-lg)',
} as const satisfies Record<string, string>

// Opacity tokens — disabled/muted/ghost states. Unitless numbers as CSS vars.
export const OPACITY = {
  disabled: 'var(--opacity-disabled)',
  muted:    'var(--opacity-muted)',
  ghost:    'var(--opacity-ghost)',
} as const satisfies Record<string, string>

export const Z_INDEX = {
  base:         'var(--z-base)',
  raised:       'var(--z-raised)',
  dropdown:     'var(--z-dropdown)',
  sticky:       'var(--z-sticky)',
  overlay:      'var(--z-overlay)',
  modal:        'var(--z-modal)',
  tooltip:      'var(--z-tooltip)',
  notification: 'var(--z-notification)',
  max:          'var(--z-max)',
} as const satisfies Record<string, string>

export type SpacingToken     = typeof SPACING[keyof typeof SPACING]
export type RadiiToken       = typeof RADII[keyof typeof RADII]
export type BorderWidthToken = typeof BORDER_WIDTH[keyof typeof BORDER_WIDTH]
export type SizeToken        = typeof SIZE[keyof typeof SIZE]
export type BlurToken        = typeof BLUR[keyof typeof BLUR]
export type OpacityToken     = typeof OPACITY[keyof typeof OPACITY]
export type ZIndexToken      = typeof Z_INDEX[keyof typeof Z_INDEX]
