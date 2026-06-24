// ── @statdash/styles — Color tokens ────────────────────────────────────
//
//  Three layers, deliberately separate (D1):
//   1. GRAY      — raw neutral scale (50–900). Primitives for fine-grained
//                  control of backgrounds / borders / text without touching
//                  semantic names. Dark mode inverts the scale in tokens.css.
//   2. COLOR     — semantic aliases (text / surface / border / accent). The
//                  layer components consume. Dark mode overrides ONLY these.
//   3. STATUS    — feedback tones (positive / negative / warning / info /
//                  preliminary), each as bg / border / fg.
//   4. CHART_*   — categorical data-viz palette (deuteranopia-distinguishable).
//
//  Keystone invariant preserved: semantic + status + chart are overridden in
//  the dark layer; the raw GRAY scale is inverted independently. Spacing/type
//  stay theme-neutral.
//

// ── Raw neutral scale ───────────────────────────────────────────────────
export const GRAY = {
  '50':  'var(--gray-50)',
  '100': 'var(--gray-100)',
  '200': 'var(--gray-200)',
  '300': 'var(--gray-300)',
  '400': 'var(--gray-400)',
  '500': 'var(--gray-500)',
  '600': 'var(--gray-600)',
  '700': 'var(--gray-700)',
  '800': 'var(--gray-800)',
  '900': 'var(--gray-900)',
} as const satisfies Record<string, string>

// ── Semantic colors ─────────────────────────────────────────────────────
//  Names are semantic + agnostic (text/surface/border/accent), values are
//  neutral defaults. The app maps its own brand vars onto these via cascade.
export const COLOR = {
  // Text
  textPrimary:   'var(--color-text-primary)',
  textSecondary: 'var(--color-text-secondary)',
  textMuted:     'var(--color-text-muted)',
  textFaint:     'var(--color-text-faint)',
  textInverse:   'var(--color-text-inverse)',
  // Surface
  surface:       'var(--color-surface)',
  surfaceRaised: 'var(--color-surface-raised)',
  surfaceSunken: 'var(--color-surface-sunken)',
  surfaceFrame:  'var(--color-surface-frame)',
  // Border
  border:            'var(--color-border)',
  borderSubtle:      'var(--color-border-subtle)',
  borderFrame:       'var(--color-border-frame)',
  borderStrong:      'var(--color-border-strong)',
  borderInteractive: 'var(--color-border-interactive)',
  // Accent
  accent:          'var(--color-accent)',
  accentHover:     'var(--color-accent-hover)',
  accentMuted:     'var(--color-accent-muted)',
  accentBg:        'var(--color-accent-bg)',
  accentSecondary: 'var(--color-accent-secondary)',
  accentRing:      'var(--color-accent-ring)',
  // Chart chrome
  chartFrame:    'var(--color-chart-frame)',
} as const satisfies Record<string, string>

// ── Status / feedback colors ────────────────────────────────────────────
//  Each status has three tones: bg (pale surface), border (subtle outline),
//  fg (text / icon). `preliminary` is stat-platform-specific — flags data
//  not yet final (ONS / IMF / Eurostat data-integrity convention).
export const STATUS = {
  positiveBg:     'var(--status-positive-bg)',
  positiveBorder: 'var(--status-positive-border)',
  positiveFg:     'var(--status-positive-fg)',
  negativeBg:     'var(--status-negative-bg)',
  negativeBorder: 'var(--status-negative-border)',
  negativeFg:     'var(--status-negative-fg)',
  warningBg:      'var(--status-warning-bg)',
  warningBorder:  'var(--status-warning-border)',
  warningFg:      'var(--status-warning-fg)',
  infoBg:         'var(--status-info-bg)',
  infoBorder:     'var(--status-info-border)',
  infoFg:         'var(--status-info-fg)',
  preliminaryBg:     'var(--status-preliminary-bg)',
  preliminaryBorder: 'var(--status-preliminary-border)',
  preliminaryFg:     'var(--status-preliminary-fg)',
} as const satisfies Record<string, string>

// ── Chart / data-visualization palette ──────────────────────────────────
//  10 categorical colors. Blue leads; ordered for maximum pairwise
//  separation under deuteranopia. Dark-mode variants (lighter / more vivid)
//  are remapped in tokens.css. Use series1…series10 for multi-series charts.
export const CHART_COLOR = {
  series1:  'var(--chart-color-1)',
  series2:  'var(--chart-color-2)',
  series3:  'var(--chart-color-3)',
  series4:  'var(--chart-color-4)',
  series5:  'var(--chart-color-5)',
  series6:  'var(--chart-color-6)',
  series7:  'var(--chart-color-7)',
  series8:  'var(--chart-color-8)',
  series9:  'var(--chart-color-9)',
  series10: 'var(--chart-color-10)',
} as const satisfies Record<string, string>

export type GrayToken       = typeof GRAY[keyof typeof GRAY]
export type ColorToken      = typeof COLOR[keyof typeof COLOR] | (string & {})
export type StatusToken     = typeof STATUS[keyof typeof STATUS]
export type ChartColorToken = typeof CHART_COLOR[keyof typeof CHART_COLOR]
