// ── @geostat/styles — Type system ────────────────────────────────────
//
//  Architecture (Builder.io/Plasmic pattern):
//    ResponsiveVal<T> — flat value OR per-breakpoint object
//    NodeStyles       — all presentational properties, all responsive-capable
//    StyleAttrs       — DOM-spreadable result of any resolver
//    JSON-serializable — Constructor-ready (no functions, no class instances)
//
//  Breakpoints (mobile-first names, desktop-default max-width cascade):
//    xs  = ≤480px    sm = ≤640px    md = ≤768px
//    lg  = ≤1024px   xl = ≤1280px   2xl = ≤1536px
//  A per-breakpoint override applies at that width and down, inheriting
//  from the next-larger key when unset (see resolveResponsive / node-styles.css).
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

// The ordered breakpoint keys, largest → smallest (matches the desktop-default
// max-width cascade). `default` is the unconstrained (widest) value.
// SSOT for the responsive key set — resolveResponsive + the catalog derive from it.
export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

// Per-property responsive values (Builder.io/Plasmic pattern).
// Flat value = applied at all breakpoints.
// Object form = per-breakpoint override; undefined breakpoints inherit from larger.
export type ResponsiveVal<T> =
  | T
  | { default?: T; '2xl'?: T; xl?: T; lg?: T; md?: T; sm?: T; xs?: T }

// Normalized form — always an object (output of resolveResponsive).
export type ResolvedResponsive<T> =
  { default?: T; '2xl'?: T; xl?: T; lg?: T; md?: T; sm?: T; xs?: T }

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

// ── PseudoStyles — interaction-state style subset ──────────────────────
//
//  A restricted subset of NodeStyles applied on a pseudo-state
//  (:hover / :focus-visible / :active). Pure JSON object — Law-2 legal
//  (no functions). The resolver flattens each property to an --on-<state>-*
//  custom property + a data-<state> presence flag; node-styles.css reads
//  those vars in the matching pseudo-class rule. Zero runtime injection.
//
//  Only the enumerated, governed surface below can change on interaction —
//  this is deliberate (a Constructor palette shows exactly these). It is NOT
//  responsive: a pseudo-state is already a conditional; nesting breakpoints
//  inside it adds combinatorial CSS for no real dashboard use case (YAGNI).
//
export interface PseudoStyles {
  color?:           ColorValue
  backgroundColor?: ColorValue
  borderColor?:     ColorValue
  boxShadow?:       string
  opacity?:         number
  transform?:       string
}

// Color value — a token var() ref, hex, rgb(), hsl(), or named color.
// Kept as a string (open-ended) like padding; see ColorToken for tokens.
export type ColorValue = string

// ── NodeStyles — full style spec ───────────────────────────────────────
//
//  All CSS-level presentational properties, all responsive-capable.
//  Placement props (colSpan, rowSpan, align, justify, order) are set by
//  child in view.styles and consumed by the parent layout container shell.
//
//  Design line (D5): this is a *design system*, not a CSSProperties mirror.
//  Included axes serve a statistical dashboard; out-of-scope CSS (float,
//  clip-path, blend modes, per-side border objects, grid-template on the
//  node) is deliberately absent — layout templating is the container's job.
//
export interface NodeStyles {
  // ── Sizing ───────────────────────────────────────────────────────
  height?:      ResponsiveVal<StyleValue>
  width?:       ResponsiveVal<StyleValue>
  minHeight?:   ResponsiveVal<StyleValue>
  maxHeight?:   ResponsiveVal<StyleValue>
  minWidth?:    ResponsiveVal<StyleValue>
  maxWidth?:    ResponsiveVal<StyleValue>
  // Responsive aspect-ratio — emits data-aspect + --ar-* CSS vars.
  // node-styles.css applies responsive behavior via [data-aspect].
  aspectRatio?: ResponsiveVal<string>
  // ── Spacing ──────────────────────────────────────────────────────
  padding?:     ResponsiveVal<string>
  margin?:      ResponsiveVal<string>
  gap?:         ResponsiveVal<string>
  // ── Display / flex-self (this node as a flex container or item) ──
  display?:        ResponsiveVal<'block' | 'flex' | 'inline-flex' | 'grid' | 'inline-block' | 'none'>
  flexDirection?:  ResponsiveVal<'row' | 'column' | 'row-reverse' | 'column-reverse'>
  flexWrap?:       ResponsiveVal<'nowrap' | 'wrap' | 'wrap-reverse'>
  alignItems?:     ResponsiveVal<string>
  justifyContent?: ResponsiveVal<string>
  flex?:           ResponsiveVal<string>
  flexGrow?:       ResponsiveVal<number>
  flexShrink?:     ResponsiveVal<number>
  flexBasis?:      ResponsiveVal<StyleValue>
  // ── Grid / flex item placement (consumed by parent container) ────
  colSpan?:     ResponsiveVal<number>
  rowSpan?:     ResponsiveVal<number>
  align?:       ResponsiveVal<string>
  justify?:     ResponsiveVal<string>
  order?:       ResponsiveVal<number>
  // ── Position ─────────────────────────────────────────────────────
  position?:    ResponsiveVal<'static' | 'relative' | 'absolute' | 'sticky' | 'fixed'>
  top?:         ResponsiveVal<StyleValue>
  right?:       ResponsiveVal<StyleValue>
  bottom?:      ResponsiveVal<StyleValue>
  left?:        ResponsiveVal<StyleValue>
  zIndex?:      ResponsiveVal<number | string>
  // ── Overflow ─────────────────────────────────────────────────────
  overflow?:    ResponsiveVal<'hidden' | 'auto' | 'visible' | 'scroll'>
  // Per-axis overflow — common for wide tables / charts (overflowX: scroll).
  overflowX?:   ResponsiveVal<'hidden' | 'auto' | 'visible' | 'scroll'>
  overflowY?:   ResponsiveVal<'hidden' | 'auto' | 'visible' | 'scroll'>
  // ── Typography ───────────────────────────────────────────────────
  fontFamily?:    ResponsiveVal<string>
  fontSize?:      ResponsiveVal<StyleValue>
  fontWeight?:    ResponsiveVal<number | string>
  fontStyle?:     ResponsiveVal<'normal' | 'italic'>
  lineHeight?:    ResponsiveVal<number | string>
  letterSpacing?: ResponsiveVal<string>
  textAlign?:     ResponsiveVal<'left' | 'right' | 'center' | 'justify' | 'start' | 'end'>
  textTransform?: ResponsiveVal<'none' | 'uppercase' | 'lowercase' | 'capitalize'>
  textOverflow?:  ResponsiveVal<'clip' | 'ellipsis'>
  whiteSpace?:    ResponsiveVal<'normal' | 'nowrap' | 'pre' | 'pre-wrap' | 'pre-line'>
  color?:         ResponsiveVal<ColorValue>
  // ── Background ───────────────────────────────────────────────────
  backgroundColor?:    ResponsiveVal<ColorValue>
  background?:         ResponsiveVal<string>   // gradient / shorthand
  backgroundImage?:    ResponsiveVal<string>
  backgroundSize?:     ResponsiveVal<string>
  backgroundPosition?: ResponsiveVal<string>
  backgroundRepeat?:   ResponsiveVal<string>
  // ── Border (shorthand + radius + decomposed; no per-side objects) ─
  border?:       ResponsiveVal<string>
  borderRadius?: ResponsiveVal<StyleValue>
  borderColor?:  ResponsiveVal<ColorValue>
  borderWidth?:  ResponsiveVal<StyleValue>
  borderStyle?:  ResponsiveVal<'none' | 'solid' | 'dashed' | 'dotted'>
  // ── Box ──────────────────────────────────────────────────────────
  boxShadow?:   ResponsiveVal<string>
  // ── Visual ───────────────────────────────────────────────────────
  opacity?:     ResponsiveVal<number>
  // visibility:hidden retains layout box (unlike display:none) — for
  // reserve-space toggles. collapse is table-row specific.
  visibility?:  ResponsiveVal<'visible' | 'hidden' | 'collapse'>
  // ── Transform (map overlays, geo markers, decorative rotation) ───
  transform?:       ResponsiveVal<string>
  transformOrigin?: ResponsiveVal<string>
  // ── Filters (grayscale disabled-state, blur overlays, frosted glass) ─
  filter?:         ResponsiveVal<string>
  backdropFilter?: ResponsiveVal<string>
  // Forces a new stacking context — pairs with position/zIndex/backdropFilter.
  isolation?:   ResponsiveVal<'auto' | 'isolate'>
  // ── Media fit (image / media nodes) ──────────────────────────────
  objectFit?:      ResponsiveVal<'fill' | 'contain' | 'cover' | 'none' | 'scale-down'>
  objectPosition?: ResponsiveVal<string>
  // ── Interaction ──────────────────────────────────────────────────
  cursor?:        ResponsiveVal<string>
  pointerEvents?: ResponsiveVal<'auto' | 'none'>
  userSelect?:    ResponsiveVal<'auto' | 'none' | 'text' | 'all'>
  // ── Motion ───────────────────────────────────────────────────────
  // Use TRANSITION token constants or a raw CSS value.
  transition?:  string
  // ── Print ────────────────────────────────────────────────────────
  // Hide this node in the print / PDF-export flow (emits data-print-hide,
  // node-styles.css applies display:none inside @media print). Not responsive —
  // print is its own media context, orthogonal to viewport breakpoints.
  printHide?:   boolean
  // ── Pseudo-states (D2 / Option A — pure CSS, zero runtime injection) ─
  //  Flattened to --on-<state>-* vars + data-<state> flag by the resolver.
  hover?:  PseudoStyles
  focus?:  PseudoStyles   // applied via :focus-visible (keyboard-friendly)
  active?: PseudoStyles
  // ── Conditional overrides (Constructor-driven) ───────────────────
  // Evaluated at render time by resolveConditionStyles(conditions, ctx).
  conditions?:  StyleCond[]
}