// ── Canonical-ingest client — the Excel-upload + curator-approve surface ──────
//
//  GET  is N/A here; this scope is the WRITE side of the Staged Submission
//  Pipeline (apps/api/src/routes/ingest):
//    POST /api/ingest/canonical        — upload a canonical .xlsx (raw octet bytes,
//          x-filename header) → 202 { datasetCode, sourceDigest, jobIds[] }. The
//          codelists/displays come back 'published' (auto reference data); the FACTS
//          job comes back 'staged' (the curator-approval gate).
//    GET  /api/ingest/jobs/:id         — poll one job: status, issuesBySeverity, the
//          canPublish gate (the DQAF integrity rules surface as WARN issues here).
//    POST /api/ingest/jobs/:id/publish — approve the staged facts → gold.
//
//  This is a SIBLING scope of configApi (lib/api.ts) and cubeApi (lib/cubeApi.ts):
//  a distinct server scope (/api/ingest, NOT /api/config) with a distinct transport
//  shape — a RAW BINARY upload, not a JSON body. So it cannot reuse requestAt
//  (which JSON.stringifies the body + assumes one JSON success shape). It DOES reuse
//  the one auth seam (getToken/clearToken/AuthError) so there is still exactly one
//  place the panel mints a JWT (Law 5: the transport is swappable, auth is not
//  re-implemented). The success envelope is the same `{ data }` wrapper ok() emits;
//  the error contract is RFC 9457 application/problem+json — parsed into a typed
//  IngestProblem so the UI maps `code` to a friendly message, never a raw blob.
//
//  The wire shapes below MIRROR the apps/api ingest route contract EXACTLY
//  (routes/ingest/canonical.ts 202 body + index.ts GET /jobs/:id body + lib/problem.ts
//  RFC 9457 extension members). They are the CONSUMED CONTRACT — the panel adapts
//  here and nowhere else if the server shape evolves.
//
import type { ProblemDetails } from '@statdash/contracts'
import { getToken, clearToken, AuthError } from './auth'

// Empty fallback → relative `/api/...` (same-origin). Dev supplies VITE_API_URL
// (or the Vite proxy); only the production fallback is relative. Mirrors lib/api.ts.
const BASE = import.meta.env.VITE_API_URL ?? ''
const INGEST_PREFIX = '/api/ingest'

// ── Wire shapes (exact mirror of the ingest route contract) ───────────────────

/** A submission kind this upload produced. */
export type IngestKind = 'codelists' | 'displays' | 'facts'

/** The FSM status a kind was left in: reference data 'published', facts 'staged'. */
export type IngestJobStatus =
  | 'received' | 'staged' | 'publishing' | 'published' | 'rejected' | 'failed'

/** One submission the upload produced — kind, its pipeline jobId, its FSM status. */
export interface IngestKindJob {
  kind:   IngestKind
  jobId:  string
  status: IngestJobStatus
}

/** The 202 body of POST /api/ingest/canonical. */
export interface CanonicalUploadResult {
  datasetCode:  string
  sourceDigest: string
  jobIds:       IngestKindJob[]
}

/** The issue tally GET /jobs/:id returns (DQAF integrity rules are WARN-level). */
export interface IssuesBySeverity {
  error: number
  warn:  number
  info:  number
}

/** The GET /api/ingest/jobs/:id body — the job, its tally, and the publish gate. */
export interface IngestJobView {
  job: {
    id:     string
    kind:   IngestKind
    status: IngestJobStatus
  }
  issuesBySeverity: IssuesBySeverity
  /** Server-authoritative gate: staged + zero error issues. The UI mirrors it. */
  canPublish:       boolean
}

// ── IngestProblem — a typed RFC 9457 error the UI maps to a friendly message ───
//
//  Carries the parsed problem body so the caller reads machine-readable extension
//  members (`code`, `parseIssues`, `reason`, `existingJobId`) — never JSON.parse on
//  a `detail` string. A network/parse failure (no problem body) is surfaced as an
//  IngestProblem with `code: undefined` so the UI still shows a friendly fallback.
export class IngestProblem extends Error {
  readonly status: number
  /** The RFC 9457 extension member the route stamps (PARSE_ISSUES, DSD_INCOMPATIBLE, …). */
  readonly code:   string | undefined
  readonly body:   ProblemDetails | undefined
  constructor(status: number, body: ProblemDetails | undefined, fallback: string) {
    super(body?.detail ?? body?.title ?? fallback)
    this.name   = 'IngestProblem'
    this.status = status
    this.code   = typeof body?.code === 'string' ? body.code : undefined
    this.body   = body
  }
}

// ── Transport core ────────────────────────────────────────────────────────────

const ENVELOPE_FALLBACK = 'Request failed'

/** Attach the Bearer JWT (the one auth seam) to a header bag. */
function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getToken()
  return token !== null ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra }
}

/**
 * Unwrap a Response: 401 → clear + AuthError (mirrors requestAt); any other
 * non-2xx → parse the RFC 9457 problem+json body into a typed IngestProblem;
 * a 2xx → unwrap the `{ data }` envelope. A body that is not JSON (a proxy 502,
 * a truncated stream) still yields an IngestProblem with a friendly fallback,
 * never a thrown SyntaxError leaking to the UI.
 */
async function unwrap<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    clearToken()
    throw new AuthError(401, 'Session expired — please log in again')
  }

  const body = await res.json().catch(() => undefined)

  if (!res.ok) {
    throw new IngestProblem(res.status, body as ProblemDetails | undefined, ENVELOPE_FALLBACK)
  }
  return (body as { data?: T } | undefined)?.data as T
}

// ── Endpoint group ────────────────────────────────────────────────────────────

export const ingestApi = {
  /**
   * Upload a canonical workbook — raw .xlsx bytes as application/octet-stream,
   * the original filename in x-filename (the route's provenance label). The bytes
   * are sent verbatim (no multipart wrap — the route decodes a raw Buffer). Returns
   * the 202 result; throws IngestProblem on 400/409, AuthError on 401.
   *
   * `datasetVersion` opts into the SDMX version-mint path: a structural (DSD) change
   * that WITHOUT a version returns 400 DSD_INCOMPATIBLE will, WITH a `?datasetVersion=`
   * label, be accepted as a new governed version (202). The SAME bytes are re-POSTed —
   * the caller caches them so resolving a DSD change never requires re-dropping the file.
   */
  uploadCanonical: async (
    bytes: ArrayBuffer,
    filename: string,
    opts: { datasetVersion?: string } = {},
  ): Promise<CanonicalUploadResult> => {
    const query =
      opts.datasetVersion !== undefined && opts.datasetVersion !== ''
        ? `?datasetVersion=${encodeURIComponent(opts.datasetVersion)}`
        : ''
    const res = await fetch(`${BASE}${INGEST_PREFIX}/canonical${query}`, {
      method:  'POST',
      headers: authHeaders({
        'Content-Type': 'application/octet-stream',
        'x-filename':   filename,
      }),
      body: bytes,
    })
    return unwrap<CanonicalUploadResult>(res)
  },

  /** Poll one job — its status, the issue tally, and the server's publish gate. */
  getJob: async (jobId: string): Promise<IngestJobView> => {
    const res = await fetch(`${BASE}${INGEST_PREFIX}/jobs/${encodeURIComponent(jobId)}`, {
      method:  'GET',
      headers: authHeaders(),
    })
    return unwrap<IngestJobView>(res)
  },

  /** Approve a staged facts job → publish to gold. Throws IngestProblem on a 409 gate. */
  publishJob: async (jobId: string): Promise<unknown> => {
    const res = await fetch(`${BASE}${INGEST_PREFIX}/jobs/${encodeURIComponent(jobId)}/publish`, {
      method:  'POST',
      headers: authHeaders(),
    })
    return unwrap<unknown>(res)
  },
}
