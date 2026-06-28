// ── Ingest — job FSM worker (drain received → staged) ─────────────────────────
//
// Pipe-and-Filter orchestrator + Competing-Consumers claim. Drains `received`
// submissions through parse → conform → validate, persisting the silver rows and
// the issue report, and advancing the job to `staged` (ready for the approval gate
// + publish) or `rejected` (validation found error-severity issues).
//
// THE DB IS THE QUEUE: no external broker. A claim uses
//   SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1
// so concurrent workers (or a boot worker + a manually-triggered one) never grab
// the same submission. One submission at a time avoids silver-layer contention.
//
// FAIL-SOFT (graceful degradation): a single failed submission is marked `failed`
// and the loop continues to the next — one bad file never blocks the queue. This
// mirrors the provisioning loader's fail-soft contract.
//
// Called at boot (after runProvisioning) and triggerable manually (e.g. a route or
// a CI step). Returns when no `received` submission remains claimable.

import type {
  Queryable, QueryableClient, IngestLogger,
  SubmissionKind, RawObsRow, RawClassifierRow, RawDisplayRow,
  StagedObsRow, StagedClassifierRow, StagedDisplayRow,
  ValidationIssue, PublishPreview,
} from './types.js'
import { consoleIngestLogger } from './types.js'
import { conformObsRows } from './conform.js'
import { validateObs, validateClassifiers, validateDisplays } from './validate.js'
import { runFactRules } from './validate-integrity.js'
import { errMsg, normalizeObsStatus } from './util.js'

interface ClaimedSubmission {
  id: string
  kind: SubmissionKind
  dataset_code: string | null
}

/**
 * Drain every claimable `received` submission to `staged`/`rejected`.
 * Processes one at a time; returns the number of submissions processed.
 */
export async function runIngestionWorker(
  db: Queryable,
  opts: { logger?: IngestLogger } = {},
): Promise<{ processed: number }> {
  const log = opts.logger ?? consoleIngestLogger
  if (!db.connect) throw new Error('runIngestionWorker requires a Queryable with connect() (a pool)')

  let processed = 0
  // Drain loop: claim → process → repeat until nothing left to claim.
  for (;;) {
    const claimed = await claimNext(db, log)
    if (!claimed) break
    await processOne(db, claimed, log)
    processed++
  }
  log.info({ processed }, 'ingest worker: drain complete')
  return { processed }
}

/**
 * Atomically claim the next `received` submission: FOR UPDATE SKIP LOCKED moves it
 * to `parsing` so a sibling worker skips it. The row lock is released at COMMIT;
 * the `parsing` status is the durable claim that survives the lock.
 */
async function claimNext(db: Queryable, log: IngestLogger): Promise<ClaimedSubmission | null> {
  const client = await db.connect!()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query<ClaimedSubmission>(
      `SELECT id, kind, dataset_code
         FROM stats_stage.submission
        WHERE status = 'received'
        ORDER BY submitted_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1`,
    )
    const claimed = rows[0]
    if (!claimed) {
      await client.query('ROLLBACK')
      return null
    }
    // Stamp claimed_at = now() with the status flip (API-02): the visibility-timeout
    // marker the boot reclaim sweep reads to recover a row stranded by a worker crash.
    await client.query(`UPDATE stats_stage.submission SET status = 'parsing', claimed_at = now() WHERE id = $1`, [claimed.id])
    await client.query('COMMIT')
    log.info({ id: claimed.id, kind: claimed.kind }, 'ingest worker: claimed submission')
    return claimed
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    log.error({ error: errMsg(err) }, 'ingest worker: claim failed')
    return null
  } finally {
    client.release()
  }
}

/**
 * Run one submission through parse → conform → validate → persist (silver + issues),
 * then set the terminal staging status. Fail-soft: any throw marks the job `failed`
 * and the drain loop continues.
 */
async function processOne(db: Queryable, sub: ClaimedSubmission, log: IngestLogger): Promise<void> {
  const client = await db.connect!()
  try {
    await client.query('BEGIN')

    // Silver rows are persisted inside runFilters (a single bulk INSERT per kind
    // into stats_stage.*_staging); here we record the issue report and set the
    // terminal staging status.
    const { issues, preview, staged } = await runFilters(client, sub)
    await persistIssues(client, sub.id, issues)

    // Validation outcome → terminal staging status. error-severity ⇒ rejected
    // (cannot publish); otherwise staged (ready for the approval gate).
    const status = preview.canPublish ? 'staged' : 'rejected'
    // Clear the claim stamp on the terminal staging transition — the row is no
    // longer in-flight, so it must not look stranded to the reclaim sweep (API-02).
    await client.query(
      `UPDATE stats_stage.submission
          SET status = $2, staged_at = now(), staged_count = $3, issue_count = $4, claimed_at = NULL
        WHERE id = $1`,
      [sub.id, status, staged.count, issues.length],
    )
    await client.query('COMMIT')
    log.info({ id: sub.id, status, ...preview }, 'ingest worker: submission processed')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    await db.query(
      `UPDATE stats_stage.submission SET status = 'failed', error_detail = $2, claimed_at = NULL WHERE id = $1`,
      [sub.id, errMsg(err)],
    ).catch(() => {})
    log.error({ id: sub.id, error: errMsg(err) }, 'ingest worker: submission failed')
  } finally {
    client.release()
  }
}

// ── Bronze parse (submission_blob.raw_content → in-memory canonical rows) ──────
//
// V11 stores the raw payload as ONE bronze row (stats_stage.submission_blob), not
// per-row *_raw tables. The parse stage reads that blob and deserializes it into the
// canonical Raw*Row[] shapes the conform/validate filters consume — entirely in
// memory. The blob is the application-canonical parsed payload (the upload/registry
// path serializes the rows it parsed into raw_content as JSON); a malformed blob
// fails fast here and the job is marked `failed` by processOne's catch.

interface BronzePayload {
  obs?: RawObsRow[]
  classifiers?: RawClassifierRow[]
  displays?: RawDisplayRow[]
}

/** Read the single bronze blob for a submission and parse raw_content as JSON. */
async function parseBronze(client: QueryableClient, submissionId: string): Promise<BronzePayload> {
  const { rows } = await client.query<{ raw_content: string }>(
    `SELECT raw_content
       FROM stats_stage.submission_blob
      WHERE submission_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [submissionId],
  )
  const blob = rows[0]
  if (!blob) throw new Error(`submission ${submissionId} has no bronze blob`)
  let parsed: unknown
  try {
    parsed = JSON.parse(blob.raw_content)
  } catch (err) {
    throw new Error(`submission ${submissionId} blob is not valid JSON: ${errMsg(err)}`)
  }
  if (parsed == null || typeof parsed !== 'object') {
    throw new Error(`submission ${submissionId} blob is not an object payload`)
  }
  return parsed as BronzePayload
}

// ── Filter dispatch (Strategy by kind) ────────────────────────────────────────

interface FilterResult {
  issues: ValidationIssue[]
  preview: PublishPreview
  staged: { count: number }
}

/**
 * parse (bronze blob → in-memory rows) → conform (in memory) → validate (batch DB
 * lookups) → single bulk INSERT of the conformed silver rows into the matching
 * stats_stage.*_staging table. There is NO intermediate *_raw table: the raw payload
 * is the bronze blob; the conform step replaces the old two-table design. Returns
 * issues + preview + the staged row count.
 */
async function runFilters(client: QueryableClient, sub: ClaimedSubmission): Promise<FilterResult> {
  const payload = await parseBronze(client, sub.id)

  if (sub.kind === 'facts') {
    if (!sub.dataset_code) throw new Error(`facts submission ${sub.id} has no dataset_code`)
    const raw = payload.obs ?? []
    const conformed = await conformObsRows(client, sub.id, sub.dataset_code, raw)
    const validated = await validateObs(client, sub.id, sub.dataset_code, conformed.rows)

    // Integrity rules (validation-as-data) run AFTER the schema validator, over the
    // conformed silver rows. Two severities (DC-02): a 'warn' rule surfaces a DQAF gap
    // with offending rows but does not block; an 'error' rule (a declared accounting
    // identity) persists an error-severity ACCOUNTING_IDENTITY issue. Schema errors
    // reject at INGEST (the row cannot stage, via validateObs → canPublish); an
    // accounting-identity error does NOT change staging (the row is structurally valid)
    // but BLOCKS the PUBLISH gate — assertPublishableIdentities reads the persisted issue
    // at publish and rejects with the RFC-9457 422. So a violating submission reaches
    // 'staged' yet is un-publishable (GET /jobs/:id reports canPublish=false).
    const ruleIssues = runFactRules(sub.id, sub.dataset_code, conformed.rows)

    // Single write: the conformed silver rows land in stats_stage.obs_staging.
    await insertStagedObs(client, sub.id, conformed.rows)

    return {
      issues: [...conformed.issues, ...validated.issues, ...ruleIssues],
      preview: validated.preview,
      staged: { count: conformed.rows.length },
    }
  }

  if (sub.kind === 'codelists') {
    const staged: StagedClassifierRow[] = payload.classifiers ?? []
    const validated = await validateClassifiers(client, sub.id, staged)
    await insertStagedClassifiers(client, sub.id, staged)
    return { issues: validated.issues, preview: validated.preview, staged: { count: staged.length } }
  }

  // displays
  const staged: StagedDisplayRow[] = payload.displays ?? []
  const validated = await validateDisplays(client, sub.id, staged)
  await insertStagedDisplays(client, sub.id, staged)
  return { issues: validated.issues, preview: validated.preview, staged: { count: staged.length } }
}

// ── Silver persistence (conformed rows → stats_stage.*_staging) ───────────────
// Idempotent per submission: DELETE the prior staging rows (a re-drain after a
// failed attempt) then bulk INSERT. Column lists match V11 exactly.

async function insertStagedObs(client: QueryableClient, submissionId: string, rows: StagedObsRow[]): Promise<void> {
  await client.query(`DELETE FROM stats_stage.obs_staging WHERE submission_id = $1`, [submissionId])
  for (const r of rows) {
    await client.query(
      `INSERT INTO stats_stage.obs_staging (submission_id, dataset_code, time_period, dim_key, obs_value, obs_status, obs_attribute, row_index)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::jsonb, $8)`,
      [submissionId, r.datasetCode, r.timePeriod, JSON.stringify(r.dimKey), r.obsValue, normalizeObsStatus(r.obsStatus), JSON.stringify(r.obsAttribute ?? {}), r.rowIndex],
    )
  }
}

async function insertStagedClassifiers(client: QueryableClient, submissionId: string, rows: StagedClassifierRow[]): Promise<void> {
  await client.query(`DELETE FROM stats_stage.classifier_staging WHERE submission_id = $1`, [submissionId])
  for (const r of rows) {
    await client.query(
      `INSERT INTO stats_stage.classifier_staging (submission_id, dim_code, code, label, parent_code, ord, metadata, row_index)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::jsonb, $8)`,
      [submissionId, r.dimCode, r.code, JSON.stringify(r.label), r.parentCode ?? null, r.ord ?? 0, JSON.stringify(r.metadata ?? {}), r.rowIndex],
    )
  }
}

async function insertStagedDisplays(client: QueryableClient, submissionId: string, rows: StagedDisplayRow[]): Promise<void> {
  await client.query(`DELETE FROM stats_stage.display_staging WHERE submission_id = $1`, [submissionId])
  for (const r of rows) {
    await client.query(
      `INSERT INTO stats_stage.display_staging (submission_id, dim_code, code, locale, display, row_index)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [submissionId, r.dimCode, r.code, r.locale, JSON.stringify(r.display), r.rowIndex],
    )
  }
}

// ── Issue persistence ─────────────────────────────────────────────────────────

async function persistIssues(client: QueryableClient, submissionId: string, issues: ValidationIssue[]): Promise<void> {
  await client.query(`DELETE FROM stats_stage.validation_issue WHERE submission_id = $1`, [submissionId])
  for (const i of issues) {
    await client.query(
      `INSERT INTO stats_stage.validation_issue (submission_id, layer, row_index, severity, code, detail)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [submissionId, i.layer, i.rowIndex ?? null, i.severity, i.code, JSON.stringify(i.detail)],
    )
  }
}
