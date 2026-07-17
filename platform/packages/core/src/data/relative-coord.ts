// ── relative-coord — MDX Lag/ParallelPeriod member navigation [ADR-045] ─────────
//
//  Resolves a `RelativeCoord` token (`{ $prev: n }`, metric.ts) to an ABSOLUTE
//  coordinate against the store's ORDERED member set, at read time. This is the
//  OLAP-canonical relative-member navigation (MDX `Lag(n)` / `ParallelPeriod`)
//  adopted whole (Law 4): navigation is over the ORDERED MEMBERS of a dimension —
//  NOT a naive `value - n` arithmetic (which cannot tell "no prior member" from "a
//  gap year with no observation", the origin of the fabricated-0 growth number).
//
//  Off-the-edge (no such prior member — e.g. `$prev:1` at the first period) resolves
//  to `undefined`: the caller (metric-calc) folds that to the honest no-data state
//  (Law 11), never a wrap, clamp, or fabricated 0.
//
//  GENERIC over dims (Law 1): the same machinery navigates ANY ordered dimension —
//  time is merely the first consumer. The ordered member set is derived from an OBS
//  SCAN at the component's measure (the SAME warmed-obs mechanism `obsAtCoord` uses,
//  so it resolves synchronously on the live async store post-warm — the growth
//  metric's warm requirement fetches the whole navigated axis, see
//  calcMetricRequirements). Member ORDER follows the SDMX member-order canon: the
//  dimension's classifier codelist order when coded, else natural value order
//  (numeric-ascending when every member is numeric-coercible, else lexical).
//
import type { DataStore } from './store'
import { storeObs }       from './store'
import type { SectionContext } from '../core/context'
import type { DimVal }         from '../sdmx'
import { codesOf }        from './codelist'
import { isRelativeCoord } from './metric'
import type { RelativeCoord } from './metric'

/**
 * The ORDERED member set of `dim` present at the current slice — the members
 * observed at (measure = `code`, every OTHER concrete ctx dim fixed), with `dim`
 * itself freed (the axis being navigated). Ordered by the SDMX member-order canon
 * (classifier codelist order when the dim is coded, else numeric/lexical). Returns
 * `[]` when the obs slice is unreadable (a cold async slice) — the caller degrades
 * to off-the-edge, never fabricates a member. Generic over dims (Law 1).
 */
export function orderedMembers(
  store: DataStore,
  code:  string,
  dim:   string,
  ctx:   SectionContext,
): DimVal[] {
  // Free the navigated dim; scope the scan to every OTHER concrete dim. The scan ctx
  // ALSO drops the navigated dim from ctx.dims so the async store leaves that axis
  // unbounded (time → all periods) rather than pinning it to the current coordinate.
  const filter:   Record<string, DimVal> = {}
  const scanDims: Record<string, DimVal> = {}
  for (const [k, v] of Object.entries(ctx.dims)) {
    if (k === dim) continue
    if (v === '' || v === null || v === undefined) continue
    filter[k]   = v
    scanDims[k] = v
  }
  const scanCtx: SectionContext = { ...ctx, dims: scanDims }

  let obs
  try {
    obs = storeObs(store, { measure: code, filter }, scanCtx)
  } catch {
    return []   // cold/unreadable slice → caller treats as off-the-edge (no member)
  }

  const seen    = new Set<string>()
  const members: DimVal[] = []
  for (const o of obs) {
    const raw = (o as Record<string, DimVal>)[dim]
    if (raw === undefined || raw === null || raw === '') continue
    const key = String(raw)
    if (seen.has(key)) continue
    seen.add(key)
    members.push(raw)
  }
  return orderMembers(members, dim, store)
}

/** Order members by the SDMX member-order canon (classifier order, else natural value). */
function orderMembers(members: DimVal[], dim: string, store: DataStore): DimVal[] {
  const cl = store.classifiers?.[dim]
  if (cl) {
    const order = new Map<string, number>()
    codesOf(cl).forEach((c, i) => order.set(String(c), i))
    return [...members].sort(
      (a, b) => (order.get(String(a)) ?? Number.MAX_SAFE_INTEGER) - (order.get(String(b)) ?? Number.MAX_SAFE_INTEGER),
    )
  }
  const allNumeric = members.every((m) => String(m).trim() !== '' && !Number.isNaN(Number(m)))
  return [...members].sort(
    allNumeric
      ? (a, b) => Number(a) - Number(b)
      : (a, b) => String(a).localeCompare(String(b)),
  )
}

/**
 * MDX `Lag(n)` / `ParallelPeriod` over an ordered member set: the member `token.$prev`
 * positions BACK from `current`. Off-the-edge — `current` absent from the set, or the
 * target index below 0 (no such prior member, e.g. the first period) — returns
 * `undefined` (the honest no-data signal, never a wrap or clamp).
 */
export function navigateRelative(
  members: DimVal[],
  current: DimVal,
  token:   RelativeCoord,
): DimVal | undefined {
  const idx = members.findIndex((m) => String(m) === String(current))
  if (idx < 0) return undefined
  const target = idx - token.$prev
  if (target < 0 || target >= members.length) return undefined
  return members[target]
}

/**
 * Resolve a component's `at` to an ABSOLUTE coordinate — every `RelativeCoord` token
 * navigated over its dimension's ordered members (against `code`, the component's
 * measure). Returns the concrete `at` (tokens replaced by absolute members), or
 * `undefined` when ANY token is off-the-edge (the honest first-period state that
 * metric-calc folds to no-data, Law 11). An `at` with no tokens returns byte-identical
 * (each absolute value passed through) — the existing calc-metric path is unchanged.
 */
export function resolveRelativeAt(
  at:    Partial<Record<string, DimVal | RelativeCoord>> | undefined,
  code:  string,
  ctx:   SectionContext,
  store: DataStore,
): Partial<Record<string, DimVal>> | undefined {
  if (!at) return {}
  const out: Partial<Record<string, DimVal>> = {}
  for (const [dim, v] of Object.entries(at)) {
    if (isRelativeCoord(v)) {
      const resolved = navigateRelative(orderedMembers(store, code, dim, ctx), ctx.dims[dim], v)
      if (resolved === undefined) return undefined   // off-the-edge → no-data
      out[dim] = resolved
    } else if (v !== undefined) {
      out[dim] = v
    }
  }
  return out
}
