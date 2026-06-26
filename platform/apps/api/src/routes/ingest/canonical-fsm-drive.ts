// ── canonical-fsm-drive — in-process staging/publish drive for the canonical upload ──
//
// The canonical upload route (canonical.ts) must order REFERENCE DATA (codelists,
// displays) fully to PUBLISHED gold BEFORE it submits facts, so the facts validate
// against classifiers that already exist in gold. createSubmission fires the worker
// out of band (setImmediate), so the route cannot assume staging has happened when
// createSubmission returns. This module owns the seed-pipeline-style in-process drive
// — drive the worker, poll the job FSM, reuse the existing publish path — extracted
// from the route so the route file is just the HTTP boundary + orchestration (one
// concern per file). Mirrors scripts/seed-pipeline.ts submitAndPublish, in-process.

import { problem } from '../../lib/problem.js'
import { HttpError } from '../../lib/http.js'
import {
  createSubmission, AlreadyPublishedError, runIngestionWorker, publishSubmission,
} from '../../ingest/index.js'
import type { Queryable, IngestLogger, SubmissionStatus } from '../../ingest/index.js'

/**
 * One submission this upload produced — the kind, its pipeline jobId, and the FSM
 * status the route left it in. Reference data (codelists/displays) is left 'published'
 * (the route drove it to gold); facts are left 'staged' (the curator-approval gate).
 */
export interface KindJob {
  kind: 'codelists' | 'displays' | 'facts'
  jobId: string
  status: SubmissionStatus
  /**
   * True when this reference submission was a CONVERGED no-op on RETRY: an identical
   * payload was already published for this upload's prior (partially-failed) run, so
   * the Idempotent Receiver's existing published job is reused instead of re-submitting
   * (the partial-failure → retry → converge fix). Absent/false on a fresh publish.
   */
  converged?: boolean
}

// ── In-process FSM drive (mirrors seed-pipeline.ts submitAndPublish) ───────────
//
// createSubmission fires runIngestionWorker via setImmediate (out of band): the bronze
// row is durably 'received' but staging happens AFTER the createSubmission call returns.
// To order reference-data-before-facts DETERMINISTICALLY in one request we drive the
// worker ourselves and poll the job FSM — never assume the async drain has run.

const POLL_INTERVAL_MS = 50
const POLL_TIMEOUT_MS = 60_000
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** Read one job's current FSM status (the gold/silver SSOT, stats_stage.submission). */
export async function readStatus(db: Queryable, jobId: string): Promise<SubmissionStatus> {
  const { rows } = await db.query<{ status: SubmissionStatus }>(
    `SELECT status FROM stats_stage.submission WHERE id = $1`, [jobId],
  )
  if (!rows[0]) throw new HttpError(500, `submission ${jobId} vanished mid-pipeline`)
  return rows[0].status
}

/**
 * Drive the worker, then poll one job to 'staged' (fail-fast on rejected/failed/timeout).
 * runIngestionWorker drains every claimable 'received' row and returns once none remain,
 * so the target status is normally already set when it returns; the poll is the robust
 * confirmation (and tolerates the racing setImmediate worker still committing — SKIP
 * LOCKED guarantees only one drains a given row). 'published' counts as past 'staged'.
 */
export async function driveToStaged(db: Queryable, log: IngestLogger, jobId: string): Promise<void> {
  await runIngestionWorker(db, { logger: log })
  const deadline = Date.now() + POLL_TIMEOUT_MS
  for (;;) {
    const status = await readStatus(db, jobId)
    if (status === 'staged' || status === 'published') return
    if (status === 'rejected' || status === 'failed') {
      // A reference-data submission that fails validation is a curator-facing data
      // error — surface it (fail-fast), do not silently 202. The per-row report is at
      // GET /jobs/:id/issues; here we name the kind + terminal status (RFC 9457).
      throw problem('bad-request', `canonical submission ${jobId} ${status} during staging`, {
        code: 'SUBMISSION_REJECTED',
        jobId,
        status,
      })
    }
    if (Date.now() >= deadline) {
      throw new HttpError(504, `submission ${jobId} did not reach 'staged' within ${POLL_TIMEOUT_MS / 1000}s (last: '${status}')`)
    }
    await sleep(POLL_INTERVAL_MS)
  }
}

/**
 * Submit a REFERENCE-DATA kind (codelists | displays) and drive it to PUBLISHED gold:
 * createSubmission → driveToStaged → publishSubmission (the EXISTING publish path, reused
 * — no duplicate publish logic) → confirm 'published'. This is the seed-pipeline's
 * submitAndPublish, in-process, so the classifier members exist in gold before the facts
 * that reference them validate. Returns the published KindJob.
 *
 * PARTIAL-FAILURE → RETRY → CONVERGE (the resilience fix). A canonical upload publishes
 * reference data (codelists/displays) to gold BEFORE facts. If a prior run of THIS upload
 * crashed after a reference kind published but before the facts landed, that reference
 * submission is durably 'published'. The legitimate retry re-derives the IDENTICAL reference
 * payload (same content_hash, same dataset_code) and createSubmission's Idempotent Receiver
 * refuses it with AlreadyPublishedError (409). That refusal is CORRECT about the data —
 * those exact members are already in gold — but it must NOT abort the retry: the post-
 * condition submitToGold guarantees ("this reference content is published in gold") is
 * ALREADY satisfied. So within a canonical upload an identical-already-published reference
 * payload is a CONVERGED NO-OP: we adopt the existing published job and continue to facts,
 * instead of bubbling the 409 that blocked the retry's tail. Reference data is additive and
 * compat-gated (the §4 pre-pass), so reusing it is safe — no gold mutation, no duplicate
 * publish. (Facts are NOT auto-published here; their own retry/converge is governed by the
 * curator publish gate, out of scope for this in-route orchestration.)
 */
export async function submitToGold(
  db: Queryable,
  log: IngestLogger,
  args: Parameters<typeof createSubmission>[2] & { kind: 'codelists' | 'displays' },
  publishOpts: { userId?: string },
): Promise<KindJob> {
  let jobId: string
  try {
    jobId = await createSubmission(db, log, args)
  } catch (err) {
    if (err instanceof AlreadyPublishedError) {
      // CONVERGE: the identical reference payload is already published in gold from a
      // prior (partially-failed) run of this upload. Adopt that job and skip — the retry
      // proceeds to the mint/facts tail instead of 409-ing on already-landed reference data.
      log.info(
        { kind: args.kind, existingJobId: err.existingJobId },
        'canonical upload: identical reference payload already published — converged no-op (retry resume)',
      )
      return { kind: args.kind, jobId: err.existingJobId, status: 'published', converged: true }
    }
    throw err
  }
  await driveToStaged(db, log, jobId)
  // Idempotent re-run: if the worker already advanced it past 'staged' to 'published'
  // (it cannot here, but the seed-pipeline guards this), skip the publish.
  if ((await readStatus(db, jobId)) !== 'published') {
    await publishSubmission(db, jobId, { userId: publishOpts.userId })
  }
  const status = await readStatus(db, jobId)
  if (status !== 'published') {
    throw new HttpError(500, `reference submission ${jobId} did not publish (status '${status}')`)
  }
  return { kind: args.kind, jobId, status }
}
