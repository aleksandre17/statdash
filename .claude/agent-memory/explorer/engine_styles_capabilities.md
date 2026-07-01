---
name: engine_styles_capabilities
description: @geostat/styles design tokens, resolvers, and validators for Constructor UI
metadata:
  type: reference
  source: engine/styles/src/**/*.ts
---

# @geostat/styles — Design System Catalog

Complete style system for responsive layouts. All JSON-serializable (no functions). Constructor-ready.

## Design Tokens

### Spacing Scale (4px grid base)

```typescript
const SPACING = {
  xs:    'var(--spacing-xs)',
  sm:    'var(--spacing-sm)',
  md:    'var(--spacing-md)',
  lg:    'var(--spacing-lg)',
  xl:    'var(--spacing-xl)',
  '2xl': 'var(--spacing-2xl)',
}
```

Helper: `spacing(n: number) → '${n * 0.25}rem'` (e.g., spacing(4) → '1rem')

### Border Radius

```typescript
const RADII = {
  sm:   'var(--radius-sm)',
  md:   'var(--radius-md)',
  lg:   'var(--radius-lg)',
  card: 'var(--radius-card)',
  pill: 'var(--radius-pill)',
}
```

### Shadows

```typescript
const SHADOW = {
  sm:      'var(--shadow-sm)',
  md:      'var(--shadow-md)',
  card:    'var(--shadow-card)',
  overlay: 'var(--shadow-overlay)',
}
```

### Aspect Ratios

```typescript
const ASPECT = {
  '16:9': '16 / 9',
  '4:3':  '4 / 3',
  '1:1':  '1 / 1',
  '21:9': '21 / 9',
  '3:2':  '3 / 2',
}
```

Helper: `ratio(w: number, h: number) → '${w} / ${h}'`

### Breakpoints (px)

```typescript
const BREAKPOINTS = {
  sm: 640,   // ≤640px
  md: 960,   // ≤960px
  lg: 1280,  // ≤1280px
}
```

### Transitions

```typescript
const TRANSITION = {
  none:   'none',
  fast:   'var(--transition-fast)',
  smooth: 'var(--transition-smooth)',
  slow:   'var(--transition-slow)',
}
```

## NodeStyles — Full Presentational Spec

```typescript
interface NodeStyles {
  // Sizing
  height?: ResponsiveVal<StyleValue>
  width?: ResponsiveVal<StyleValue>
  minHeight?: ResponsiveVal<StyleValue>
  maxHeight?: ResponsiveVal<StyleValue>
  aspectRatio?: ResponsiveVal<string>

  // Spacing
  padding?: ResponsiveVal<string>
  margin?: ResponsiveVal<string>
  gap?: ResponsiveVal<string>

  // Grid/flex item placement
  colSpan?: ResponsiveVal<number>
  rowSpan?: ResponsiveVal<number>
  align?: ResponsiveVal<string>
  justify?: ResponsiveVal<string>
  order?: ResponsiveVal<number>

  // Overflow
  overflow?: ResponsiveVal<'hidden' | 'auto' | 'visible' | 'scroll'>

  // Visual
  opacity?: ResponsiveVal<number>

  // Motion
  transition?: string    // TRANSITION token or raw CSS

  // Conditional overrides
  conditions?: StyleCond[]
}
```

## ResponsiveVal — Per-Breakpoint Values

```typescript
type ResponsiveVal<T> = T | { default?: T; md?: T; sm?: T }
```

Flat T → applied at all breakpoints. Object → per-breakpoint override.

## StyleValue Types

```typescript
type StyleValue = string | number | FluidValue

// Fluid clamp() — responsive sizing without hardcoded breakpoints
interface FluidValue {
  fluid: true
  min: string           // clamp min
  max: string           // clamp max
  preferred?: string    // clamp middle (auto: (min+max)/2)
}
```

Helper: `fluid(min: string, max: string, preferred?: string) → FluidValue`

## Conditional Styles

```typescript
interface StyleCond {
  when: StyleExpr              // condition to evaluate
  apply: Omit<NodeStyles, 'conditions'>  // styles to apply if true
}

type StyleExpr =
  | { param: string; is: unknown }       // filter param == value
  | { param: string; not: unknown }      // filter param != value
  | { mode: string }                     // active mode key matches
```

## Resolvers (Config → DOM Attrs)

### applyNodeStyles — Universal

```typescript
applyNodeStyles(styles?: NodeStyles, base?: string): StyleAttrs
```

Returns: `{ className, style?, data-height?, data-aspect?, ...data-* }`

**Data attributes (CSS hooks):**
- `data-height` — token name or 'constrained'
- `data-aspect` — presence flag (CSS reads --ar-default, --ar-md, --ar-sm)

### applyViewStyles — Shell Wrapper

```typescript
applyViewStyles(view?: {
  width?: 'full' | 'half' | 'third'
  styles?: NodeStyles
}): { panel: StyleAttrs; body: BodyStyleAttrs }
```

Returns panel (wrapper) + body (content) attrs separately.

### applyPanelStyles — Panel Column

```typescript
applyPanelStyles(config: {
  width?: 'full' | 'half' | 'third'
  styles?: NodeStyles
}): StyleAttrs
```

Combines layout shorthand + height data-attribute.

### applyContainerVars — Layout Gap

```typescript
applyContainerVars(gap?: ResponsiveVal<string>): Record<string, string> | undefined
```

Returns CSS custom property: `{ '--layout-gap': gap }` or undefined.

### resolveColumns — Grid Template

```typescript
resolveColumns(val?: ResponsiveVal<number>, fallback?: number):
  { default: number; md: number; sm: number }
```

Translates column count ResponsiveVal to breakpoint object.

### resolveLayoutItem — Grid/Flex Item

```typescript
resolveLayoutItem(styles?: NodeStyles): Record<string, string | number> | null
```

Returns CSS grid/flex properties: gridColumn, gridRow, alignSelf, justifySelf, order.

### resolveViewState — Visibility

```typescript
resolveViewState(hidden: boolean): { 'data-view': 'hidden'|'visible'; 'aria-hidden'?: true }
```

Maps boolean to accessibility attributes.

### resolveConditionStyles — Conditional Merge

```typescript
resolveConditionStyles(
  conditions: StyleCond[] | undefined,
  filterParams: Record<string, unknown>,
  mode: string
): NodeStyles
```

Evaluates all matching conditions, merges resulting styles.

## Composition Utilities

```typescript
mergeStyles(a: NodeStyles, b: NodeStyles): NodeStyles
  // b fills gaps in a; conditions concatenated

overrideStyles(base: NodeStyles, patch: Partial<NodeStyles>): NodeStyles
  // alias: patch wins

pickStyles<K extends keyof NodeStyles>(styles: NodeStyles, keys: K[]): Pick<NodeStyles, K>
  // projection

omitStyles<K extends keyof NodeStyles>(styles: NodeStyles, keys: K[]): Omit<NodeStyles, K>
  // exclusion
```

## Validation

```typescript
interface StyleIssue {
  field: keyof NodeStyles
  code: string
  message: string
  severity: 'error' | 'warning' | 'info'
}

validateNodeStyles(styles: NodeStyles | undefined): StyleIssue[]
```

Detects:
- `CONFLICT_HEIGHT_ASPECT` — explicit height + aspectRatio.default
- `OPACITY_OUT_OF_RANGE` — opacity outside [0, 1]
- `FLUID_MISSING_BOUNDS` — FluidValue without min/max
- `BOTH_MARGIN_PADDING` — info-level reminder

## SSR / Codegen

```typescript
toCSSVars(styles?: NodeStyles): Record<string, string>
  // Extract CSS custom properties (--ar-*, etc)

toDataAttrs(styles?: NodeStyles): Record<string, string>
  // Extract data-* attributes

toStyleString(styles?: NodeStyles): string
  // Inline style string: 'height:300px;padding:1rem'
```
