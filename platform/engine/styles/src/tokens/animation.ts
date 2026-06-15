// ── @geostat/styles — Motion tokens ───────────────────────────────────
//
//  TRANSITION exposes ready-made `transition:` shorthands (kept for
//  backward compatibility — existing config consumes these). DURATION +
//  EASING decompose motion into composable parts so a renderer can build
//  `transition: color var(--duration-fast) var(--easing-ease-out)`.
//  Expand, not replace (parallel change) — no consumer breaks.
//

export const TRANSITION = {
  none:   'none',
  fast:   'var(--transition-fast)',
  smooth: 'var(--transition-smooth)',
  slow:   'var(--transition-slow)',
} as const satisfies Record<string, string>

export const DURATION = {
  instant: 'var(--duration-instant)',
  fast:    'var(--duration-fast)',
  normal:  'var(--duration-normal)',
  slow:    'var(--duration-slow)',
  slower:  'var(--duration-slower)',
} as const satisfies Record<string, string>

export const EASING = {
  linear:     'var(--easing-linear)',
  easeIn:     'var(--easing-ease-in)',
  easeOut:    'var(--easing-ease-out)',
  easeInOut:  'var(--easing-ease-in-out)',
  spring:     'var(--easing-spring)',
  bounce:     'var(--easing-bounce)',
} as const satisfies Record<string, string>

export type TransitionToken = typeof TRANSITION[keyof typeof TRANSITION] | (string & {})
export type DurationToken   = typeof DURATION[keyof typeof DURATION]
export type EasingToken     = typeof EASING[keyof typeof EASING]
