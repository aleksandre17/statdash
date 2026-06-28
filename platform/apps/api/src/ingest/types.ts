// ── Ingest — Staged Submission Pipeline contracts (ports + shapes) ────────────
//
// The shared types for the staged ingestion pipeline (Medallion + Pipe-and-Filter):
//
//   Bronze (raw) → parse → conform → validate → Silver (staged) → PUBLISH → Gold (stats.*)
//
// Kept separate from logic so every filter (conform/validate) and the publish
// service share ONE source of truth for the row shapes and the issue contract.
// Mirrors the provisioning/types.ts split: a narrow DB port (Dependency Inversion)
// + the boundary data shapes + the result/report types.
//
// The persisted side of these types mirrors the `stats_stage.*` schema introduced
// by the staging migration (V11+). The TS shapes are the application-layer view of
// those rows; the SQL columns are the SSOT. Postel's law at the boundary: optional
// fields tolerate columns that are NULL until a later lifecycle stage populates them.

// ── Port (Dependency Inversion) ───────────────────────────────────────────────
// Identical surface to provisioning's port, restated here so the ingest module
// depends on its own contract (no import against a sibling feature). @fastify/
// postgres' app.pg and a single PoolClient both satisfy this structurally; a fake
// satisfies it in tests. Every filter/service depends on this, never on the driver.

/** A pooled client for a single transactional unit of work (publish path). */
export interface QueryableClient {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
  release(): void
}

/** The narrow Postgres surface the pipeline reads/writes. */
export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
  /** Present on a Pool (not on a single client). Publish opens its own transaction. */
  connect?(): Promise<QueryableClient>
}

/**
 * Structured logger port (subset of Fastify's logger). Defaults to console so the
 * worker is usable from scripts/CI without a Fastify app. Pass app.log at boot.
 */
export interface IngestLogger {
  info(obj: unknown, msg?: string): void
  warn(obj: unknown, msg?: string): void
  error(obj: unknown, msg?: string): void
}

export const consoleIngestLogger: IngestLogger = {
  info:  (o, m) => console.log(m ?? '', o),
  warn:  (o, m) => console.warn(m ?? '', o),
  error: (o, m) => console.error(m ?? '', o),
}

// ── Submission job (mirrors stats_stage.submission) ───────────────────────────
// The unit the worker FSM drains. snake_case columns map to these camelCase
// fields in the worker's row reader. Optional fields are populated as the job
// advances through the lifecycle (received → staged → published).

export type SubmissionKind = 'facts' | 'codelists' | 'displays'

export type SubmissionStatus =
  | 'received' | 'parsing' | 'staged' | 'publishing'
  | 'published' | 'failed' | 'rejected'

export interface SubmissionJob {
  id: string
  kind: SubmissionKind
  datasetCode?: string
  status: SubmissionStatus
  source?: string
  format?: string
  submittedBy?: string
  submittedAt: Date
  stagedAt?: Date
  publishedAt?: Date
  rowCount?: number
  stagedCount?: number
  issueCount?: number
  errorDetail?: string
  dryRun: boolean
  /** ADR-0025 — the publication-event release this submission is bundled into
   *  (nullable: the single-submission path auto-opens a singleton at publish). */
  releaseId?: string
  /** ADR-0031 improvement 4 — SHA-256 of the SOURCE bytes (the workbook), distinct
   *  from the bronze content_hash of the JSON payload. Nullable (V32). */
  sourceDigest?: string
  /** ADR-0031 improvement 4 — W3C PROV lineage bag (parserVersion, sourceDigest,
   *  sourceFilename, mappingId, rulesetId). Nullable JSONB (V32). The PROV graph is
   *  DERIVABLE from this + the release/revision spine — no parallel store. */
  provenance?: Record<string, unknown>
}

// ── Release (ADR-0025 — vintage-as-release) ───────────────────────────────────
// A publication-event AGGREGATE (SDMX/ECB sense): a named release bundles 1..N
// submissions (revised facts + codelists + displays). It is the durable vintage
// key — observation.release_id / observation_revision.{set_by,superseded_by}
// reference it, so "the series AS PUBLISHED on date D" reconstructs from the
// release publish times. Mirrors stats.release (V25). published_at is the as-of
// anchor; it is set when the release is published and is null while open.

export type ReleaseStatus = 'open' | 'published' | 'superseded'

export interface Release {
  id: string
  /** i18n display label, { ka: '…', en: '…' } — JSONB in gold. */
  label: Record<string, string>
  /** Nullable: a cross-dataset release (codelists/displays) is not dataset-scoped. */
  datasetCode: string | null
  status: ReleaseStatus
  /** True for the one current published release per dataset (partial unique index). */
  isCurrent: boolean
  openedAt: Date
  /** Null while open; the atomic vintage anchor once published. */
  publishedAt: Date | null
  openedBy: string | null
  note: string | null
}

// ── Bronze — raw canonical rows after parsing (before conform) ────────────────

export interface RawObsRow {
  timePeriod: string
  dimKey: Record<string, string>   // may contain surrogate IDs at this stage
  obsValue: number | null
  obsStatus?: string
  obsAttribute?: Record<string, unknown>
  rowIndex: number
}

export interface RawClassifierRow {
  dimCode: string
  code: string
  label: Record<string, string>    // { ka: '...', en: '...' }
  parentCode?: string
  ord?: number
  metadata?: Record<string, unknown>
  rowIndex: number
}

export interface RawDisplayRow {
  dimCode: string
  code: string
  locale: string
  display: Record<string, unknown>
  rowIndex: number
}

// ── Silver — staged rows after conform (ready for staging / publish) ──────────

export interface StagedObsRow extends Omit<RawObsRow, 'dimKey'> {
  datasetCode: string
  dimKey: Record<string, string>   // codes only after conform
}

export type StagedClassifierRow = RawClassifierRow

export type StagedDisplayRow = RawDisplayRow

// ── Validation — per-row diagnostic report ────────────────────────────────────

export type IssueSeverity = 'error' | 'warn' | 'info'
export type IssueLayer = 'conform' | 'validate'

/** Stable issue codes — a closed vocabulary so the approver UI can map/i18n them. */
export type IssueCode =
  // conform
  | 'UNKNOWN_SURROGATE'   // dim_key value looked like a surrogate id but resolved to nothing
  | 'INVALID_TIME'        // time_period failed the SDMX format regex
  // validate — obs
  | 'UNKNOWN_DATASET'     // dataset_code not in stats.dataset
  | 'DIM_KEY_MISMATCH'    // dim_key keys != the dataset DSD (set inequality)
  | 'UNKNOWN_DIM'         // a dim_key key is not a declared dimension for the dataset
  | 'UNKNOWN_CODE'        // a dim_key value is not a stats.classifier member for that dim
  | 'ILLEGAL_COMBINATION' // dim_key values are each valid but the COMBINATION is outside the dataset's allowed cube region (ADR-0027)
  | 'INVALID_VALUE'       // obs_value is neither numeric nor null
  // validate — classifiers
  | 'UNKNOWN_DIM_CODE'    // dim_code not in stats.dimension
  | 'UNKNOWN_PARENT'      // parent_code resolves neither in-submission nor in gold
  | 'MISSING_LABEL'       // label has no ka/en locale key
  // validate — displays
  | 'UNKNOWN_MEMBER'      // (dim_code, code) does not resolve to a classifier member
  | 'UNKNOWN_LOCALE'      // locale is not a known locale
  | 'EMPTY_DISPLAY'       // display is not a non-empty object
  // validate — DQAF integrity rules (ADR-0031 §4 improvement 3, validation-as-data).
  // warn-severity (DQAF = surface, never silently drop): a rounding-level gap is
  // reported with the offending rows but does NOT block publish — only a schema
  // error does. The evaluator (ingest/rules/) dispatches these on RuleSpec.kind.
  | 'BALANCE_MISMATCH'    // Σ(lhs side) ≉ Σ(rhs) within ε for a balance-rule group
  | 'IDENTITY_MISMATCH'   // two approaches to the same aggregate disagree beyond ε
  | 'TOTAL_RECONCILE'     // Σ(parts) ≉ the declared total within ε
  // validate — accounting-identity gate (DC-02, Law 9). The SIGNED national-accounts
  // identity lhs ≈ Σ(coefᵢ·termᵢ) (e.g. GDP = C+I_GFCF+X−M). Authored severity:'error'
  // ⇒ a violation beyond ε is a publish-GATING issue: the curator publish route and the
  // gold-boundary publishSubmission reject it with an RFC-9457 `accounting-identity`
  // problem (422) naming the failing identity + the discrepancy. (warn-authored = surface
  // only, like the DQAF kinds.) detail carries { ruleId, group, lhs, lhsValue, rhsSum,
  // delta, epsilon, terms, offendingRows }.
  | 'ACCOUNTING_IDENTITY' // lhs ≉ Σ(coefᵢ·termᵢ) within ε for a declared linear identity
  // validate — data-contract compatibility pre-pass (ADR-0031 §4 improvement 5).
  // Codelist is OPEN (BACKWARD-auto): extensions/deprecations warn and proceed.
  // DSD is GOVERNED (FULL-required): a structural change is an error unless versioned.
  | 'CODELIST_EXTENDED'   // declared codelist adds members vs gold (warn, auto-applied)
  | 'CODELIST_DEPRECATED' // a previously-present member is absent (warn, SCD-2 retire — never hard-delete)
  | 'DSD_INCOMPATIBLE'    // the DSD (dim set/order or measure) differs without a declared dataset_version (error)

export interface ValidationIssue {
  submissionId: string
  layer: IssueLayer
  rowIndex?: number
  severity: IssueSeverity
  code: IssueCode
  detail: Record<string, unknown>
}

// ── Impact preview (shown to the approver before publish) ─────────────────────

export interface PublishPreview {
  newRows: number
  revisedRows: number
  unchangedRows: number
  errorCount: number
  warnCount: number
  canPublish: boolean   // false if any error-severity issue exists
}
