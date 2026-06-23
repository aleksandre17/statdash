// ── createSubmission — the one bronze-write entry point into the pipeline ──────
//
// Submission creation (idempotency guard → bronze write → fire-and-forget worker)
// is a SINGLE capability with one authoritative implementation. Every HTTP surface
// that feeds the Staged Submission Pipeline (the JSON ingest routes AND the curator
// CSV import route) calls THIS — never a copy. SSOT: the idempotency rule and the
// bronze contract live in one place, so they cannot drift between callers.
//
// Extracted from ingestRoutes' closure so a second caller (admin/displays import)
// reuses it (DRY, root-cause) rather than duplicating the bronze write. Depends on
// the narrow Queryable port + IngestLogger port — never on Fastify or the pg driver
// concretes (Dependency Inversion).

import { createHash } from 'node:crypto'
import { runIngestionWorker } from './worker.js'
import type { Queryable, IngestLogger, SubmissionKind } from './types.js'

// ── Content hash (SHA-256 of the canonical JSON payload) ──────────────────────
// The bronze content_hash + idempotency key. JSON.stringify is the same
// serialization parseBronze round-trips, so the stored raw_content and the hash
// describe exactly the same bytes (no drift between them).
export function contentHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

/** Thrown when an IDENTICAL payload was already published for the same dataset. */
export class AlreadyPublishedError extends Error {
  readonly existingJobId: string
  constructor(existingJobId: string) {
    super('payload already published')
    this.name = 'AlreadyPublishedError'
    this.existingJobId = existingJobId
  }
}

export interface CreateSubmissionArgs {
  kind: SubmissionKind
  datasetCode: string | null
  format: string
  payload: unknown
  dryRun: boolean
  source?: string
  submittedBy?: string
}

/**
 * Idempotency guard → bronze write (submission + blob) → fire-and-forget worker.
 * Returns the new jobId. datasetCode is non-null only for kind='facts' (the
 * submission_facts_dataset_chk enforces the same invariant at the DB boundary).
 *
 * Throws AlreadyPublishedError if an identical payload is already published for the
 * same dataset (the HTTP boundary maps it to 409). The worker drain runs out of band
 * via setImmediate: the caller returns immediately and a worker failure is logged,
 * never surfaced — the job is durably 'received' and the next trigger retries.
 */
export async function createSubmission(
  db: Queryable,
  log: IngestLogger,
  args: CreateSubmissionArgs,
): Promise<string> {
  const hash = contentHash(args.payload)

  // Idempotent Receiver: refuse a re-publish of an identical already-published
  // payload for the same dataset. dataset_code is part of the identity (the same
  // bytes published to a different dataset is a legitimately different load). We
  // guard the published terminal state, not in-flight dupes — a retried upload
  // after a transient failure must be allowed to proceed.
  const { rows: dup } = await db.query<{ id: string }>(
    `SELECT s.id
       FROM stats_stage.submission s
       JOIN stats_stage.submission_blob b ON b.submission_id = s.id
      WHERE b.content_hash = $1
        AND s.status = 'published'
        AND s.dataset_code IS NOT DISTINCT FROM $2
      ORDER BY s.published_at DESC
      LIMIT 1`,
    [hash, args.datasetCode],
  )
  if (dup[0]) throw new AlreadyPublishedError(dup[0].id)

  const raw = JSON.stringify(args.payload)
  const byteSize = Buffer.byteLength(raw, 'utf8')

  // Bronze write: the job header + the immutable raw blob. Two statements; the blob
  // FK (ON DELETE CASCADE) ties them. A worker can only claim a 'received' row, and
  // the blob is written before we return, so by the time the async trigger fires the
  // bronze record is durable.
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO stats_stage.submission (kind, dataset_code, format, source, submitted_by, dry_run)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [args.kind, args.datasetCode, args.format, args.source ?? null, args.submittedBy ?? null, args.dryRun],
  )
  const id = rows[0].id

  await db.query(
    `INSERT INTO stats_stage.submission_blob (submission_id, content_hash, raw_content, byte_size)
     VALUES ($1, $2, $3, $4)`,
    [id, hash, raw, byteSize],
  )

  // Fire-and-forget the worker: the caller returns immediately and the drain runs
  // out of band. setImmediate detaches it from the request lifecycle; a worker
  // failure is logged, never surfaced — the job is durably 'received' and the next
  // trigger (or a boot drain) retries.
  setImmediate(() => {
    runIngestionWorker(db, { logger: log })
      .catch((err) => log.error({ err, jobId: id }, 'ingest worker (route-triggered) failed'))
  })

  return id
}
