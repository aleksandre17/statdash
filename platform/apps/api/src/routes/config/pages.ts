import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { ok, notFound, parseBody, parseParams } from '../../lib/http.js'

// ── Schemas ───────────────────────────────────────────────────────────────────
const CreatePageBody = z.object({
  slug:       z.string().min(1).regex(/^[a-z0-9-]+$/),
  title:      z.object({ ka: z.string(), en: z.string().optional() }),
  config:     z.record(z.unknown()).default({}),
  data_specs: z.array(z.unknown()).default([]),
})

const UpdatePageBody = z.object({
  slug:       z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  title:      z.object({ ka: z.string(), en: z.string().optional() }).optional(),
  status:     z.enum(['draft', 'published', 'archived']).optional(),
  config:     z.record(z.unknown()).optional(),
  data_specs: z.array(z.unknown()).optional(),
})

const PageParams = z.object({ id: z.string().uuid() })

export const pagesRoutes: FastifyPluginAsync = async (app) => {
  // GET / — list non-archived pages (Constructor dashboard).
  app.get('/', async () => {
    const { rows } = await app.pg.query(
      `SELECT id, slug, title, status, updated_at
         FROM config.page
        WHERE status != 'archived'
        ORDER BY updated_at DESC`,
    )
    return ok(rows)
  })

  // GET /:id — page identity + its latest version config + data_specs.
  app.get('/:id', async (req) => {
    const { id } = parseParams(PageParams, req.params)
    const { rows } = await app.pg.query(
      `SELECT p.id, p.slug, p.title, p.status, p.metadata,
              p.created_at, p.updated_at,
              v.version_number, v.config, v.data_specs, v.is_published
         FROM config.page p
         LEFT JOIN LATERAL (
           SELECT version_number, config, data_specs, is_published
             FROM config.page_version
            WHERE page_id = p.id
            ORDER BY version_number DESC
            LIMIT 1
         ) v ON true
        WHERE p.id = $1`,
      [id],
    )
    const page = rows[0]
    if (!page) throw notFound('Page')
    return ok(page)
  })

  // POST / — create page + its first immutable version (atomic).
  app.post('/', async (req, reply) => {
    const body = parseBody(CreatePageBody, req.body)
    const client = await app.pg.connect()
    try {
      await client.query('BEGIN')
      const { rows: [page] } = await client.query(
        `INSERT INTO config.page (slug, title) VALUES ($1, $2) RETURNING id`,
        [body.slug, JSON.stringify(body.title)],
      )
      await client.query(
        `INSERT INTO config.page_version (page_id, config, data_specs)
         VALUES ($1, $2, $3)`,
        [page.id, JSON.stringify(body.config), JSON.stringify(body.data_specs)],
      )
      await client.query('COMMIT')
      return reply.status(201).send(ok({ id: page.id }))
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  })

  // PUT /:id — update identity (slug/title/status) AND append a new version.
  // Identity and the version snapshot move together in one transaction so a
  // saved page never has stale identity pointing at a fresh tree (or vice versa).
  app.put('/:id', async (req) => {
    const { id } = parseParams(PageParams, req.params)
    const body = parseBody(UpdatePageBody, req.body)

    const client = await app.pg.connect()
    try {
      await client.query('BEGIN')

      // Lock the row; also tells us if the page exists before we mutate.
      const { rows: existing } = await client.query(
        `SELECT id FROM config.page WHERE id = $1 FOR UPDATE`,
        [id],
      )
      if (!existing[0]) {
        await client.query('ROLLBACK')
        throw notFound('Page')
      }

      // Build a dynamic-but-parameterized identity UPDATE (only provided fields).
      const sets: string[] = []
      const vals: unknown[] = []
      if (body.slug !== undefined)   { sets.push(`slug = $${sets.length + 1}`);   vals.push(body.slug) }
      if (body.title !== undefined)  { sets.push(`title = $${sets.length + 1}`);  vals.push(JSON.stringify(body.title)) }
      if (body.status !== undefined) { sets.push(`status = $${sets.length + 1}`); vals.push(body.status) }
      if (sets.length > 0) {
        vals.push(id)
        await client.query(
          `UPDATE config.page SET ${sets.join(', ')} WHERE id = $${vals.length}`,
          vals,
        )
      }

      // Append a new version when a tree/spec snapshot is supplied. version_number
      // is assigned by the BEFORE INSERT trigger (no app-side max()+1 race).
      let versionNumber: number | undefined
      if (body.config !== undefined || body.data_specs !== undefined) {
        const { rows: [prev] } = await client.query(
          `SELECT config, data_specs FROM config.page_version
            WHERE page_id = $1 ORDER BY version_number DESC LIMIT 1`,
          [id],
        )
        const nextConfig    = body.config    ?? prev?.config    ?? {}
        const nextDataSpecs = body.data_specs ?? prev?.data_specs ?? []
        const { rows: [ver] } = await client.query(
          `INSERT INTO config.page_version (page_id, config, data_specs)
           VALUES ($1, $2, $3) RETURNING version_number`,
          [id, JSON.stringify(nextConfig), JSON.stringify(nextDataSpecs)],
        )
        versionNumber = ver.version_number
      }

      await client.query('COMMIT')
      return ok({ id, version_number: versionNumber })
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      throw e
    } finally {
      client.release()
    }
  })

  // DELETE /:id — soft delete (lifecycle FSM → archived), never a hard delete.
  app.delete('/:id', async (req) => {
    const { id } = parseParams(PageParams, req.params)
    const { rows } = await app.pg.query(
      `UPDATE config.page SET status = 'archived'
        WHERE id = $1 RETURNING id`,
      [id],
    )
    if (!rows[0]) throw notFound('Page')
    return ok({ id, status: 'archived' })
  })

  // GET /:id/versions — full version history (append-only audit log).
  app.get('/:id/versions', async (req) => {
    const { id } = parseParams(PageParams, req.params)
    const { rows } = await app.pg.query(
      `SELECT id, version_number, is_published, created_at
         FROM config.page_version
        WHERE page_id = $1
        ORDER BY version_number DESC`,
      [id],
    )
    return ok(rows)
  })

  // POST /:id/publish — promote the latest version; demote all others. Atomic so
  // there is never zero or two published versions for a page.
  app.post('/:id/publish', async (req) => {
    const { id } = parseParams(PageParams, req.params)
    const client = await app.pg.connect()
    try {
      await client.query('BEGIN')

      const { rows: [latest] } = await client.query(
        `SELECT id FROM config.page_version
          WHERE page_id = $1 ORDER BY version_number DESC LIMIT 1`,
        [id],
      )
      if (!latest) {
        await client.query('ROLLBACK')
        throw notFound('Page version')
      }

      await client.query(
        `UPDATE config.page_version SET is_published = (id = $2)
          WHERE page_id = $1`,
        [id, latest.id],
      )
      await client.query(
        `UPDATE config.page SET status = 'published' WHERE id = $1`,
        [id],
      )

      await client.query('COMMIT')
      return ok({ id, published_version_id: latest.id })
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      throw e
    } finally {
      client.release()
    }
  })
}
