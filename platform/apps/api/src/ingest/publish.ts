// ── Ingest — PUBLISH service (silver staging → gold stats.*) ──────────────────
//
// The approval-gated promotion: a submission that is `staged` and whose validation
// preview has canPublish=true is promoted from the silver staging tables into the
// gold cube. ALL-OR-NOTHING per dataset (one transaction), reusing the canonical
// idempotent upserts (./upsert.ts) so the V4 dim_key trigger + V8 revision trigger
// fire exactly as they do for the seed.
//
// PROVENANCE: SET LOCAL app.revised_by = '<submissionId>' scopes the GUC to the
// transaction; the V8 capture trigger stamps every revision row with it — the
// audit trail records WHICH submission revised a figure, for free.
//
// DRY RUN (submission.dry_run = true): run the full publish through to the version
// bump, then ROLLBACK. CI can validate a submission file end-to-end (including the
// gold triggers) without mutating the cube. The submission is NOT marked published.
//
// STATUS TRANSITIONS (fail-fast, surfaced — never swallowed):
//   staged → publishing → published    (success, non-dry-run)
//   staged → publishing → staged       (dry-run: rolled back, stays staged)
//   staged → publishing → failed       (any error: rolled back, error_detail set)

import type { Queryable, QueryableClient, SubmissionKind } from './types.js'
import { upsertClassifier, bumpDatasetVersion } from './upsert.js'
import type { AuditLogger } from '../lib/audit-log.js'
import { errMsg } from './util.js'

// ── Silver row readers (the staged shapes as persisted in stats_stage.*) ──────

interface StageClassifierRow {
  dim_code: string
  code: string
  label: Record<string, string>
  parent_code: string | null
  ord: number | null
  metadata: Record<string, unknown> | null
}

interface SubmissionRow {
  id: string
  kind: SubmissionKind
  dataset_code: string | null
  status: string
  dry_run: boolean
  // ADR-0025 — the release this submission is bundled into (nullable: a curator
  // may pre-attach via the releases API; otherwise publish auto-opens a singleton).
  release_id: string | null
}

/** Optional inputs to publishSubmission — audit actor + sink (DI-14b). */
export interface PublishOpts {
  /** Subject id of the curator triggering the publish (req.jwtPayload?.sub). */
  userId?: string
  /** Governance audit sink (port). Fire-and-forget; never awaited, never blocks. */
  audit?: AuditLogger
}

/**
 * Publish one submission's staged rows into gold.
 * Returns the count of rows written (published) and how many were revisions.
 * Throws (after rolling back + marking `failed`) on any error — fail-fast.
 *
 * DI-14b: on a committed (non-dry-run) publish, records an 'ingest.publish'
 * governance audit entry. The audit logger is a fire-and-forget port — it is
 * never awaited and an audit failure must never break a successful publish.
 */
export async function publishSubmission(
  db: Queryable,
  submissionId: string,
  opts?: PublishOpts,
): Promise<{ published: number; revised: number }> {
  if (!db.connect) {
    // Publish owns its transaction boundary; it needs a Pool, not a single client.
    throw new Error('publishSubmission requires a Queryable with connect() (a pool)')
  }

  // Read the submission header outside the publish transaction (a quick lookup).
  const { rows: subs } = await db.query<SubmissionRow>(
    `SELECT id, kind, dataset_code, status, dry_run, release_id
       FROM stats_stage.submission WHERE id = $1`,
    [submissionId],
  )
  const sub = subs[0]
  if (!sub) throw new Error(`submission ${submissionId} not found`)
  if (sub.status !== 'staged') {
    throw new Error(`submission ${submissionId} is '${sub.status}', not 'staged' — cannot publish`)
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query(`UPDATE stats_stage.submission SET status = 'publishing' WHERE id = $1`, [submissionId])

    // Provenance: every V8 revision row in this txn is stamped with the submission.
    await client.query(`SET LOCAL app.revised_by = $1`, [submissionId])

    // ADR-0025 — resolve the RELEASE for this publish (the vintage key). A curator
    // may have pre-attached one (sub.release_id, bundled path); otherwise auto-open
    // a singleton so the single-submission path Just Works. open_release is called
    // INSIDE this transaction, so a dry-run ROLLBACK discards an auto-opened release
    // with no orphan (the row never commits) — confirmed: the INSERT is txn-local.
    //
    // autoOpened is the PATH DISCRIMINANT that decides who owns the release-publish
    // moment (ADR-0025 bundled-release atomicity):
    //   · autoOpened = true  → SINGLETON. publishSubmission opened the release itself,
    //                          so it also publishes it here (one submission = one
    //                          atomic vintage). publish_release WITHIN this txn.
    //   · autoOpened = false → BUNDLED. The release was pre-attached by a curator who
    //                          may have bundled OTHER submissions into it. This
    //                          submission only STAMPS its facts under the shared
    //                          release_id and commits; it must NOT publish, or the
    //                          first submission would flip the whole bundle to
    //                          published before the rest are written (partial,
    //                          non-atomic vintage). The bundle endpoint
    //                          (POST /releases/:id/publish) owns the publish moment.
    let releaseId = sub.release_id
    const autoOpened = releaseId === null
    if (autoOpened) {
      const { rows: rel } = await client.query<{ release_id: string }>(
        `SELECT stats.open_release($1, $2::jsonb, $3) AS release_id`,
        [
          sub.dataset_code,
          // a minimal auto-label keyed on the submission (curators relabel via the API);
          // en-only is acceptable for an auto-opened singleton (Postel: a stable shape).
          JSON.stringify({ en: `auto: ${submissionId}` }),
          submissionId, // opened_by — the submission is the actor on the auto path
        ],
      )
      releaseId = rel[0].release_id
    }

    // Stamp the release on every gold write in this txn: the BEFORE trigger on
    // stats.observation reads app.release_id and writes observation.release_id;
    // the extended V8 capture trigger stamps the pre-image's set_by/superseded_by.
    await client.query(`SET LOCAL app.release_id = $1`, [releaseId])

    const result = await publishByKind(client, sub)

    // Cache/ETag invalidation — bump the affected dataset version(s).
    for (const dc of result.datasets) await bumpDatasetVersion(client, dc)

    if (sub.dry_run) {
      // Full pipeline exercised (incl. gold triggers + release stamping); discard
      // the writes. The auto-opened release (if any) rolls back with them.
      await client.query('ROLLBACK')
      await client.query(
        `UPDATE stats_stage.submission SET status = 'staged' WHERE id = $1`, [submissionId],
      )
      return { published: result.published, revised: result.revised }
    }

    await client.query(
      `UPDATE stats_stage.submission
          SET status = 'published', published_at = now(), staged_count = $2, release_id = $3
        WHERE id = $1`,
      [submissionId, result.published, releaseId],
    )

    // ADR-0025 — publish the release WITHIN the same txn ONLY on the auto-opened
    // SINGLETON path: flip the prior current release to 'superseded', mark this one
    // 'published', stamp published_at (the atomic as-of anchor for the vintage).
    // Same txn as the gold writes so the release publish and the facts it bundles
    // commit (or roll back) together.
    //
    // BUNDLED path (autoOpened = false): do NOT publish here. The release was
    // pre-attached and may bundle other submissions; publishing on the first one
    // would flip the whole vintage to published prematurely (partial, non-atomic),
    // and a later submission's failure would leave a published-with-partial-data
    // vintage. The bundle endpoint publishes ONCE after all members are written.
    // This submission's facts are committed and stamped under the shared release_id;
    // the release stays OPEN until the bundle finalizes it — so a mid-bundle failure
    // leaves an OPEN, retryable release, never a half-published one.
    if (autoOpened) {
      await client.query(`SELECT stats.publish_release($1)`, [releaseId])
    }

    await client.query('COMMIT')

    // DI-14b — governance audit on a committed publish. Fire-and-forget: never
    // awaited (the port is synchronous void), and guarded so a faulty audit
    // adapter can never undo a successful publish (the COMMIT already happened).
    try {
      opts?.audit?.log({
        userId:   opts.userId,
        action:   'ingest.publish',
        resource: submissionId,
        payload:  { kind: sub.kind, dataset_code: sub.dataset_code },
      })
    } catch { /* audit is best-effort; a successful publish must not fail here */ }

    return { published: result.published, revised: result.revised }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    // Mark failed in its OWN committed statement (the publish txn rolled back).
    await db.query(
      `UPDATE stats_stage.submission SET status = 'failed', error_detail = $2 WHERE id = $1`,
      [submissionId, errMsg(err)],
    ).catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

// ── Per-kind dispatch (Strategy by discriminant — OCP open point) ─────────────

interface PublishOutcome { published: number; revised: number; datasets: Set<string> }

async function publishByKind(client: QueryableClient, sub: SubmissionRow): Promise<PublishOutcome> {
  switch (sub.kind) {
    case 'codelists': return publishClassifiers(client, sub.id)
    case 'displays':  return publishDisplays(client, sub.id)
    case 'facts':     return publishFacts(client, sub.id)
    default: {
      const _exhaustive: never = sub.kind
      throw new Error(`unknown submission kind: ${String(_exhaustive)}`)
    }
  }
}

// ── Facts → stats.observation ─────────────────────────────────────────────────

async function publishFacts(client: QueryableClient, submissionId: string): Promise<PublishOutcome> {
  // DI-13 — one set-based INSERT … SELECT … ON CONFLICT promotes every staged
  // observation in a single statement (no per-row round-trip). The gold V4
  // dim_key validation trigger + V8 revision trigger still fire FOR EACH ROW, so
  // promotion stays semantically identical to the old per-row upsertObservation
  // loop — only the network chatter is gone. COALESCE(obs_status,'A') mirrors the
  // gold default for silver rows that staged a NULL status (Postel at the boundary).
  // The conflict target is the V4 unique index; dim_key_hash + time_period_date
  // are GENERATED, so Postgres infers them from the inserted values.
  const { rows: written } = await client.query<{ dataset_code: string }>(
    `INSERT INTO stats.observation (dataset_code, time_period, dim_key, obs_value, obs_status, obs_attribute)
     SELECT dataset_code, time_period, dim_key, obs_value, COALESCE(obs_status, 'A'), obs_attribute
       FROM stats_stage.obs_staging
      WHERE submission_id = $1
     ON CONFLICT (dataset_code, time_period, dim_key_hash, time_period_date) DO UPDATE
       SET obs_value     = EXCLUDED.obs_value,
           obs_status    = EXCLUDED.obs_status,
           obs_attribute = EXCLUDED.obs_attribute
     RETURNING dataset_code`,
    [submissionId],
  )
  const datasets = new Set<string>()
  for (const r of written) datasets.add(r.dataset_code)
  // revised count is captured by the V8 trigger into observation_revision; the
  // approver-facing number came from the validate preview. Here we report writes.
  return { published: written.length, revised: 0, datasets }
}

// ── Classifiers → stats.classifier (dependency-order: roots first) ────────────

async function publishClassifiers(client: QueryableClient, submissionId: string): Promise<PublishOutcome> {
  const { rows } = await client.query<StageClassifierRow>(
    `SELECT dim_code, code, label, parent_code, ord, metadata
       FROM stats_stage.classifier_staging WHERE submission_id = $1 ORDER BY dim_code, ord`,
    [submissionId],
  )

  // ADR-0023: parent_code is passed STRAIGHT THROUGH to gold (the hierarchy edge is
  // now the stable business key, no surrogate-id resolution). But the V23
  // trg_classifier_code_path trigger RAISES if a child is inserted before its
  // CURRENT parent exists (it derives code_path from the parent's code_path).
  // So ordering is still load-bearing: a parent must be published before its child.
  //
  // We keep the topological loop (parent-before-child, generalized to ARBITRARY
  // depth) rather than a plain `ORDER BY parent_code NULLS FIRST`. The seed corpus
  // is 2-level (seed.ts loadDim is a fixed two-pass), but the runtime contract is
  // not corpus-bound: upsert.scd2.test.ts exercises a 3-level subtree (B→B1→B1G),
  // and a future submission may stage deeper. A 2-level-only sort would be a
  // correctness regression on the first deep batch; the loop costs nothing extra on
  // shallow batches (it converges in one pass when already root-ordered).
  //
  // Resolution is now a CODE-keyed boolean: a parent is "ready" if it is a sibling
  // already published in this batch (publishedCodes) OR a CURRENT row already in
  // gold (EXISTS … is_current = true). is_current = true is load-bearing post-V18:
  // SCD-2 keeps historical rows; a child must attach to the LIVE parent, never a
  // retired revision (mirrors publishDisplays' is_current join + the trigger guard).
  const publishedCodes = new Set<string>() // `${dim_code} ${code}` published this batch
  const pending = [...rows]
  let progressed = true
  let published = 0

  while (pending.length > 0 && progressed) {
    progressed = false
    for (let i = pending.length - 1; i >= 0; i--) {
      const r = pending[i]
      if (r.parent_code != null) {
        const ready =
          publishedCodes.has(`${r.dim_code} ${r.parent_code}`) ||
          (await parentIsCurrentInGold(client, r.dim_code, r.parent_code))
        if (!ready) continue // parent not resolvable yet — try a later pass
      }
      // color is not staged (V11 classifier_staging has no color column); pass null
      // so upsertClassifier's COALESCE preserves any existing gold color. parent_code
      // flows straight through; the trigger materializes code_path.
      await upsertClassifier(
        client, r.dim_code, r.code, r.label, null, r.parent_code, r.ord ?? 0, r.metadata ?? {},
      )
      publishedCodes.add(`${r.dim_code} ${r.code}`)
      pending.splice(i, 1)
      published++
      progressed = true
    }
  }

  if (pending.length > 0) {
    // Unresolvable parents — validate should have caught this; fail-fast here too.
    throw new Error(
      `unresolved parent_code for ${pending.length} classifier row(s): ` +
      pending.map((p) => `${p.dim_code}/${p.code}→${p.parent_code}`).join(', '),
    )
  }

  return { published, revised: 0, datasets: new Set() }
}

/** True iff (dim_code, parent_code) has a CURRENT row in gold — the trigger's guard. */
async function parentIsCurrentInGold(
  client: QueryableClient,
  dimCode: string,
  parentCode: string,
): Promise<boolean> {
  const { rows } = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM stats.classifier
        WHERE dim_code = $1 AND code = $2 AND is_current = true
     ) AS exists`,
    [dimCode, parentCode],
  )
  return rows[0]?.exists ?? false
}

// ── Displays → stats.classifier_display ───────────────────────────────────────

async function publishDisplays(client: QueryableClient, submissionId: string): Promise<PublishOutcome> {
  // DI-13 — fully set-based. The old path did one member-id SELECT + one upsert
  // PER staged display row (2 round-trips × N). Instead, resolve every member id
  // and upsert every overlay in ONE INSERT … SELECT that JOINs the staging rows
  // to the CURRENT classifier members (is_current = true — V6 SCD-2 keeps multiple
  // historical rows per (dim_code, code); only the live one owns the overlay).
  //
  // An INNER JOIN silently drops display rows whose (dim_code, code) does not
  // resolve. validate is supposed to have caught that (UNKNOWN_MEMBER), but the
  // old code fail-fast threw on an unresolved member, so we preserve that contract:
  // first detect unresolved rows, fail-fast if any, then do the single upsert.
  const { rows: unresolved } = await client.query<{ dim_code: string; code: string }>(
    `SELECT DISTINCT d.dim_code, d.code
       FROM stats_stage.display_staging d
       LEFT JOIN stats.classifier c
         ON c.dim_code = d.dim_code AND c.code = d.code AND c.is_current = true
      WHERE d.submission_id = $1
        AND c.id IS NULL`,
    [submissionId],
  )
  if (unresolved.length > 0) {
    throw new Error(
      `display references unknown member(s): ` +
      unresolved.map((u) => `${u.dim_code}/${u.code}`).join(', '),
    )
  }

  const { rows: written } = await client.query<{ member_id: number }>(
    `INSERT INTO stats.classifier_display (member_id, locale, display)
     SELECT c.id, d.locale, d.display
       FROM stats_stage.display_staging d
       JOIN stats.classifier c
         ON c.dim_code = d.dim_code AND c.code = d.code AND c.is_current = true
      WHERE d.submission_id = $1
     ON CONFLICT (member_id, locale) DO UPDATE
       SET display = EXCLUDED.display
     RETURNING member_id`,
    [submissionId],
  )
  return { published: written.length, revised: 0, datasets: new Set() }
}
