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
import type { ValueThreshold }   from '../config/threshold'

export type FormatKey = 'mln_gel' | 'sign_pct' | 'pct' | 'decimal1' | 'decimal2'

export type TimeRef = number | CtxRef

/**
 * A KPI filter dim value: a literal code (national pin, e.g. '_T') OR a
 * cross-filter `$ctx` ref that FOLLOWS the current selection (ctx.dims[$ctx]),
 * with an optional `default` used when that dim is unselected (empty). This is
 * what lets a regional KPI scope to the selected region(s) yet fall back to the
 * national total when nothing is selected — `{ $ctx:'geo', default:'_T' }`.
 * Resolved by withFilter (kpi.ts) through the SAME path the warm extractor uses,
 * so warm === read holds.
 *
 * `$ne` — an optional client-side EXCLUSION (the same operator the obs/query path
 * carries) applied at val match time, never in the wire fetch (which stays a
 * covering superset). It lets a wildcard fallback sum a dimension MINUS an
 * aggregate row — `{ $ctx:'geo', $ne:'_T' }` sums the leaf regions but drops the
 * `_T` national-total row, so State A (no selection) yields the national total ONCE
 * instead of double-counting `_T + Σleaves`, AND still resolves per-sector (where no
 * `_T` row exists) by summing leaves. Mirrors the regions-bar/sectors-multi binding.
 *
 * Two shapes (a discriminated union on `$ctx`):
 *   • `{ $ctx, default?, $ne? }` — a selection-FOLLOWING pin (may also exclude a code).
 *   • `{ $ne }`                  — a PURE exclusion with NO positive pin: the dim stays
 *     wildcard-open and `_val` SUMS it minus the excluded aggregate (the INVARIANT
 *     denominator of a `share`, e.g. a national leaf-sum `{ $ne:'_T' }`). Both shapes
 *     are handled by resolveFilterVal's structural `'$ctx' in v` / `'$ne' in v` dispatch.
 */
export type DimFilterRef =
  | { $ctx: string;      default?: DimVal; $ne?: DimVal }
  | { $ctx?: undefined;  default?: DimVal; $ne:  DimVal }

export type DimFilter = Record<string, DimVal | DimFilterRef>

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
  // 'share' — a computed ratio × 100 rendered as the trend LINE (num / denom, the
  // SAME ObsRef vocabulary the `share` VALUE uses). Lets a card whose primary value
  // is an absolute level ALSO surface its % of a base (e.g. a region's headline GEL
  // value + its share of the national total) without a second card. Resolves to
  // dir 'none' — a share is a PROPORTION, not a rise/fall, so the card renders it
  // with NO direction glyph or up/down/flat label; formatted as a magnitude percent.
  | { type: 'share';  num: ObsRef;     denom: ObsRef }
  // `value` is a USER-FACING caption (e.g. 'stable', 'real'), NOT a computed number —
  // LocaleString (plain string legacy OR { ka, en }), resolved to the active locale AND
  // template-expanded by resolveTrend via resolveTemplate, the SAME boundary label/unit/
  // trendSub funnel through. A bare string is a degenerate LocaleString (Postel). `dir`
  // 'none' renders the caption WITHOUT a glyph/direction label (a neutral annotation).
  | { type: 'static'; value: LocaleString; dir: 'up' | 'down' | 'flat' | 'none' }

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
   * OPTIONAL unit suffix (e.g. 'მლნ ₾', '$'). LocaleString — plain string (legacy) OR
   * { ka, en } bilingual, resolved to the active locale by interpretKpi (the same
   * boundary that resolves `label`), so a raw bag never reaches the KpiCard child.
   * ABSENT for a self-describing value: a percent-formatted value (`sign_pct`/`pct`,
   * or a `yoy` value) already carries its own "%", so a unit "%" would double-render
   * ("+15%%"). Absent ⇒ the card renders VALUE only (KpiCard guards `{unit && …}`).
   */
  unit?:           LocaleString
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
  /**
   * OPTIONAL conditional formatting — an ordered set of numeric breakpoints that drive
   * the value's PRESENTATION (colour token ⊕ directional glyph ⊕ state label). The
   * numeric-range sibling of a value mapping: the resolved VALUE takes the presentation
   * of the highest breakpoint it reaches (Grafana thresholds). ADDITIVE (Law 8): absent
   * ⇒ the value renders exactly as before (reference-identical). HONEST (Law 11): a
   * no-data / masked / unbound card renders its declared affordance and NO threshold is
   * applied — thresholds colour a real value only, never a fabricated 0.
   */
  thresholds?:     ValueThreshold
}
