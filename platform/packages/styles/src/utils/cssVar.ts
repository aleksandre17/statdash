// ── cssVar — resolve a design token to its computed value at render time ────
//
//  For the few sinks where CSS `var(--token)` is INVALID and would render
//  black / no-fill:
//    1. SVG presentation attributes      (<text fill="…">, <rect stroke="…">)
//    2. ApexCharts config color strings   that Apex forwards onto SVG attrs
//    3. colors PARSED in JS (e.g. a luminance check) — these need a literal
//
//  Resolve the token's COMPUTED value from the cascade and pass the literal
//  through. The theme still owns the value — under a [data-tenant] override the
//  resolved string changes with zero call-site edits. `fallback` is the
//  un-themed default, used when the computed value is empty (SSR / jsdom).
//
//  Chrome CSS uses `var()` directly; only these JS-fed/SVG-attr fills route
//  through here (the data-viz-fill axis of the semantic-token spine).

export function cssVar(name: `--${string}`, fallback: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}
