// ── KpiDef — resolved KPI card data ───────────────────────────────────
//
//  Output of interpretKpis() — fed directly into KpiCard renderer.
//  100% JSON-serializable: string/number fields only.
//
//  Separation: KpiSpec (what to compute) lives in data/kpi.ts.
//              KpiDef (computed result) lives here — it's a view type.
//
import type { ValueState } from '../data/cell'

export interface KpiDef {
  label:           string
  value:           string
  /**
   * The honest state of `value` (AR-52 / Law 11). Absent ⟺ `'ok'` (a real value,
   * incl. a genuine 0) — every stored KpiDef is byte-identical to pre-seam. A
   * non-`ok` state ('no-data' | 'unbound' | 'masked' | 'loading' | 'error') means
   * `value` is a placeholder the renderer MUST NOT show as a number — it renders the
   * declared honest affordance instead, so the canvas never lies (an unbound / empty /
   * suppressed cell is never a fabricated `0`).
   */
  state?:          ValueState
  unit?:           string
  /**
   * Trend DIRECTION — 'up'/'down'/'flat' are true rises/falls (glyph + coloured);
   * 'none' is a DIRECTIONLESS figure (a `share` is a proportion, not a rise/fall):
   * the card renders its value + subtext with NO arrow and NO up/down/flat label.
   */
  trend:           'up' | 'down' | 'flat' | 'none'
  trendValue?:     string
  trendSub?:       string
  color:           string
  /** "P" badge — data is preliminary / subject to revision (IMF/Eurostat convention). */
  preliminary?:    boolean
  /** Short explanatory note shown below the trend line. */
  note?:           string
  /** URL to methodology or metadata page — renders as an info-icon link. */
  methodologyUrl?: string
  // ── Threshold-resolved presentation (conditional formatting) ─────────────────
  //  Populated by interpretKpi ONLY for a genuine `ok` value that matched a step of
  //  the card's `thresholds` (Law 8 additive · Law 11 honest — a non-ok state never
  //  reaches here, so a fabricated 0 is never coloured). All three are elided when no
  //  threshold matched, so a card without conditional formatting is byte-identical.
  /** Semantic-token KEY for the VALUE colour (resolved to CSS by the KpiCard via the token spine). */
  valueToken?:     string
  /** Directional glyph rendered beside the value — the non-colour a11y signal (WCAG 1.4.1). */
  valueGlyph?:     'up' | 'down' | 'flat'
  /** Matched-step state label (resolved to the active locale) — the accessible name for the colour. */
  valueStateLabel?: string
}