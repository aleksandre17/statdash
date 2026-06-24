// ── KPI Spec Engine ───────────────────────────────────────────────────
//
//  JSON-based KPI config system — Eurostat / ONS / IMF pattern.
//
//  KpiSpec  →  interpretKpi(spec, ctx, store)  →  KpiDef (resolved, feeds KpiCard)
//
//  KpiValueSpec types:
//    'point'  → single observation  (store.val)
//    'yoy'    → year-on-year %      (cur/prev − 1) × 100
//    'cagr'   → compound annual GR  (to/from)^(1/n) − 1
//    'share'  → ratio × 100         num / denom
//    'expr'   → derived indicator   D2 − D3  (add / subtract)
//

import type { CtxRef, DimVal }  from '../sdmx'
import type { DataStore }       from './store'
import { storeVal }            from './store'
import type { SectionContext }  from '../core/context'
import type { KpiDef }          from '../config/kpi'
import type { LocaleString }    from '../i18n/types'
import { resolveLocaleString }  from '../i18n/types'
import { getFormatter }         from './transform'
import { resolveTemplate }      from '../config/template'

// ── Types ─────────────────────────────────────────────────────────────

export type FormatKey = 'mln_gel' | 'sign_pct' | 'pct' | 'decimal1' | 'decimal2'

type TimeRef = number | CtxRef

type DimFilter = Record<string, DimVal>

/** Self-contained observation reference: measure + optional dim overrides + optional time pin. */
export type ObsRef = { measure: string; filter?: DimFilter; time?: TimeRef }

export type KpiValueSpec =
  | { type: 'point';  measure: string; time?: TimeRef; format: FormatKey; abs?: boolean; filter?: DimFilter }
  | { type: 'yoy';    measure: string; time?: TimeRef; filter?: DimFilter }
  | { type: 'cagr';   measure: string; from: TimeRef;  to: TimeRef;       filter?: DimFilter }
  | { type: 'share';  num: ObsRef;     denom: ObsRef }
  | { type: 'expr';   op: 'subtract' | 'add'; codes: string[]; time?: TimeRef; format: FormatKey; filter?: DimFilter }

export type KpiTrendSpec =
  | { type: 'yoy';    measure: string; time?: TimeRef; filter?: DimFilter }
  | { type: 'cagr';   measure: string; from: TimeRef;  to: TimeRef;       filter?: DimFilter }
  | { type: 'static'; value: string;   dir: 'up' | 'down' | 'flat' }

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
  unit:            string
  color:           string
  mode:            'year' | 'range' | 'both'
  value:           KpiValueSpec
  trend?:          KpiTrendSpec
  trendSub?:       string
  /** Mark data as preliminary / subject to revision — renders a "P" badge. */
  preliminary?:    boolean
  /** Short explanatory note rendered below the trend line. */
  note?:           string
  /** URL to methodology or metadata page — renders as an info-icon link on the card. */
  methodologyUrl?: string
}

// ── Internal helpers ──────────────────────────────────────────────────

/** Extract the primary measure code from a KpiValueSpec for provenance lookup. */
function primaryMeasure(spec: KpiValueSpec): string | undefined {
  if ('measure' in spec) return spec.measure          // point | yoy | cagr
  if ('num'     in spec) return spec.num.measure      // share
  if ('codes'   in spec) return spec.codes[0]         // expr — first operand
  return undefined
}

function resolveTime(ref: TimeRef | undefined, ctx: SectionContext): number {
  if (ref === undefined)                        return ctx.dims['time'] as number
  if (typeof ref === 'object' && '$ctx' in ref) return ctx.dims[ref.$ctx] as number
  return ref as number
}

function atTime(t: number, ctx: SectionContext): SectionContext {
  if ((ctx.dims['time'] as number) === t) return ctx
  return { ...ctx, dims: { ...ctx.dims, time: t } }
}

function withFilter(ctx: SectionContext, filter?: DimFilter): SectionContext {
  if (!filter) return ctx
  const dims = { ...ctx.dims }
  for (const [k, v] of Object.entries(filter)) {
    // '' / null / undefined — wildcard: drop the dim from ctx so val() sums over it.
    if (v === '' || v === null || v === undefined) delete dims[k]
    else                                            dims[k] = v
  }
  return { ...ctx, dims }
}

const fmtKpiPct = (n: number): string => n.toFixed(1)

function trendDir(pct: number): 'up' | 'down' | 'flat' {
  return pct > 0.05 ? 'up' : pct < -0.05 ? 'down' : 'flat'
}

// ── Value computation ─────────────────────────────────────────────────

function resolveValue(spec: KpiValueSpec, ctx: SectionContext, store: DataStore): string {
  switch (spec.type) {
    case 'point': {
      const c = withFilter(ctx, spec.filter)
      const t = resolveTime(spec.time, c)
      const n = storeVal(store, spec.measure, atTime(t, c))
      return getFormatter(spec.format)(spec.abs ? Math.abs(n) : n)
    }
    case 'yoy': {
      const c    = withFilter(ctx, spec.filter)
      const t    = resolveTime(spec.time, c)
      const cur  = storeVal(store, spec.measure, atTime(t, c))
      const prev = storeVal(store, spec.measure, atTime(t - 1, c))
      const pct  = prev ? (cur / prev - 1) * 100 : 0
      return getFormatter('sign_pct')(pct)
    }
    case 'cagr': {
      const c     = withFilter(ctx, spec.filter)
      const from  = resolveTime(spec.from, c)
      const to    = resolveTime(spec.to, c)
      const vFrom = storeVal(store, spec.measure, atTime(from, c))
      const vTo   = storeVal(store, spec.measure, atTime(to, c))
      const n     = vFrom && to > from ? ((vTo / vFrom) ** (1 / (to - from)) - 1) * 100 : 0
      return fmtKpiPct(n)
    }
    case 'share': {
      const getRef = (ref: ObsRef): number => {
        const rc = withFilter(ctx, ref.filter)
        return storeVal(store, ref.measure, atTime(resolveTime(ref.time, rc), rc))
      }
      const n = getRef(spec.num)
      const d = getRef(spec.denom)
      return fmtKpiPct(d ? (n / d) * 100 : 0)
    }
    case 'expr': {
      const c    = withFilter(ctx, spec.filter)
      const t    = resolveTime(spec.time, c)
      const vals = spec.codes.map((code) => storeVal(store, code, atTime(t, c)))
      const n    = spec.op === 'subtract'
        ? vals[0] - vals.slice(1).reduce((a, b) => a + b, 0)
        : vals.reduce((a, b) => a + b, 0)
      return getFormatter(spec.format)(n)
    }
  }
}

// ── Trend computation ─────────────────────────────────────────────────

function resolveTrend(
  spec:  KpiTrendSpec,
  ctx:   SectionContext,
  store: DataStore,
): { value: string; dir: 'up' | 'down' | 'flat' } {
  if (spec.type === 'static') return { value: spec.value, dir: spec.dir }
  const c = withFilter(ctx, spec.filter)
  switch (spec.type) {
    case 'yoy': {
      const t    = resolveTime(spec.time, c)
      const cur  = storeVal(store, spec.measure, atTime(t, c))
      const prev = storeVal(store, spec.measure, atTime(t - 1, c))
      const pct  = prev ? (cur / prev - 1) * 100 : 0
      return { value: getFormatter('sign_pct')(pct), dir: trendDir(pct) }
    }
    case 'cagr': {
      const from  = resolveTime(spec.from, c)
      const to    = resolveTime(spec.to, c)
      const vFrom = storeVal(store, spec.measure, atTime(from, c))
      const vTo   = storeVal(store, spec.measure, atTime(to, c))
      const pct   = vFrom && to > from ? ((vTo / vFrom) ** (1 / (to - from)) - 1) * 100 : 0
      return { value: getFormatter('sign_pct')(pct), dir: trendDir(pct) }
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────

export function interpretKpi(
  spec:  KpiSpec,
  ctx:   SectionContext,
  store: DataStore,
): KpiDef {
  const formattedValue = resolveValue(spec.value, ctx, store)
  const trend          = spec.trend ? resolveTrend(spec.trend, ctx, store) : null

  // Provenance: static flag OR dynamic store.metadata port [N14].
  const code = primaryMeasure(spec.value)
  const prov = code ? store.metadata?.provenance(code, ctx) : undefined

  // LocaleString → concrete string for the active locale, THEN template-expand
  // against ctx.dims. ctx.locale is the same seam ColumnDef.label resolution uses.
  const localizedLabel = resolveLocaleString(spec.label, ctx.locale ?? 'ka', 'ka')

  return {
    label:           resolveTemplate(localizedLabel, ctx),
    value:           formattedValue,
    unit:            spec.unit,
    color:           spec.color,
    trend:           trend?.dir ?? 'flat',
    trendValue:      trend?.value ?? '',
    trendSub:        spec.trendSub ? resolveTemplate(spec.trendSub, ctx) : '',
    preliminary:     spec.preliminary || prov?.status === 'p',
    note:            spec.note,
    methodologyUrl:  spec.methodologyUrl,
  }
}

export function interpretKpis(
  specs:  KpiSpec[],
  ctx:    SectionContext,
  store:  DataStore,
): KpiDef[] {
  return specs
    .filter((s) => s.mode === 'both' || s.mode === ctx.timeMode)
    .map((s) => interpretKpi(s, ctx, store))
}