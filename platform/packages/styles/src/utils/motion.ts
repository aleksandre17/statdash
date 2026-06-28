// ── motion — the runtime reduced-motion guard (WCAG 2.3.3 / 2.2.2, vestibular safety) ──
//
//  The CSS baseline in `css/animations.css` neutralises *declarative* CSS
//  animation/transition under `@media (prefers-reduced-motion: reduce)`. But a
//  few motion sinks are driven by JS, where CSS media queries cannot reach:
//
//    1. ApexCharts entrance/update animation (`chart.animations.enabled`)
//    2. Programmatic smooth scroll (`window.scrollTo({ behavior })`)
//    3. Any future JS-orchestrated transition
//
//  These read `prefersReducedMotion()` at the moment they act, so the OS/user
//  setting is honoured live (matchMedia is evaluated each call — no stale snapshot).
//  This is the single SSOT for the JS half of the motion baseline; the CSS half
//  is `animations.css`. Mirrors `cssVar()`: one tiny guarded reader the whole
//  platform funnels through, SSR/jsdom-safe.
//
//  SSR / jsdom: `window.matchMedia` is absent → returns `false` (motion-on), the
//  safe default for a non-interactive render (no user to harm, no media to query).

/** The reduced-motion media query — the single string both halves of the baseline key off. */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)' as const

/**
 * True when the user/OS has requested reduced motion. Evaluated live on every
 * call so a setting change is honoured without a reload. JS motion sinks
 * (Apex, smooth scroll) gate on this; CSS sinks gate on the media query directly.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

/**
 * The motion-safe `ScrollBehavior` for `scrollTo`/`scrollIntoView`: `'auto'`
 * (instant jump) when reduced motion is requested, otherwise the caller's
 * preferred behaviour (default `'smooth'`). One call site for the whole
 * platform's programmatic scrolling.
 */
export function motionSafeScrollBehavior(preferred: ScrollBehavior = 'smooth'): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : preferred
}
