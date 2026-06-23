// ── @statdash/styles — Shadow / aspect / breakpoint tokens ─────────────
//
//  Elevation shadows, aspect ratios, viewport breakpoints. Shadows are
//  dark-mode-aware (overridden in tokens.css). Aspect + breakpoints are
//  theme-neutral raw values.
//

export const SHADOW = {
  sm:      'var(--shadow-sm)',
  md:      'var(--shadow-md)',
  card:    'var(--shadow-card)',
  overlay: 'var(--shadow-overlay)',
  xl:      'var(--shadow-xl)',      // modals / popovers
  inset:   'var(--shadow-inset)',   // sunken inputs / wells
  focus:   'var(--shadow-focus)',   // accessible focus ring (WCAG 2.1 AA)
} as const satisfies Record<string, string>

// Canonical aspect-ratio strings — '16 / 9' format (CSS aspect-ratio value).
export const ASPECT = {
  '16:9': '16 / 9',
  '4:3':  '4 / 3',
  '1:1':  '1 / 1',
  '21:9': '21 / 9',
  '3:2':  '3 / 2',
} as const satisfies Record<string, string>

// Breakpoint thresholds in px — max-width boundaries for the desktop-default
// cascade. Serve both @media (viewport) and @container (element) queries; the
// same six numbers drive node-styles.css. Mobile-first names, framework-aligned
// (Tailwind/Chakra/MUI consensus, tuned for statistical dashboard targets).
export const BREAKPOINTS = {
  xs:    480,   // small mobile
  sm:    640,   // large mobile / simplified layouts
  md:    768,   // tablet
  lg:    1024,  // laptop — primary stats design target
  xl:    1280,  // wide desktop
  '2xl': 1536,  // large monitor (ONS / Eurostat target)
} as const satisfies Record<string, number>

export type ShadowToken     = typeof SHADOW[keyof typeof SHADOW]
export type AspectToken     = typeof ASPECT[keyof typeof ASPECT]
export type BreakpointKey   = keyof typeof BREAKPOINTS
export type BreakpointValue = typeof BREAKPOINTS[BreakpointKey]
