// ── KPI Spec Vocabulary — the declarative, Constructor-browsable types ──
//
//  The SHAPE of a KPI card, split from the interpreter (kpi.ts) so the spec
//  vocabulary is one concern (config authoring / Constructor palette) and the
//  render + warm engine is another. Leaf module: type-only imports, no cycle.
//
//  KpiValueSpec discriminants (open for extension — new discriminant = new
//  reduction, the interpreter's switch stays exhaustive, Law 8 OCP):
//    'point'  → single observation  (store.val)
//    'yoy'    → year-on-year %      (cur/prev − 1) × 100
//    'cagr'   → compound annual GR  (to/from)^(1/n) − 1   (a LEVEL operator)
//    'mean'   → arithmetic mean     Σ v(t)/N over [from,to]  (a RATE reducer)
//    'share'  → ratio × 100         num / denom
//    'expr'   → derived indicator   D2 − D3  (add / subtract)
//    'metric' → calculated metric   value of a registered calc MetricDef (DC-01)

import type { CtxRef, DimVal }   from '../sdmx'
import type { LocaleString }     from '../i18n/types'
import type { VisibilityExpr }   from '../config/visibility'

export type FormatKey = 'mln_gel' | 'sign_pct' | 'pct' | 'decimal1' | 'decimal2'

export type TimeRef = number | CtxRef

export type DimFilter = Record<string, DimVal>

/** Self-contained observation reference: measure + optional dim overrides + optional time pin. */
export type ObsRef = { measure: string; filter?: DimFilter; time?: TimeRef }

export type KpiValueSpec =
  | { type: 'point';  measure: string; time?: TimeRef; format: FormatKey; abs?: boolean; filter?: DimFilter }
  | { type: 'yoy';    measure: string; time?: TimeRef; filter?: DimFilter }
  | { type: 'cagr';   measure: string; from: TimeRef;  to: TimeRef;       filter?: DimFilter }
  // 'mean' — arithmetic mean Σ v(t)/N over the INCLUSIVE window [from,to]. The
  // proper reducer for a RATE series (e.g. real-gdp-growth-rates): "average real
  // growth" is the mean of the per-year rates, NOT a `cagr` (a LEVEL operator whose
  // ratio is undefined when the baseline is 0). `format` is OPTIONAL — absent ⇒
  // fmtKpiPct (the same toFixed(1) `share`/`metric` use); a rate card supplies
  // 'sign_pct' so the sign survives.
  | { type: 'mean';   measure: string; from: TimeRef;  to: TimeRef;       format?: FormatKey; filter?: DimFilter }
  | { type: 'share';  num: ObsRef;     denom: ObsRef }
  | { type: 'expr';   op: 'subtract' | 'add'; codes: string[]; time?: TimeRef; format: FormatKey; filter?: DimFilter }
  // 'metric' — a calculated MetricDef's value (DC-01). The measure-algebra
  // (ratio/derived/…) lives ONCE on the named, governed metric; the card just
  // names it. `time` pins the active period (e.g. {$ctx:'toYear'}) for every
  // component read; `format` is OPTIONAL — absent ⇒ the same ratio formatting a
  // `share` card uses (toFixed(1)), so a `share`→`metric` migration is byte-identical.
  | { type: 'metric'; metric: string;  time?: TimeRef; format?: FormatKey }

export type KpiTrendSpec =
  | { type: 'yoy';    measure: string; time?: TimeRef; filter?: DimFilter }
  | { type: 'cagr';   measure: string; from: TimeRef;  to: TimeRef;       filter?: DimFilter }
  // `value` is a USER-FACING caption (e.g. 'stable', 'real'), NOT a computed number —
  // LocaleString (plain string legacy OR { ka, en }), resolved to the active locale AND
  // template-expanded by resolveTrend via resolveTemplate, the SAME boundary label/unit/
  // trendSub funnel through. A bare string is a degenerate LocaleString (Postel).
  | { type: 'static'; value: LocaleString; dir: 'up' | 'down' | 'flat' }

export interface KpiSpec {
  id:              string
  /**
   * User-facing card label. LocaleString — plain string (legacy/single-locale)
   * OR { ka, en } bilingual map, consistent with every other label in the
   * platform (ColumnDef.label, RowSpec.label, HeroNode.title, LinkDef.label).
   * Resolved to the active locale by interpretKpi via SectionContext.locale,
   * then template-expanded against ctx.dims.
   */
  label:           LocaleString
  /**
   * Unit suffix (e.g. 'მლნ ₾', '%'). LocaleString — plain string (legacy) OR
   * { ka, en } bilingual, resolved to the active locale by interpretKpi (the same
   * boundary that resolves `label`), so a raw bag never reaches the KpiCard child.
   */
  unit:            LocaleString
  color:           string
  /**
   * OPTIONAL perspective-scoped visibility — the declarative replacement for the
   * retired privileged `mode: 'year'|'range'|'both'` union (Law 1). A
   * `{op:'perspective-is', perspective:'year'}` shows the card only in the `year`
   * perspective; absent ⇒ the card shows in EVERY perspective (the old `'both'`).
   * Evaluated against `ctx.perspectiveState` by the SHARED `kpiVisible` predicate,
   * at BOTH the render (`interpretKpis`) and warm (`extractKpiRequirements`) sites.
   */
  when?:           VisibilityExpr
  value:           KpiValueSpec
  trend?:          KpiTrendSpec
  /**
   * Caption under the trend line. LocaleString — plain string (legacy) OR { ka, en }
   * bilingual; resolved to the active locale AND template-expanded (e.g.
   * '{fromYear}–{toYear}') by interpretKpi via resolveTemplate.
   */
  trendSub?:       LocaleString
  /** Mark data as preliminary / subject to revision — renders a "P" badge. */
  preliminary?:    boolean
  /** Short explanatory note rendered below the trend line. */
  note?:           string
  /** URL to methodology or metadata page — renders as an info-icon link on the card. */
  methodologyUrl?: string
}
