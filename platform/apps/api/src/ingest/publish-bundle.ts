// ── Ingest — PUBLISH BUNDLE service (release-as-vintage finalizer) ─────────────
//
// ADR-0025. A release groups 1..N pre-attached submissions into one named vintage.
// publishBundle owns the bundle's PUBLISH MOMENT: it promotes every still-staged
// attached submission's gold writes — each stamping the SHARED release_id, each
// SKIPPING publish_release because it is pre-attached (autoOpened=false in
// publishSubmission) — then flips the prior current release to 'superseded', marks
// this one 'published', and stamps published_at (the atomic as-of anchor) via
// stats.publish_release ONCE at the end. Idempotent on an already-published release
// (the helper is a no-op flip).
//
// TRANSACTION BOUNDARY (decision): each publishSubmission owns its OWN per-submission
// transaction (it requires a Pool by contract and manages its own BEGIN/COMMIT +
// out-of-band 'failed' marking), so the bundle is NOT one physical transaction. The
// guarantee is "each submission atomic + release published LAST", which is correct
// because the release lifecycle FSM provides the bundle-level atomicity that matters:
// the vintage is INVISIBLE until publish_release sets published_at + is_current. Every
// read that defines a vintage (GET /releases/:id/observations, the as-of /
// revision-triangle joins) keys on published_at / is_current — both NULL/false while
// the release is 'open'. Therefore:
//   · If a member fails mid-loop, publishSubmission rolls back ITS writes and marks
//     itself 'failed'; the loop aborts (fail-fast, surfaced upstream). Already-published
//     members stay committed under the shared release_id, BUT the release is still
//     'open' (we never reached publish_release) → NO vintage is exposed. The release is
//     RETRYABLE: re-run skips already-'published' members (the 'staged' status filter)
//     and re-runs only the still-'staged' ones, then finalizes.
//   · Only when ALL members succeed does publish_release run, atomically making the
//     whole bundle visible as one vintage with one published_at.
// A single shared transaction was REJECTED: it would force publishSubmission to accept
// an external client, splitting its txn-ownership and breaking its out-of-band 'failed'
// marking (that mark must COMMIT even though the publish rolled back — impossible inside
// a caller-owned txn that also rolls back). The FSM already yields the only guarantee a
// partial bundle needs: never half-published, always retryable. (Two-way door: the
// shared-txn refactor stays open if a future requirement needs all-or-nothing across
// member ROLLBACKs too.)

import type { Queryable } from './types.js'
import { publishSubmission } from './publish.js'
import type { PublishOpts } from './publish.js'

export interface PublishBundleResult {
  /** Number of attached submissions promoted in this run (excludes already-published). */
  members: number
  /** Total observation rows written across the promoted members. */
  published: number
  /** The vintage as-of anchor stamped by stats.publish_release. */
  publishedAt: Date
}

/**
 * Finalize a release bundle into one atomic vintage.
 *
 * Promotes every still-'staged' submission attached to the release (each stamping the
 * shared release_id, each SKIPPING publish_release because pre-attached), then calls
 * stats.publish_release ONCE to stamp the vintage anchor. Fail-fast: a failing member
 * aborts the run leaving the release OPEN and retryable (never half-published).
 *
 * The caller is responsible for the lifecycle guard (release exists + status 'open')
 * and for emitting the governance audit on the release.publish action.
 */
export async function publishBundle(
  db: Queryable,
  releaseId: string,
  opts?: PublishOpts,
): Promise<PublishBundleResult> {
  // Only 'staged' members are promoted: on a retry, members published by a prior
  // (partially-failed) run are already 'published' and are skipped (publishSubmission
  // fail-fast on a non-staged status — we must not call it on them).
  const { rows: members } = await db.query<{ id: string }>(
    `SELECT id FROM stats_stage.submission
      WHERE release_id = $1 AND status = 'staged'
      ORDER BY submitted_at`,
    [releaseId],
  )

  let published = 0
  for (const m of members) {
    // fail-fast: a failing member throws, aborting the loop. Already-committed members
    // remain under the shared release_id but the release stays 'open' (publish_release
    // not yet called) → retryable, never half-published.
    const r = await publishSubmission(db, m.id, opts)
    published += r.published
  }

  // FINALIZE: publish the release ONCE, now every member's gold writes are committed
  // under the shared release_id. This is the atomic vintage anchor for the bundle.
  const { rows } = await db.query<{ published_at: Date }>(
    `SELECT stats.publish_release($1) AS published_at`,
    [releaseId],
  )

  return { members: members.length, published, publishedAt: rows[0].published_at }
}
