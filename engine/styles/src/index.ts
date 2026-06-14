// ── @geostat/styles — Public API ──────────────────────────────────────
//
//  Import from '@geostat/styles' for all style system needs.
//  CSS: import '@geostat/styles/css' in your root stylesheet.
//

// ── Core types ────────────────────────────────────────────────────────
export type {
  StyleValue,
  FluidValue,
  ResponsiveVal,
  ResolvedResponsive,
  DataAttrs,
  StyleAttrs,
  BodyStyleAttrs,
  NodeStyles,
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

// ── Validation ────────────────────────────────────────────────────────
export { validateNodeStyles }    from './utils/validate'
export type { StyleIssue }       from './utils/validate'

// ── CSS codegen (SSR · Constructor preview · debugging) ───────────────
export { toCSSVars, toDataAttrs, toStyleString } from './utils/codegen'

// ── Design tokens (TS constants → CSS var() references) ──────────────
export {
  SPACING,
  RADII,
  SHADOW,
  ASPECT,
  BREAKPOINTS,
  TRANSITION,
} from './tokens'
export type {
  SpacingToken,
  RadiiToken,
  ShadowToken,
  AspectToken,
  TransitionToken,
} from './tokens'