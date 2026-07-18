// ── Cell — the honest value envelope (the interpret-level state seam) ──────────
//
//  "The canvas never lies" (Law 11 / FF-CANVAS-NEVER-LIES). The pervasive read
//  path — `storeVal(...) ?? 0` (store.ts) — collapses FOUR semantically distinct
//  conditions into the single number `0`:
//    • a genuine zero (a real, published 0)
//    • no observation at the coordinate (bound spec, empty cell — "no data")
//    • an unbound spec (no measure chosen — an authoring state)
//    • a suppressed cell (SDMX OBS_STATUS 'c' — confidential, must NOT be published)
//  A statistics tool that renders `0` for all four has published a lie. The state
//  grammar the platform needs is ALREADY modeled on the async envelope
//  (`QueryResult.state`) and on the row (`obsStatus`) — it just never survives the
//  synchronous `storeVal` fast-lane. This leaf recovers it.
//
//  Benchmarked against: Grafana DataFrames (per-frame loading/error/no-data state),
//  Vega-Lite (invalid/filtered datum), SDMX OBS_STATUS (A/p/e/r/c). The surpass is
//  PER-VALUE state (not per-frame): a single cell carries {value, state, status}.
//
//  ADDITIVE / REVERSIBLE (Law 7 — a Strangler expand): `storeVal` stays
//  byte-identical; `storeCell` is the honest sibling nothing is forced to adopt.
//

import type { DataStore, Observation } from './store'
import { storeVal, storeObs }          from './store'
import type { SectionContext }         from '../core/context'
import { MEASURE_DIM }                 from '../core/context'
import type { ObsStatus }              from '../core/provenance'

// ── ValueState — the canonical interpret-level state grammar ───────────────────
//
//  The level-of-honesty a resolved value carries. Exactly one applies to a Cell.
export type ValueState =
  | 'ok'                 // a real value — INCLUDING a genuine 0
  | 'no-data'            // coordinate is valid but the store has no observation there
  | 'unbound'            // the spec is incomplete — no measure/coordinate to read (authoring)
  | 'loading'            // an async read is in flight (the QueryResult.state that dies at querySync)
  | 'transient-retrying' // a read hit a transient failure (429/503) and is backing off/retrying (ADR-048)
  | 'error'              // the read failed
  | 'masked'             // suppressed by OBS_STATUS 'c' — value WITHHELD, never rendered as a number

/**
 * The honest value envelope. `value` is `null` for every non-`ok` state — a Cell
 * NEVER carries a fabricated `0` for a no-data / unbound / masked coordinate.
 */
export interface Cell {
  /** The resolved number, or `null` when `state !== 'ok'` (never a fake 0). */
  value:   number | null
  /** Which of the six honesty conditions this cell is in. */
  state:   ValueState
  /** SDMX OBS_STATUS decoration (p/e/r) when `state === 'ok'`; 'c' rides `masked`. */
  status?: ObsStatus
}

// ── Cell constructors (readability at the call sites) ──────────────────────────
export const okCell        = (value: number, status?: ObsStatus): Cell => ({ value, state: 'ok', status })
export const noDataCell    = (): Cell                                   => ({ value: null, state: 'no-data' })
export const unboundCell   = (): Cell                                   => ({ value: null, state: 'unbound' })
export const maskedCell    = (): Cell                                   => ({ value: null, state: 'masked', status: 'c' })
/** A read in transient backoff/retry (429/503) — value withheld, never a fake 0 (ADR-048). */
export const retryingCell  = (): Cell                                   => ({ value: null, state: 'transient-retrying' })

// ── obsAtCoord — the observation slice at a coordinate (the SSOT scan) ──────────
//
//  The `val` OLAP sum collapses no-data into `0` (an empty match reduces to 0), so
//  distinguishing genuine-0 from no-data — and detecting a suppressed cell — needs
//  the observation-level slice, NOT the sum. This is the generic coordinate scan
//  (measure(code) × every CONCRETE dim in ctx.dims) that BOTH the honest-cell read
//  and the preliminary-status derivation (kpi-preliminary.ts) share, so a cell's
//  state and its OBS_STATUS derive from the IDENTICAL slice (no drift). Generic over
//  dims (Law 1 — no year/measure/geo literal).
//
//  Returns `null` — NOT `[]` — when the obs read throws (a cold async slice), so the
//  caller can DISTINGUISH "genuinely no observation" (`[]`) from "could not read"
//  (`null`) and degrade safely rather than fabricate a false no-data. The obs read at
//  this coordinate is warmed by the KPI warm path (extractKpiRequirements warms `obs`
//  per requirement) exactly as `val` is, so a warm consumer resolves it synchronously.
export function obsAtCoord(
  store: DataStore,
  code:  string,
  ctx:   SectionContext,
): Observation[] | null {
  let obs: Observation[]
  try {
    obs = storeObs(store, { measure: code }, ctx)
  } catch {
    return null   // could not read — caller degrades, never a false no-data
  }
  return obs.filter((o) => {
    const r = o as Record<string, unknown>
    if (String(r[MEASURE_DIM] ?? code) !== code) return false
    // At-coordinate ⟺ every CONCRETE (non-empty) dim in ctx.dims matches the obs.
    for (const [dim, val] of Object.entries(ctx.dims)) {
      if (val === '' || val === null || val === undefined) continue
      const ov = r[dim]
      if (ov !== undefined && String(ov) !== String(val)) return false
    }
    return true
  })
}

/** SDMX OBS_STATUS of an observation (case-tolerant), or undefined when absent. */
export function obsStatusOf(o: Observation): ObsStatus | undefined {
  const r    = o as Record<string, unknown>
  const prov = r['provenance'] as { status?: unknown } | undefined
  const raw  = r['obsStatus'] ?? r['status'] ?? prov?.status
  if (typeof raw !== 'string' || raw.trim() === '') return undefined
  const l = raw.trim().toLowerCase()
  return l === 'c' ? 'c'
       : l === 'p' ? 'p'
       : l === 'e' ? 'e'
       : l === 'r' ? 'r'
       : l === 'a' ? 'A'
       : undefined
}

/** True ⟺ the observation is confidential/suppressed (OBS_STATUS 'c'). */
const isMasked = (o: Observation): boolean => obsStatusOf(o) === 'c'

// ── storeCell — the honest sibling of storeVal ─────────────────────────────────
//
//  Reads a single measure code at ctx as an honest `Cell`. `storeVal` stays the
//  numeric SSOT (the OLAP sum is authoritative — the value here is byte-identical to
//  storeVal for every `ok` cell); the obs slice supplies ONLY the state distinction
//  the sum cannot carry:
//    • empty/whitespace code → `unbound`   — decided BEFORE any read (no coordinate)
//    • any obs at coord is 'c' → `masked`   — value withheld, the sum never surfaces
//    • obs slice is [] AND sum is 0 → `no-data`  (genuine empty — no observation)
//    • obs slice unreadable (null) → `ok`   — DEGRADE to today's behaviour, never a
//                                             false no-data (statistics safety)
//    • otherwise → `ok(sum)`                — a non-zero sum, OR a 0 with a real obs
//                                             behind it (a GENUINE published zero)
//
//  Never hides a real value: a non-zero sum is ALWAYS `ok`. The ONLY `0`→`no-data`
//  conversion is when the exact-coordinate scan AND the sum both see nothing.
export function storeCell(store: DataStore, code: string, ctx: SectionContext): Cell {
  if (!code || code.trim().length === 0) return unboundCell()

  const obs = obsAtCoord(store, code, ctx)
  // Suppression is the hard rule — a confidential cell resolves to `masked`, never the
  // raw number, BEFORE the sum is even computed (F7: the flag must actually withhold).
  if (obs !== null && obs.some(isMasked)) return maskedCell()

  const n = storeVal(store, code, ctx)   // authoritative OLAP sum (value byte-identical)
  if (obs === null)      return okCell(n)                    // status unreadable → never regress
  if (obs.length === 0)  return n === 0 ? noDataCell() : okCell(n)  // empty scan: no-data ⟺ 0
  return okCell(n, obsStatusOf(obs[0]!))                     // real obs behind it (genuine 0 = ok)
}
