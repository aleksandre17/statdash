// ── Style helper functions ────────────────────────────────────────────
//
//  Ergonomic constructors for common style values.
//  All return JSON-serializable values — Constructor-ready.
//

import type { FluidValue } from '../types'

// Convert a pixel number to a CSS px string.
// px(300) → '300px'
export function px(n: number): string {
  return `${n}px`
}

// Construct a CSS aspect-ratio value string.
// ratio(16, 9) → '16 / 9'
export function ratio(w: number, h: number): string {
  return `${w} / ${h}`
}

// Construct a FluidValue that resolves to CSS clamp(min, preferred, max).
// fluid('280px', '480px') → { fluid: true, min: '280px', max: '480px' }
// Resolver picks: clamp(280px, calc((280px + 480px) / 2), 480px)
export function fluid(min: string, max: string, preferred?: string): FluidValue {
  return { fluid: true, min, max, preferred }
}

// Convert a spacing scale number to rem (4px base grid).
// spacing(1) → '0.25rem' (4px)
// spacing(4) → '1rem'   (16px)
// spacing(6) → '1.5rem' (24px)
export function spacing(n: number): string {
  return `${n * 0.25}rem`
}