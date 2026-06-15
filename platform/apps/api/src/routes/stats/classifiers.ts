import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { ok, notFound, parseParams } from '../../lib/http.js'

const DimParams = z.object({ dim_code: z.string().min(1) })
const EntryParams = z.object({ dim_code: z.string().min(1), code: z.string().min(1) })

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
    const { rows } = await app.pg.query(
      `SELECT id, code, label, color, parent_id, ord, metadata
         FROM stats.classifier
        WHERE dim_code = $1
        ORDER BY ord, code`,
      [dim_code],
    )
    return ok(rows)
  })

  // GET /:dim_code/tree — hierarchical; LTREE path ordering keeps parents before
  // children without an app-side tree build.
  app.get('/:dim_code/tree', async (req) => {
    const { dim_code } = parseParams(DimParams, req.params)
    const { rows } = await app.pg.query(
      `SELECT id, code, label, color, parent_id, path::text AS path, ord
         FROM stats.classifier
        WHERE dim_code = $1
        ORDER BY path`,
      [dim_code],
    )
    return ok(rows)
  })

  // GET /:dim_code/:code — a single classifier entry.
  app.get('/:dim_code/:code', async (req) => {
    const { dim_code, code } = parseParams(EntryParams, req.params)
    const { rows } = await app.pg.query(
      `SELECT id, code, label, color, parent_id, path::text AS path, ord, metadata
         FROM stats.classifier
        WHERE dim_code = $1 AND code = $2`,
      [dim_code, code],
    )
    if (!rows[0]) throw notFound('Classifier entry')
    return ok(rows[0])
  })
}
