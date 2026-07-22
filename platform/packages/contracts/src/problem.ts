// ── RFC 9457 Problem Details — the api error contract ─────────────────────────
//
//  The single shared shape for EVERY error body the api emits. A client that
//  reads `application/problem+json` parses exactly this: the five IETF members
//  plus typed extension members per problem kind. Lives in @statdash/contracts
//  (not apps/api) because it crosses the api ↔ runner/panel boundary the
//  dependency arrow forbids a direct import across — same reason SiteManifest /
//  PageDataSnapshot live here. Pure types, zero-dep: the registry that mints
//  these and the Fastify handler that serializes them stay api-local (runtime).
//
//  RFC 9457 §3.1 — the standard members:
//    type     — a URI reference identifying the problem TYPE (stable, dereferences
//               to a human description in principle). Our scheme: a stable URN,
//               `urn:statdash:problem:<kind>` (see ProblemType below).
//    title    — a short, human-readable, TYPE-stable summary (does not vary per
//               occurrence). The registry owns it.
//    status   — the HTTP status code, mirrored into the body (§3.1).
//    detail   — human-readable explanation specific to THIS occurrence.
//    instance — a URI reference for this specific occurrence (here: the request
//               path). Optional.
//  Plus extension members: any additional, machine-readable, type-specific
//  fields (§3.2) — e.g. a validation problem's `issues`, the schema-ahead
//  conflict's `currentSchemaVersion` / `configSchemaVersion`.

/** The media type every problem response carries (RFC 9457 §3). */
export const PROBLEM_CONTENT_TYPE = 'application/problem+json'

/** URN namespace for our problem `type` URIs — stable, app-owned, dereference-free. */
export const PROBLEM_URN_PREFIX = 'urn:statdash:problem:'

// ── config-invalid (422) — the validated-PUT rejection contract (ADR-052 §4) ──
//
//  A `config-invalid` 422 (data_spec / data_source PUT + restore) carries a
//  machine-readable `violations[]` extension member so a client renders the
//  failure AT the offending field, never a stringified blob. This lives in
//  @statdash/contracts (not apps/api) because it is a WIRE shape the panel reads
//  off the 422 body — the same cross-boundary rationale as ProblemDetails itself.
//  The api's referential gate (`validate-config-doc`) is the runtime that MINTS
//  these and reads THIS type (its former local copy is retired — Strangler swap).

/** The `code` extension member a `config-invalid` 422 carries. */
export const CONFIG_INVALID_CODE = 'CONFIG_INVALID'

/**
 * One entry in a `config-invalid` 422's `violations[]` (ADR-052 §4). Machine-
 * readable: `check` names the failed class, `path` is a JSON-pointer into the
 * document body, `ref` is the offending value, `detail` is the human message.
 */
export interface ConfigViolation {
  /**
   * Which validation class failed. `code-resolves` is the shared-namespace check:
   * a code in a head/source position (a `MetricRef` — governed metric id OR raw
   * cube code, one namespace) must resolve SOMEWHERE — the governed metrics
   * catalog or the live measure codelist. It supersedes the former catalog-only
   * `metric-resolves` (which asked "is it governed", the wrong question — a
   * nonsense raw-looking code slipped through under Postel).
   */
  check:  'shape' | 'dataset-exists' | 'dims-subset' | 'code-resolves'
  /** JSON-pointer into the document body (e.g. `/config/datasetCode`). */
  path:   string
  /** The offending value (missing datasetCode / dim / metric id), when applicable. */
  ref?:   string
  /** Human-readable occurrence detail. */
  detail: string
}

/** The `config-invalid` 422 body: ProblemDetails + the typed `violations[]`/`code`. */
export interface ConfigInvalidProblem extends ProblemDetails {
  code:       typeof CONFIG_INVALID_CODE
  violations: ConfigViolation[]
}

/**
 * The RFC 9457 problem body. The five standard members are fixed; extension
 * members (§3.2) are any further JSON-serializable fields a problem kind adds.
 * Index signature carries the extensions while keeping the standard members
 * strongly typed.
 */
export interface ProblemDetails {
  /** URI reference identifying the problem type (our `urn:statdash:problem:<kind>`). */
  type: string
  /** Short, type-stable, human-readable summary. */
  title: string
  /** HTTP status code, mirrored from the response line. */
  status: number
  /** Human-readable, occurrence-specific explanation. */
  detail?: string
  /** URI reference for this specific occurrence (the request path). */
  instance?: string
  /** Extension members (§3.2) — type-specific machine-readable context. */
  [extension: string]: unknown
}
