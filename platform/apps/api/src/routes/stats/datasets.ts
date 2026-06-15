import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { ok, notFound, parseParams } from '../../lib/http.js'

const CodeParams = z.object({ code: z.string().min(1) })

export const datasetsRoutes: FastifyPluginAsync = async (app) => {
  // GET / — datasets with their DSD (dimension structure) aggregated inline.
  app.get('/', async () => {
    const { rows } = await app.pg.query(
      `SELECT d.code, d.label, d.frequency, d.source, d.metadata,
              COALESCE(
                json_agg(
                  json_build_object(
                    'dim_code', dd.dim_code,
                    'is_time_dim', dd.is_time_dim,
                    'ord', dd.ord
                  ) ORDER BY dd.ord
                ) FILTER (WHERE dd.dim_code IS NOT NULL),
                '[]'
              ) AS dimensions
         FROM stats.dataset d
         LEFT JOIN stats.dataset_dimension dd ON dd.dataset_code = d.code
        GROUP BY d.code, d.label, d.frequency, d.source, d.metadata
        ORDER BY d.code`,
    )
    return ok(rows)
  })

  // GET /:code — one dataset + its DSD (dataset_dimension rows).
  app.get('/:code', async (req) => {
    const { code } = parseParams(CodeParams, req.params)
    const { rows } = await app.pg.query(
      `SELECT d.code, d.label, d.frequency, d.source, d.metadata,
              COALESCE(
                json_agg(
                  json_build_object(
                    'dim_code', dd.dim_code,
                    'is_time_dim', dd.is_time_dim,
                    'ord', dd.ord
                  ) ORDER BY dd.ord
                ) FILTER (WHERE dd.dim_code IS NOT NULL),
                '[]'
              ) AS dimensions
         FROM stats.dataset d
         LEFT JOIN stats.dataset_dimension dd ON dd.dataset_code = d.code
        WHERE d.code = $1
        GROUP BY d.code, d.label, d.frequency, d.source, d.metadata`,
      [code],
    )
    if (!rows[0]) throw notFound('Dataset')
    return ok(rows[0])
  })
}
