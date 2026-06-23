// ── @statdash/styles — Token catalog types ─────────────────────────────────────
// Shared shape for every catalog slice. Consumed by Panel's token picker UI.

export type TokenGroup =
  | 'spacing' | 'radii' | 'border-width' | 'size' | 'blur' | 'opacity'
  | 'shadow' | 'aspect' | 'breakpoints'
  | 'transition' | 'duration' | 'easing'
  | 'font-size' | 'fluid-font-size' | 'font-weight' | 'line-height' | 'letter-spacing' | 'font-family'
  | 'gray' | 'color' | 'status' | 'chart-color' | 'z-index'

export type TokenDescriptor = {
  group:       TokenGroup
  cssVar?:     string          // e.g. 'var(--spacing-md)' — undefined for non-CSS tokens
  value?:      string | number // resolved value hint for Panel preview
  label:       { ka: string; en: string }
  description: { ka: string; en: string }
}
