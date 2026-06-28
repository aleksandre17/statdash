// ── @statdash/styles — Public API ──────────────────────────────────────
//
//  Import from '@statdash/styles' for all style system needs.
//  CSS: import '@statdash/styles/css' in your root stylesheet.
//

// ── Core types ────────────────────────────────────────────────────────
export type {
  StyleValue,
  FluidValue,
  Breakpoint,
  ResponsiveVal,
  ResolvedResponsive,
  DataAttrs,
  StyleAttrs,
  BodyStyleAttrs,
  NodeStyles,
  PseudoStyles,
  ColorValue,
  StyleCond,
  StyleExpr,
} from './types'

// ── Core helpers ──────────────────────────────────────────────────────
export {
  resolveResponsive,
  parseStyleValue,
  isFluidValue,
  isAspectRatio,
} from './resolve'

// ── Resolvers — config → DOM attrs (spread directly on elements) ──────
export {
  applyNodeStyles,
  applyViewStyles,
} from './resolvers/node'

export { applyPanelStyles } from './resolvers/panel'

export {
  applyContainerVars,
  resolveColumns,
  resolveLayoutItem,
} from './resolvers/layout'

export { resolveViewState }      from './resolvers/view'
export type { ViewStateAttrs }   from './resolvers/view'

export { resolveVariants }       from './resolvers/variant'
export type {
  VariantDefShape,
  VariantSchemaShape,
  AuthoredVariants,
} from './resolvers/variant'

export { resolveConditionStyles } from './resolvers/condition'

// ── Composition utilities ─────────────────────────────────────────────
export {
  mergeStyles,
  overrideStyles,
  pickStyles,
  omitStyles,
} from './utils/compose'

// ── Style helpers ─────────────────────────────────────────────────────
export { px, ratio, fluid, spacing } from './utils/helpers'

// ── Token resolution (computed value for SVG-attr / JS-parsed fills) ──
export { cssVar } from './utils/cssVar'
export { chartPalette, chartColorAt, CHART_PALETTE_SIZE } from './utils/palette'
export { tokenCssVar, tokenColorLiteral, isRegisteredColorToken } from './utils/tokenColor'

// ── Reduced-motion guard (JS half of the motion baseline; CSS half = animations.css) ──
export {
  prefersReducedMotion,
  motionSafeScrollBehavior,
  REDUCED_MOTION_QUERY,
} from './utils/motion'

// ── Validation ────────────────────────────────────────────────────────
export { validateNodeStyles }    from './utils/validate'
export type { StyleIssue }       from './utils/validate'

// ── CSS codegen (SSR · Constructor preview · debugging) ───────────────
export { toCSSVars, toDataAttrs, toStyleString } from './utils/codegen'

// ── Design tokens (TS constants → CSS var() references) ──────────────
export {
  SPACING,
  RADII,
  BORDER_WIDTH,
  SIZE,
  BLUR,
  OPACITY,
  SHADOW,
  ASPECT,
  BREAKPOINTS,
  TRANSITION,
  DURATION,
  EASING,
  FONT_SIZE,
  FLUID_FONT_SIZE,
  FONT_WEIGHT,
  LINE_HEIGHT,
  LETTER_SPACING,
  FONT_FAMILY,
  GRAY,
  COLOR,
  STATUS,
  CHART_COLOR,
  Z_INDEX,
} from './tokens'
export type {
  SpacingToken,
  RadiiToken,
  BorderWidthToken,
  SizeToken,
  BlurToken,
  OpacityToken,
  ShadowToken,
  AspectToken,
  TransitionToken,
  DurationToken,
  EasingToken,
  FontSizeToken,
  FluidFontSizeToken,
  FontWeightToken,
  LineHeightToken,
  LetterSpacingToken,
  FontFamilyToken,
  GrayToken,
  ColorToken,
  StatusToken,
  ChartColorToken,
  ZIndexToken,
  BreakpointKey,
  BreakpointValue,
} from './tokens'

// ── Token Capability Catalog — Self-Describing Module (Panel / Constructor) ─
export type { TokenGroup, TokenDescriptor } from './tokens-catalog'
export { TOKENS_CATALOG }                   from './tokens-catalog'