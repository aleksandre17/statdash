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

  // GET /:code — one dataset + its DSD (dataset_dimension rows) + its cube
  // version. GAP 5c: include the stats.dataset_version (V6) so a client knows
  // the dataset's current revision in the SAME call it reads the structure —
  // and so the response can carry the matching ETag (see below). LEFT JOIN so a
  // dataset with no version row yet still returns (version → null).
  app.get('/:code', async (req, reply) => {
    const { code } = parseParams(CodeParams, req.params)
    // P2-3: `preliminary` is a dataset-level provenance flag (IMF/Eurostat data
    // integrity standard) — true ⟺ the dataset has ANY observation flagged
    // preliminary (SDMX OBS_STATUS = 'P'). Computed as a correlated EXISTS so it
    // short-circuits on the first match (index scan on (dataset_code, obs_status))
    // rather than aggregating the whole hypertable. It feeds the engine's
    // MetadataPort so the "preliminary data" badge can render dataset-wide.
    const { rows } = await app.pg.query<{
      code: string; version: string | null; preliminary: boolean
    }>(
      `SELECT d.code, d.label, d.frequency, d.source, d.metadata,
              dv.version,
              EXISTS(
                SELECT 1 FROM stats.observation o
                 WHERE o.dataset_code = d.code AND o.obs_status = 'P'
              ) AS preliminary,
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
         LEFT JOIN stats.dataset_version    dv ON dv.dataset_code = d.code
        WHERE d.code = $1
        GROUP BY d.code, d.label, d.frequency, d.source, d.metadata, dv.version`,
      [code],
    )
    if (!rows[0]) throw notFound('Dataset')
    // GAP 5a — same weak ETag scheme as the observation route, so a dataset's
    // metadata read is cache-revalidatable against the very version it reports.
    if (rows[0].version !== null) {
      reply.header('ETag', `W/"${rows[0].code}.${rows[0].version}"`)
      reply.header('Cache-Control', 'no-cache')
    }
    return ok(rows[0])
  })
}
