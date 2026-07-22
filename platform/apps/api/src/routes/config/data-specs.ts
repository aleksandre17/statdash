import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { ok, notFound, parseBody, parseParams, parseQuery } from '../../lib/http.js'
import { configInvalid } from '../../lib/problem.js'
import { validateConfigDoc } from '../../lib/validate-config-doc.js'
import { appendRevision, listRevisions, getRevision } from '../../lib/revision-log.js'
import { requirePublishRole } from '../../lib/publish-roles.js'

// spec is the engine DataSpec JSON — validated by the engine at query time, so
// here it is an opaque object (z.record), never narrowed to a code shape. The
// REFERENTIAL validation (dataset/dims/metric refs) is the ADR-052 validated-PUT
// gate (validateConfigDoc), separate from this envelope shape.
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
const RevParams = z.object({ id: z.string().uuid(), revId: z.string().uuid() })
const ListQuery = z.object({ source_id: z.string().uuid().optional() })

// The full logical document snapshot a data_spec revision stores (ADR-052 §2.3).
interface DataSpecSnapshot {
  name:        string
  description: string | null
  spec:        Record<string, unknown>
  source_id:   string | null
}

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

  // PUT /:id — the VALIDATED, VERSIONED write (ADR-052). Replaces the destructive
  // buildSetClause UPDATE: read+lock current → merge supplied fields into the FULL
  // snapshot → validate the RESULT (422 config-invalid on a dangling ref) → append a
  // revision AND update the current row in ONE transaction (a crash never drifts
  // current-state from its log — the pages.ts:213 invariant).
  app.put('/:id', async (req) => {
    const { id } = parseParams(IdParams, req.params)
    const body = parseBody(UpdateDataSpecBody, req.body)

    const client = await app.pg.connect()
    try {
      await client.query('BEGIN')

      const { rows: existing } = await client.query(
        `SELECT name, description, spec, source_id
           FROM config.data_spec WHERE id = $1 FOR UPDATE`,
        [id],
      )
      if (!existing[0]) {
        await client.query('ROLLBACK')
        throw notFound('Data spec')
      }
      const cur = existing[0] as DataSpecSnapshot

      // Merge supplied fields over the current row (undefined = keep; explicit null =
      // set null). The merged snapshot IS the resulting document — we validate + store it.
      const next: DataSpecSnapshot = {
        name:        body.name        !== undefined ? body.name        : cur.name,
        description: body.description !== undefined ? body.description : cur.description,
        spec:        body.spec        !== undefined ? body.spec        : cur.spec,
        source_id:   body.source_id   !== undefined ? body.source_id   : cur.source_id,
      }

      // Referential gate (ADR-052 §4) — reject BEFORE any write; the txn opens no write.
      const violations = await validateConfigDoc('data_spec', next, client)
      if (violations.length > 0) {
        await client.query('ROLLBACK')
        throw configInvalid(violations)
      }

      // Append the revision (full snapshot) + update the current row, together.
      await appendRevision(client, {
        docKind: 'data_spec',
        docId:   id,
        body:    next,
        actor:   req.jwtPayload?.sub ?? null,
      })
      const { rows } = await client.query(
        `UPDATE config.data_spec
            SET name = $1, description = $2, spec = $3, source_id = $4
          WHERE id = $5
          RETURNING id, name, description, spec, source_id, created_at, updated_at`,
        [next.name, next.description, JSON.stringify(next.spec), next.source_id, id],
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

  app.delete('/:id', async (req) => {
    const { id } = parseParams(IdParams, req.params)
    const { rows } = await app.pg.query(
      `DELETE FROM config.data_spec WHERE id = $1 RETURNING id`,
      [id],
    )
    if (!rows[0]) throw notFound('Data spec')
    return ok({ id, deleted: true })
  })

  // GET /:id/revisions — the append-only history (summaries, no bodies).
  app.get('/:id/revisions', async (req) => {
    const { id } = parseParams(IdParams, req.params)
    const { rows } = await app.pg.query(
      `SELECT id FROM config.data_spec WHERE id = $1`, [id],
    )
    if (!rows[0]) throw notFound('Data spec')
    return ok(await listRevisions(app.pg, 'data_spec', id))
  })

  // GET /:id/revisions/:revId — one full revision (with body).
  app.get('/:id/revisions/:revId', async (req) => {
    const { id, revId } = parseParams(RevParams, req.params)
    const rev = await getRevision(app.pg, 'data_spec', id, revId)
    if (!rev) throw notFound('Revision')
    return ok(rev)
  })

  // POST /:id/revisions/:revId/restore — re-apply a historical body as the live
  // document. Admin-gated (the governance act, ADR-052 §4). RE-VALIDATES the old body
  // against TODAY's referential state (a body valid when saved may reference a
  // since-deleted dataset) — restore is a NEW, validated revision (restoredFrom set),
  // never a raw rewind. The onRequest gate runs BEFORE the txn — an unauthorised
  // caller never opens a DB connection.
  app.post(
    '/:id/revisions/:revId/restore',
    { onRequest: async (req) => requirePublishRole(req.jwtPayload?.roles) },
    async (req) => {
      const { id, revId } = parseParams(RevParams, req.params)

      const client = await app.pg.connect()
      try {
        await client.query('BEGIN')

        // Read the source revision (scoped to this doc) + lock the current row.
        const source = await getRevision(client, 'data_spec', id, revId)
        if (!source) {
          await client.query('ROLLBACK')
          throw notFound('Revision')
        }
        const { rows: existing } = await client.query(
          `SELECT id FROM config.data_spec WHERE id = $1 FOR UPDATE`, [id],
        )
        if (!existing[0]) {
          await client.query('ROLLBACK')
          throw notFound('Data spec')
        }

        const restored = source.body as DataSpecSnapshot

        // Re-validate against today's refs — a stale body may now be dangling.
        const violations = await validateConfigDoc('data_spec', restored, client)
        if (violations.length > 0) {
          await client.query('ROLLBACK')
          throw configInvalid(violations)
        }

        await appendRevision(client, {
          docKind:      'data_spec',
          docId:        id,
          body:         restored,
          actor:        req.jwtPayload?.sub ?? null,
          note:         `restored from revision ${source.revisionNumber}`,
          restoredFrom: source.id,
        })
        const { rows } = await client.query(
          `UPDATE config.data_spec
              SET name = $1, description = $2, spec = $3, source_id = $4
            WHERE id = $5
            RETURNING id, name, description, spec, source_id, created_at, updated_at`,
          [restored.name, restored.description, JSON.stringify(restored.spec), restored.source_id, id],
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
