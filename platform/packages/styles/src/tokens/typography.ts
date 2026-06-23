// ── @statdash/styles — Typography tokens ───────────────────────────────
//
//  Fixed font sizes (FONT_SIZE) stay for padding-coupled text where a
//  predictable px value matters. Fluid sizes (FLUID_FONT_SIZE) use clamp()
//  for display / headings that should scale smoothly with viewport width
//  (Utopia.fyi / Tailwind v4 pattern). Both are siblings — pick per use.
//

export const FONT_SIZE = {
  xs:    'var(--font-size-xs)',
  sm:    'var(--font-size-sm)',
  md:    'var(--font-size-md)',
  lg:    'var(--font-size-lg)',
  xl:    'var(--font-size-xl)',
  '2xl': 'var(--font-size-2xl)',
} as const satisfies Record<string, string>

export const FLUID_FONT_SIZE = {
  sm:      'var(--font-size-fluid-sm)',
  md:      'var(--font-size-fluid-md)',
  lg:      'var(--font-size-fluid-lg)',
  xl:      'var(--font-size-fluid-xl)',
  '2xl':   'var(--font-size-fluid-2xl)',
  display: 'var(--font-size-fluid-display)',
} as const satisfies Record<string, string>

export const FONT_WEIGHT = {
  regular:  'var(--font-weight-regular)',
  medium:   'var(--font-weight-medium)',
  semibold: 'var(--font-weight-semibold)',
  bold:     'var(--font-weight-bold)',
} as const satisfies Record<string, string>

export const LINE_HEIGHT = {
  tight:   'var(--line-height-tight)',
  normal:  'var(--line-height-normal)',
  relaxed: 'var(--line-height-relaxed)',
} as const satisfies Record<string, string>

export const LETTER_SPACING = {
  tight:  'var(--letter-spacing-tight)',
  normal: 'var(--letter-spacing-normal)',
  wide:   'var(--letter-spacing-wide)',
} as const satisfies Record<string, string>

export const FONT_FAMILY = {
  base: 'var(--font-family-base)',
  mono: 'var(--font-family-mono)',
} as const satisfies Record<string, string>

export type FontSizeToken      = typeof FONT_SIZE[keyof typeof FONT_SIZE]
export type FluidFontSizeToken = typeof FLUID_FONT_SIZE[keyof typeof FLUID_FONT_SIZE]
export type FontWeightToken    = typeof FONT_WEIGHT[keyof typeof FONT_WEIGHT]
export type LineHeightToken    = typeof LINE_HEIGHT[keyof typeof LINE_HEIGHT]
export type LetterSpacingToken = typeof LETTER_SPACING[keyof typeof LETTER_SPACING]
export type FontFamilyToken    = typeof FONT_FAMILY[keyof typeof FONT_FAMILY]
