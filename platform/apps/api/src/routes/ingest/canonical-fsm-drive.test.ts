// ── canonical-fsm-drive — partial-failure → retry → converge (DB-free) ─────────
//
// THE RESILIENCE INVARIANT this locks (the canonical-upload partial-failure loose
// end): a canonical upload publishes reference data (codelists/displays) to gold
// BEFORE facts. If a prior run crashed AFTER a reference kind published but BEFORE
// facts landed, the reference submission is durably 'published'. The legitimate retry
// re-derives the IDENTICAL reference payload; createSubmission's Idempotent Receiver
// (keyed on content_hash + status='published' + dataset_code) raises
// AlreadyPublishedError (the 409). submitToGold must treat that as a CONVERGED NO-OP —
// adopt the existing published job and continue — so the retry's mint/facts TAIL runs
// instead of 409-ing on already-landed reference data.
//
// DB-free: a fake Queryable returns a duplicate published row for the idempotency
// probe (exactly what createSubmission queries), so the REAL createSubmission throws
// the REAL AlreadyPublishedError and submitToGold's convergence is exercised end to
// end — no mocking of the error path, no live DB.

import { describe, it, expect, vi } from 'vitest'
import { submitToGold } from './canonical-fsm-drive.js'
import type { Queryable, IngestLogger } from '../../ingest/index.js'

const log: IngestLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

const refArgs = {
  kind: 'codelists' as const,
  datasetCode: null,
  format: 'canonical-xlsx',
  payload: { classifiers: [{ dimCode: 'approach', code: 'P', label: { en: 'P' } }] },
  dryRun: false,
  source: 'canonical-upload',
}

describe('submitToGold — partial-failure retry converges (no 409, reference reused)', () => {
  it('an identical already-published reference payload → converged no-op (adopts the existing job)', async () => {
    const EXISTING = 'existing-published-job-id'
    let insertAttempted = false

    // The fake Queryable: the FIRST query createSubmission runs is the Idempotent
    // Receiver probe (SELECT … submission … status='published' …). Returning a row
    // makes the REAL createSubmission throw AlreadyPublishedError(EXISTING). Any
    // INSERT would mean we failed to converge — flag it so the test can assert none ran.
    const db: Queryable = {
      query: vi.fn(async (sql: string) => {
        if (/SELECT[\s\S]*FROM stats_stage\.submission/i.test(sql) && /status = 'published'/i.test(sql)) {
          return { rows: [{ id: EXISTING }] }
        }
        if (/INSERT INTO stats_stage\.submission/i.test(sql)) {
          insertAttempted = true
        }
        return { rows: [] }
      }) as Queryable['query'],
    }

    const job = await submitToGold(db, log, refArgs, { userId: 'curator-1' })

    // CONVERGED: the existing published job is adopted, the kind preserved, marked converged.
    expect(job).toEqual({
      kind: 'codelists',
      jobId: EXISTING,
      status: 'published',
      converged: true,
    })
    // No new submission was inserted, and no worker drain / publish was attempted —
    // the retry simply continues to its tail (mint/facts) past the no-op reference.
    expect(insertAttempted, 'must NOT re-insert a duplicate reference submission').toBe(false)
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ existingJobId: EXISTING, kind: 'codelists' }),
      expect.stringContaining('converged no-op'),
    )
  })

  it('a NON-duplicate error is NOT swallowed (fail-fast — convergence is scoped to ALREADY_PUBLISHED)', async () => {
    // The idempotency probe returns no dup → createSubmission proceeds to INSERT, which
    // we make throw a generic DB error. submitToGold must propagate it (it only converges
    // on AlreadyPublishedError; any other failure is a real fault, surfaced).
    const db: Queryable = {
      query: vi.fn(async (sql: string) => {
        if (/SELECT[\s\S]*FROM stats_stage\.submission/i.test(sql)) return { rows: [] }
        if (/INSERT INTO stats_stage\.submission/i.test(sql)) throw new Error('connection reset')
        return { rows: [] }
      }) as Queryable['query'],
    }

    await expect(submitToGold(db, log, refArgs, {})).rejects.toThrow(/connection reset/)
  })
})
