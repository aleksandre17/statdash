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
