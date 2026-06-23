// ── @statdash/styles — Design token registry (barrel) ─────────────────
//
//  Single source of truth for all platform design tokens.
//  CSS side: css/tokens.css emits :root custom properties (the values).
//  TS side: these constants are typed references to those properties.
//  Usage in config: { padding: SPACING.md } → 'var(--spacing-md)'
//
//  Split by concern (one-body hygiene; the file exceeded the 400-line
//  ceiling once chart / status / fluid / motion tokens landed):
//    tokens/spacing    — spacing · radii · border-width · size · blur · opacity · z-index
//    tokens/effects    — shadow · aspect · breakpoints
//    tokens/animation  — transition · duration · easing
//    tokens/typography — font-size · fluid-font-size · weight · line-height · letter-spacing · family
//    tokens/color      — gray scale · semantic color · status · chart palette
//

export {
  SPACING, RADII, BORDER_WIDTH, SIZE, BLUR, OPACITY, Z_INDEX,
} from './tokens/spacing'
export type {
  SpacingToken, RadiiToken, BorderWidthToken, SizeToken, BlurToken, OpacityToken, ZIndexToken,
} from './tokens/spacing'

export { SHADOW, ASPECT, BREAKPOINTS } from './tokens/effects'
export type {
  ShadowToken, AspectToken, BreakpointKey, BreakpointValue,
} from './tokens/effects'

export { TRANSITION, DURATION, EASING } from './tokens/animation'
export type { TransitionToken, DurationToken, EasingToken } from './tokens/animation'

export {
  FONT_SIZE, FLUID_FONT_SIZE, FONT_WEIGHT, LINE_HEIGHT, LETTER_SPACING, FONT_FAMILY,
} from './tokens/typography'
export type {
  FontSizeToken, FluidFontSizeToken, FontWeightToken,
  LineHeightToken, LetterSpacingToken, FontFamilyToken,
} from './tokens/typography'

export { GRAY, COLOR, STATUS, CHART_COLOR } from './tokens/color'
export type { GrayToken, ColorToken, StatusToken, ChartColorToken } from './tokens/color'
