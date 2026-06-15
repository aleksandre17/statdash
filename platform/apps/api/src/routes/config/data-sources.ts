import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { ok, notFound, parseBody, parseParams } from '../../lib/http.js'

// type values mirror the data_source_type_chk CHECK constraint (V3).
const DataSourceBody = z.object({
  name:   z.string().min(1),
  type:   z.enum(['sdmx-json', 'rest', 'static']),
  url:    z.string().url().optional(),
  config: z.record(z.unknown()).default({}),
})

const UpdateDataSourceBody = z.object({
  name:   z.string().min(1).optional(),
  type:   z.enum(['sdmx-json', 'rest', 'static']).optional(),
  url:    z.string().url().nullable().optional(),
  config: z.record(z.unknown()).optional(),
  status: z.enum(['idle', 'connected', 'error', 'pending']).optional(),
})

const IdParams = z.object({ id: z.string().uuid() })

export const dataSourcesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async () => {
    const { rows } = await app.pg.query(
      `SELECT id, name, type, url, config, status, created_at, updated_at
         FROM config.data_source
        ORDER BY created_at DESC`,
    )
    return ok(rows)
  })

  app.get('/:id', async (req) => {
    const { id } = parseParams(IdParams, req.params)
    const { rows } = await app.pg.query(
      `SELECT id, name, type, url, config, status, created_at, updated_at
         FROM config.data_source WHERE id = $1`,
      [id],
    )
    if (!rows[0]) throw notFound('Data source')
    return ok(rows[0])
  })

  app.post('/', async (req, reply) => {
    const body = parseBody(DataSourceBody, req.body)
    const { rows: [created] } = await app.pg.query(
      `INSERT INTO config.data_source (name, type, url, config)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, type, url, config, status, created_at, updated_at`,
      [body.name, body.type, body.url ?? null, JSON.stringify(body.config)],
    )
    return reply.status(201).send(ok(created))
  })

  app.put('/:id', async (req) => {
    const { id } = parseParams(IdParams, req.params)
    const body = parseBody(UpdateDataSourceBody, req.body)

    const sets: string[] = []
    const vals: unknown[] = []
    if (body.name !== undefined)   { sets.push(`name = $${sets.length + 1}`);   vals.push(body.name) }
    if (body.type !== undefined)   { sets.push(`type = $${sets.length + 1}`);   vals.push(body.type) }
    if (body.url !== undefined)    { sets.push(`url = $${sets.length + 1}`);    vals.push(body.url) }
    if (body.config !== undefined) { sets.push(`config = $${sets.length + 1}`); vals.push(JSON.stringify(body.config)) }
    if (body.status !== undefined) { sets.push(`status = $${sets.length + 1}`); vals.push(body.status) }

    if (sets.length === 0) {
      const { rows } = await app.pg.query(
        `SELECT id, name, type, url, config, status, created_at, updated_at
           FROM config.data_source WHERE id = $1`,
        [id],
      )
      if (!rows[0]) throw notFound('Data source')
      return ok(rows[0])
    }

    vals.push(id)
    const { rows } = await app.pg.query(
      `UPDATE config.data_source SET ${sets.join(', ')}
        WHERE id = $${vals.length}
        RETURNING id, name, type, url, config, status, created_at, updated_at`,
      vals,
    )
    if (!rows[0]) throw notFound('Data source')
    return ok(rows[0])
  })

  // Hard delete — config.data_spec.source_id is ON DELETE SET NULL, so dependent
  // specs survive (orphaned, re-pointable), they are not silently destroyed.
  app.delete('/:id', async (req) => {
    const { id } = parseParams(IdParams, req.params)
    const { rows } = await app.pg.query(
      `DELETE FROM config.data_source WHERE id = $1 RETURNING id`,
      [id],
    )
    if (!rows[0]) throw notFound('Data source')
    return ok({ id, deleted: true })
  })
}
