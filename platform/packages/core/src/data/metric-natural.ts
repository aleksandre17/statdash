// ── metric-natural — a metric's NATURAL browse coordinates [ADR-047 Wave A · DECISION 1] ──
//
//  A grain-∅ metric BROWSE (ADR-046 Addendum 2 — "a source IS the table") must read the
//  metric at its NATURAL coordinates: every ctx pin on a dimension the metric does NOT carry
//  an observation for (a FOREIGN pin) is neutralized to the empty-wildcard '' BEFORE the read.
//  Otherwise a NATIONAL metric browsed on a page that pins geo=<region> reads
//  storeValAt(code, { geo:<region> }) = 0 for every year (the OLAP sum of an empty match),
//  and a growth expr folds 0/prev → −100 — a number that is a pure artifact of missing data
//  (the W-P5c FINDING; a Law-11 breach). The benchmark verdict (dbt MetricFlow / Cube / LookML):
//  ignore-with-annotation — read the metric at its own grain, NEVER silently coerce to 0.
//
//  DERIVED, never declared (Law 5). The metric's natural dims are a PROJECTION of the obs slice
//  the browse ALREADY scans — NOT a declared per-metric axis field. A dim present in the obs
//  with ≥1 concrete (non-'_T') member is a natural axis of the metric; a ctx pin on any other
//  dim, absent from the obs, is foreign. Reusing the obs scan the browse already performs makes
//  naturality free and cannot drift from the cube — a declared `MetricDef.naturalDims` would
//  duplicate DSD structure into config (the exact Law-5 anti-pattern) and drift when a dataset
//  gains/loses an axis. Generic over dims (Law 1): the foreign set is derived per metric, never
//  a `geo`/`time` literal.
//
//  ONE '' mechanism, TWO consumers (read + warm), so warm ≡ read across the React re-merge
//  wall (reqCtx = { ...ctx.dims, ...r.dims }; '' WINS the spread, and the store matcher +
//  obsAtCoord both read '' as "unpinned"):
//    • the browse READ (pipeline-resolver) uses `naturalBrowseCtx` — precise foreign-ONLY
//      neutralization (a natural pin is KEPT, so a regional metric still shows its pinned
//      region's series).
//    • the browse WARM (`spec.pipelineRequirements`) + the read's obs member scan use
//      `browseScanCtx`/`browseScanDims` — the whole-table (every pin '') superset, which needs
//      no store handle (the warm is a static analysis with no obs in hand) and covers the
//      foreign-neutralized natural read by construction.
//
//  Data-layer leaf: pure, framework-free; imports only the SDMX obs type + the context SSOT
//  (MEASURE_DIM). Arrow-clean (no react, no DOM); idempotent.

import type { Observation, DimVal } from '../sdmx'
import type { SectionContext }      from '../core/context'
import { MEASURE_DIM }              from '../core/context'

// The SDMX "total" member — present on an axis a metric AGGREGATES over (a national total),
// never a concrete slice value. An axis carrying ONLY '_T' is NOT a natural browse axis.
const TOTAL_MEMBER = '_T'

/** True ⟺ the member value is a CONCRETE slice member (not the SDMX total, not empty/unset). */
function isConcreteMember(v: string): boolean {
  return v !== '' && v !== TOTAL_MEMBER
}

/**
 * The per-dim set of member values a metric's obs slice carries. Only rows whose MEASURE_DIM
 * is `code` contribute (a multi-measure slice is filtered to THIS metric's own observations);
 * the MEASURE_DIM axis itself is excluded (it is WHICH measure, not a slicing dim). The value
 * sets INCLUDE '_T' so a pin ON the total (a valid national-total coordinate) can be told from
 * a genuinely foreign one.
 */
function membersByDim(obs: readonly Observation[], code: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const o of obs) {
    const r = o as Record<string, DimVal>
    if (String(r[MEASURE_DIM] ?? code) !== code) continue
    for (const [dim, v] of Object.entries(r)) {
      if (dim === MEASURE_DIM || v === undefined || v === null) continue
      let set = out.get(dim)
      if (!set) { set = new Set<string>(); out.set(dim, set) }
      set.add(String(v))
    }
  }
  return out
}

/**
 * The dims a metric CARRIES observations for — its NATURAL axes — derived from an obs slice
 * (Law 5: FROM the store, never a declared axis field). A dim present with ≥1 concrete
 * (non-'_T') member is a natural axis. The MEASURE_DIM axis is excluded (it selects the
 * measure, it is not a slicing dim); non-dimension decoration fields (value/label/…) may be
 * present but are only ever consulted against `ctx.dims`, where solely true dimension pins
 * appear, so they never affect a browse coordinate.
 */
export function metricNaturalDims(obs: readonly Observation[], code: string): Set<string> {
  const out = new Set<string>()
  for (const [dim, members] of membersByDim(obs, code)) {
    for (const m of members) if (isConcreteMember(m)) { out.add(dim); break }
  }
  return out
}

/**
 * `ctx` with every FOREIGN pin neutralized to the empty-wildcard '' — a concrete ctx dim that
 * is NOT a natural axis of the metric AND whose pinned member is absent from the metric's obs.
 * A NATURAL pin (a dim the metric ranges over) is KEPT, and a pin ON a member the metric does
 * carry (e.g. the '_T' total itself) is KEPT — only a genuinely foreign coordinate is dropped.
 *
 * Returns the neutralized ctx + the sorted list of dims that were neutralized (the browse's
 * honest annotation: "read at the metric's own grain; <dims> not applicable"). Derived purely
 * from `obs` — FF-NATURAL-DERIVED-NOT-DECLARED: no per-metric axis field is consulted.
 */
export function naturalBrowseCtx(
  obs:  readonly Observation[],
  code: string,
  ctx:  SectionContext,
): { ctx: SectionContext; neutralized: string[] } {
  const members = membersByDim(obs, code)
  const dims: Record<string, DimVal> = { ...ctx.dims }
  const neutralized: string[] = []

  for (const [dim, v] of Object.entries(ctx.dims)) {
    if (v === '' || v === null || v === undefined) continue      // already unpinned
    const seen       = members.get(dim)
    const isNatural  = seen !== undefined && [...seen].some(isConcreteMember)
    const pinPresent = seen !== undefined && seen.has(String(v))
    // FOREIGN ⟺ NOT a natural axis AND the pinned member is absent from the metric's obs.
    if (!isNatural && !pinPresent) {
      dims[dim] = '' as DimVal
      neutralized.push(dim)
    }
  }

  return { ctx: { ...ctx, dims }, neutralized: neutralized.sort() }
}

/**
 * The whole-table dims for a grain-∅ browse's obs MEMBER SCAN and its WARM requirement — the
 * time-unbounded, dimension-unpinned superset that spans the metric's entire natural table.
 * EVERY ctx pin is set to '' (NOT omitted): an omitted dim would inherit its ctx pin across the
 * React re-merge wall (reqCtx = { ...ctx.dims, ...r.dims }), whereas a '' dim wins the spread as
 * "unpinned" (the store matcher + obsAtCoord treat '' as a wildcard, and isUnsetTime('') is true
 * so the time axis is unbounded). Store-free (the warm is a static analysis): a whole-table read
 * is a superset of any foreign-neutralized natural read, so warm ⊇ read by construction.
 */
export function browseScanDims(ctx: SectionContext): Record<string, DimVal> {
  const dims: Record<string, DimVal> = {}
  for (const dim of Object.keys(ctx.dims)) dims[dim] = '' as DimVal
  return dims
}

/** `ctx` with `browseScanDims` — the whole-table coordinate for the browse's obs member scan. */
export function browseScanCtx(ctx: SectionContext): SectionContext {
  return { ...ctx, dims: browseScanDims(ctx) }
}
