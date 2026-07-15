import type { ResponsiveVal, ResolvedResponsive, StyleValue, FluidValue } from './types'

// Normalize a ResponsiveVal to always-object form.
// Flat T    → { default: T }
// undefined → {}
// Object    → passthrough
// Note: FluidValue objects have { fluid, min, max } — NOT breakpoint keys.
// resolveResponsive correctly identifies them as flat values (not breakpoint objects).
//
// ── Breakpoint key orderings — the styles-package SSOT ──────────────────
//
//  The responsive resolver, the per-property var cascade (node.ts) and the
//  layout-gap cascade (layout.ts) all iterate the breakpoint key set. They
//  previously each re-declared a literal copy with a "keep in sync" comment.
//  These two exports are the single home (mirror the Breakpoint type in
//  types.ts and BREAKPOINTS in tokens/effects.ts).
//
//  Two orderings, both load-bearing:
//   • BREAKPOINT_KEYS  — mobile-first (small → large), default-first. Used for
//     object-form detection and the --ar-* aspect-ratio var emission.
//   • BREAKPOINT_KEYS_CASCADE — desktop-default (large → small), default-first.
//     Used where the EMISSION order must match the CSS max-width cascade so a
//     smaller breakpoint's rule wins (the --<prop>-<bp> cascade in node.ts).

/** Breakpoint keys, default-first, mobile-first (small → large). */
export const BREAKPOINT_KEYS = ['default', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const

/** Breakpoint keys, default-first, desktop-cascade (large → small). */
export const BREAKPOINT_KEYS_CASCADE = ['default', '2xl', 'xl', 'lg', 'md', 'sm', 'xs'] as const

/** Non-default cascade keys — drives the data-<prop>-responsive presence flag. */
export const BREAKPOINT_KEYS_NON_DEFAULT = ['2xl', 'xl', 'lg', 'md', 'sm', 'xs'] as const

export function resolveResponsive<T>(val: ResponsiveVal<T> | undefined): ResolvedResponsive<T> {
  if (val === undefined) return {}
  if (isResponsiveObject(val)) {
    return val as ResolvedResponsive<T>
  }
  return { default: val as T }
}

// True when a value is in per-breakpoint OBJECT form — a plain object carrying at
// least one breakpoint key (`default`/`xs`/…/`2xl`), and NOT a FluidValue. The SSOT
// predicate the resolver AND the authoring layer share to classify a value's shape:
// the inspector uses it to decide whether a prop is currently in "responsive" mode
// (distinct from a flat literal or a `{ $bind }` binding, which carries no breakpoint
// key so is never mistaken for responsive). Array is excluded (never a breakpoint map).
export function isResponsiveObject(val: unknown): boolean {
  return (
    val !== null &&
    typeof val === 'object' &&
    !Array.isArray(val) &&
    !isFluidValue(val as StyleValue) &&
    BREAKPOINT_KEYS.some(k => k in (val as object))
  )
}

// Convert StyleValue to a CSS string.
// number    → px (e.g. 300 → '300px')
// FluidValue → clamp(min, preferred, max)
// string    → passthrough (CSS values, tokens, aspect ratios)
export function parseStyleValue(val: StyleValue): string {
  if (typeof val === 'number') return `${val}px`
  if (isFluidValue(val)) {
    const preferred = val.preferred ?? `calc((${val.min} + ${val.max}) / 2)`
    return `clamp(${val.min}, ${preferred}, ${val.max})`
  }
  return val
}

// Returns true when val is a FluidValue object.
export function isFluidValue(val: StyleValue): val is FluidValue {
  return (
    typeof val === 'object' &&
    val !== null &&
    'fluid' in val &&
    (val as FluidValue).fluid === true
  )
}

// Returns true when val is an aspect-ratio string like '16:9' or '4:3'.
// Used for data-height token detection.
export function isAspectRatio(val: StyleValue): boolean {
  return typeof val === 'string' && /^\d+:\d+$/.test(val)
}