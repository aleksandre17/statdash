// ── Provisioning — idempotent DB upserts (one concern: write resources) ───────
//
// Each upserter is transactional and idempotent: re-running an unchanged file
// produces no write churn. None ever DELETE — a resource removed from the files
// is left in the DB (retired via the CRUD API / lifecycle FSM, not file omission).
// All depend on the narrow PgPool port, never on @fastify/postgres.

import type {
  PgPool, ApplyCtx, ResourceResult, UpsertOutcome,
  PageProvision, NavItemProvision, DataSourceProvision, SiteConfigProvision,
  ContentConstraintProvision, ContentConstraintMemberProvision,
} from './types.js'
import { jsonEqual, errMsg } from './util.js'

/**
 * Upsert a page: identity by slug, a new immutable version appended ONLY when the
 * config tree actually changed vs the latest version. Transactional so identity
 * and the version snapshot move together; FOR UPDATE serializes concurrent boots.
 */
export async function upsertPage(pg: PgPool, page: PageProvision, ctx: ApplyCtx): Promise<ResourceResult> {
  const key = page.slug
  if (ctx.dryRun) {
    ctx.log.info({ slug: key, status: page.status ?? 'published' }, 'provisioning[dry-run]: would upsert page')
    return { kind: 'page', key, outcome: 'skipped', reason: 'dry-run' }
  }

  const client = await pg.connect()
  try {
    await client.query('BEGIN')

    const { rows: existing } = await client.query<{ id: string }>(
      `SELECT id FROM config.page WHERE slug = $1 FOR UPDATE`,
      [key],
    )

    let pageId: string
    let outcome: UpsertOutcome

    if (existing[0]) {
      pageId = existing[0].id
      await client.query(
        `UPDATE config.page SET title = $2, status = $3 WHERE id = $1`,
        [pageId, JSON.stringify(page.title), page.status ?? 'published'],
      )
      outcome = 'updated'
    } else {
      const { rows: [created] } = await client.query<{ id: string }>(
        `INSERT INTO config.page (slug, title, status) VALUES ($1, $2, $3) RETURNING id`,
        [key, JSON.stringify(page.title), page.status ?? 'published'],
      )
      pageId = created.id
      outcome = 'created'
    }

    // Append a version only on a real change — keeps re-provisioning idempotent
    // against the append-only version table. Canonical compare ignores key order.
    const { rows: [latest] } = await client.query<{ id: string; config: unknown; data_specs: unknown; is_published: boolean }>(
      `SELECT id, config, data_specs, is_published FROM config.page_version
        WHERE page_id = $1 ORDER BY version_number DESC LIMIT 1`,
      [pageId],
    )

    const nextDataSpecs = page.dataSpecs ?? []
    const changed =
      !latest ||
      !jsonEqual(latest.config, page.config) ||
      !jsonEqual(latest.data_specs, nextDataSpecs)

    if (changed) {
      await client.query(
        `INSERT INTO config.page_version (page_id, config, data_specs) VALUES ($1, $2, $3)`,
        [pageId, JSON.stringify(page.config), JSON.stringify(nextDataSpecs)],
      )
    } else if (outcome === 'updated') {
      outcome = 'unchanged'   // identity AND tree unchanged ⇒ nothing moved
    }

    // Publish-state fix (ADR-0026 Phase B, gap #1): bootstrap requires BOTH
    // p.status='published' AND v.is_published. Setting status above is not enough
    // — the appended version defaults is_published=false, so a provisioned page
    // would return ZERO from bootstrap. Mirror POST /:id/publish IN THE SAME TX:
    // promote the latest version, demote its siblings. Idempotent — re-running on
    // an already-published page is a no-op write (the predicate already holds).
    // Draft/archived pages are left untouched (they must NOT appear in bootstrap).
    const targetStatus = page.status ?? 'published'
    if (targetStatus === 'published') {
      // Re-read the latest id: on `changed` we just inserted a newer version that
      // must become the published one (the `latest` above is now stale).
      const { rows: [head] } = await client.query<{ id: string; is_published: boolean }>(
        `SELECT id, is_published FROM config.page_version
          WHERE page_id = $1 ORDER BY version_number DESC LIMIT 1`,
        [pageId],
      )
      if (head && !head.is_published) {
        // Single UPDATE flips the head to published and every sibling to false —
        // identical to POST /:id/publish: never zero, never two published versions.
        await client.query(
          `UPDATE config.page_version SET is_published = (id = $2) WHERE page_id = $1`,
          [pageId, head.id],
        )
        // The publish promotion is itself a change worth reporting even when the
        // tree was unchanged (an existing draft-version page now goes live).
        if (outcome === 'unchanged') outcome = 'updated'
      }
    }

    await client.query('COMMIT')
    ctx.log.info({ slug: key, outcome }, 'provisioning: page')
    return { kind: 'page', key, outcome }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    ctx.log.error({ slug: key, error: errMsg(err) }, 'provisioning: page failed')
    return { kind: 'page', key, outcome: 'skipped', reason: errMsg(err) }
  } finally {
    client.release()
  }
}

/**
 * Upsert a data source by name. V3 has no UNIQUE on name, so the conflict key is
 * emulated with SELECT … FOR UPDATE inside the transaction (no check-then-write
 * race against concurrent boots).
 */
export async function upsertDataSource(pg: PgPool, src: DataSourceProvision, ctx: ApplyCtx): Promise<ResourceResult> {
  const key = src.name
  if (ctx.dryRun) {
    ctx.log.info({ name: key, type: src.type }, 'provisioning[dry-run]: would upsert data source')
    return { kind: 'dataSource', key, outcome: 'skipped', reason: 'dry-run' }
  }

  const client = await pg.connect()
  try {
    await client.query('BEGIN')
    const { rows: existing } = await client.query<{ id: string }>(
      `SELECT id FROM config.data_source WHERE name = $1 FOR UPDATE`,
      [key],
    )
    let outcome: UpsertOutcome
    if (existing[0]) {
      await client.query(
        `UPDATE config.data_source SET type = $2, url = $3, config = $4 WHERE id = $1`,
        [existing[0].id, src.type, src.url ?? null, JSON.stringify(src.config ?? {})],
      )
      outcome = 'updated'
    } else {
      await client.query(
        `INSERT INTO config.data_source (name, type, url, config) VALUES ($1, $2, $3, $4)`,
        [key, src.type, src.url ?? null, JSON.stringify(src.config ?? {})],
      )
      outcome = 'created'
    }
    await client.query('COMMIT')
    ctx.log.info({ name: key, outcome }, 'provisioning: data source')
    return { kind: 'dataSource', key, outcome }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    ctx.log.error({ name: key, error: errMsg(err) }, 'provisioning: data source failed')
    return { kind: 'dataSource', key, outcome: 'skipped', reason: errMsg(err) }
  } finally {
    client.release()
  }
}

/**
 * Upsert a top-level nav item. config.nav_item has no natural UNIQUE key, so
 * idempotency keys on the localized label text. Nested trees are out of scope for
 * file provisioning v1 (authored via the CRUD API). An internal item resolves its
 * target by page slug; an unresolved slug is skipped, not fatal.
 */
export async function upsertNavItem(pg: PgPool, nav: NavItemProvision, ctx: ApplyCtx): Promise<ResourceResult> {
  const key = nav.label.en ?? nav.label.ka ?? Object.values(nav.label)[0] ?? '(unlabeled)'

  if (nav.href != null && nav.pageSlug != null) {
    return { kind: 'navItem', key, outcome: 'skipped', reason: 'nav item targets both href and pageSlug' }
  }
  if (ctx.dryRun) {
    ctx.log.info({ label: key }, 'provisioning[dry-run]: would upsert nav item')
    return { kind: 'navItem', key, outcome: 'skipped', reason: 'dry-run' }
  }

  const client = await pg.connect()
  try {
    await client.query('BEGIN')

    let pageId: string | null = null
    if (nav.pageSlug != null) {
      const { rows } = await client.query<{ id: string }>(
        `SELECT id FROM config.page WHERE slug = $1`,
        [nav.pageSlug],
      )
      if (!rows[0]) {
        await client.query('ROLLBACK')
        return { kind: 'navItem', key, outcome: 'skipped', reason: `pageSlug '${nav.pageSlug}' not found` }
      }
      pageId = rows[0].id
    }

    const { rows: existing } = await client.query<{ id: string }>(
      `SELECT id FROM config.nav_item
        WHERE parent_id IS NULL
          AND label IS NOT DISTINCT FROM $1::jsonb
        FOR UPDATE`,
      [JSON.stringify(nav.label)],
    )

    let outcome: UpsertOutcome
    if (existing[0]) {
      await client.query(
        `UPDATE config.nav_item SET label = $2, href = $3, page_id = $4, ord = $5 WHERE id = $1`,
        [existing[0].id, JSON.stringify(nav.label), nav.href ?? null, pageId, nav.ord ?? 0],
      )
      outcome = 'updated'
    } else {
      await client.query(
        `INSERT INTO config.nav_item (label, href, page_id, ord) VALUES ($1, $2, $3, $4)`,
        [JSON.stringify(nav.label), nav.href ?? null, pageId, nav.ord ?? 0],
      )
      outcome = 'created'
    }

    await client.query('COMMIT')
    ctx.log.info({ label: key, outcome }, 'provisioning: nav item')
    return { kind: 'navItem', key, outcome }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    ctx.log.error({ label: key, error: errMsg(err) }, 'provisioning: nav item failed')
    return { kind: 'navItem', key, outcome: 'skipped', reason: errMsg(err) }
  } finally {
    client.release()
  }
}

/**
 * Upsert a site-level setting by key (ADR-0026 Phase B). config.site_config.key is
 * a real PRIMARY KEY, so a single INSERT … ON CONFLICT (key) DO UPDATE is both
 * atomic and idempotent — no SELECT … FOR UPDATE emulation the other upserters
 * need. A jsonEqual short-circuit skips the no-op write (and the updated_at trigger
 * churn) when the stored value already equals the provisioned one, mirroring the
 * change-detection contract of the page/nav upserters.
 */
export async function upsertSiteConfig(pg: PgPool, entry: SiteConfigProvision, ctx: ApplyCtx): Promise<ResourceResult> {
  const key = entry.key
  if (ctx.dryRun) {
    ctx.log.info({ key }, 'provisioning[dry-run]: would upsert site config')
    return { kind: 'siteConfig', key, outcome: 'skipped', reason: 'dry-run' }
  }

  const client = await pg.connect()
  try {
    await client.query('BEGIN')

    const { rows: existing } = await client.query<{ value: unknown }>(
      `SELECT value FROM config.site_config WHERE key = $1`,
      [key],
    )

    let outcome: UpsertOutcome
    if (existing[0]) {
      if (jsonEqual(existing[0].value, entry.value)) {
        await client.query('COMMIT')
        ctx.log.info({ key, outcome: 'unchanged' }, 'provisioning: site config')
        return { kind: 'siteConfig', key, outcome: 'unchanged' }
      }
      outcome = 'updated'
    } else {
      outcome = 'created'
    }

    await client.query(
      `INSERT INTO config.site_config (key, value) VALUES ($1, $2::jsonb)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, JSON.stringify(entry.value)],
    )

    await client.query('COMMIT')
    ctx.log.info({ key, outcome }, 'provisioning: site config')
    return { kind: 'siteConfig', key, outcome }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    ctx.log.error({ key, error: errMsg(err) }, 'provisioning: site config failed')
    return { kind: 'siteConfig', key, outcome: 'skipped', reason: errMsg(err) }
  } finally {
    client.release()
  }
}

/** Canonical, order-insensitive form of a member list for change detection. */
function canonicalMembers(members: ContentConstraintMemberProvision[]): unknown[] {
  return members
    .map((m) => ({
      dimCode:  m.dimCode,
      code:     m.code,
      condDim:  m.when?.dimCode ?? null,
      condCode: m.when?.code ?? null,
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
}

/**
 * Upsert an authored allowed cube region (ADR-0027 ContentConstraint). Identity by
 * (dataset_code, role='allowed'); the member set is replaced transactionally ONLY
 * when the canonical list changed (jsonEqual) — re-provisioning an unchanged file
 * is a no-op write. Never DELETEs the constraint on file omission (same convention
 * as the other upserters: removal is a deliberate API/CRUD action, not silence).
 * The member-set replace (delete-all + re-insert) is the simplest correct sync for
 * a small authored set and is gated behind the change check so it never churns.
 */
export async function upsertContentConstraint(
  pg: PgPool, cc: ContentConstraintProvision, ctx: ApplyCtx,
): Promise<ResourceResult> {
  const role = cc.role ?? 'allowed'
  const key = `${cc.datasetCode}:${role}`
  if (ctx.dryRun) {
    ctx.log.info({ datasetCode: cc.datasetCode, role, members: cc.members.length },
      'provisioning[dry-run]: would upsert content constraint')
    return { kind: 'contentConstraint', key, outcome: 'skipped', reason: 'dry-run' }
  }

  const client = await pg.connect()
  try {
    await client.query('BEGIN')

    // Identity (dataset_code, role) — FOR UPDATE serializes concurrent boots.
    const { rows: existing } = await client.query<{ id: string }>(
      `SELECT id FROM stats.content_constraint
        WHERE dataset_code = $1 AND role = $2 FOR UPDATE`,
      [cc.datasetCode, role],
    )

    let constraintId: string
    let outcome: UpsertOutcome
    if (existing[0]) {
      constraintId = existing[0].id
      await client.query(
        `UPDATE stats.content_constraint SET label = $2 WHERE id = $1`,
        [constraintId, JSON.stringify(cc.label ?? {})],
      )
      outcome = 'updated'
    } else {
      const { rows: [created] } = await client.query<{ id: string }>(
        `INSERT INTO stats.content_constraint (dataset_code, role, label)
         VALUES ($1, $2, $3) RETURNING id`,
        [cc.datasetCode, role, JSON.stringify(cc.label ?? {})],
      )
      constraintId = created.id
      outcome = 'created'
    }

    // Replace the member set only on a real change (canonical, order-insensitive).
    const { rows: current } = await client.query<{
      dim_code: string; code: string; cond_dim_code: string | null; cond_code: string | null
    }>(
      `SELECT dim_code, code, cond_dim_code, cond_code
         FROM stats.content_constraint_member WHERE constraint_id = $1`,
      [constraintId],
    )
    const currentCanon = canonicalMembers(current.map((r) => ({
      dimCode: r.dim_code, code: r.code,
      when: r.cond_dim_code ? { dimCode: r.cond_dim_code, code: r.cond_code! } : undefined,
    })))
    const nextCanon = canonicalMembers(cc.members)

    if (!jsonEqual(currentCanon, nextCanon)) {
      await client.query(`DELETE FROM stats.content_constraint_member WHERE constraint_id = $1`, [constraintId])
      for (const m of cc.members) {
        await client.query(
          `INSERT INTO stats.content_constraint_member
             (constraint_id, dim_code, code, cond_dim_code, cond_code)
           VALUES ($1, $2, $3, $4, $5)`,
          [constraintId, m.dimCode, m.code, m.when?.dimCode ?? null, m.when?.code ?? null],
        )
      }
    } else if (outcome === 'updated') {
      outcome = 'unchanged'   // identity AND member set unchanged ⇒ nothing moved
    }

    await client.query('COMMIT')
    ctx.log.info({ datasetCode: cc.datasetCode, role, outcome }, 'provisioning: content constraint')
    return { kind: 'contentConstraint', key, outcome }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    ctx.log.error({ datasetCode: cc.datasetCode, role, error: errMsg(err) }, 'provisioning: content constraint failed')
    return { kind: 'contentConstraint', key, outcome: 'skipped', reason: errMsg(err) }
  } finally {
    client.release()
  }
}
