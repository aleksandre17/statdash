// ── releases — Vintage-as-Release HTTP surface (ADR-0025 / SDMX-P0-2) ──────────
//
// A release is the publication-event AGGREGATE that groups 1..N submissions into a
// named, atomic vintage. This route exposes the real-time / vintage database:
//
//   GET  /?dataset=X              list releases for a dataset, newest first (read)
//   GET  /:id/observations        the vintage AS PUBLISHED by this release
//                                 (asOf = release.published_at, reusing queryAsOf)
//   GET  /revision-triangle       how an estimate for one period evolved across
//                                 releases (the classic real-time-database view)
//   POST /                        open a release (curator) — bundle start
//   POST /:id/attach              attach a staged submission to an open release
//   POST /:id/publish             publish the bundle (flips prior current, stamps
//                                 published_at) — the atomic vintage anchor
//
// AUTH (own scope, mirrors ingestRoutes): the GET reads are part of the public,
// read-only stats surface (no token); the POST mutations are curator-gated
// (authPlugin → requireWrite: admin OR editor). 401 (no/invalid token) vs 403
// (valid token, wrong role) kept distinct per RFC 7235. authPlugin is registered
// in a NESTED scope wrapping only the mutating routes, so the JWT hook never
// cascades to the public GETs (same encapsulation idiom as the rest of the app).

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { ok, notFound, parseBody, parseParams, parseQuery, HttpError } from '../../lib/http.js'
import { authPlugin } from '../../auth.js'
import type { AuditLogger } from '../../lib/audit-log.js'
import type { Release, ReleaseStatus } from '../../ingest/index.js'
import { publishBundle } from '../../ingest/index.js'
import { queryAsOf, filterSchema, scalarFilterSchema } from './observations.js'

// ── Curator-write role gate (admin OR editor) — same contract as ingestRoutes ──
const WRITE_ROLES = ['admin', 'editor'] as const
function requireWrite(roles: string[] | undefined): void {
  const r = roles ?? []
  if (!WRITE_ROLES.some((role) => r.includes(role))) {
    throw new HttpError(403, 'admin or editor role required')
  }
}

// ── Boundary schemas (validate at the edge, narrow before any SQL) ─────────────

const ListQuery = z.object({ dataset: z.string().min(1) })
const IdParam = z.object({ id: z.string().uuid() })

// label is an i18n bag; require at least one locale so a release is never unnamed.
const labelSchema = z
  .record(z.string(), z.string())
  .refine((o) => Object.keys(o).length > 0, 'label must carry at least one locale')

const OpenBody = z.object({
  // nullable: a cross-dataset release (codelists/displays) is not dataset-scoped.
  datasetCode: z.string().min(1).nullable().default(null),
  label:       labelSchema,
  note:        z.string().optional(),
})

const AttachBody = z.object({ submissionId: z.string().uuid() })

const sdmxTimePeriod = z
  .string()
  .regex(
    /^\d{4}(-S[12]|-Q[1-4]|-W\d{2}|-\d{2}(-\d{2})?)?$/,
    'must be an SDMX TIME_PERIOD: 2020 | 2020-S1 | 2020-Q1 | 2020-W01 | 2020-06 | 2020-01-15',
  )

// The vintage read is a multi-series projection (same key-selection contract as the
// observations route) → the SHARED multi-value filterSchema (SSOT, imported — no
// copy). A cross-region vintage `geo ∈ {R2,R3}` is now expressible here too.
const VintageQuery = z.object({
  from:   sdmxTimePeriod.optional(),
  to:     sdmxTimePeriod.optional(),
  filter: filterSchema,
  limit:  z.coerce.number().int().positive().max(10000).default(1000),
})

// The revision-triangle resolves exactly ONE series (md5($filter::jsonb::text) →
// dim_key_hash), so it takes the SCALAR-ONLY variant: a multi-value array would hash
// to a key matching no single series (rejected at the boundary, fail-fast).
const TriangleQuery = z.object({
  dataset: z.string().min(1),
  period:  sdmxTimePeriod,            // the single period whose estimate evolution we trace
  filter:  scalarFilterSchema,       // resolves to ONE series via its dim_key_hash
})

// ── Row → API shape (snake_case columns → the camelCase Release contract) ──────
interface ReleaseRowDb {
  id: string
  label: Record<string, string>
  dataset_code: string | null
  status: ReleaseStatus
  is_current: boolean
  opened_at: Date
  published_at: Date | null
  opened_by: string | null
  note: string | null
}
const RELEASE_COLS =
  'id, label, dataset_code, status, is_current, opened_at, published_at, opened_by, note'
function toRelease(r: ReleaseRowDb): Release {
  return {
    id:          r.id,
    label:       r.label,
    datasetCode: r.dataset_code,
    status:      r.status,
    isCurrent:   r.is_current,
    openedAt:    r.opened_at,
    publishedAt: r.published_at,
    openedBy:    r.opened_by,
    note:        r.note,
  }
}

export const releasesRoutes = (audit?: AuditLogger): FastifyPluginAsync => async (app) => {
  // ── GET /?dataset=X — releases for a dataset, newest first (public read) ─────
  // A cross-dataset release (dataset_code IS NULL) is included too: it touches
  // codelists/displays that any dataset's vintage may depend on.
  app.get('/', async (req) => {
    const { dataset } = parseQuery(ListQuery, req.query)
    const { rows } = await app.pg.query<ReleaseRowDb>(
      `SELECT ${RELEASE_COLS}
         FROM stats.release
        WHERE dataset_code = $1 OR dataset_code IS NULL
        ORDER BY COALESCE(published_at, opened_at) DESC`,
      [dataset],
    )
    return ok({ releases: rows.map(toRelease) })
  })

  // ── GET /:id/observations — the vintage as published by this release ─────────
  // The release's published_at IS the as-of anchor (ADR-0025): reconstruct the
  // series exactly as it stood the instant this release went out. An OPEN (not yet
  // published) release has no published_at → 409 (no vintage exists yet).
  app.get('/:id/observations', async (req, reply) => {
    const { id } = parseParams(IdParam, req.params)
    const q = parseQuery(VintageQuery, req.query)

    const { rows } = await app.pg.query<{
      dataset_code: string | null; published_at: Date | null; status: ReleaseStatus
    }>(
      `SELECT dataset_code, published_at, status FROM stats.release WHERE id = $1`,
      [id],
    )
    const rel = rows[0]
    if (!rel) throw notFound('Release')
    if (rel.published_at === null) {
      throw new HttpError(409, `release is '${rel.status}', not published — no vintage to read`)
    }
    if (rel.dataset_code === null) {
      // a cross-dataset (codelist/display) release has no observation vintage of
      // its own; the caller wants a dataset's observations as-of, via GET /observations?asOf.
      throw new HttpError(409, 'release is cross-dataset (no observation vintage); use /observations?asOf=')
    }

    // The vintage is immutable → strongly cacheable; key the ETag on the release id
    // (a published release never changes). Reuse the shared as-of reconstruction.
    reply.header('ETag', `W/"release.${id}"`)
    reply.header('Cache-Control', 'no-cache')

    const obs = await queryAsOf(app.pg, {
      dataset: rel.dataset_code,
      asOf:    rel.published_at,
      from:    q.from,
      to:      q.to,
      filter:  q.filter,
      limit:   q.limit,
    })
    return ok({ releaseId: id, asOf: rel.published_at, observations: obs })
  })

  // ── GET /revision-triangle — estimate evolution for one period × one series ──
  // The real-time-database view: for period P and ONE series, the ordered sequence
  // of (release, value) showing how the estimate was revised release-over-release.
  //
  // SERIES RESOLUTION — dim_key_hash via the V4 SSOT expression, NOT a JS md5.
  // V4 defines dim_key_hash GENERATED ALWAYS AS md5(dim_key::text); reproducing
  // Postgres' canonical jsonb text in JS is fragile (key order, spacing, escaping),
  // so we let Postgres compute it: md5($filter::jsonb::text). Identical input →
  // identical hash → matches the stored generated column with zero drift risk.
  //
  // The evolution combines the pre-image log (each prior value with the release
  // that SET it + the one that SUPERSEDED it) with the CURRENT value (set by the
  // live observation.release_id, not yet superseded). Ordered by the setting
  // release's published_at — that is the time axis of the triangle.
  app.get('/revision-triangle', async (req) => {
    const q = parseQuery(TriangleQuery, req.query)
    const filterJson = q.filter ? JSON.stringify(q.filter) : null

    const { rows } = await app.pg.query<{
      set_by_release_id: string | null
      set_label: Record<string, string> | null
      set_published_at: Date | null
      superseded_by_release_id: string | null
      superseded_published_at: Date | null
      obs_value: number | null
      obs_status: string | null
      is_current: boolean
    }>(
      // $1 dataset · $2 period · $3 filter(jsonb) → dim_key_hash via md5(::text)
      `WITH series AS (
         SELECT md5($3::jsonb::text) AS dim_key_hash
       ),
       preimg AS (
         SELECT rev.set_by_release_id,
                sr.label                  AS set_label,
                sr.published_at           AS set_published_at,
                rev.superseded_by_release_id,
                xr.published_at           AS superseded_published_at,
                rev.obs_value_old         AS obs_value,
                rev.obs_status_old        AS obs_status,
                false                     AS is_current
           FROM stats.observation_revision rev
           JOIN series s ON s.dim_key_hash = rev.dim_key_hash
           LEFT JOIN stats.release sr ON sr.id = rev.set_by_release_id
           LEFT JOIN stats.release xr ON xr.id = rev.superseded_by_release_id
          WHERE rev.dataset_code = $1
            AND rev.time_period  = $2
       ),
       live AS (
         SELECT o.release_id        AS set_by_release_id,
                r.label             AS set_label,
                r.published_at      AS set_published_at,
                NULL::uuid          AS superseded_by_release_id,
                NULL::timestamptz   AS superseded_published_at,
                o.obs_value,
                o.obs_status,
                true                AS is_current
           FROM stats.observation o
           JOIN series s ON s.dim_key_hash = o.dim_key_hash
           LEFT JOIN stats.release r ON r.id = o.release_id
          WHERE o.dataset_code = $1
            AND o.time_period  = $2
       )
       SELECT * FROM preimg
       UNION ALL
       SELECT * FROM live
       ORDER BY set_published_at ASC NULLS FIRST`,
      [q.dataset, q.period, filterJson],
    )

    const estimates = rows.map((r) => ({
      releaseId:             r.set_by_release_id,
      releaseLabel:          r.set_label,
      publishedAt:           r.set_published_at,
      supersededByReleaseId: r.superseded_by_release_id,
      supersededAt:          r.superseded_published_at,
      value:                 r.obs_value,
      status:                r.obs_status,
      isCurrent:             r.is_current,
    }))
    return ok({ dataset: q.dataset, period: q.period, estimates })
  })

  // ── Mutating curator path — JWT + write-role gated (own nested scope) ────────
  // Registered after the public GETs in a child scope so the auth hook applies
  // ONLY here (encapsulation), exactly like the config/ingest read-vs-write split.
  await app.register(async (write) => {
    await write.register(authPlugin)

    // POST / — open a release (curator bundle start). Returns the new release id.
    write.post('/', { onRequest: async (req) => requireWrite(req.jwtPayload?.roles) }, async (req, reply) => {
      const body = parseBody(OpenBody, req.body)
      const { rows } = await app.pg.query<{ release_id: string }>(
        `SELECT stats.open_release($1, $2::jsonb, $3) AS release_id`,
        [body.datasetCode, JSON.stringify(body.label), req.jwtPayload?.sub ?? null],
      )
      const releaseId = rows[0].release_id
      // optional note is metadata-only; set it in a follow-up UPDATE if provided
      // (open_release's signature is dataset/label/opened_by per ADR-0025).
      if (body.note !== undefined) {
        await app.pg.query(`UPDATE stats.release SET note = $2 WHERE id = $1`, [releaseId, body.note])
      }
      try {
        audit?.log({
          userId:   req.jwtPayload?.sub,
          action:   'release.open',
          resource: releaseId,
          payload:  { datasetCode: body.datasetCode, label: body.label },
        })
      } catch { /* audit is best-effort; a successful open must not fail here */ }
      return reply.status(201).send(ok({ releaseId }))
    })

    // POST /:id/attach — bundle a staged submission into an open release. The
    // submission must be 'staged' (not yet published) and the release 'open'; both
    // guards are in the UPDATE so a concurrent publish cannot be clobbered.
    write.post('/:id/attach', { onRequest: async (req) => requireWrite(req.jwtPayload?.roles) }, async (req) => {
      const { id } = parseParams(IdParam, req.params)
      const { submissionId } = parseBody(AttachBody, req.body)

      // fail-fast if the release is not open (cannot attach to a published vintage).
      const { rows: rel } = await app.pg.query<{ status: ReleaseStatus }>(
        `SELECT status FROM stats.release WHERE id = $1`,
        [id],
      )
      if (!rel[0]) throw notFound('Release')
      if (rel[0].status !== 'open') {
        throw new HttpError(409, `release is '${rel[0].status}', not 'open' — cannot attach`)
      }

      const { rows: updated } = await app.pg.query<{ id: string }>(
        `UPDATE stats_stage.submission
            SET release_id = $2
          WHERE id = $1 AND status = 'staged'
          RETURNING id`,
        [submissionId, id],
      )
      if (!updated[0]) {
        const { rows: exists } = await app.pg.query<{ status: string }>(
          `SELECT status FROM stats_stage.submission WHERE id = $1`, [submissionId],
        )
        if (!exists[0]) throw notFound('Submission')
        throw new HttpError(409, `submission is '${exists[0].status}', not 'staged' — cannot attach`)
      }
      try {
        audit?.log({
          userId:   req.jwtPayload?.sub,
          action:   'release.attach',
          resource: id,
          payload:  { submissionId },
        })
      } catch { /* best-effort */ }
      return ok({ releaseId: id, submissionId })
    })

    // POST /:id/publish — publish the BUNDLE atomically (ADR-0025). Thin HTTP adapter:
    // guard the release lifecycle (must exist + be 'open'), delegate the multi-
    // submission promote + single publish_release finalize to publishBundle (which
    // owns the transaction-boundary reasoning), then emit the governance audit.
    // Idempotent retry: a partially-failed prior run left the release 'open' with some
    // members already 'published'; publishBundle re-runs only the still-'staged' ones.
    write.post('/:id/publish', { onRequest: async (req) => requireWrite(req.jwtPayload?.roles) }, async (req) => {
      const { id } = parseParams(IdParam, req.params)
      const userId = req.jwtPayload?.sub

      const { rows: rel } = await app.pg.query<{ status: ReleaseStatus }>(
        `SELECT status FROM stats.release WHERE id = $1`,
        [id],
      )
      if (!rel[0]) throw notFound('Release')
      if (rel[0].status !== 'open') {
        throw new HttpError(409, `release is '${rel[0].status}', not 'open' — cannot publish`)
      }

      const result = await publishBundle(app.pg, id, { userId, audit })

      try {
        audit?.log({
          userId,
          action:   'release.publish',
          resource: id,
          payload:  { publishedAt: result.publishedAt, members: result.members, observations: result.published },
        })
      } catch { /* best-effort */ }
      return ok({ releaseId: id, publishedAt: result.publishedAt, members: result.members })
    })
  })
}
