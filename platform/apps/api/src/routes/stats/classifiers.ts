import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { ok, notFound, parseParams, parseQuery } from '../../lib/http.js'

const DimParams = z.object({ dim_code: z.string().min(1) })
const EntryParams = z.object({ dim_code: z.string().min(1), code: z.string().min(1) })
const DisplayQuery = z.object({ locale: z.string().min(1).default('ka') })

export const classifiersRoutes: FastifyPluginAsync = async (app) => {
  // GET / — list the cube axes (dimensions).
  app.get('/', async () => {
    const { rows } = await app.pg.query(
      `SELECT code, label, ord, created_at
         FROM stats.dimension
        ORDER BY ord, code`,
    )
    return ok(rows)
  })

  // GET /:dim_code — flat classifier list for one dimension, in display order.
  app.get('/:dim_code', async (req) => {
    const { dim_code } = parseParams(DimParams, req.params)
    // ADR-0023: the hierarchy edge is parent_code (the stable business key). Clients
    // read the code-chain edge directly (the old surrogate parent_id is dropped in
    // V24). is_current = true scopes to the LIVE codelist (post-V18 SCD-2 keeps
    // retired revisions; a flat list must show only the current member per code).
    const { rows } = await app.pg.query(
      `SELECT id, code, label, color, parent_code, ord, metadata
         FROM stats.classifier
        WHERE dim_code = $1 AND is_current = true
        ORDER BY ord, code`,
      [dim_code],
    )
    return ok(rows)
  })

  // GET /:dim_code/tree — hierarchical; LTREE code_path ordering keeps parents
  // before children without an app-side tree build.
  app.get('/:dim_code/tree', async (req) => {
    const { dim_code } = parseParams(DimParams, req.params)
    // ADR-0023: `code_path::text AS path` keeps the wire field name `path` stable for
    // clients during the parity period. The VALUE changes from an id-chain ('1.5.12')
    // to a code-chain ('B.B1.B1G') — clients use path only for parent-before-child
    // ORDER and ancestry (LTREE @>/<@), never to parse surrogate ids, so the contract
    // holds. is_current = true scopes to the live tree (one current row per code).
    const { rows } = await app.pg.query(
      `SELECT id, code, label, color, parent_code, code_path::text AS path, ord
         FROM stats.classifier
        WHERE dim_code = $1 AND is_current = true
        ORDER BY code_path`,
      [dim_code],
    )
    return ok(rows)
  })

  // GET /:dim_code/display — the display overlay for every member of a dimension,
  // shaped { dim, members: { <code>: { label, color, … } } }. GAP 5b: this is
  // the SQL form of the engine's in-memory resolveDisplayRef — it joins
  // stats.classifier (id → code, the structural SSOT) with
  // stats.classifier_display (member_id → display bag, V6) for the requested
  // locale. When the API is live the frontend reads from here instead of
  // resolving against the bundle. Members with no overlay row for the locale
  // fall back to { label: code } so the consumer always gets a usable label
  // (Postel: never return a member with nothing renderable).
  //
  // Route ordering note: the literal 'display' segment is matched before the
  // ':code' param route below (Fastify static > parametric precedence), the
  // same way '/:dim_code/tree' coexists with '/:dim_code/:code'.
  app.get('/:dim_code/display', async (req) => {
    const { dim_code } = parseParams(DimParams, req.params)
    const { locale } = parseQuery(DisplayQuery, req.query)
    const { rows } = await app.pg.query<{ code: string; display: Record<string, unknown> }>(
      `SELECT c.code,
              COALESCE(cd.display, jsonb_build_object('label', c.code)) AS display
         FROM stats.classifier c
         LEFT JOIN stats.classifier_display cd
                ON cd.member_id = c.id AND cd.locale = $2
        WHERE c.dim_code = $1 AND c.is_current = true
        ORDER BY c.ord, c.code`,
      [dim_code, locale],
    )
    const members: Record<string, Record<string, unknown>> = {}
    for (const r of rows) members[r.code] = r.display
    return ok({ dim: dim_code, locale, members })
  })

  // GET /:dim_code/:code — a single classifier entry.
  app.get('/:dim_code/:code', async (req) => {
    const { dim_code, code } = parseParams(EntryParams, req.params)
    // ADR-0023: parent_code edge + `code_path::text AS path` (wire name stable).
    // is_current = true returns the LIVE member (post-V18 SCD-2 keeps retired rows;
    // a bare (dim_code, code) lookup would otherwise be ambiguous across revisions).
    const { rows } = await app.pg.query(
      `SELECT id, code, label, color, parent_code, code_path::text AS path, ord, metadata
         FROM stats.classifier
        WHERE dim_code = $1 AND code = $2 AND is_current = true`,
      [dim_code, code],
    )
    if (!rows[0]) throw notFound('Classifier entry')
    return ok(rows[0])
  })
}
