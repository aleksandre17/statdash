// ── Ingest crash-recovery — reclaim stranded submissions (API-02) ─────────────
//
// The drain worker claims a submission by moving it received → parsing and
// stamping claimed_at = now() (worker.ts claimNext). The `parsing` status is the
// durable claim (the row lock is released at COMMIT). If the worker PROCESS DIES
// mid-parse, the row is left in `parsing` forever — neither `received` (so the
// boot drain never re-claims it) nor terminal. A Competing-Consumers queue needs a
// VISIBILITY TIMEOUT to recover such a claim; this is it.
//
// reclaimStrandedSubmissions re-queues any `parsing` row whose claim is older than
// `staleAfterMs` back to `received` (clearing claimed_at), so the very next drain
// re-processes it. Run at BOOT, BEFORE runIngestionWorker — a crash-recovered row
// is reclaimed and then immediately re-drained in the same boot.
//
// Idempotent + safe under concurrency: the UPDATE is WHERE-guarded on the exact
// stranded predicate, so two boots racing the sweep simply both target the same
// rows and the second is a zero-row no-op (the same optimistic-concurrency pattern
// as the publish/reject FSM guards). The threshold must exceed the longest healthy
// parse, so an actively-parsing row is never reclaimed out from under a live worker.

import type { Queryable, IngestLogger } from './types.js'
import { consoleIngestLogger } from './types.js'
import { errMsg } from './util.js'

/**
 * Default visibility timeout. A healthy parse is sub-second to a few seconds even
 * for the largest real workbook; 5 minutes is comfortably longer than any healthy
 * claim, so only a genuinely dead worker's row is reclaimed.
 */
export const DEFAULT_STALE_AFTER_MS = 5 * 60_000

export interface ReclaimOptions {
  /** A `parsing` row is stranded once its claim is older than this. */
  staleAfterMs?: number
  logger?: IngestLogger
}

/**
 * Re-queue submissions stranded in `parsing` past the visibility timeout. Returns
 * the number reclaimed. Fail-soft: a sweep failure is logged, never thrown — boot
 * proceeds (the next boot retries), mirroring the worker's fail-soft drain.
 */
export async function reclaimStrandedSubmissions(
  db: Queryable,
  opts: ReclaimOptions = {},
): Promise<{ reclaimed: number }> {
  const log = opts.logger ?? consoleIngestLogger
  const staleAfterMs = opts.staleAfterMs ?? DEFAULT_STALE_AFTER_MS
  // Seconds for the interval literal (Postgres make_interval takes integers).
  const staleSeconds = Math.max(1, Math.ceil(staleAfterMs / 1000))

  try {
    const { rows } = await db.query<{ id: string }>(
      `UPDATE stats_stage.submission
          SET status = 'received', claimed_at = NULL
        WHERE status = 'parsing'
          AND claimed_at IS NOT NULL
          AND claimed_at < now() - make_interval(secs => $1)
        RETURNING id`,
      [staleSeconds],
    )
    if (rows.length > 0) {
      log.warn(
        { reclaimed: rows.length, ids: rows.map((r) => r.id), staleSeconds },
        'ingest reclaim: re-queued stranded parsing submissions (worker crash-recovery)',
      )
    } else {
      log.info({ staleSeconds }, 'ingest reclaim: no stranded submissions')
    }
    return { reclaimed: rows.length }
  } catch (err) {
    log.error({ error: errMsg(err) }, 'ingest reclaim: sweep failed (continuing boot)')
    return { reclaimed: 0 }
  }
}
