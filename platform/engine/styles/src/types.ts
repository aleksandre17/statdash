// ── @geostat/styles — Type system ────────────────────────────────────
//
//  Architecture (Builder.io/Plasmic pattern):
//    ResponsiveVal<T> — flat value OR per-breakpoint object
//    NodeStyles       — all presentational properties, all responsive-capable
//    StyleAttrs       — DOM-spreadable result of any resolver
//    JSON-serializable — Constructor-ready (no functions, no class instances)
//
//  Breakpoints:
//    md = ≤960px container width
//    sm = ≤640px container width
//

// ── Primitive style values ────────────────────────────────────────────

// A single style dimension — px number, CSS string, or fluid clamp spec.
export type StyleValue = string | number | FluidValue

// Fluid responsive value — resolves to CSS clamp(min, preferred, max).
// Usage: fluid('280px', '480px') — zero hardcoded breakpoints.
export interface FluidValue {
  fluid:      true
  min:        string
  max:        string
  preferred?: string   // omitted → resolver picks a sensible midpoint
}

// Per-property responsive values (Builder.io/Plasmic pattern).
// Flat value = applied at all breakpoints.
// Object form = per-breakpoint override; undefined breakpoints inherit from larger.
export type ResponsiveVal<T> = T | { default?: T; md?: T; sm?: T }

// Normalized form — always an object (output of resolveResponsive).
export type ResolvedResponsive<T> = { default?: T; md?: T; sm?: T }

// ── DOM attribute types ────────────────────────────────────────────────

// Allow spreading onto DOM elements — any data-* attribute.
export type DataAttrs = { [K in `data-${string}`]?: string }

// Complete spreadable attrs for any visible element.
// className always present (safe to spread even when empty string).
export type StyleAttrs = { className: string; style?: Record<string, string> } & DataAttrs

// Body/content area attrs — no className (shell provides its own BEM class).
export type BodyStyleAttrs = Omit<StyleAttrs, 'className'>

// ── Condition system ───────────────────────────────────────────────────

// Expression that evaluates against runtime context.
// Used in StyleCond.when — pure JSON, Constructor-ready.
export type StyleExpr =
  | { param: string; is:  unknown }   // filter param equals value
  | { param: string; not: unknown }   // filter param not equals value
  | { mode:  string }                 // active mode key matches

// Conditional style override — applies when `when` evaluates to true.
// Evaluated by resolveConditionStyles() at render time.
export interface StyleCond {
  when:  StyleExpr
  apply: Omit<NodeStyles, 'conditions'>   // no nested conditions
}

// ── NodeStyles — full style spec ───────────────────────────────────────
//
//  All CSS-level presentational properties, all responsive-capable.
//  Placement props (colSpan, rowSpan, align, justify, order) are set by
//  child in view.styles and consumed by the parent layout container shell.
//
export interface NodeStyles {
  // ── Sizing ───────────────────────────────────────────────────────
  height?:      ResponsiveVal<StyleValue>
  width?:       ResponsiveVal<StyleValue>
  minHeight?:   ResponsiveVal<StyleValue>
  maxHeight?:   ResponsiveVal<StyleValue>
  // Responsive aspect-ratio — emits data-aspect + --ar-* CSS vars.
  // node-styles.css applies responsive behavior via [data-aspect].
  aspectRatio?: ResponsiveVal<string>
  // ── Spacing ──────────────────────────────────────────────────────
  padding?:     ResponsiveVal<string>
  margin?:      ResponsiveVal<string>
  gap?:         ResponsiveVal<string>
  // ── Grid / flex item placement (consumed by parent container) ────
  colSpan?:     ResponsiveVal<number>
  rowSpan?:     ResponsiveVal<number>
  align?:       ResponsiveVal<string>
  justify?:     ResponsiveVal<string>
  order?:       ResponsiveVal<number>
  // ── Overflow ─────────────────────────────────────────────────────
  overflow?:    ResponsiveVal<'hidden' | 'auto' | 'visible' | 'scroll'>
  // ── Visual ───────────────────────────────────────────────────────
  opacity?:     ResponsiveVal<number>
  // ── Motion ───────────────────────────────────────────────────────
  // Use TRANSITION token constants or a raw CSS value.
  transition?:  string
  // ── Conditional overrides (Constructor-driven) ───────────────────
  // Evaluated at render time by resolveConditionStyles(conditions, ctx).
  conditions?:  StyleCond[]
}