import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { ok, parseQuery } from '../../lib/http.js'

// filter arrives as a JSON string in the query string; refine it to a plain
// object so it can feed dim_key @> $::jsonb (GIN containment), never raw text.
const filterSchema = z
  .string()
  .optional()
  .transform((s, ctx) => {
    if (s === undefined || s === '') return undefined
    try {
      const parsed: unknown = JSON.parse(s)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'filter must be a JSON object' })
        return z.NEVER
      }
      return parsed as Record<string, unknown>
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'filter must be valid JSON' })
      return z.NEVER
    }
  })

// SDMX TIME_PERIOD format — the SAME accept-set as V9's obs_time_period_fmt_chk
// CHECK and stats.parse_time_period / parse_time_period_end. Validating here at
// the boundary (Postel: be liberal in what we accept, but only within the
// contract) means malformed periods are rejected with a 400 before touching SQL,
// and a year-like '2020' is just the annual SDMX period — no breaking change.
//   A '2020' · S '2020-S1' · Q '2020-Q1' · W '2020-W01' · M '2020-06' · D '2020-01-15'
const sdmxTimePeriod = z
  .string()
  .regex(
    /^\d{4}(-S[12]|-Q[1-4]|-W\d{2}|-\d{2}(-\d{2})?)?$/,
    'must be an SDMX TIME_PERIOD: 2020 | 2020-S1 | 2020-Q1 | 2020-W01 | 2020-06 | 2020-01-15',
  )

const ObsQuery = z.object({
  dataset: z.string().min(1),
  from:    sdmxTimePeriod.optional(), // inclusive lower bound (SDMX period start)
  to:      sdmxTimePeriod.optional(), // inclusive upper bound (SDMX period END)
  filter:  filterSchema,
  limit:   z.coerce.number().int().positive().max(10000).default(1000),
  // ADR-0025 — vintage reconstruction. When present, the route returns the series
  // AS IT WAS PUBLISHED on this instant (the live∪pre-image overlay below) rather
  // than the current cube. Absent ⇒ EXACTLY the prior behaviour (back-compatible).
  // z.coerce.date accepts an ISO-8601 timestamp or date in the query string.
  asOf:    z.coerce.date().optional(),
})

// GAP 5a — weak ETag for a dataset, built from stats.dataset_version (V6). The
// version bumps on any data/structure change (seed/ETL calls bump_dataset_version),
// so the ETag is the SSOT for "is my cached cube stale?". Weak (W/) because the
// body is a filtered/paginated projection, not a byte-exact resource — two
// requests with the same version are semantically equivalent, which is exactly
// what a weak validator asserts. content_hash (strong) is reserved for a future
// byte-exact variant; the version counter is the right validator for this route.
// version arrives as a string from pg (BIGINT is returned as text to preserve
// precision) — keep it as-is; it is an opaque validator token, not arithmetic.
function datasetETag(datasetCode: string, version: string): string {
  return `W/"${datasetCode}.${version}"`
}

// ADR-0025 — ETag for a vintage read. A vintage is IMMUTABLE (the past cannot be
// re-published), so it is strongly cacheable; the dataset_version is folded in so
// a structural change (new dim/codelist) still busts the cache. The asOf instant
// is normalized to its ISO-8601 form for a stable token. Weak (W/) because the
// body is still a filtered/paginated projection of the vintage, not byte-exact.
function vintageETag(datasetCode: string, asOf: Date, version: string): string {
  return `W/"${datasetCode}.${asOf.toISOString()}.${version}"`
}

// ── As-of vintage reconstruction (ADR-0025) ───────────────────────────────────
// "GDP series AS IT WAS PUBLISHED on instant D." The current cube is single-valued
// (the latest figure); the V8 pre-image log holds every superseded value with its
// validity interval keyed by RELEASE (set_by/superseded_by + release.published_at).
//
// For each series (dataset_code, time_period, dim_key_hash) we build candidate
// rows, each a [valid_from, valid_until) interval, then DISTINCT ON the series
// picking the interval that COVERS D (latest valid_from <= D wins):
//
//   • LIVE — the current observation. Its value took effect at its release's
//     published_at and has no upper bound. Eligible iff published_at <= D.
//   • PRE-IMAGE — each observation_revision row. Its value was set by set_by_release
//     (valid_from = that release's published_at) and superseded by superseded_by_release
//     (valid_until = that release's published_at). Eligible iff valid_from <= D AND
//     (valid_until IS NULL OR valid_until > D).
//
// DISTINCT ON (dataset_code, time_period, dim_key_hash) ORDER BY ... valid_from DESC
// collapses each series to the single value live AT D. The from/to/filter predicates
// compose into BOTH legs so partition pruning + GIN containment still apply to live.
//
// $1 dataset · $2 from(period|null) · $3 to(period|null) · $4 filter(jsonb|null)
// $5 asOf(timestamptz) · $6 limit
const AS_OF_SQL = `
  WITH live AS (
    SELECT o.dataset_code, o.time_period, o.time_period_date, o.dim_key, o.dim_key_hash,
           o.obs_value, o.obs_status, o.obs_attribute,
           r.published_at AS valid_from,
           NULL::timestamptz AS valid_until
      FROM stats.observation o
      JOIN stats.release r ON r.id = o.release_id
     WHERE o.dataset_code = $1
       AND r.published_at IS NOT NULL
       AND r.published_at <= $5::timestamptz
       AND ($4::jsonb IS NULL OR o.dim_key @> $4::jsonb)
  ),
  preimg AS (
    SELECT rev.dataset_code, rev.time_period,
           stats.parse_time_period(rev.time_period) AS time_period_date,
           rev.dim_key_hash,
           live_obs.dim_key,
           rev.obs_value_old     AS obs_value,
           rev.obs_status_old    AS obs_status,
           rev.obs_attribute_old AS obs_attribute,
           sr.published_at  AS valid_from,
           xr.published_at  AS valid_until
      FROM stats.observation_revision rev
      JOIN stats.release sr ON sr.id = rev.set_by_release_id
      LEFT JOIN stats.release xr ON xr.id = rev.superseded_by_release_id
      -- the dim_key is not stored on the pre-image (only its hash); recover it from
      -- the live observation row for the same series (the structural key is stable).
      LEFT JOIN stats.observation live_obs
        ON live_obs.dataset_code = rev.dataset_code
       AND live_obs.time_period  = rev.time_period
       AND live_obs.dim_key_hash = rev.dim_key_hash
     WHERE rev.dataset_code = $1
       AND sr.published_at IS NOT NULL
       AND sr.published_at <= $5::timestamptz
       AND (xr.published_at IS NULL OR xr.published_at > $5::timestamptz)
       AND ($4::jsonb IS NULL OR live_obs.dim_key @> $4::jsonb)
  ),
  candidates AS (
    SELECT * FROM live
    UNION ALL
    SELECT * FROM preimg
  )
  SELECT DISTINCT ON (dataset_code, time_period, dim_key_hash)
         time_period, dim_key, obs_value, obs_status, obs_attribute
    FROM candidates
   WHERE ($2::text IS NULL OR time_period_date >= stats.parse_time_period($2))
     AND ($3::text IS NULL OR time_period_date <= stats.parse_time_period_end($3))
   ORDER BY dataset_code, time_period, dim_key_hash, valid_from DESC
   LIMIT $6
`

/**
 * Run the as-of reconstruction for one dataset at one instant. Shared by the
 * observations route (?asOf=) and the releases route (/:id/observations, where
 * the instant is the release's published_at). Returns the vintage rows.
 */
export async function queryAsOf(
  pg: { query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }> },
  args: {
    dataset: string
    asOf: Date
    from?: string
    to?: string
    filter?: Record<string, unknown>
    limit: number
  },
): Promise<Record<string, unknown>[]> {
  const { rows } = await pg.query<Record<string, unknown>>(AS_OF_SQL, [
    args.dataset,
    args.from ?? null,
    args.to ?? null,
    args.filter ? JSON.stringify(args.filter) : null,
    args.asOf,
    args.limit,
  ])
  return rows
}

export const observationsRoutes: FastifyPluginAsync = async (app) => {
  // GET / — filtered observation read. Hits the hypertable partition pruning
  // (time_period_date range) + GIN containment (dim_key @>) — the hot path.
  // With ?asOf=<instant> it returns the vintage (the series as published at D).
  app.get('/', async (req, reply) => {
    const q = parseQuery(ObsQuery, req.query)
    const filterJson = q.filter ? JSON.stringify(q.filter) : null

    // GAP 5a — resolve the dataset version FIRST, set the ETag, and short-circuit
    // a matching If-None-Match with 304 (no body, no obs scan). This makes the
    // hot read cheaply revalidatable: the client keeps its cache until the cube
    // version actually changes. A missing version row (dataset never seeded /
    // bumped) → no ETag, route degrades gracefully to an unconditional 200.
    const { rows: ver } = await app.pg.query<{ version: string }>(
      `SELECT version FROM stats.dataset_version WHERE dataset_code = $1`,
      [q.dataset],
    )
    if (ver[0]) {
      // ADR-0025 — a vintage read uses an immutable, asOf-keyed validator; the
      // current-cube read keeps the version-only validator. Both fold in version
      // so a structural change still revalidates.
      const etag = q.asOf
        ? vintageETag(q.dataset, q.asOf, ver[0].version)
        : datasetETag(q.dataset, ver[0].version)
      reply.header('ETag', etag)
      // Cache-Control: clients/proxies must revalidate against the ETag rather
      // than serve a stale body blindly (no-cache = "store, but revalidate").
      reply.header('Cache-Control', 'no-cache')
      if (ifNoneMatchSatisfied(req.headers['if-none-match'], etag)) {
        return reply.code(304).send()
      }
    }

    // ADR-0025 — vintage path: reconstruct the series as published at q.asOf.
    if (q.asOf) {
      const rows = await queryAsOf(app.pg, {
        dataset: q.dataset,
        asOf:    q.asOf,
        from:    q.from,
        to:      q.to,
        filter:  q.filter,
        limit:   q.limit,
      })
      return ok(rows)
    }

    // Frequency-generic range bounds (no annual assumption). The DB resolves the
    // SDMX period strings to dates via stats.parse_time_period (start) and
    // stats.parse_time_period_end (inclusive last day) — the SSOT for period↔date
    // math (V4/V9/V16). `from='2020-Q1'` → >= 2020-01-01; `to='2020-Q1'` →
    // <= 2020-03-31. A plain '2020' is the annual period: >= 2020-01-01 /
    // <= 2020-12-31, preserving the old behaviour. Passing the raw period text
    // (not a pre-computed date) keeps date logic in one place, never the route.
    const { rows } = await app.pg.query(
      `SELECT time_period, dim_key, obs_value, obs_status, obs_attribute
         FROM stats.observation
        WHERE dataset_code = $1
          AND ($2::text IS NULL OR time_period_date >= stats.parse_time_period($2))
          AND ($3::text IS NULL OR time_period_date <= stats.parse_time_period_end($3))
          AND ($4::jsonb IS NULL OR dim_key @> $4::jsonb)
        ORDER BY time_period_date DESC, dim_key
        LIMIT $5`,
      [
        q.dataset,
        q.from ?? null,
        q.to ?? null,
        filterJson,
        q.limit,
      ],
    )
    return ok(rows)
  })
}

// If-None-Match may carry a list of validators; a weak comparison (RFC 9110
// §13.1.2) matches if any equals our tag. We compare on the opaque value,
// tolerating the W/ prefix on either side (weak validators are what we issue).
function ifNoneMatchSatisfied(header: string | string[] | undefined, etag: string): boolean {
  if (!header) return false
  const tags = (Array.isArray(header) ? header.join(',') : header).split(',').map((t) => t.trim())
  const normalize = (t: string): string => t.replace(/^W\//, '')
  if (tags.includes('*')) return true
  return tags.some((t) => normalize(t) === normalize(etag))
}
