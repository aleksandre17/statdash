// ── Featured collection — curated headline items (AR-40) ────────────────
//
//  A "featured" item is a CURATION (LookML define-vs-curate): a metric-id
//  resolved at a pinned coordinate, ordered into a headline collection. It is
//  NOT a flag on the MetricDef (SSOT + SoC) — the metric stays a pure definition;
//  "featured" is a separate list a surface (the landing featured-slider) reads.
//
//  DESIGN — maximal reuse (Law 4): each FeaturedItemSpec LOWERS to a `point`
//  KpiSpec and is interpreted by the EXISTING interpretKpi. So live values,
//  warm/render symmetry, the preliminary derivation (OBS_STATUS at the read
//  coordinate), the i18n resolution boundary and template expansion all come for
//  free and stay single-sourced — there is NO parallel resolver. This is the
//  SSOT payoff: the slider shows the LIVE governed number at the coordinate,
//  never a hand-typed / snapshot string (the number-consistency bug-class AR-40
//  kills).
//
//  This file is a pure vocabulary + interpreter leaf (sibling of kpi-spec.ts /
//  kpi.ts). It imports nothing from react — per-item store ROUTING is delegated
//  to a `FeaturedStoreResolver` callback the react hook supplies (each item's
//  metric names its `dataSource`, so a slider spanning multiple datasets routes
//  each card to its own store). The callback is runtime plumbing (a function
//  ARGUMENT, exactly like `store` on interpretKpi), NEVER serialized config, so
//  Law 2 (no functions in config) holds.
//
import type { DataStore, Requirement }  from './store'
import type { SectionContext }          from '../core/context'
import type { KpiDef }                   from '../config/kpi'
import type { LocaleString }             from '../i18n/types'
import type {
  KpiSpec, KpiTrendSpec, DimFilter, TimeRef, FormatKey,
} from './kpi-spec'
import { interpretKpi, extractKpiRequirements } from './kpi'
import { getMetric, resolveMeasureRef }          from './metric'
import { resolveTemplate }                        from '../config/template'

/**
 * One curated headline item — a metric-id read at a pinned coordinate.
 *
 * The metric's governance (label / unit / format / methodology) DEFAULTS the
 * card; an explicit consumer-side override on the item wins (Postel / expand-
 * contract — the same `explicit > metric-default` precedence a KPI uses). Pure
 * DATA (a coordinate + refs), never a function — Constructor-ready (a new
 * headline = a new item, interface unchanged, Law 8).
 */
export interface FeaturedItemSpec {
  /** Semantic-layer metric-id (SSOT). Governs label/unit/format/methodology. */
  metric:  string
  /**
   * Curation label OVERRIDE (wins over metric.label). Needed when several items
   * share ONE metric at different coordinates and the headline is the coordinate,
   * not the measure — e.g. four regional cards all reading `regional.gva` whose
   * headline is the region name (Tbilisi / Adjara / …), not "Gross Value Added".
   */
  label?:  LocaleString
  /** Unit OVERRIDE (wins over metric.unit). Usually omitted — the metric governs. */
  unit?:   LocaleString
  /** Display-format OVERRIDE (wins over metric.format). Usually omitted. */
  format?: FormatKey
  /**
   * Coordinate pins beyond time (Law 1, generic dims): { account:'…', side:'U' },
   * { geo:'R2', sector:'_T' }, { geo:'GE', approach:'_Z' }. Reuses the KPI
   * DimFilter vocabulary (literal | { $ctx } cross-filter ref), so a featured card
   * can also follow selection. Lowered to the point KpiSpec's `filter`.
   */
  at?:     DimFilter
  /** Time pin (literal year or {$ctx}) — the published year for this headline. */
  time?:   TimeRef
  /** Optional prior-period context (yoy/cagr/static/share) — reuses KpiTrendSpec. */
  trend?:  KpiTrendSpec
  /**
   * Caption under the trend line (e.g. "of national total" beneath a `share`
   * trend). LocaleString, resolved + template-expanded at interpretKpi's leak-proof
   * boundary — same field a KpiSpec carries; only surfaces when `trend` is present.
   */
  trendSub?: LocaleString
  /** Per-card accent (token or CSS custom-prop expr). Defaults to --color-accent. */
  color?:  string
  /**
   * Drill-through target — a page SLUG ('accounts') or an absolute/external URL.
   * LocaleString so a route can localize its content; the SHELL adds the active
   * locale PREFIX for a bare slug (mirrors the hero card: `/${locale}/${slug}`).
   * Page-level for now; the exact-coordinate deep-link is elevation (AR-31/42).
   */
  href:    LocaleString | string
  /** Editorial grouping → one tab/slide (e.g. "National Accounts" / "GDP"). */
  group?:  LocaleString
  /** Optional decorative glyph (a11y hidden). */
  icon?:   string
  /** Display order within its group. */
  order?:  number
}

/**
 * Resolved featured card — a KpiDef (value/trend/unit/preliminary/methodologyUrl)
 * plus the slider-only affordances. 100% JSON-serializable (view type).
 */
export interface FeaturedSlideDef {
  /** Produced by interpretKpi — the governed, localized, live card body. */
  card:  KpiDef
  /** Drill target resolved to the active locale (still a SLUG or absolute URL). */
  href:  string
  /** Group label resolved to the active locale ('' → single ungrouped slide). */
  group: string
  /** Decorative glyph (a11y hidden). */
  icon?: string
  /** Stable display order (falls back to authoring index). */
  order: number
}

/**
 * Per-item store router — `dataSource → DataStore`. Supplied by the react hook
 * (useFeaturedRows), which resolves each metric's `dataSource` to its store so a
 * multi-dataset slider routes every card correctly. A runtime function argument,
 * not config.
 */
export type FeaturedStoreResolver = (dataSource?: string) => DataStore

/** A warm requirement tagged with the store it must be warmed against. */
export interface FeaturedRequirement {
  dataSource?: string
  req:         Requirement
}

/** Ultimate format fallback when neither the item nor the metric declares one. */
const DEFAULT_FEATURED_FORMAT: FormatKey = 'decimal2'
/** Default card accent — a token, never a literal hex (Law: token-driven). */
const FEATURED_DEFAULT_COLOR = 'var(--color-accent)'

/**
 * Lower ONE featured item to a `point` KpiSpec — the single seam through which a
 * card resolves its live value. Governance precedence (explicit consumer wins):
 *   format = item.format ?? metric.format ?? DEFAULT
 *   label  = item.label  ?? metric.label  ?? metric-id
 *   unit   = item.unit   ?? metric.unit   ?? ''
 * The point value carries `measure: item.metric`, so interpretKpi → readMeasure →
 * resolveMeasureRef expands it to the underlying code(s) at render time (U1); the
 * coordinate (`filter: item.at`, `time: item.time`) pins the headline slice.
 */
export function featuredToKpiSpec(item: FeaturedItemSpec): KpiSpec {
  const metric = getMetric(item.metric)
  const rm     = resolveMeasureRef(item.metric)
  const format: FormatKey = item.format ?? rm.format ?? DEFAULT_FEATURED_FORMAT
  return {
    id:             `featured:${item.metric}@${JSON.stringify(item.at ?? {})}`,
    label:          item.label ?? metric?.label ?? item.metric,
    unit:           item.unit  ?? metric?.unit  ?? '',
    color:          item.color ?? FEATURED_DEFAULT_COLOR,
    value:          { type: 'point', measure: item.metric, time: item.time, filter: item.at, format },
    trend:          item.trend,
    trendSub:       item.trendSub,
    // methodology surfaces the metric's governed methodology (Law 9) when known;
    // NEVER fabricated — absent on the metric ⇒ no info-affordance on the card.
    methodologyUrl: metric?.methodology,
  }
}

/**
 * interpret — REUSES interpretKpi per item (DRY; no parallel resolver). Each item
 * routes to ITS OWN store via `resolveStore(metric.dataSource)` so a slider
 * spanning accounts/gdp/regional reads each card from the right dataset. label/
 * unit/href/group localize at interpretKpi's / resolveTemplate's leak-proof
 * boundary (RENDER-NO-LOCALE-LEAK) — a raw { ka, en } bag never escapes.
 */
export function interpretFeatured(
  items:        FeaturedItemSpec[],
  ctx:          SectionContext,
  resolveStore: FeaturedStoreResolver,
): FeaturedSlideDef[] {
  return items.map((item, i) => {
    const store = resolveStore(getMetric(item.metric)?.dataSource)
    const card  = interpretKpi(featuredToKpiSpec(item), ctx, store)
    return {
      card,
      href:  resolveTemplate(item.href, ctx),
      group: item.group ? resolveTemplate(item.group, ctx) : '',
      icon:  item.icon,
      order: item.order ?? i,
    }
  })
}

/**
 * warm — REUSES extractKpiRequirements (warm === render). Each item's reqs are
 * tagged with the item's `dataSource` so the react hook warms every requirement
 * against the SAME store interpretFeatured will read it from (no cache-miss, no
 * cold throw — the kpi-strip invariant, extended across datasets).
 */
export function extractFeaturedRequirements(
  items: FeaturedItemSpec[],
  ctx:   SectionContext,
): FeaturedRequirement[] {
  const out: FeaturedRequirement[] = []
  for (const item of items) {
    const dataSource = getMetric(item.metric)?.dataSource
    for (const req of extractKpiRequirements([featuredToKpiSpec(item)], ctx))
      out.push({ dataSource, req })
  }
  return out
}
