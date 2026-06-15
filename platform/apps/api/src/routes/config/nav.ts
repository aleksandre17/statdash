import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { ok, notFound, parseBody, parseParams } from '../../lib/http.js'

// A nav item targets EITHER an internal page OR an external href, never both —
// mirrors the nav_item_target_chk CHECK so we fail fast with a 400 instead of a
// 500 from the DB constraint.
const targetRefine = (v: { page_id?: string | null; href?: string | null }) =>
  !(v.page_id != null && v.href != null)

const CreateNavBody = z
  .object({
    label:     z.object({ ka: z.string(), en: z.string().optional() }),
    href:      z.string().optional(),
    page_id:   z.string().uuid().optional(),
    parent_id: z.string().uuid().optional(),
    ord:       z.number().int().default(0),
  })
  .refine(targetRefine, { message: 'A nav item targets a page_id OR an href, never both' })

const UpdateNavBody = z
  .object({
    label:     z.object({ ka: z.string(), en: z.string().optional() }).optional(),
    href:      z.string().nullable().optional(),
    page_id:   z.string().uuid().nullable().optional(),
    parent_id: z.string().uuid().nullable().optional(),
    ord:       z.number().int().optional(),
  })
  .refine(targetRefine, { message: 'A nav item targets a page_id OR an href, never both' })

const IdParams = z.object({ id: z.string().uuid() })

export const navRoutes: FastifyPluginAsync = async (app) => {
  // GET / — full tree, parents before children (recursive CTE + depth/ord order).
  app.get('/', async () => {
    const { rows } = await app.pg.query(
      `WITH RECURSIVE nav_tree AS (
         SELECT id, parent_id, page_id, label, href, ord, 0 AS depth
           FROM config.nav_item WHERE parent_id IS NULL
         UNION ALL
         SELECT n.id, n.parent_id, n.page_id, n.label, n.href, n.ord, t.depth + 1
           FROM config.nav_item n
           JOIN nav_tree t ON n.parent_id = t.id
       )
       SELECT id, parent_id, page_id, label, href, ord, depth
         FROM nav_tree
        ORDER BY depth, ord`,
    )
    return ok(rows)
  })

  app.post('/', async (req, reply) => {
    const body = parseBody(CreateNavBody, req.body)
    const { rows: [created] } = await app.pg.query(
      `INSERT INTO config.nav_item (label, href, page_id, parent_id, ord)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, parent_id, page_id, label, href, ord, created_at, updated_at`,
      [
        JSON.stringify(body.label),
        body.href ?? null,
        body.page_id ?? null,
        body.parent_id ?? null,
        body.ord,
      ],
    )
    return reply.status(201).send(ok(created))
  })

  app.put('/:id', async (req) => {
    const { id } = parseParams(IdParams, req.params)
    const body = parseBody(UpdateNavBody, req.body)

    const sets: string[] = []
    const vals: unknown[] = []
    if (body.label !== undefined)     { sets.push(`label = $${sets.length + 1}`);     vals.push(JSON.stringify(body.label)) }
    if (body.href !== undefined)      { sets.push(`href = $${sets.length + 1}`);      vals.push(body.href) }
    if (body.page_id !== undefined)   { sets.push(`page_id = $${sets.length + 1}`);   vals.push(body.page_id) }
    if (body.parent_id !== undefined) { sets.push(`parent_id = $${sets.length + 1}`); vals.push(body.parent_id) }
    if (body.ord !== undefined)       { sets.push(`ord = $${sets.length + 1}`);       vals.push(body.ord) }

    if (sets.length === 0) {
      const { rows } = await app.pg.query(
        `SELECT id, parent_id, page_id, label, href, ord, created_at, updated_at
           FROM config.nav_item WHERE id = $1`,
        [id],
      )
      if (!rows[0]) throw notFound('Nav item')
      return ok(rows[0])
    }

    vals.push(id)
    const { rows } = await app.pg.query(
      `UPDATE config.nav_item SET ${sets.join(', ')}
        WHERE id = $${vals.length}
        RETURNING id, parent_id, page_id, label, href, ord, created_at, updated_at`,
      vals,
    )
    if (!rows[0]) throw notFound('Nav item')
    return ok(rows[0])
  })

  // DELETE /:id — parent_id is ON DELETE CASCADE, so the subtree goes with it
  // (a nav branch is one unit).
  app.delete('/:id', async (req) => {
    const { id } = parseParams(IdParams, req.params)
    const { rows } = await app.pg.query(
      `DELETE FROM config.nav_item WHERE id = $1 RETURNING id`,
      [id],
    )
    if (!rows[0]) throw notFound('Nav item')
    return ok({ id, deleted: true })
  })
}
