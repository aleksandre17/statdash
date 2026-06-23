// ── ingestRoutes — Staged Submission Pipeline HTTP entry point [V11] ───────────
//
// The boundary in front of the Medallion pipeline (bronze → silver → gold):
//
//   POST /facts|/codelists|/displays  accept a payload → write BRONZE (submission +
//                                     submission_blob) → fire the worker (async) →
//                                     202 with the jobId. The HTTP request NEVER
//                                     waits on parse/conform/validate (which can run
//                                     for seconds): the worker drains it out-of-band.
//   GET  /jobs, /jobs/:id, .../issues read the job FSM + the validation report.
//   POST /jobs/:id/publish            the approval gate → gold promotion.
//   POST /jobs/:id/reject             the curator's terminal "no".
//
// AUTH (own scope, two-layer, fail-fast — never nested under adminRoutes so this
// plugin is self-contained and independently testable; mirrors data-sources):
//   1. authPlugin   — Bearer JWT or 401 (who are you?).
//   2. requireWrite — a per-route onRequest gate: the mutating routes (submit,
//      publish, reject) demand 'admin' OR 'editor' (curator-level); the read
//      routes (list/status/issues) need only a valid token. 401 vs 403 kept
//      distinct (RFC 7235): 401 = no/invalid token, 403 = valid token, wrong role.
//
// IDEMPOTENT RECEIVER (EIP): every payload is content-hashed (SHA-256). If an
// IDENTICAL payload was already PUBLISHED for the same dataset, re-submission is a
// double-publish hazard → 409 ALREADY_PUBLISHED with the prior jobId, BEFORE any
// bronze write. (We guard the published terminal state, not in-flight dupes — a
// retried upload after a transient failure must be allowed to proceed.)

import type { FastifyPluginAsync } from 'fastify'
import { ok, parseBody, parseParams, parseQuery, HttpError, notFound } from '../../lib/http.js'
import { authPlugin } from '../../auth.js'
import type { AuditLogger } from '../../lib/audit-log.js'
import { publishSubmission, createSubmission, AlreadyPublishedError } from '../../ingest/index.js'
import type {
  SubmissionStatus,
  ValidationIssue,
  IssueSeverity,
} from '../../ingest/index.js'
import { FactsBody, CodelistsBody, DisplaysBody, JobsQuery, IdParam, IssuesQuery } from './schemas.js'
import { SUBMISSION_COLS, toJob, type SubmissionRowDb } from './projection.js'

// ── Curator-write role gate (admin OR editor) ─────────────────────────────────
// ingest is a data-curation surface, not a governance one: an editor curates data
// loads, an admin also can. viewer is read-only. Reused by every mutating route.
const WRITE_ROLES = ['admin', 'editor'] as const

function requireWrite(roles: string[] | undefined): void {
  const r = roles ?? []
  if (!WRITE_ROLES.some((role) => r.includes(role))) {
    throw new HttpError(403, 'admin or editor role required')
  }
}

// Factory: the AuditLogger is injected (port) so curator publish/reject actions
// are recorded into the governance trail [N41] — same pattern as configRoutes /
// snapshotsRoutes / embedRoutes. Optional so callers/tests without an audit
// logger still compile; a missing logger just skips the (best-effort) record.
export const ingestRoutes = (audit?: AuditLogger): FastifyPluginAsync => async (app) => {
  await app.register(authPlugin)

  // ── Submission creation (shared by the three submit routes — Strategy by kind) ─
  // Delegates to the one authoritative createSubmission service (SSOT for the bronze
  // write + idempotency guard, shared with the curator CSV import route). The HTTP
  // boundary's only added job is mapping AlreadyPublishedError → the 409 contract
  // clients already depend on ({ code: 'ALREADY_PUBLISHED', existingJobId }).
  async function submit(args: Parameters<typeof createSubmission>[2]): Promise<string> {
    try {
      return await createSubmission(app.pg, app.log, args)
    } catch (err) {
      if (err instanceof AlreadyPublishedError) {
        throw new HttpError(
          409,
          JSON.stringify({ code: 'ALREADY_PUBLISHED', existingJobId: err.existingJobId }),
        )
      }
      throw err
    }
  }

  // POST /facts — submit observation data (kind='facts', dataset-scoped).
  app.post('/facts', { onRequest: async (req) => requireWrite(req.jwtPayload?.roles) }, async (req, reply) => {
    const body = parseBody(FactsBody, req.body)
    const id = await submit({
      kind: 'facts',
      datasetCode: body.datasetCode,
      format: body.format,
      payload: body.payload,
      dryRun: body.dryRun,
      source: body.source,
      submittedBy: req.jwtPayload?.sub,
    })
    return reply.status(202).send(ok({ jobId: id }))
  })

  // POST /codelists — submit classifier/codelist data (kind='codelists', cross-dataset).
  app.post('/codelists', { onRequest: async (req) => requireWrite(req.jwtPayload?.roles) }, async (req, reply) => {
    const body = parseBody(CodelistsBody, req.body)
    const id = await submit({
      kind: 'codelists',
      datasetCode: null, // codelists span dimensions, not one dataset (DB chk enforces NULL)
      format: body.format,
      payload: body.payload,
      dryRun: body.dryRun,
      source: body.source,
      submittedBy: req.jwtPayload?.sub,
    })
    return reply.status(202).send(ok({ jobId: id }))
  })

  // POST /displays — submit display overlay data (kind='displays', cross-dataset).
  app.post('/displays', { onRequest: async (req) => requireWrite(req.jwtPayload?.roles) }, async (req, reply) => {
    const body = parseBody(DisplaysBody, req.body)
    const id = await submit({
      kind: 'displays',
      datasetCode: null,
      format: body.format,
      payload: body.payload,
      dryRun: body.dryRun,
      source: body.source,
      submittedBy: req.jwtPayload?.sub,
    })
    return reply.status(202).send(ok({ jobId: id }))
  })

  // GET /jobs — recent jobs for the admin dashboard (most-recent-first, bounded).
  // Read-only: any authenticated identity may view the job queue.
  app.get('/jobs', async (req) => {
    const { status, kind, limit } = parseQuery(JobsQuery, req.query)
    // Optional filters compiled into the WHERE so the index (idx_submission_status
    // / idx_submission_kind) is usable; a NULL param matches every row.
    const { rows } = await app.pg.query<SubmissionRowDb>(
      `SELECT ${SUBMISSION_COLS}
         FROM stats_stage.submission
        WHERE ($1::text IS NULL OR status = $1)
          AND ($2::text IS NULL OR kind   = $2)
        ORDER BY submitted_at DESC
        LIMIT $3`,
      [status ?? null, kind ?? null, limit],
    )
    return ok({ jobs: rows.map(toJob) })
  })

  // GET /jobs/:id — poll one job's status + its issue tally + the publish gate.
  app.get('/jobs/:id', async (req) => {
    const { id } = parseParams(IdParam, req.params)

    const { rows } = await app.pg.query<SubmissionRowDb>(
      `SELECT ${SUBMISSION_COLS} FROM stats_stage.submission WHERE id = $1`,
      [id],
    )
    const row = rows[0]
    if (!row) throw notFound('Submission')

    // Tally issues by severity in one grouped scan (idx_issue_sub_severity).
    const { rows: sev } = await app.pg.query<{ severity: IssueSeverity; n: string }>(
      `SELECT severity, count(*)::text AS n
         FROM stats_stage.validation_issue
        WHERE submission_id = $1
        GROUP BY severity`,
      [id],
    )
    const issuesBySeverity = { error: 0, warn: 0, info: 0 }
    for (const s of sev) issuesBySeverity[s.severity] = Number(s.n)

    // canPublish mirrors publishSubmission's precondition exactly (staged + no
    // error-severity issue) so the UI's gate and the server's gate cannot diverge.
    const canPublish = row.status === 'staged' && issuesBySeverity.error === 0

    return ok({ job: toJob(row), issuesBySeverity, canPublish })
  })

  // GET /jobs/:id/issues — the full per-row validation report (optional severity filter).
  app.get('/jobs/:id/issues', async (req) => {
    const { id } = parseParams(IdParam, req.params)
    const { severity } = parseQuery(IssuesQuery, req.query)

    const { rows } = await app.pg.query<{
      submission_id: string
      layer: ValidationIssue['layer']
      row_index: number | null
      severity: IssueSeverity
      code: ValidationIssue['code']
      detail: Record<string, unknown>
    }>(
      `SELECT submission_id, layer, row_index, severity, code, detail
         FROM stats_stage.validation_issue
        WHERE submission_id = $1
          AND ($2::text IS NULL OR severity = $2)
        ORDER BY severity, row_index NULLS FIRST`,
      [id, severity ?? null],
    )

    const issues: ValidationIssue[] = rows.map((r) => ({
      submissionId: r.submission_id,
      layer: r.layer,
      rowIndex: r.row_index ?? undefined,
      severity: r.severity,
      code: r.code,
      detail: r.detail,
    }))
    return ok({ issues })
  })

  // POST /jobs/:id/publish — the approval gate → gold promotion (curator action).
  // Preconditions are re-checked server-side (status='staged' AND zero error
  // issues): the client's canPublish is advisory, the server is authoritative.
  // 409 (Conflict) is the correct status for "the resource is not in a state that
  // permits this action" — not 400 (the request was well-formed).
  app.post('/jobs/:id/publish', { onRequest: async (req) => requireWrite(req.jwtPayload?.roles) }, async (req) => {
    const { id } = parseParams(IdParam, req.params)

    const { rows } = await app.pg.query<{ status: SubmissionStatus }>(
      `SELECT status FROM stats_stage.submission WHERE id = $1`,
      [id],
    )
    const row = rows[0]
    if (!row) throw notFound('Submission')
    if (row.status !== 'staged') {
      throw new HttpError(409, `submission is '${row.status}', not 'staged' — cannot publish`)
    }

    const { rows: err } = await app.pg.query<{ n: string }>(
      `SELECT count(*)::text AS n
         FROM stats_stage.validation_issue
        WHERE submission_id = $1 AND severity = 'error'`,
      [id],
    )
    if (Number(err[0].n) > 0) {
      throw new HttpError(409, `submission has ${err[0].n} error-severity issue(s) — cannot publish`)
    }

    // publishSubmission owns its transaction + the FSM transition (staged →
    // publishing → published/failed). It re-asserts status='staged' internally
    // (defense in depth: a race between our check and its txn is caught there).
    // DI-14b: the audit record is emitted INSIDE publishSubmission, only after a
    // committed (non-dry-run) publish — the route just supplies the actor + sink.
    const result = await publishSubmission(app.pg, id, { userId: req.jwtPayload?.sub, audit })
    return ok(result)
  })

  // POST /jobs/:id/reject — the curator's terminal "no" on a staged job. The
  // status guard is IN the UPDATE (WHERE status='staged') so a concurrent publish
  // cannot be clobbered: zero rows updated ⇒ the job was not staged ⇒ 409.
  app.post('/jobs/:id/reject', { onRequest: async (req) => requireWrite(req.jwtPayload?.roles) }, async (req) => {
    const { id } = parseParams(IdParam, req.params)

    const { rows } = await app.pg.query<{ id: string; status: SubmissionStatus }>(
      `UPDATE stats_stage.submission
          SET status = 'rejected'
        WHERE id = $1 AND status = 'staged'
        RETURNING id, status`,
      [id],
    )
    const updated = rows[0]
    if (!updated) {
      // Distinguish "no such job" (404) from "wrong state" (409) for a precise
      // client signal rather than a single ambiguous failure.
      const { rows: exists } = await app.pg.query<{ status: SubmissionStatus }>(
        `SELECT status FROM stats_stage.submission WHERE id = $1`,
        [id],
      )
      if (!exists[0]) throw notFound('Submission')
      throw new HttpError(409, `submission is '${exists[0].status}', not 'staged' — cannot reject`)
    }
    // DI-14b — record the curator's terminal "no" on the governance trail. The
    // UPDATE already committed (single statement), so this is best-effort: audit
    // is fire-and-forget and must never turn a successful reject into a failure.
    try {
      audit?.log({
        userId:   req.jwtPayload?.sub,
        action:   'ingest.reject',
        resource: updated.id,
        payload:  { status: updated.status },
      })
    } catch { /* audit is best-effort; a successful reject must not fail here */ }
    return ok({ id: updated.id, status: updated.status })
  })
}
