import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { ok, notFound, parseBody, parseParams, parseQuery } from '../../lib/http.js'

// spec is the engine DataSpec JSON — validated by the engine at query time, so
// here it is an opaque object (z.record), never narrowed to a code shape.
const DataSpecBody = z.object({
  name:        z.string().min(1),
  description: z.string().optional(),
  spec:        z.record(z.unknown()),
  source_id:   z.string().uuid().optional(),
})

const UpdateDataSpecBody = z.object({
  name:        z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  spec:        z.record(z.unknown()).optional(),
  source_id:   z.string().uuid().nullable().optional(),
})

const IdParams = z.object({ id: z.string().uuid() })
const ListQuery = z.object({ source_id: z.string().uuid().optional() })

export const dataSpecsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => {
    const { source_id } = parseQuery(ListQuery, req.query)
    const { rows } = await app.pg.query(
      `SELECT id, name, description, spec, source_id, created_at, updated_at
         FROM config.data_spec
        WHERE ($1::uuid IS NULL OR source_id = $1::uuid)
        ORDER BY created_at DESC`,
      [source_id ?? null],
    )
    return ok(rows)
  })

  app.get('/:id', async (req) => {
    const { id } = parseParams(IdParams, req.params)
    const { rows } = await app.pg.query(
      `SELECT id, name, description, spec, source_id, created_at, updated_at
         FROM config.data_spec WHERE id = $1`,
      [id],
    )
    if (!rows[0]) throw notFound('Data spec')
    return ok(rows[0])
  })

  app.post('/', async (req, reply) => {
    const body = parseBody(DataSpecBody, req.body)
    const { rows: [created] } = await app.pg.query(
      `INSERT INTO config.data_spec (name, description, spec, source_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, description, spec, source_id, created_at, updated_at`,
      [body.name, body.description ?? null, JSON.stringify(body.spec), body.source_id ?? null],
    )
    return reply.status(201).send(ok(created))
  })

  app.put('/:id', async (req) => {
    const { id } = parseParams(IdParams, req.params)
    const body = parseBody(UpdateDataSpecBody, req.body)

    const sets: string[] = []
    const vals: unknown[] = []
    if (body.name !== undefined)        { sets.push(`name = $${sets.length + 1}`);        vals.push(body.name) }
    if (body.description !== undefined) { sets.push(`description = $${sets.length + 1}`); vals.push(body.description) }
    if (body.spec !== undefined)        { sets.push(`spec = $${sets.length + 1}`);        vals.push(JSON.stringify(body.spec)) }
    if (body.source_id !== undefined)   { sets.push(`source_id = $${sets.length + 1}`);   vals.push(body.source_id) }

    if (sets.length === 0) {
      const { rows } = await app.pg.query(
        `SELECT id, name, description, spec, source_id, created_at, updated_at
           FROM config.data_spec WHERE id = $1`,
        [id],
      )
      if (!rows[0]) throw notFound('Data spec')
      return ok(rows[0])
    }

    vals.push(id)
    const { rows } = await app.pg.query(
      `UPDATE config.data_spec SET ${sets.join(', ')}
        WHERE id = $${vals.length}
        RETURNING id, name, description, spec, source_id, created_at, updated_at`,
      vals,
    )
    if (!rows[0]) throw notFound('Data spec')
    return ok(rows[0])
  })

  app.delete('/:id', async (req) => {
    const { id } = parseParams(IdParams, req.params)
    const { rows } = await app.pg.query(
      `DELETE FROM config.data_spec WHERE id = $1 RETURNING id`,
      [id],
    )
    if (!rows[0]) throw notFound('Data spec')
    return ok({ id, deleted: true })
  })
}
