// ── Provisioning — idempotent DB upserts (one concern: write resources) ───────
//
// Each upserter is transactional and idempotent: re-running an unchanged file
// produces no write churn. None ever DELETE — a resource removed from the files
// is left in the DB (retired via the CRUD API / lifecycle FSM, not file omission).
// All depend on the narrow PgPool port, never on @fastify/postgres.

import type {
  PgPool, ApplyCtx, ResourceResult, UpsertOutcome,
  PageProvision, NavItemProvision, SiteConfigProvision,
  ContentConstraintProvision, ContentConstraintMemberProvision,
} from './types.js'
import { jsonEqual, canonicalHash, errMsg, isObject } from './util.js'

// ── Governed-catalog keys — steward-authorable in-tool (AR-49 M2.2) ───────────
//
// `metrics` and `dimensions` are the semantic-layer catalog the Studio's Steward
// edits IN-TOOL (SPEC-authoring-reconception-M2, decision #4). A steward save
// (`PUT /api/config/site`) writes authored entries into the SAME site_config keys
// provisioning seeds. So for these two keys provisioning must NOT replace the value
// wholesale — a re-provision would wipe every steward-authored metric/dimension.
// Instead it MERGES per entry-id with SEED PROVENANCE (the kubectl last-applied /
// three-way-merge concept, replacing the earlier "existing id always wins" rule
// after it stranded a provisioning label fix — the 0078 P2 (B5G) incident):
//
//   · provisioning records a content hash of every entry IT wrote, in the
//     system-plane site_config key `provisioning_seed_hashes` (Law 11: system
//     fields are projected to no one — bootstrap serves only named keys, so the
//     catalog values themselves stay free of plumbing);
//   · on re-provision, an id whose stored entry still hashes to its recorded
//     seed hash is provisioning-owned → the provisioned UPDATE applies;
//   · any hash mismatch means the steward touched it → steward owns the id
//     from then on (the seed hash is dropped), the stored entry is kept verbatim;
//   · entries with no recorded hash are presumed steward's (conservative for
//     pre-provenance deployments), except the lossless bridge: stored ≡ provisioned
//     adopts the id into provenance without changing content.
//
// Per-entry relational provenance/versioning stays the AR-47 concern; this ledger
// is its single-tenant interim. Every OTHER site_config key keeps wholesale
// last-write-wins replace, unchanged.
const GOVERNED_CATALOG_KEYS = new Set(['metrics', 'dimensions'])

/** System-plane ledger key — never provisioned from files, never served by bootstrap. */
export const SEED_STATE_KEY = 'provisioning_seed_hashes'

/** Entry identity for the per-id catalog merge. Metrics and dimensions both key on `id`. */
function catalogId(entry: unknown): string | undefined {
  return isObject(entry) && typeof entry.id === 'string' ? entry.id : undefined
}

/** Per-catalog slice of the seed ledger, tolerant of a malformed stored value. */
function seedSlice(ledger: unknown, key: string): Record<string, string> {
  if (!isObject(ledger)) return {}
  const slice = ledger[key]
  if (!isObject(slice)) return {}
  const out: Record<string, string> = {}
  for (const [id, h] of Object.entries(slice)) if (typeof h === 'string') out[id] = h
  return out
}

/**
 * Provenance-aware per-id merge of a governed catalog (metrics/dimensions).
 * Ownership per id (see doctrine above): recorded-hash match → provisioning owns,
 * update applies in place (stable order); mismatch or no record → steward owns,
 * stored survives verbatim; absent id → seeded (appended). Stored entries the file
 * no longer ships are never deleted (file omission ≠ retirement). Returns the
 * merged array + the next ledger slice, or `null` when the two values are not
 * BOTH arrays, so the caller refuses to clobber an unmergeable value.
 */
export function mergeCatalogById(
  stored: unknown,
  provisioned: unknown,
  seedHashes: Record<string, string> = {},
): { merged: unknown[]; nextHashes: Record<string, string> } | null {
  if (!Array.isArray(stored) || !Array.isArray(provisioned)) return null
  const provisionedById = new Map<string, unknown>()
  for (const e of provisioned) {
    const id = catalogId(e)
    // An id-less provisioned entry is malformed (governed catalog entries are
    // id-bearing by contract — config-cube-contract); skipped for idempotency.
    if (id !== undefined) provisionedById.set(id, e)
  }

  const nextHashes: Record<string, string> = {}
  const seenStored = new Set<string>()
  const merged = stored.map((s) => {
    const id = catalogId(s)
    if (id === undefined || !provisionedById.has(id)) {
      // Steward-authored, or provisioning-owned but no longer shipped — keep, and
      // carry a still-valid ownership record forward (content unchanged ⇔ hash holds).
      if (id !== undefined && seedHashes[id] === canonicalHash(s)) nextHashes[id] = seedHashes[id]
      if (id !== undefined) seenStored.add(id)
      return s
    }
    seenStored.add(id)
    const p = provisionedById.get(id)
    const storedHash = canonicalHash(s)
    if (seedHashes[id] === storedHash) {
      // Provisioning still owns this id → the file's update applies (in place).
      nextHashes[id] = canonicalHash(p)
      return p
    }
    if (seedHashes[id] === undefined && jsonEqual(s, p)) {
      // Pre-provenance bridge: identical content adopts the id, losslessly.
      nextHashes[id] = storedHash
      return s
    }
    // Hash mismatch (or unknown + diverged): the steward owns this id now.
    return s
  })

  for (const [id, e] of provisionedById) {
    if (!seenStored.has(id)) {
      merged.push(e)
      nextHashes[id] = canonicalHash(e)
    }
  }
  return { merged, nextHashes }
}

// Re-exported so consumers keep a single import surface (./upsert.js) across the
// per-concern split. The data_source upserter lives in its own one-body file.
export { upsertDataSource } from './upsert-data-source.js'

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
  if (key === SEED_STATE_KEY) {
    // The provenance ledger is provisioning's OWN bookkeeping — a file shipping it
    // would clobber ownership records (and it is system-plane, Law 11). Refuse.
    ctx.log.warn({ key }, 'provisioning: the seed-provenance ledger key cannot be provisioned from files — skipped')
    return { kind: 'siteConfig', key, outcome: 'skipped', reason: 'reserved system key' }
  }
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

    // The value to persist. For a governed-catalog key with an existing value we
    // MERGE per entry-id with seed provenance (steward-authored entries survive,
    // provisioning-owned entries update); every other key — and the fresh-seed
    // (create) path — writes the provisioned value verbatim.
    let valueToWrite: unknown = entry.value
    let nextLedger: Record<string, unknown> | null = null
    if (GOVERNED_CATALOG_KEYS.has(key)) {
      // Read the provenance ledger under the same tx (FOR UPDATE serializes
      // concurrent boots); the merged slice is written back below with the value.
      const { rows: ledgerRows } = await client.query<{ value: unknown }>(
        `SELECT value FROM config.site_config WHERE key = $1 FOR UPDATE`,
        [SEED_STATE_KEY],
      )
      const ledger = ledgerRows[0]?.value
      const seedHashes = seedSlice(ledger, key)
      const result = mergeCatalogById(existing[0] ? existing[0].value : [], entry.value, seedHashes)
      if (result === null) {
        // Not both arrays: refuse to overwrite a possibly steward-authored catalog
        // with an unmergeable value. Additive + safe — skip and report, never destroy.
        await client.query('ROLLBACK')
        ctx.log.warn({ key }, 'provisioning: governed catalog value not mergeable (not both arrays) — skipped to avoid data loss')
        return { kind: 'siteConfig', key, outcome: 'skipped', reason: 'catalog value not mergeable (not both arrays)' }
      }
      valueToWrite = result.merged
      if (!jsonEqual(seedHashes, result.nextHashes)) {
        nextLedger = { ...(isObject(ledger) ? ledger : {}), [key]: result.nextHashes }
      }
    }
    const valueUnchanged = existing[0] !== undefined && jsonEqual(existing[0].value, valueToWrite)
    if (valueUnchanged && nextLedger === null) {
      await client.query('COMMIT')
      ctx.log.info({ key, outcome: 'unchanged' }, 'provisioning: site config')
      return { kind: 'siteConfig', key, outcome: 'unchanged' }
    }
    const outcome: UpsertOutcome = existing[0] ? (valueUnchanged ? 'unchanged' : 'updated') : 'created'

    if (!valueUnchanged) {
      await client.query(
        `INSERT INTO config.site_config (key, value) VALUES ($1, $2::jsonb)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, JSON.stringify(valueToWrite)],
      )
    }

    if (nextLedger !== null) {
      // The ledger moves in the SAME transaction — a catalog value and its
      // ownership records never drift apart.
      await client.query(
        `INSERT INTO config.site_config (key, value) VALUES ($1, $2::jsonb)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [SEED_STATE_KEY, JSON.stringify(nextLedger)],
      )
    }

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
