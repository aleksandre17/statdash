import type { ResponsiveVal, ResolvedResponsive, StyleValue, FluidValue } from './types'

// Normalize a ResponsiveVal to always-object form.
// Flat T    → { default: T }
// undefined → {}
// Object    → passthrough
// Note: FluidValue objects have { fluid, min, max } — NOT { default, md, sm }.
// resolveResponsive correctly identifies them as flat values (not breakpoint objects).
export function resolveResponsive<T>(val: ResponsiveVal<T> | undefined): ResolvedResponsive<T> {
  if (val === undefined) return {}
  if (
    val !== null &&
    typeof val === 'object' &&
    !Array.isArray(val) &&
    !isFluidValue(val as unknown as StyleValue) &&
    ('default' in val || 'md' in val || 'sm' in val)
  ) {
    return val as ResolvedResponsive<T>
  }
  return { default: val as T }
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