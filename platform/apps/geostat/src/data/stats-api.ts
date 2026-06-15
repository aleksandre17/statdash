// ── Stats API client + adapters (Layer 3: VITE_STORE_MODE=stats) ──────────
//
//  HTTP boundary for the real stats API at /api/stats/*. Native fetch only.
//  All responses use a { data: T } envelope — unwrapped here before use.
//
//  Pattern: Hexagonal Architecture — this file is the single adapter at the
//  port. `get()` is the ONLY place fetch is called (Law 5: API-readiness).
//
//  Law 1 (no privileged dimensions): dim_key is treated as an opaque generic
//  Record<string, DimVal>. We never name 'measure' / 'geo' / 'time' here —
//  the adapter spreads the key as-is and lets the engine resolve dimensions.
//
import type { Observation, Classifier, ClassifierEntry, DimVal } from '@geostat/engine'

// ── Wire shapes — exact contract of GET /api/stats/* responses ────────────

/** Row of GET /datasets — dataset descriptor + its dimension list. */
export interface StatsDatasetRow {
  code:  string
  label: string
  dimensions: { dim_code: string; is_time_dim: boolean; ord: number }[]
}

/** Row of GET /observations — one fact. dim_key holds all non-time dims. */
export interface StatsObsRow {
  time_period: string
  dim_key:     Record<string, unknown>
  obs_value:   number
  obs_status:  string
}

/** Row of GET /classifiers/:dim_code — one codelist member. */
export interface StatsClassifierRow {
  id:        number
  code:      string
  label:     string | null
  color:     string | null
  parent_id: number | null
  ord:       number
  metadata:  unknown
}

// ── HTTP boundary — the ONLY fetch in stats mode (Law 5) ──────────────────

const STATS_PREFIX = '/api/stats'

async function get<T>(base: string, path: string): Promise<T> {
  const res = await fetch(`${base}${STATS_PREFIX}${path}`)
  if (!res.ok) throw new Error(`Stats API ${path}: ${res.status}`)
  const json = (await res.json()) as { data: T }
  return json.data
}

// ── Time parsing — annual / quarterly / monthly → fractional year ─────────
//
//  Time becomes a numeric year-fraction so it orders and ranges naturally on
//  a continuous axis. Unrecognized formats return null → time dim omitted.

function parseTimePeriod(tp: string): number | null {
  if (/^\d{4}$/.test(tp)) return Number(tp) // "2023" → 2023
  if (/^\d{4}-Q[1-4]$/i.test(tp)) {
    const [y, q] = tp.split('-')
    return Number(y) + (Number(q.slice(1)) - 1) * 0.25 // "2023-Q2" → 2023.25
  }
  if (/^\d{4}-\d{2}$/.test(tp)) {
    const [y, m] = tp.split('-')
    return Number(y) + (Number(m) - 1) / 12 // "2023-06" → 2023.416…
  }
  return null // unrecognized format — omit time dim
}

// ── Adapters — wire shape → engine shape ──────────────────────────────────

/**
 * StatsObsRow → Observation. dim_key is spread generically (Law 1); time_period
 * is parsed to a numeric `time` dim, omitted when the format is unrecognized.
 * obs_status is surfaced as camelCase `obsStatus` (engine convention).
 */
export function fromStatsObsRow(row: StatsObsRow): Observation {
  const time = parseTimePeriod(row.time_period)
  return {
    ...(row.dim_key as Record<string, DimVal>), // measure, geo, sector, …
    value: row.obs_value,
    obsStatus: row.obs_status,
    ...(time !== null ? { time } : {}),
  }
}

/**
 * StatsClassifierRow[] → Classifier (array form). Code IS the key, matching the
 * codes observations carry. parent_id is resolved to the parent's *code* so the
 * hierarchy works in array form (DimResolver reads parent as a code there).
 */
export function fromStatsClassifiers(rows: StatsClassifierRow[]): Classifier {
  const codeById = new Map(rows.map((r) => [r.id, r.code]))
  return rows.map((r): ClassifierEntry => ({
    code:  r.code,
    label: r.label ?? r.code,
    color: r.color ?? undefined,
    parent: r.parent_id !== null ? codeById.get(r.parent_id) : undefined,
  }))
}

// ── Resource fetchers — typed reads over the HTTP boundary ────────────────

export async function fetchDatasets(base: string): Promise<StatsDatasetRow[]> {
  return get<StatsDatasetRow[]>(base, '/datasets')
}

export async function fetchDatasetObs(
  base: string,
  datasetCode: string,
  limit?: number,
): Promise<Observation[]> {
  const q = new URLSearchParams({ dataset: datasetCode })
  if (limit !== undefined) q.set('limit', String(limit))
  const rows = await get<StatsObsRow[]>(base, `/observations?${q.toString()}`)
  return rows.map(fromStatsObsRow)
}

export async function fetchDimClassifiers(base: string, dimCode: string): Promise<Classifier> {
  const rows = await get<StatsClassifierRow[]>(base, `/classifiers/${encodeURIComponent(dimCode)}`)
  return fromStatsClassifiers(rows)
}
