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

const ObsQuery = z.object({
  dataset: z.string().min(1),
  from:    z.string().optional(), // time_period start, e.g. '2019'
  to:      z.string().optional(), // time_period end
  filter:  filterSchema,
  limit:   z.coerce.number().int().positive().max(10000).default(1000),
})

export const observationsRoutes: FastifyPluginAsync = async (app) => {
  // GET / — filtered observation read. Hits the hypertable partition pruning
  // (time_period_date range) + GIN containment (dim_key @>) — the hot path.
  app.get('/', async (req) => {
    const q = parseQuery(ObsQuery, req.query)
    const filterJson = q.filter ? JSON.stringify(q.filter) : null

    const { rows } = await app.pg.query(
      `SELECT time_period, dim_key, obs_value, obs_status
         FROM stats.observation
        WHERE dataset_code = $1
          AND ($2::date IS NULL OR time_period_date >= $2::date)
          AND ($3::date IS NULL OR time_period_date <= $3::date)
          AND ($4::jsonb IS NULL OR dim_key @> $4::jsonb)
        ORDER BY time_period_date DESC, dim_key
        LIMIT $5`,
      [
        q.dataset,
        q.from ? `${q.from}-01-01` : null,
        q.to ? `${q.to}-12-31` : null,
        filterJson,
        q.limit,
      ],
    )
    return ok(rows)
  })
}
