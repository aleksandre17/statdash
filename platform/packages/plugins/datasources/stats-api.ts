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
//  SSOT NOTE (G3.0): this is tenant-agnostic stats plumbing — the SDMX obs→row
//  mapping + the /api/stats HTTP boundary. It carries NO tenant content (no
//  pages, datasets, brand), so it lives in @statdash/plugins/datasources where
//  BOTH the geostat runner and the panel Constructor share ONE store-builder
//  (Law 3: plugins is below apps; it imports only @statdash/engine types here).
//
import type { Observation, Classifier, ClassifierEntry, DimVal } from '@statdash/engine'

// ── Wire shapes — exact contract of GET /api/stats/* responses ────────────

/** Row of GET /datasets — dataset descriptor + its dimension list. */
export interface StatsDatasetRow {
  code:  string
  label: string
  dimensions: { dim_code: string; is_time_dim: boolean; ord: number }[]
}

/**
 * Row of GET /observations — one raw fact, exact wire shape of the route's
 * SELECT (time_period, dim_key, obs_value, obs_status, obs_attribute).
 *
 * This is the SSOT raw shape the engine's ApiStore hands to its DI `mapRow`
 * (engine `RawObsRow`). It is structurally identical to engine `RawObsRow`,
 * declared here so the app owns its own wire contract (the engine never
 * imports app types — Law 3 / dependency arrow).
 *
 * `obs_value` is a pg `numeric` serialized as a STRING (e.g. "42367.21") — pg
 * returns numeric/decimal as text to preserve arbitrary precision. The adapter
 * coerces it to a real `number` (GAP 3); a missing/suppressed cell is `null`,
 * NOT 0 — the mapper preserves null (suppressed ≠ 0). It also accepts a real
 * `number` so a stub/typed source still works.
 * `dim_key` is opaque generic (Law 1): never named dims here.
 * `obs_attribute` is a generic bag (e.g. `{ seq_pos }`) lifted to camelCase
 * engine fields by the mapper.
 */
export interface RawStatsObsRow {
  time_period:   string
  dim_key:       Record<string, string>
  obs_value:     string | number | null
  obs_status:    string
  obs_attribute: Record<string, unknown>
}

/**
 * @deprecated kept as a backward-compatible alias for existing callers.
 * New code uses {@link RawStatsObsRow} — the exact route shape.
 */
export type StatsObsRow = RawStatsObsRow

/**
 * Row of GET /datasets/:code — dataset descriptor + DSD + provenance flags.
 * P2-3: `preliminary` (any obs_status='P') and `version` feed the engine's
 * MetadataPort so dataset-wide provenance badges can render.
 */
export interface StatsDatasetMetaRow {
  code:        string
  label:       string
  version:     string | null
  preliminary: boolean
  dimensions:  { dim_code: string; is_time_dim: boolean; ord: number }[]
}

/**
 * Row of GET /api/data-sources — one connected data source (P3-4). The public,
 * minimal projection the dashboard reads at boot to build its store manifest;
 * mirrors the API's PublicDataSourceRow exactly (the app owns its own wire
 * contract — the API never imports app types, Law 3). `config` carries the
 * store-builder params (datasetCode, nonTimeDims) as opaque JSON.
 */
export interface PublicDataSourceRow {
  name:   string
  type:   string
  url:    string | null
  config: Record<string, unknown>
}

/**
 * Minimal projection of GET /api/cube/:code/profile — just the browsable axes
 * the source-authoring Constructor needs (dims/measures codes + labels). The
 * full profile bundle (members, units, actual-region) is richer; this reads only
 * what SourceMetadata reports. Mirrors the route's CubeProfile shape exactly (the
 * app owns its own wire contract — Law 3). Labels are SDMX LocaleString records.
 */
export interface StatsCubeProfileRow {
  datasetCode: string
  // `isTime` mirrors the route's ProfileDimension.isTime (DSD is_time_dim, the
  // per-dataset truth of WHICH axis is time). The store-builder reads it to fold
  // time coverage under the dataset's own time-dim key — never a hardcoded 'time'
  // (Law 1). Projected here because the builder needs the time-dim identity, not
  // just the dim codes SourceMetadata reports.
  dimensions:  { code: string; conceptRole: string | null; isTime: boolean }[]
  measures:    { code: string; label: Record<string, string> | null }[]
  /**
   * The dataset's available TIME RANGE (V26 cube_actual_region SSOT): MIN/MAX
   * bound plus the distinct period list ASCENDING. The store-builder folds
   * `periods` into `classifiers[<timeDim>]` so a year-select `{from:'options',
   * pick:'last'}` resolves to the real latest period synchronously. Degraded
   * source ⇒ `{ min:null, max:null, periods:[] }` (all-years render, never 400).
   */
  timeCoverage: { min: string | null; max: string | null; periods: string[] }
}

/**
 * Row of GET /classifiers/:dim_code — one codelist member.
 *
 * WIRE CONTRACT (GAP 5b): the live route SELECTs `label` and `parent_code`
 * straight from `stats.classifier`. Two things changed vs the legacy shape and
 * the adapter must track them at THIS seam (Postel normalization, single ACL):
 *
 *   • `label` is a LocaleString object `{ en, ka }` (V-i18n), no longer a flat
 *     string. Stored as-is into the engine `ClassifierEntry.label` so real i18n
 *     is preserved end-to-end (resolved to a concrete string at the React
 *     boundary). A legacy flat `string` still parses (LocaleString ⊇ string).
 *   • the hierarchy edge is `parent_code` (the stable business key, ADR-0023),
 *     NOT the dropped surrogate `parent_id`. It maps DIRECTLY to the array-form
 *     classifier's `parent` (which is a code) — no codeById indirection.
 */
export interface StatsClassifierRow {
  id:          number
  code:        string
  /** LocaleString `{ en, ka }` (or a legacy flat string). */
  label:       Record<string, string> | string | null
  color:       string | null
  /** Parent's business CODE (ADR-0023 code-chain edge); null = root. */
  parent_code: string | null
  ord:         number
  metadata:    unknown
}

// ── HTTP boundary — the ONLY fetch in stats mode (Law 5) ──────────────────

const STATS_PREFIX = '/api/stats'
const API_PREFIX   = '/api'
const CUBE_PREFIX  = '/api/cube'

async function get<T>(base: string, path: string): Promise<T> {
  return getAt<T>(base, STATS_PREFIX, path)
}

/**
 * Same { data: T } unwrap as get(), but parameterized on the route prefix so the
 * public /api/data-sources read (P3-4) — which is NOT under /api/stats — can
 * share this single fetch boundary instead of opening a second one (Law 5: one
 * adapter seam).
 */
async function getAt<T>(base: string, prefix: string, path: string): Promise<T> {
  const res = await fetch(`${base}${prefix}${path}`)
  if (!res.ok) throw new Error(`API ${prefix}${path}: ${res.status}`)
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
 * obs_status is surfaced as camelCase `obsStatus` (engine convention) and
 * normalized to the engine's canonical SDMX OBS_STATUS casing.
 *
 * Postel's Law (robustness at the boundary): the DB persists SDMX codes in
 * upper case ('P', 'E', 'R', 'C') while the engine's `ObsStatus` union and
 * OBS_STATUS_LABELS use the IMF/Eurostat lower-case convention ('p', 'e', 'r',
 * 'c'); only 'A' (normal) stays upper. Normalize here — the single adapter seam
 * — so every downstream consumer (provenance badge, StatusBadge) sees one
 * canonical casing and never has to case-fold the status itself.
 */
export function fromStatsObsRow(row: RawStatsObsRow): Observation {
  const time = parseTimePeriod(row.time_period)
  return {
    ...(row.dim_key as Record<string, DimVal>),       // measure, geo, sector, …
    ...liftObsAttributes(row.obs_attribute),          // seqPos (camelCase), …
    value: toNumericValue(row.obs_value),             // GAP 3: numeric, null preserved
    obsStatus: normalizeObsStatus(row.obs_status),
    ...(time !== null ? { time } : {}),
  }
}

/**
 * GAP 3: coerce the wire `obs_value` to a real `number`. pg serializes `numeric`
 * as a STRING ("42367.21"); passing it verbatim makes every downstream
 * `aggregate{sum}` / `pct{sumOf}` / growth ratio do STRING math (NaN or
 * concatenation). A suppressed/missing cell is `null` and MUST stay null
 * (suppressed ≠ 0), so an aggregate omits it rather than counting a zero. A
 * non-finite parse (corrupt cell) also degrades to null rather than poisoning a
 * sum with NaN.
 */
function toNumericValue(v: string | number | null): number | null {
  if (v === null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * GAP 3: surface obs attributes generically (Law 1 — never name a specific dim),
 * lifting snake_case wire keys to the engine's camelCase convention. The
 * accounts config sorts `by:'seqPos'` and carry-forward-filters on `seqPos>0`,
 * but the value lives in `obs_attribute.seq_pos` — only `dim_key` was spread
 * before, so the field was MISSING and the sequence collapsed. The OLD adapter
 * lifted `seqPos` from dims; this mirrors it for the live wire shape. Values are
 * coerced to `DimVal` scalars; numeric strings become numbers so `seqPos>0`
 * compares numerically.
 */
function liftObsAttributes(attr: Record<string, unknown>): Record<string, DimVal> {
  const out: Record<string, DimVal> = {}
  for (const [k, v] of Object.entries(attr)) {
    if (v === undefined || v === null) continue
    const key = snakeToCamel(k)
    if (typeof v === 'number' || typeof v === 'boolean') { out[key] = v; continue }
    const s = String(v)
    // A numeric attribute (e.g. seq_pos) becomes a number so numeric comparisons
    // (seqPos>0) and ordering (by:'seqPos') work; non-numeric stays a string.
    out[key] = /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : s
  }
  return out
}

/** snake_case → camelCase (seq_pos → seqPos). Single-segment keys pass through. */
function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase())
}

/**
 * Canonicalize a raw SDMX OBS_STATUS to the engine's convention: 'A' (normal)
 * stays upper-case, every other recognized code is lower-cased ('P'→'p', …).
 * Unrecognized values pass through untouched (forward-compatible — a new SDMX
 * code still reaches the renderer rather than being silently dropped).
 */
function normalizeObsStatus(raw: string): string {
  if (raw === '' || raw === 'A') return raw
  const lower = raw.toLowerCase()
  return (lower === 'p' || lower === 'e' || lower === 'r' || lower === 'c') ? lower : raw
}

/**
 * StatsClassifierRow[] → Classifier (array form). Code IS the key, matching the
 * codes observations carry.
 *
 * GAP 5b fixes at this single ACL seam:
 *   • `label` is carried INTACT as a LocaleString `{ en, ka }` (or flat string),
 *     not stored as `[object Object]` (the old `label ?? code` stringified the
 *     object). Real i18n end-to-end; resolved at the React boundary. A null/empty
 *     label degrades to the `code` (Postel: always something renderable).
 *   • `parent` maps DIRECTLY from `parent_code` (already a business code) — the
 *     array form reads `parent` as a code, so no codeById id→code indirection.
 */
export function fromStatsClassifiers(rows: StatsClassifierRow[]): Classifier {
  return rows.map((r): ClassifierEntry => ({
    code:   r.code,
    label:  normalizeClassifierLabel(r.label, r.code),
    color:  r.color ?? undefined,
    parent: r.parent_code ?? undefined,
  }))
}

/**
 * A wire `label` is either a LocaleString object `{ en, ka }`, a legacy flat
 * string, or null. Keep the object/string intact (i18n preserved); fall back to
 * the code only when there is genuinely nothing to show. An empty object (no
 * locales) also degrades to the code so a consumer never renders `{}`.
 */
function normalizeClassifierLabel(
  label: Record<string, string> | string | null,
  code:  string,
): import('@statdash/engine').LocaleString {
  if (label === null) return code
  if (typeof label === 'string') return label === '' ? code : label
  return Object.keys(label).length > 0 ? label : code
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

/**
 * GET /api/data-sources → connected data sources (P3-4). The Phase-2 boot read:
 * fetchStoreManifest maps these rows to 'stats' datasource descriptors. Lives
 * here so every server read crosses the one HTTP adapter (Law 5). Note the
 * /api prefix (not /api/stats) — this is a sibling public route.
 */
export async function fetchDataSources(base: string): Promise<PublicDataSourceRow[]> {
  return getAt<PublicDataSourceRow[]>(base, API_PREFIX, '/data-sources')
}

export async function fetchDimClassifiers(base: string, dimCode: string): Promise<Classifier> {
  const rows = await get<StatsClassifierRow[]>(base, `/classifiers/${encodeURIComponent(dimCode)}`)
  return fromStatsClassifiers(rows)
}

/**
 * GET /datasets/:code → dataset-level provenance (P2-3). Read once at store-build
 * time and folded into a MetadataPort so the engine can surface a dataset-wide
 * "preliminary" badge without re-fetching per render.
 */
export async function fetchDatasetMeta(base: string, datasetCode: string): Promise<StatsDatasetMetaRow> {
  return get<StatsDatasetMetaRow>(base, `/datasets/${encodeURIComponent(datasetCode)}`)
}

/**
 * GET /api/cube/:code/profile → the introspection bundle (M2 — the source's
 * browsable structure). Reuses the SAME HTTP boundary (getAt) on the public cube
 * scope (NOT /api/stats — the cube profile is its own least-privilege read).
 * This is what the 'stats' kind's `getMetadata` maps to SourceMetadata. 404 ⇒
 * throws (unknown dataset) — the caller surfaces it as a Test/Browse error.
 */
export async function fetchCubeProfile(base: string, datasetCode: string): Promise<StatsCubeProfileRow> {
  return getAt<StatsCubeProfileRow>(base, CUBE_PREFIX, `/${encodeURIComponent(datasetCode)}/profile`)
}

// ── Per-query observation fetcher — the on-demand read (ADR-STORE-001) ─────
//
//  Where fetchDatasetObs pulls the WHOLE cube, fetchObservations pulls exactly
//  one slice — the Cache-Aside read the engine ApiStore issues per ObsQuery.
//  Returns RAW rows (RawStatsObsRow): the engine ApiStore owns the raw→engine
//  mapping via its injected `mapRow` (fromStatsObsRow), so the boundary stays a
//  pure HTTP adapter (Hexagonal) and the engine stays app-agnostic (Law 3).
//
//  ETag/304 aware: the route emits a weak ETag (GAP 5a). We forward the caller's
//  If-None-Match and surface `notModified` so the store can keep its cached slice
//  on a 304 (conditional-GET cache validation, RFC 9110).

/** Query params for GET /api/stats/observations — mirrors the route's ObsQuery. */
export interface ObsFetchParams {
  dataset: string
  from?:   string                 // time_period start (e.g. '2015')
  to?:     string                 // time_period end   (e.g. '2024')
  filter?: Record<string, string> // non-time dim filters → JSON.stringify-ed
  limit?:  number
}

export async function fetchObservations(
  base: string,
  params: ObsFetchParams,
  ifNoneMatch?: string,
): Promise<{ data: RawStatsObsRow[]; etag?: string; notModified: boolean }> {
  const qp = new URLSearchParams({ dataset: params.dataset })
  if (params.from) qp.set('from', params.from)
  if (params.to)   qp.set('to', params.to)
  if (params.filter && Object.keys(params.filter).length > 0)
    qp.set('filter', JSON.stringify(params.filter))
  if (params.limit) qp.set('limit', String(params.limit))

  const headers: Record<string, string> = {}
  if (ifNoneMatch) headers['If-None-Match'] = ifNoneMatch

  const res = await fetch(`${base}${STATS_PREFIX}/observations?${qp.toString()}`, { headers })

  // 304 — cached slice is still fresh; keep the caller's ETag, signal no body.
  if (res.status === 304) return { data: [], etag: ifNoneMatch, notModified: true }
  if (!res.ok) throw new Error(`fetchObservations HTTP ${res.status}`)

  const body = (await res.json()) as { data: RawStatsObsRow[] }
  return { data: body.data, etag: res.headers.get('ETag') ?? undefined, notModified: false }
}
