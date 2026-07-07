// ── KpiDef — resolved KPI card data ───────────────────────────────────
//
//  Output of interpretKpis() — fed directly into KpiCard renderer.
//  100% JSON-serializable: string/number fields only.
//
//  Separation: KpiSpec (what to compute) lives in data/kpi.ts.
//              KpiDef (computed result) lives here — it's a view type.
//
export interface KpiDef {
  label:           string
  value:           string
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
}