import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { ok, notFound, parseBody, parseParams } from '../../lib/http.js'
import { configInvalid } from '../../lib/problem.js'
import { validateConfigDoc } from '../../lib/validate-config-doc.js'
import { appendRevision, listRevisions, getRevision } from '../../lib/revision-log.js'
import { requirePublishRole } from '../../lib/publish-roles.js'

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
const RevParams = z.object({ id: z.string().uuid(), revId: z.string().uuid() })

// The full logical document snapshot a data_source revision stores (ADR-052 §2.3).
interface DataSourceSnapshot {
  name:   string
  type:   string
  url:    string | null
  config: Record<string, unknown>
  status: string
}

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

  // PUT /:id — the VALIDATED, VERSIONED write (ADR-052). Replaces the destructive
  // buildSetClause UPDATE: read+lock current → merge supplied fields into the FULL
  // snapshot → validate the RESULT (422 config-invalid on a flipped/dangling
  // datasetCode or a dim outside the DSD — the exact incident class) → append a
  // revision AND update the current row in ONE transaction.
  app.put('/:id', async (req) => {
    const { id } = parseParams(IdParams, req.params)
    const body = parseBody(UpdateDataSourceBody, req.body)

    const client = await app.pg.connect()
    try {
      await client.query('BEGIN')

      const { rows: existing } = await client.query(
        `SELECT name, type, url, config, status
           FROM config.data_source WHERE id = $1 FOR UPDATE`,
        [id],
      )
      if (!existing[0]) {
        await client.query('ROLLBACK')
        throw notFound('Data source')
      }
      const cur = existing[0] as DataSourceSnapshot

      const next: DataSourceSnapshot = {
        name:   body.name   !== undefined ? body.name   : cur.name,
        type:   body.type   !== undefined ? body.type   : cur.type,
        url:    body.url    !== undefined ? body.url    : cur.url,
        config: body.config !== undefined ? body.config : cur.config,
        status: body.status !== undefined ? body.status : cur.status,
      }

      // Referential gate (ADR-052 §4) — reject BEFORE any write.
      const violations = await validateConfigDoc('data_source', next, client)
      if (violations.length > 0) {
        await client.query('ROLLBACK')
        throw configInvalid(violations)
      }

      await appendRevision(client, {
        docKind: 'data_source',
        docId:   id,
        body:    next,
        actor:   req.jwtPayload?.sub ?? null,
      })
      const { rows } = await client.query(
        `UPDATE config.data_source
            SET name = $1, type = $2, url = $3, config = $4, status = $5
          WHERE id = $6
          RETURNING id, name, type, url, config, status, created_at, updated_at`,
        [next.name, next.type, next.url, JSON.stringify(next.config), next.status, id],
      )

      await client.query('COMMIT')
      return ok(rows[0])
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      throw e
    } finally {
      client.release()
    }
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

  // GET /:id/revisions — the append-only history (summaries, no bodies).
  app.get('/:id/revisions', async (req) => {
    const { id } = parseParams(IdParams, req.params)
    const { rows } = await app.pg.query(
      `SELECT id FROM config.data_source WHERE id = $1`, [id],
    )
    if (!rows[0]) throw notFound('Data source')
    return ok(await listRevisions(app.pg, 'data_source', id))
  })

  // GET /:id/revisions/:revId — one full revision (with body).
  app.get('/:id/revisions/:revId', async (req) => {
    const { id, revId } = parseParams(RevParams, req.params)
    const rev = await getRevision(app.pg, 'data_source', id, revId)
    if (!rev) throw notFound('Revision')
    return ok(rev)
  })

  // POST /:id/revisions/:revId/restore — re-apply a historical body as the live
  // source. Admin-gated (the governance act). RE-VALIDATES against today's refs
  // (a since-deleted dataset makes a once-valid body dangling); restore is a NEW,
  // validated revision (restoredFrom set), never a raw rewind.
  app.post(
    '/:id/revisions/:revId/restore',
    { onRequest: async (req) => requirePublishRole(req.jwtPayload?.roles) },
    async (req) => {
      const { id, revId } = parseParams(RevParams, req.params)

      const client = await app.pg.connect()
      try {
        await client.query('BEGIN')

        const source = await getRevision(client, 'data_source', id, revId)
        if (!source) {
          await client.query('ROLLBACK')
          throw notFound('Revision')
        }
        const { rows: existing } = await client.query(
          `SELECT id FROM config.data_source WHERE id = $1 FOR UPDATE`, [id],
        )
        if (!existing[0]) {
          await client.query('ROLLBACK')
          throw notFound('Data source')
        }

        const restored = source.body as DataSourceSnapshot

        const violations = await validateConfigDoc('data_source', restored, client)
        if (violations.length > 0) {
          await client.query('ROLLBACK')
          throw configInvalid(violations)
        }

        await appendRevision(client, {
          docKind:      'data_source',
          docId:        id,
          body:         restored,
          actor:        req.jwtPayload?.sub ?? null,
          note:         `restored from revision ${source.revisionNumber}`,
          restoredFrom: source.id,
        })
        const { rows } = await client.query(
          `UPDATE config.data_source
              SET name = $1, type = $2, url = $3, config = $4, status = $5
            WHERE id = $6
            RETURNING id, name, type, url, config, status, created_at, updated_at`,
          [restored.name, restored.type, restored.url, JSON.stringify(restored.config), restored.status, id],
        )

        await client.query('COMMIT')
        return ok(rows[0])
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {})
        throw e
      } finally {
        client.release()
      }
    },
  )
}
