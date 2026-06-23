// ── FieldConfig — per-field display settings ──────────────────────────
//
//  Grafana's most copied feature: display configuration decoupled from data.
//  FieldConfig is declared in ChartDef/SectionDef and applied by the engine
//  at interpretation time — before any rendering happens.
//
//  Pattern: same DataRow[] + different FieldConfig = different visual output.
//  100% JSON-serializable → Constructor generates it without code.
//
//  Grafana equivalent: FieldConfig + FieldOverride + Threshold system.
//

// ── Threshold ──────────────────────────────────────────────────────────
//
//  Value-based color mapping. Evaluated at engine level — not in React.
//  value: null  → base color (applied when no threshold is exceeded).
//  Thresholds are evaluated in ascending order; last match wins.
//
//  Example:
//    [{ value: null, color: '#6B7B8D' },   // base:  grey
//     { value: 0,    color: '#E76F51' },   // ≥ 0:   orange (warn)
//     { value: 3,    color: '#00A896' }]   // ≥ 3%:  green  (good)
//
export interface Threshold {
  /** Activation value. null = base (always active, overridden by higher thresholds). */
  value: number | null
  /** CSS color string applied when this threshold is the highest exceeded. */
  color: string
  /** Optional label shown in legend / tooltip. */
  label?: string
}

// ── ColorMode ─────────────────────────────────────────────────────────
//
//  How colors are assigned to data points:
//    'fixed'      — all points use SectionDef.color (or series color)
//    'palette'    — DataRow.color (from observation field)
//    'thresholds' — FieldConfig.thresholds, based on DataRow.value
//
export type ColorMode = 'fixed' | 'palette' | 'thresholds'

// ── FieldOverride ─────────────────────────────────────────────────────
//
//  Per-series display overrides (Grafana FieldOverride equivalent).
//  Matched by series name, applied on top of base FieldConfig.
//
export interface FieldOverride {
  /** Series name to match (DataRow.series or DataRow.label). */
  match: string
  /** Overrides applied to matched series. */
  config: Omit<FieldConfig, 'overrides'>
}

// ── FieldConfig ───────────────────────────────────────────────────────
//
//  Complete per-field display specification.
//  Applied by engine before rendering → React receives pre-formatted data.
//
export interface FieldConfig {
  /** Unit suffix: 'მლნ ₾', '%', '$', 'ათ. ₾', etc. */
  unit?:       string
  /** Decimal places for formatted values. Default: 0 */
  decimals?:   number
  /** Y-axis explicit minimum (prevents auto-scale below this). */
  min?:        number
  /** Y-axis explicit maximum. */
  max?:        number
  /** Color assignment strategy. Default: 'palette' → uses DataRow.color */
  colorMode?:  ColorMode
  /** Value-based color thresholds (used when colorMode = 'thresholds'). */
  thresholds?: Threshold[]
  /** Display string when value is null / 0. Default: '—' */
  noValue?:    string
  /** Per-series overrides — applied after base config. */
  overrides?:  FieldOverride[]
}