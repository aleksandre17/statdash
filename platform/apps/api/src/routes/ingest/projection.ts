// ── ingest row projection — persisted shape → wire contract (SSOT) ────────────
//
// One place maps the snake_case stats_stage.submission row to the shared camelCase
// SubmissionJob the worker writes, plus the column list every read route SELECTs.
// Kept apart so the route file holds handlers only (one concern per file).

import type {
  SubmissionJob,
  SubmissionKind,
  SubmissionStatus,
} from '../../ingest/index.js'

export interface SubmissionRowDb {
  id: string
  kind: SubmissionKind
  dataset_code: string | null
  status: SubmissionStatus
  source: string | null
  format: string | null
  submitted_by: string | null
  submitted_at: Date
  staged_at: Date | null
  published_at: Date | null
  row_count: number | null
  staged_count: number | null
  issue_count: number | null
  error_detail: string | null
  dry_run: boolean
}

/** The submission column list every read route projects (SSOT for the SELECT). */
export const SUBMISSION_COLS = `
  id, kind, dataset_code, status, source, format, submitted_by, submitted_at,
  staged_at, published_at, row_count, staged_count, issue_count, error_detail, dry_run
`

export function toJob(r: SubmissionRowDb): SubmissionJob {
  return {
    id: r.id,
    kind: r.kind,
    datasetCode: r.dataset_code ?? undefined,
    status: r.status,
    source: r.source ?? undefined,
    format: r.format ?? undefined,
    submittedBy: r.submitted_by ?? undefined,
    submittedAt: r.submitted_at,
    stagedAt: r.staged_at ?? undefined,
    publishedAt: r.published_at ?? undefined,
    rowCount: r.row_count ?? undefined,
    stagedCount: r.staged_count ?? undefined,
    issueCount: r.issue_count ?? undefined,
    errorDetail: r.error_detail ?? undefined,
    dryRun: r.dry_run,
  }
}
