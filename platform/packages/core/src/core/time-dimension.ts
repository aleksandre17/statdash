// ── time-dimension — first-class time normalization [ADR R5] ──────────
//
//  The SINGLE seam that folds the canonical `timeDimension { dim, range,
//  granularity? }` (Cube.dev `timeDimensions` parity) into the legacy-shaped
//  time inputs the resolvers already consume: a `years` selection + numeric
//  from/to clamp bounds. adr_data_reference_render_vision R5.
//
//  ADDITIVE + Postel (FF-TIMEDIMENSION): the three legacy forms — `YearsSpec`
//  (years on timeseries/growth), `fromDim`/`toDim` (range-clamp), and time in
//  ObsQuery.filter — still resolve EXACTLY as before. `timeDimension` is an
//  ALTERNATIVE that normalizes into the SAME (years + from/to) values, so there
//  is one resolution path and no behaviour fork. When absent, this module is
//  inert (the legacy fields drive resolution unchanged).
//
//  No privileged dimension (Law 1): the from/to clamp + the time pin operate on
//  the GENERIC time-axis key via the TIME_DIM SSOT (core/context.ts). `dim` on
//  the timeDimension is the author-supplied generic key (conventionally TIME_DIM);
//  this module reads bounds from ctx.dims and never hardcodes a `'time'` literal.
//
//  Pure + sync: ctx-ref bounds resolve through the one Ref dispatcher (../ref),
//  the same path the legacy fromDim/toDim ctx lookup used, so a `[{$ctx},{$ctx}]`
//  range folds fromDim/toDim BYTE-IDENTICALLY.
//

import type { SectionContext }                       from './context'
import type { TimeBound, TimeDimensionSpec, TimeRange, YearsSpec } from '../config/data-spec'
import type { CtxRef }                                from '../sdmx'
import { resolveRef }                                 from '../ref/ref'

// ── clampToBounds — the ONE numeric clamp (legacy + timeDimension share it) ──
//
//  Reproduces the exact pre-R5 arithmetic of `clampYears` / QueryResolver:
//    from = Number(bound ?? 0)        — absent/falsy ⇒ no lower bound.
//    to   = Number(bound ?? Infinity) — absent/falsy ⇒ no upper bound.
//    keep year y  iff  (!from || y >= from) && (!to || y <= to)
//  Both the legacy fromDim/toDim path and the timeDimension range path call
//  THIS so they are provably identical (FF-TIMEDIMENSION).
//
export function clampToBounds(
  years: number[],
  from:  number,
  to:    number,
): number[] {
  let out = years
  if (from) out = out.filter((y) => y >= from)
  if (to)   out = out.filter((y) => y <= to)
  return out
}

// ── resolveTimeBound — one [from,to] entry → numeric bound ────────────
//
//  A literal year, or a ctx ref ({ $ctx }) resolved against ctx.dims via the
//  one Ref dispatcher — identical to the legacy `Number(ctx.dims[fromDim] ?? d)`
//  lookup. `missing` is the legacy default (0 for from, Infinity for to) so an
//  absent/empty ctx value reproduces the legacy "no bound" outcome exactly.
//
export function resolveTimeBound(
  bound:   TimeBound,
  ctx:     SectionContext,
  missing: number,
): number {
  if (typeof bound === 'number') return Number(bound ?? missing)
  const v = resolveRef(bound as CtxRef, { dims: ctx.dims })
  return Number(v ?? missing)
}

// ── isYearsRange — does the range carry an explicit year list? ────────
//
//  A YearsSpec ('all' | readonly number[]) selects years; a [from,to] tuple
//  clamps a range. Distinguish: 'all' (string) is a YearsSpec; a 2-tuple whose
//  entries are bounds (number | CtxRef) is a range. A plain number[] is a
//  YearsSpec — disambiguated from a [from,to] of two literals by INTENT: the
//  canonical [from,to] form is reserved for range clamping and is detected by
//  the caller via `rangeMode`. We treat a readonly number[] as a YearsSpec.
//
export function isYearsSpec(range: TimeRange): range is YearsSpec {
  return range === 'all' || (Array.isArray(range) && range.every((b) => typeof b === 'number'))
}

// ── NormalizedTime — the legacy-shaped inputs a resolver consumes ─────
export interface NormalizedTime {
  /** Explicit year selection when the range is a YearsSpec; else undefined. */
  years?: YearsSpec
  /** Resolved numeric lower bound (0 ⇒ none) for clampToBounds. */
  from:   number
  /** Resolved numeric upper bound (Infinity ⇒ none) for clampToBounds. */
  to:     number
}

// ── resolveTimeDimension — fold timeDimension → NormalizedTime ────────
//
//  Reads `range`:
//    YearsSpec       → { years, from: 0, to: Infinity }   (folds `years`)
//    [from, to]      → { from, to }                        (folds fromDim/toDim)
//    absent          → { from: 0, to: Infinity }           (no constraint)
//  `granularity` is carried metadata (default-derived = year) and does not
//  affect resolution in this pass — door for LOD/declared-grain.
//
export function resolveTimeDimension(
  td:  TimeDimensionSpec,
  ctx: SectionContext,
): NormalizedTime {
  const { range } = td
  if (range === undefined) return { from: 0, to: Infinity }
  if (isYearsSpec(range))  return { years: range, from: 0, to: Infinity }
  const [fromB, toB] = range
  return {
    from: resolveTimeBound(fromB, ctx, 0),
    to:   resolveTimeBound(toB,   ctx, Infinity),
  }
}

// ── effectiveBounds — fold legacy fromDim/toDim + timeDimension [R5] ──
//
//  ONE numeric (from, to) clamp pair for a spec, merging the LEGACY fields and
//  the canonical timeDimension. Legacy fromDim/toDim WIN on overlap (Postel):
//  when timeDimension is absent this reduces to the pre-R5 clampYears arithmetic
//  byte-for-byte:
//    from = fromDim ? Number(ctx.dims[fromDim] ?? 0)        : (timeDimension from)
//    to   = toDim   ? Number(ctx.dims[toDim]   ?? Infinity) : (timeDimension to)
//  No hardcoded 'time' literal — operates on the generic axis via TIME_DIM.
//
export interface LegacyTimeSpec {
  fromDim?:        string
  toDim?:          string
  timeDimension?:  TimeDimensionSpec
}

export function effectiveBounds(
  spec: LegacyTimeSpec,
  ctx:  SectionContext,
): { from: number; to: number } {
  const td = spec.timeDimension ? resolveTimeDimension(spec.timeDimension, ctx) : undefined
  const from = spec.fromDim
    ? Number(ctx.dims[spec.fromDim] ?? 0)
    : (td?.from ?? 0)
  const to = spec.toDim
    ? Number(ctx.dims[spec.toDim] ?? Infinity)
    : (td?.to ?? Infinity)
  return { from, to }
}

// ── clampYears — apply merged (from,to) bounds to a year list ─────────
//
//  Identical arithmetic to the pre-R5 inline filter (clampToBounds), so legacy
//  specs (timeDimension absent) are byte-identical.
//
export function clampYears(
  years: number[],
  spec:  LegacyTimeSpec,
  ctx:   SectionContext,
): number[] {
  const { from, to } = effectiveBounds(spec, ctx)
  return clampToBounds(years, from, to)
}

// ── effectiveYears — fold the year selection (legacy `years` + timeDimension) ─
//
//  timeseries/growth carry a REQUIRED `years`; timeDimension.range may ALSO be a
//  YearsSpec. Legacy `years` WINS (Postel) — an existing spec (no timeDimension)
//  resolves exactly as before. When `years` is genuinely absent (only reachable
//  via timeDimension authoring) the range's YearsSpec is used; else 'all'.
//
export function effectiveYears(
  spec: { years?: YearsSpec; timeDimension?: TimeDimensionSpec },
): YearsSpec {
  if (spec.years !== undefined) return spec.years
  const range = spec.timeDimension?.range
  if (range !== undefined && isYearsSpec(range)) return range
  return 'all'
}
