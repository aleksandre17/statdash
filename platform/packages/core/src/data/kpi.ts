// ── KPI Spec Engine — the interpreter (render + warm) ───────────────────
//
//  JSON-based KPI config system — Eurostat / ONS / IMF pattern. The declarative
//  spec vocabulary (KpiSpec / KpiValueSpec / KpiTrendSpec) lives in ./kpi-spec;
//  this file is the interpreter:
//
//  KpiSpec  →  interpretKpi(spec, ctx, store)  →  KpiDef (resolved, feeds KpiCard)
//

import type { DataStore, Requirement } from './store'
import { storeVal }              from './store'
import type { Cell, ValueState } from './cell'
import { storeCell, okCell, noDataCell, unboundCell, maskedCell } from './cell'
import type { ObsStatus }        from '../core/provenance'
import { resolveMeasureRef }     from './metric'
import { resolveMetricValue, calcMetricRequirements } from './metric-calc'
import type { SectionContext }   from '../core/context'
import { atTime }                from '../core/context'
import type { KpiDef }           from '../config/kpi'
import { getFormatter }          from './transform'
import { resolveTemplate }       from '../config/template'
import { evalVisibility }        from '../config/visibility'
import { resolveValueThreshold } from '../config/threshold'
import type {
  ObsRef, KpiValueSpec, KpiTrendSpec, KpiSpec,
} from './kpi-spec'
import { resolveTime, withFilter, metricFilter } from './kpi-coord'
import { valueIsPreliminary }      from './kpi-preliminary'

// Re-export the vocabulary so existing `from './kpi'` / `from '../data/kpi'`
// import paths (index.ts, data/index.ts, tests) stay byte-identical after the split.
export type { FormatKey, ObsRef, KpiValueSpec, KpiTrendSpec, KpiSpec, DimFilter, DimFilterRef } from './kpi-spec'

// ── Internal helpers ──────────────────────────────────────────────────
//
//  The read-coordinate primitives (resolveTime / withFilter) live in ./kpi-coord,
//  shared with the displayed-slice preliminary derivation (./kpi-preliminary) so a
//  KPI's value and its OBS_STATUS resolve at the IDENTICAL coordinate (DRY).

const fmtKpiPct = (n: number): string => n.toFixed(1)

function trendDir(pct: number): 'up' | 'down' | 'flat' {
  return pct > 0.05 ? 'up' : pct < -0.05 ? 'down' : 'flat'
}

// ── readMeasure — the metric-aware point read (U1) ─────────────────────────────
//
//  Route EVERY render-side measure read through the SAME resolveMeasureRef seam the
//  WARM path (extractKpiRequirements.push) already uses, so render and warm resolve a
//  measure ref IDENTICALLY. This closes a latent split: the warm path resolved a
//  metric-id to its underlying code(s), but the render path passed the raw ref
//  straight to storeVal — so a KPI referencing a metric-id warmed one code yet
//  rendered a different key (cache-miss → 0 value + a dead preliminary badge).
//
//  Postel / FF-RAW-CODE-IDENTICAL: a raw code is NOT a registered metric-id, so
//  resolveMeasureRef('X').codes === ['X'] → storeVal(store, 'X', ctx), BYTE-IDENTICAL
//  to the legacy direct read. A metric-id expands to its underlying code(s); when a
//  metric declares MULTIPLE codes they SUM (the OLAP additive-measure reading),
//  mirroring the warm path which enumerates one requirement per code (warm === render).
function readMeasure(store: DataStore, measure: string, ctx: SectionContext): number {
  let sum = 0
  for (const code of resolveMeasureRef(measure).codes) sum += storeVal(store, code, ctx)
  return sum
}

// ── readMeasureCell — the HONEST (state-carrying) sibling of readMeasure (W1) ──
//
//  Reads a measure ref as a Cell (value + honest state) through the SAME
//  resolveMeasureRef seam readMeasure uses, so the NUMBER is byte-identical to
//  readMeasure for every `ok` cell (the OLAP sum over the ref's codes) and the STATE
//  is the distinction the bare sum cannot carry (no-data / unbound / masked). A no-data
//  component contributes 0 (byte-identical to readMeasure's `storeVal ?? 0`). An empty
//  ref → unbound; EVERY component no-data → no-data. Suppression is contagious: a
//  confidential ('c') component masks the aggregate (SDMX secondary suppression — a sum
//  that includes a suppressed cell may itself disclose it).
function readMeasureCell(store: DataStore, measure: string, ctx: SectionContext): Cell {
  const codes = resolveMeasureRef(measure).codes
  if (codes.length === 0) return unboundCell()
  let sum    = 0
  let anyOk  = false
  let status: ObsStatus | undefined
  for (const code of codes) {
    const cell = storeCell(store, code, ctx)
    if (cell.state === 'masked')  return maskedCell()
    if (cell.state === 'unbound') return unboundCell()
    if (cell.state === 'ok') { sum += cell.value ?? 0; anyOk = true; status ??= cell.status }
    // 'no-data' → contributes 0 (byte-identical to readMeasure's storeVal ?? 0)
  }
  return anyOk ? okCell(sum, status) : noDataCell()
}

// The honest state of a value COMPUTED from several reads. `masked` is contagious — a
// figure derived from a confidential input cannot be published. Otherwise `primary`:
// each formula decides what "no data" means for it (a YoY has none when the CURRENT
// period does; a window mean when EVERY year does; a ratio when either side does).
function deriveState(reads: Cell[], primary: ValueState): ValueState {
  return reads.some((r) => r.state === 'masked') ? 'masked' : primary
}

// The resolved KPI value — the formatted string PLUS its honest state (the seam that
// lets interpretKpi stop emitting a fabricated `0` for no-data / unbound / masked).
interface KpiValueResult {
  formatted: string
  state:     ValueState
  status?:   ObsStatus
  /**
   * The raw numeric value BEFORE formatting — the input to conditional-formatting
   * (threshold) resolution. Carried internally only; interpretKpi uses it iff the
   * state is `ok` (a no-data/masked value's number is meaningless, so thresholds are
   * never resolved against it — Law 11). NOT surfaced on KpiDef.
   */
  numeric:   number
}

/** Greppable diagnostic code for a CAGR whose baseline is 0/falsy (PL-4). */
export const KPI_CAGR_ZERO_BASELINE = 'KPI_CAGR_ZERO_BASELINE'

// A falsy CAGR baseline over a real window (to > from, vFrom === 0) means CAGR —
// a LEVEL operator — was applied to a series whose start is 0 (typically a RATE
// series, e.g. real-gdp-growth-rates). The ratio (vTo/vFrom) is undefined; the two
// cagr sites keep a 0 numeric fallback for prod resilience, but must NOT be silent —
// this emits a loud, greppable signal so the mis-authoring (use `type:'mean'` for a
// rate series) surfaces at dev time rather than rendering a bogus 0.0%.
function cagrZeroBaseline(measure: string, from: number, to: number): void {
  if (typeof console !== 'undefined' && console.warn) {
    console.warn(
      `[${KPI_CAGR_ZERO_BASELINE}] measure="${measure}" from=${from} to=${to}: ` +
      `zero/falsy baseline — result forced to 0 (use type:'mean' for a rate series)`,
    )
  }
}

// ── Value computation ─────────────────────────────────────────────────

//  Returns the formatted string AND its honest state. Every numeric formula is
//  BYTE-IDENTICAL to pre-seam (the `ok` value is unchanged — the read now flows
//  through readMeasureCell, whose `.value ?? 0` reproduces readMeasure exactly); the
//  ADDITIVE part is `state`, so a no-data / unbound / masked cell is no longer
//  rendered as a fabricated number (the origin of "the canvas lies").
function resolveValue(spec: KpiValueSpec, ctx: SectionContext, store: DataStore): KpiValueResult {
  switch (spec.type) {
    case 'point': {
      const c    = withFilter(ctx, metricFilter(spec.measure, spec.filter))
      const t    = resolveTime(spec.time, c)
      const cell = readMeasureCell(store, spec.measure, atTime(t, c))
      const n    = cell.value ?? 0
      const shown = spec.abs ? Math.abs(n) : n
      return { formatted: getFormatter(spec.format)(shown), state: cell.state, status: cell.status, numeric: shown }
    }
    case 'yoy': {
      const c     = withFilter(ctx, metricFilter(spec.measure, spec.filter))
      const t     = resolveTime(spec.time, c)
      const curC  = readMeasureCell(store, spec.measure, atTime(t, c))
      const prevC = readMeasureCell(store, spec.measure, atTime(t - 1, c))
      const cur   = curC.value ?? 0
      const prev  = prevC.value ?? 0
      const pct   = prev ? (cur / prev - 1) * 100 : 0
      // A YoY has no data when the CURRENT period does (nothing to compare).
      return { formatted: getFormatter('sign_pct')(pct), state: deriveState([curC, prevC], curC.state), numeric: pct }
    }
    case 'cagr': {
      const c      = withFilter(ctx, metricFilter(spec.measure, spec.filter))
      const from   = resolveTime(spec.from, c)
      const to     = resolveTime(spec.to, c)
      const vFromC = readMeasureCell(store, spec.measure, atTime(from, c))
      const vToC   = readMeasureCell(store, spec.measure, atTime(to, c))
      const vFrom  = vFromC.value ?? 0
      const vTo    = vToC.value ?? 0
      if (to > from && !vFrom) cagrZeroBaseline(spec.measure, from, to)   // PL-4 — fail loud, not silent 0
      const n      = vFrom && to > from ? ((vTo / vFrom) ** (1 / (to - from)) - 1) * 100 : 0
      // CAGR needs BOTH endpoints — no data if either is empty.
      const nd     = vFromC.state === 'no-data' || vToC.state === 'no-data'
      return { formatted: fmtKpiPct(n), state: deriveState([vFromC, vToC], nd ? 'no-data' : 'ok'), numeric: n }
    }
    case 'mean': {
      // Arithmetic mean Σ v(t)/N over the INCLUSIVE window [from,to] — the proper
      // reducer for a RATE series (each year's rate read at its pinned coordinate,
      // GENERICALLY via atTime). Absent `format` ⇒ fmtKpiPct (byte-identical to the
      // share/metric default); a rate card supplies 'sign_pct' to keep the sign.
      const c     = withFilter(ctx, metricFilter(spec.measure, spec.filter))
      const lo    = Math.min(resolveTime(spec.from, c), resolveTime(spec.to, c))
      const hi    = Math.max(resolveTime(spec.from, c), resolveTime(spec.to, c))
      const cells: Cell[] = []
      let sum = 0
      let n   = 0
      for (let t = lo; t <= hi; t++) {
        const cell = readMeasureCell(store, spec.measure, atTime(t, c))
        cells.push(cell); sum += cell.value ?? 0; n++
      }
      const avg = n ? sum / n : 0
      // A window mean has no data only when EVERY year in it is empty.
      const nd  = cells.length > 0 && cells.every((x) => x.state === 'no-data')
      return { formatted: (spec.format ? getFormatter(spec.format) : fmtKpiPct)(avg), state: deriveState(cells, nd ? 'no-data' : 'ok'), numeric: avg }
    }
    case 'share': {
      const getRefCell = (ref: ObsRef): Cell => {
        const rc = withFilter(ctx, metricFilter(ref.measure, ref.filter))
        return readMeasureCell(store, ref.measure, atTime(resolveTime(ref.time, rc), rc))
      }
      const numC = getRefCell(spec.num)
      const denC = getRefCell(spec.denom)
      const nv   = numC.value ?? 0
      const dv   = denC.value ?? 0
      // A share is undefined when either side is empty.
      const nd   = numC.state === 'no-data' || denC.state === 'no-data'
      const pct  = dv ? (nv / dv) * 100 : 0
      return { formatted: fmtKpiPct(pct), state: deriveState([numC, denC], nd ? 'no-data' : 'ok'), numeric: pct }
    }
    case 'expr': {
      const c     = withFilter(ctx, spec.filter)
      const t     = resolveTime(spec.time, c)
      // Each code reads at ITS OWN governed coordinate — a metric-id code folds its
      // default dims (metricFilter), a raw code returns spec.filter untouched (so a
      // raw-code expr stays byte-identical). The time pin is shared (metric dims never
      // touch the time axis, Law 1).
      const cells = spec.codes.map((code) =>
        readMeasureCell(store, code, atTime(t, withFilter(ctx, metricFilter(code, spec.filter)))))
      const vals  = cells.map((x) => x.value ?? 0)
      const n     = spec.op === 'subtract'
        ? vals[0] - vals.slice(1).reduce((a, b) => a + b, 0)
        : vals.reduce((a, b) => a + b, 0)
      const nd    = cells.length > 0 && cells.every((x) => x.state === 'no-data')
      return { formatted: getFormatter(spec.format)(n), state: deriveState(cells, nd ? 'no-data' : 'ok'), numeric: n }
    }
    case 'metric': {
      // Evaluate the named calc metric at the pinned period. Absent `format` ⇒
      // fmtKpiPct — the SAME formatter `share` uses (byte-identical). A metric that
      // resolves to null (missing ref / null expr) is NO-DATA — the legacy `?? 0`
      // fabricated a zero here (the exact lie). Masked composition through a calc
      // metric's inputs is deferred to provenance-composition (PM-4); this wave a
      // metric value is ok | no-data.
      const t = resolveTime(spec.time, ctx)
      const v = resolveMetricValue(spec.metric, atTime(t, ctx), store)
      const n = v ?? 0
      return {
        formatted: (spec.format ? getFormatter(spec.format) : fmtKpiPct)(n),
        state:     v === null || v === undefined ? 'no-data' : 'ok',
        numeric:   n,
      }
    }
  }
}

// ── Trend computation ─────────────────────────────────────────────────

function resolveTrend(
  spec:  KpiTrendSpec,
  ctx:   SectionContext,
  store: DataStore,
): { value: string; dir: 'up' | 'down' | 'flat' | 'none' } {
  // Static caption is an i18n carrier — collapse to the active locale (+ template-expand)
  // at THIS boundary, exactly as interpretKpi resolves label/unit/trendSub, so a raw
  // { ka, en } bag never reaches the KpiCard child.
  if (spec.type === 'static') return { value: resolveTemplate(spec.value, ctx), dir: spec.dir }
  // 'share' — num / denom × 100 as the trend line. Reads each ObsRef at ITS OWN
  // filter/time (the SAME getRef seam the `share` VALUE uses — DRY), so a trend
  // share and a value share resolve byte-identically. 'none' dir — a share is a
  // PROPORTION, not a rise/fall, so the card must render it WITHOUT a direction glyph
  // or an up/down/flat ("stable") label (that reads as a false trend); magnitude
  // percent ('pct') so it reads "53.1%".
  if (spec.type === 'share') {
    const getRef = (ref: ObsRef): number => {
      const rc = withFilter(ctx, metricFilter(ref.measure, ref.filter))
      return readMeasure(store, ref.measure, atTime(resolveTime(ref.time, rc), rc))
    }
    const n = getRef(spec.num)
    const d = getRef(spec.denom)
    return { value: getFormatter('pct')(d ? (n / d) * 100 : 0), dir: 'none' }
  }
  const c = withFilter(ctx, metricFilter(spec.measure, spec.filter))
  switch (spec.type) {
    case 'yoy': {
      const t    = resolveTime(spec.time, c)
      const cur  = readMeasure(store, spec.measure, atTime(t, c))
      const prev = readMeasure(store, spec.measure, atTime(t - 1, c))
      const pct  = prev ? (cur / prev - 1) * 100 : 0
      return { value: getFormatter('sign_pct')(pct), dir: trendDir(pct) }
    }
    case 'cagr': {
      const from  = resolveTime(spec.from, c)
      const to    = resolveTime(spec.to, c)
      const vFrom = readMeasure(store, spec.measure, atTime(from, c))
      const vTo   = readMeasure(store, spec.measure, atTime(to, c))
      if (to > from && !vFrom) cagrZeroBaseline(spec.measure, from, to)   // PL-4 — same fail-loud guard as the value site
      const pct   = vFrom && to > from ? ((vTo / vFrom) ** (1 / (to - from)) - 1) * 100 : 0
      return { value: getFormatter('sign_pct')(pct), dir: trendDir(pct) }
    }
  }
}

// ── kpiVisible — the SHARED per-card visibility predicate (P5.2 (2)) ──────────
//
//  ONE SSOT both the render path (interpretKpis) and the warm path
//  (extractKpiRequirements) call, so the warm requirement set is the EXACT visible
//  set the render reads — no drift (the §0b kpi-strip-crash invariant: a card warmed
//  but not rendered, or rendered but not warmed, breaks an async store).
//
//  A card's `when?` is a VisibilityExpr (canonically `perspective-is(id)`), evaluated
//  against `ctx.perspectiveState` — the SAME SSOT the node visibility gate reads. The
//  declarative replacement for the retired `mode: 'year'|'range'|'both'` union:
//    • `when` present → evalVisibility (perspective-is/in/not/and/or/…),
//    • `when` ABSENT  → visible in every perspective (the old `'both'`).
//  `evalVisibility`'s `fr` (filter-param) arg is the SAME surface `renderNode` passes
//  for a node's `view.visibleWhen` — `ctx.filterParams` (the raw URL filter Record),
//  NOT `ctx.dims`. This keeps the visibility SSOT uniform: an `eq`/`isset`/`in` `when`
//  resolves identically on a kpi card and on a node (a perspective-* op ignores `fr`
//  and reads `perspectiveState`, so today's perspective-only `when` is unaffected).
function kpiVisible(
  spec:         KpiSpec,
  ctx:          SectionContext,
  filterParams: Record<string, unknown>,
): boolean {
  if (!spec.when) return true
  return evalVisibility(spec.when, filterParams, ctx.perspectiveState)
}

// ── Public API ────────────────────────────────────────────────────────

export function interpretKpi(
  spec:  KpiSpec,
  ctx:   SectionContext,
  store: DataStore,
): KpiDef {
  const value          = resolveValue(spec.value, ctx, store)
  const trend          = spec.trend ? resolveTrend(spec.trend, ctx, store) : null

  // ── Conditional formatting (Law 8 additive · Law 11 honest) ──────────────────
  //  Resolve the value's thresholds ONLY for a genuine `ok` value — a no-data / masked
  //  / unbound state renders its declared affordance (a KpiStateCard, not a KpiCard),
  //  so a threshold never colours a fabricated number. `resolveThreshold` is itself
  //  honest (a non-finite numeric ⇒ null), so this is belt-and-suspenders. Absent
  //  thresholds ⇒ null ⇒ every field below is elided (byte-identical KpiDef).
  const threshold      = value.state === 'ok'
    ? resolveValueThreshold(value.numeric, spec.thresholds)
    : null

  // Every display field funnels through resolveTemplate — which collapses the
  // LocaleString carrier to the active locale (ctx.locale, generic) THEN template-
  // expands against ctx.dims. label/unit/trendSub are all i18n carriers; resolving
  // them at this ONE boundary keeps a raw { ka, en } bag from reaching the KpiCard.
  return {
    label:           resolveTemplate(spec.label, ctx),
    value:           value.formatted,
    // Honest state (AR-52 / Law 11). `ok` is elided (⟺ absent) so every value-bearing
    // KpiDef stays byte-identical to pre-seam; a non-`ok` state tells the renderer the
    // `value` string is a placeholder — render the declared affordance, not a fake 0.
    state:           value.state === 'ok' ? undefined : value.state,
    // Unit is OPTIONAL — absent for a self-describing (percent) value. Resolve only
    // when authored; else undefined (KpiCard guards `{unit && …}`), NEVER pass
    // undefined into resolveTemplate (its carrier collapse would throw).
    unit:            spec.unit ? resolveTemplate(spec.unit, ctx) : undefined,
    color:           spec.color,
    trend:           trend?.dir ?? 'flat',
    trendValue:      trend?.value ?? '',
    trendSub:        spec.trendSub ? resolveTemplate(spec.trendSub, ctx) : '',
    // Displayed-slice preliminary (Law 9, year-aware): an explicit author override
    // always wins; otherwise derive from the SDMX OBS_STATUS of the observation(s)
    // this KPI actually reads at its pinned coordinate(s) — never dataset-wide.
    preliminary:     spec.preliminary === true || valueIsPreliminary(spec.value, ctx, store),
    note:            spec.note,
    methodologyUrl:  spec.methodologyUrl,
    // Threshold-resolved presentation (elided when no step matched). `valueStateLabel`
    // funnels through resolveTemplate — the SAME locale-collapse boundary label/unit use
    // — so a raw { ka, en } bag never reaches the KpiCard child.
    valueToken:      threshold?.token,
    valueGlyph:      threshold?.glyph,
    valueStateLabel: threshold?.state ? resolveTemplate(threshold.state, ctx) : undefined,
  }
}

export function interpretKpis(
  specs:        KpiSpec[],
  ctx:          SectionContext,
  store:        DataStore,
  filterParams: Record<string, unknown> = {},
): KpiDef[] {
  // Postel / ISP tolerance — a kpi-strip's `items` is REQUIRED by the KpiStripNode
  // type, but a hand-authored / API-hydrated node-config may omit it (untyped JSON
  // boundary). An absent `specs` interprets to an EMPTY KPI set (the shell then
  // renders <EmptyState/>), it MUST NOT hard-throw `undefined.filter` into
  // NodeErrorBoundary. This is the engine-layer twin of the fail-soft chrome guard
  // (`useChromeConfig ?? EMPTY_CHROME_CONFIG`, packages/react): an interpreter
  // tolerates an absent optional input by rendering nothing, never by crashing.
  return (specs ?? [])
    .filter((s) => kpiVisible(s, ctx, filterParams))
    .map((s) => interpretKpi(s, ctx, store))
}

// ── extractKpiRequirements ────────────────────────────────────────────
//
//  Static analysis of a KpiSpec[] — the SSOT requirement set for the KPI
//  read surface, the sibling of extractRequirements (DataSpec). Returns every
//  {code, dims} pair interpretKpis WILL read via storeVal, WITHOUT executing
//  it — so a warm consumer (ApiStore.prefetch / CachedStore.warm / the react
//  KPI warm path) can batch-load exactly the slices a kpi-strip needs.
//
//  CRITICAL — the comparison period. A 'yoy' value/trend reads BOTH atTime(t)
//  AND atTime(t-1): the previous year is a real store read. extractRequirements
//  for a 'growth' DataSpec enumerates each year; this does the same for KPIs —
//  it MUST yield t-1 so the warm covers it, else querySync cold-throws on the
//  previous-period read (the kpi-strip crash). 'cagr' reads from AND to; 'share'
//  reads num AND denom at their own pinned times; 'expr' reads every code at t.
//
//  Visibility-filtered identically to interpretKpis via the SHARED `kpiVisible`
//  predicate (a year-only KPI contributes no requirements in the range perspective
//  and vice-versa) so the warm set is the EXACT superset of the synchronous render's
//  reads — no more, no less (warm === render, one SSOT, no drift).
//
//  Mirrors the resolveMeasureRef + atTime + withFilter seams interpretKpi uses,
//  so a metric ref expands to its underlying codes exactly as the read will.
//
export function extractKpiRequirements(
  specs:        KpiSpec[],
  ctx:          SectionContext,
  filterParams: Record<string, unknown> = {},
): Requirement[] {
  const out: Requirement[] = []

  // One (code, dims@time) requirement per underlying code of a measure ref.
  const push = (measure: string, c: SectionContext, t: number): void => {
    const dims = atTime(t, c).dims
    for (const code of resolveMeasureRef(measure).codes) out.push({ code, dims })
  }

  const fromValue = (spec: KpiValueSpec, base: SectionContext): void => {
    // Every context folds the measure's GOVERNED default dims via metricFilter — the
    // IDENTICAL fold the render (resolveValue) applies. Warm === read: if the read
    // coordinate gains the metric defaults, the warm requirement MUST too, else
    // warm-key ≠ read-key and an async store stays cold (the kpi-strip crash).
    switch (spec.type) {
      case 'point': {
        const c = withFilter(base, metricFilter(spec.measure, spec.filter))
        push(spec.measure, c, resolveTime(spec.time, c))
        return
      }
      case 'yoy': {
        const c = withFilter(base, metricFilter(spec.measure, spec.filter))
        const t = resolveTime(spec.time, c)
        push(spec.measure, c, t)
        push(spec.measure, c, t - 1)   // the comparison period — the crash year
        return
      }
      case 'cagr': {
        const c = withFilter(base, metricFilter(spec.measure, spec.filter))
        push(spec.measure, c, resolveTime(spec.from, c))
        push(spec.measure, c, resolveTime(spec.to, c))
        return
      }
      case 'mean': {
        // The mean reads EVERY year in [from,to] — enumerate one requirement per
        // year (mirrors the `growth` DataSpec's per-year enumeration) so the warm
        // set is the EXACT superset the render reads (warm === render, no drift).
        const c  = withFilter(base, metricFilter(spec.measure, spec.filter))
        const lo = Math.min(resolveTime(spec.from, c), resolveTime(spec.to, c))
        const hi = Math.max(resolveTime(spec.from, c), resolveTime(spec.to, c))
        for (let t = lo; t <= hi; t++) push(spec.measure, c, t)
        return
      }
      case 'share': {
        const cn = withFilter(base, metricFilter(spec.num.measure,   spec.num.filter))
        const cd = withFilter(base, metricFilter(spec.denom.measure, spec.denom.filter))
        push(spec.num.measure,   cn, resolveTime(spec.num.time, cn))
        push(spec.denom.measure, cd, resolveTime(spec.denom.time, cd))
        return
      }
      case 'expr': {
        const c = withFilter(base, spec.filter)
        const t = resolveTime(spec.time, c)
        // Per-code governed coordinate (mirrors resolveValue's expr read) — a metric-id
        // code folds its defaults, a raw code stays byte-identical.
        for (const code of spec.codes) push(code, withFilter(base, metricFilter(code, spec.filter)), t)
        return
      }
      case 'metric': {
        // Warm EXACTLY the component reads resolveMetricValue will issue at the
        // pinned period — the calc-metric warm SSOT (same period as the read).
        const t = resolveTime(spec.time, base)
        for (const req of calcMetricRequirements(spec.metric, atTime(t, base))) out.push(req)
        return
      }
    }
  }

  const fromTrend = (spec: KpiTrendSpec, base: SectionContext): void => {
    if (spec.type === 'static') return
    // 'share' trend — warm num AND denom at their own pinned coordinates (mirrors
    // the `share` VALUE warm in fromValue, so warm === render for a trend share).
    if (spec.type === 'share') {
      const cn = withFilter(base, metricFilter(spec.num.measure,   spec.num.filter))
      const cd = withFilter(base, metricFilter(spec.denom.measure, spec.denom.filter))
      push(spec.num.measure,   cn, resolveTime(spec.num.time, cn))
      push(spec.denom.measure, cd, resolveTime(spec.denom.time, cd))
      return
    }
    const c = withFilter(base, metricFilter(spec.measure, spec.filter))
    if (spec.type === 'yoy') {
      const t = resolveTime(spec.time, c)
      push(spec.measure, c, t)
      push(spec.measure, c, t - 1)   // the comparison period — the crash year
    } else {
      push(spec.measure, c, resolveTime(spec.from, c))
      push(spec.measure, c, resolveTime(spec.to, c))
    }
  }

  // Same Postel tolerance as interpretKpis — warm === render: if the render twin
  // folds an absent `specs` to an empty set, the warm twin MUST too, so a spec-less
  // kpi-strip yields zero requirements (no warm) rather than throwing `undefined`
  // iteration. (useKpiRows already wraps this call in try/catch, but the core
  // function is a public @statdash/engine entry point and must be tolerant at its own
  // boundary — the guard belongs here, not only in the react caller.)
  for (const spec of specs ?? []) {
    if (!kpiVisible(spec, ctx, filterParams)) continue   // SAME predicate (+fr) as interpretKpis — warm === render
    fromValue(spec.value, ctx)
    if (spec.trend) fromTrend(spec.trend, ctx)
  }

  return out
}