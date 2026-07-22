// ── Problem registry + Problem error — the api's ONE RFC 9457 mechanism ───────
//
//  Every error the api surfaces is a `Problem`: a thrown domain error the central
//  error handler (index.ts) serializes into the RFC 9457 `application/problem+json`
//  envelope (the ProblemDetails shape from @statdash/contracts).
//
//  OPEN/EXTENSIBLE SEAM (Law 8 / OCP, mirrors the platform's open-registry
//  discipline): a new error kind = ONE entry in PROBLEM_REGISTRY below, NOT an
//  edit to a central switch. Each kind declares its stable `type` URI suffix,
//  type-stable `title`, and default `status`. Routes throw `problem(kind, …)` (or
//  a thin helper) carrying an occurrence `detail` + typed extension members; they
//  never hand-assemble error JSON and never repeat a status/title literal (no
//  magic strings — the registry is the single source of truth).
//
//  Why api-local (not in @statdash/contracts): the ProblemDetails *shape* is the
//  client contract and lives in contracts (zero-dep, pure types). This registry +
//  the Problem class are RUNTIME values the api throws; contracts holds no logic
//  or classes. Clients consume the shape, the server owns the catalogue.

import {
  PROBLEM_URN_PREFIX,
  type ProblemDetails,
} from '@statdash/contracts'
import type { ValidationError } from '@statdash/engine'
import type { ZodError } from 'zod'

// ── The problem catalogue ─────────────────────────────────────────────────────
//
//  Keyed by a stable kind slug. `urn` is the slug appended to the URN prefix to
//  form the RFC 9457 `type`. `title` is the type-stable human summary. `status`
//  is the default HTTP status (an occurrence may override only its `detail` /
//  extensions, never the title — title is type-stable by RFC 9457 §3.1).
//
//  The slugs mirror the existing semantic error vocabulary 1:1 so every current
//  HTTP status is preserved exactly (see the conversion map in the route files).

interface ProblemDef {
  /** Slug appended to PROBLEM_URN_PREFIX → the RFC 9457 `type` URI. */
  readonly urn: string
  /** Type-stable, human-readable summary (RFC 9457 title). */
  readonly title: string
  /** Default HTTP status for this kind. */
  readonly status: number
}

export const PROBLEM_REGISTRY = {
  /** 400 — request failed schema validation (Zod). Carries `issues` extension. */
  validation: { urn: 'validation', title: 'Request validation failed', status: 400 },
  /** 400 — request was well-formed but semantically invalid (e.g. malformed CSV cell). */
  'bad-request': { urn: 'bad-request', title: 'Bad request', status: 400 },
  /** 401 — missing or invalid authentication credentials. */
  unauthorized: { urn: 'unauthorized', title: 'Authentication required', status: 401 },
  /** 403 — authenticated but not permitted (role / signature / disabled account). */
  forbidden: { urn: 'forbidden', title: 'Forbidden', status: 403 },
  /** 404 — the requested resource does not exist. */
  'not-found': { urn: 'not-found', title: 'Resource not found', status: 404 },
  /** 409 — the resource state conflicts with the request (FSM guard, duplicate). */
  conflict: { urn: 'conflict', title: 'Conflict', status: 409 },
  /**
   * 409 — stored config schemaVersion is HIGHER than this server supports
   * (forward-compat guard). Carries `configSchemaVersion` / `currentSchemaVersion`
   * extension members so the client can act, instead of a stringified blob.
   */
  'config-schema-ahead': {
    urn: 'config-schema-ahead',
    title: 'Config schema version is newer than this server supports',
    status: 409,
  },
  /** 410 — the resource existed but is permanently gone (expired embed token). */
  gone: { urn: 'gone', title: 'Gone', status: 410 },
  /**
   * 422 — the submission is structurally valid (it staged) but its data VIOLATES a
   * declared accounting identity beyond tolerance (DC-02, Law 9). 422 Unprocessable
   * Content is the right status: the request is well-formed, the SEMANTICS are not.
   * Carries `code` + `violations[]` extension members (the failing identity ids +
   * discrepancies) so a client reads `body.violations`, never a stringified blob.
   */
  'accounting-identity': {
    urn: 'accounting-identity',
    title: 'Accounting identity violated',
    status: 422,
  },
  /**
   * 422 — a config document (data_spec / data_source) is well-formed JSON but its
   * SEMANTICS reference things that do not exist (a dangling datasetCode, a dim not
   * in the referenced DSD, an unresolvable governed metric id, or a malformed spec
   * shape). 422 Unprocessable Content is the right status — the request body parses,
   * the references do not resolve (ADR-052 §4). Carries `code` + a machine-readable
   * `violations[]` extension member (the exact `accounting-identity` 422 shape) so a
   * client reads `body.violations`, never a stringified blob — NEVER a silent 200
   * storing corruption (the whole point of the validated PUT).
   */
  'config-invalid': {
    urn: 'config-invalid',
    title: 'Config document failed validation',
    status: 422,
  },
  /**
   * 429 — the client exceeded a rate budget OR a bounded resource (the ingest
   * bulkhead) is saturated and the request was load-shed. Carries a `Retry-After`
   * response header (set at the throw site) and a `code` extension that
   * distinguishes the cause (RATE_LIMITED vs INGEST_BUSY) for the client.
   */
  'too-many-requests': { urn: 'too-many-requests', title: 'Too many requests', status: 429 },
  /** 500 — an unexpected server fault. The fallback for any non-Problem throw. */
  internal: { urn: 'internal', title: 'Internal server error', status: 500 },
} as const satisfies Record<string, ProblemDef>

/** The set of registered problem kinds. New kind = a new entry above. */
export type ProblemKind = keyof typeof PROBLEM_REGISTRY

// ── Problem — the thrown domain error ─────────────────────────────────────────
//
//  Carries a registry kind + an occurrence detail + typed extension members. The
//  central error handler reads `.toProblemDetails(instance)` to build the body
//  and `.status` for the response line. Extends Error so existing throw/catch and
//  Fastify's error path work unchanged; `statusCode` is mirrored so any code that
//  still reads Fastify's `error.statusCode` keeps seeing the right number.

export class Problem extends Error {
  readonly kind: ProblemKind
  readonly status: number
  /** Mirror of `status` — Fastify and legacy callers read `error.statusCode`. */
  readonly statusCode: number
  readonly extensions: Readonly<Record<string, unknown>>

  constructor(kind: ProblemKind, detail?: string, extensions: Record<string, unknown> = {}) {
    const def = PROBLEM_REGISTRY[kind]
    super(detail ?? def.title)
    this.name = 'Problem'
    this.kind = kind
    this.status = def.status
    this.statusCode = def.status
    this.extensions = extensions
  }

  /** Serialize to the RFC 9457 body. `instance` is the request path (occurrence URI). */
  toProblemDetails(instance?: string): ProblemDetails {
    const def = PROBLEM_REGISTRY[this.kind]
    return {
      type: PROBLEM_URN_PREFIX + def.urn,
      title: def.title,
      status: this.status,
      ...(this.message && this.message !== def.title ? { detail: this.message } : {}),
      ...(instance ? { instance } : {}),
      ...this.extensions,
    }
  }
}

// ── Factory + thin semantic helpers ───────────────────────────────────────────
//
//  `problem(kind, detail, ext)` is the general factory. The helpers below name the
//  common kinds so call sites read as intent and never repeat a status literal.

export const problem = (
  kind: ProblemKind,
  detail?: string,
  extensions?: Record<string, unknown>,
): Problem => new Problem(kind, detail, extensions)

/** 404 — `${what} not found`. Preserves the prior `notFound('Page')` ergonomics. */
export const notFound = (what: string): Problem =>
  new Problem('not-found', `${what} not found`)

/** 401 — authentication required / invalid. */
export const unauthorized = (detail: string): Problem =>
  new Problem('unauthorized', detail)

/** 403 — authenticated but not permitted. */
export const forbidden = (detail: string): Problem =>
  new Problem('forbidden', detail)

/** 409 — resource-state / uniqueness conflict. */
export const conflict = (detail: string): Problem =>
  new Problem('conflict', detail)

/**
 * 409 — an identical payload was already published (Idempotent Receiver, EIP).
 *
 * The structured re-submission signal the ingest + curator-import surfaces both
 * raise. `code` + `existingJobId` are RFC 9457 EXTENSION MEMBERS (§3.2) — top-level
 * fields of the problem body — NOT a JSON blob stuffed into `detail`. That is the
 * whole point of the Problem seam: a machine-readable conflict the client reads as
 * `body.existingJobId`, never `JSON.parse(body.detail)`. One factory so the two
 * call sites cannot drift on the contract (SSOT).
 */
export const alreadyPublished = (existingJobId: string): Problem =>
  new Problem('conflict', 'An identical payload was already published', {
    code: 'ALREADY_PUBLISHED',
    existingJobId,
  })

/** 410 — permanently gone. */
export const gone = (detail: string): Problem =>
  new Problem('gone', detail)

/**
 * 422 — publish rejected: the submission's data violates one or more DECLARED
 * accounting identities beyond tolerance (DC-02, Law 9). The single SSOT factory both
 * the curator publish route and the gold-boundary publishSubmission throw, so the two
 * gates cannot drift on the contract. `violations` are the persisted ACCOUNTING_IDENTITY
 * issue details (each { ruleId, group, lhs, lhsValue, rhsSum, delta, epsilon, terms }) —
 * RFC 9457 EXTENSION MEMBERS (§3.2), a machine-readable list the client reads as
 * `body.violations`, NOT JSON stuffed into `detail`. The failing identity is NAMED
 * (ruleId) and the discrepancy quantified (delta vs epsilon).
 */
export const accountingIdentityViolation = (
  submissionId: string,
  violations: ReadonlyArray<Record<string, unknown>>,
): Problem =>
  new Problem(
    'accounting-identity',
    `Publish rejected: ${violations.length} declared accounting ` +
    `identit${violations.length === 1 ? 'y' : 'ies'} violated beyond tolerance`,
    { code: 'ACCOUNTING_IDENTITY_VIOLATION', submissionId, violations },
  )

/**
 * A single config-document validation failure — one entry in the `violations[]`
 * extension member of a {@link configInvalid} 422 (ADR-052 §4). Machine-readable:
 * `check` names the class, `path` is a JSON-pointer into the document body, `ref`
 * is the offending value, `detail` is the human occurrence message. A `shape`
 * violation carries the engine's structural fields under `detail`/`ref`.
 */
export interface ConfigViolation {
  /** Which validation class failed. */
  check:   'shape' | 'dataset-exists' | 'dims-subset' | 'metric-resolves'
  /** JSON-pointer into the document body (e.g. `/config/datasetCode`). */
  path:    string
  /** The offending value (the missing datasetCode / dim / metric id), when applicable. */
  ref?:    string
  /** Human-readable occurrence detail. */
  detail:  string
}

/**
 * 422 — a config document (data_spec / data_source) failed referential validation
 * (ADR-052 §4). The SSOT factory both the data-spec and data-source PUT routes throw,
 * so the two gates cannot drift on the contract. `violations` are RFC 9457 EXTENSION
 * MEMBERS (§3.2) — a machine-readable list the client reads as `body.violations`, NOT
 * JSON stuffed into `detail` (mirrors {@link accountingIdentityViolation}). Each names
 * its `check` class + a JSON-pointer `path` so the panel can surface the failure at the
 * exact field in its publish affordance.
 */
export const configInvalid = (violations: ReadonlyArray<ConfigViolation>): Problem =>
  new Problem(
    'config-invalid',
    `Config document failed validation: ${violations.length} ` +
    `violation${violations.length === 1 ? '' : 's'}`,
    { code: 'CONFIG_INVALID', violations },
  )

/**
 * 429 — rate budget exceeded or a bounded resource is saturated (load-shed). The
 * caller sets the `Retry-After` response header from `retryAfterSeconds`; here it
 * also rides as a typed extension member so a JSON-only client can read it without
 * parsing headers. `code` names the cause (RATE_LIMITED | INGEST_BUSY) so the
 * client can back off differently for a per-IP throttle vs a server-busy shed.
 */
export const tooManyRequests = (
  detail: string,
  retryAfterSeconds: number,
  code: 'RATE_LIMITED' | 'INGEST_BUSY',
): Problem =>
  new Problem('too-many-requests', detail, { code, retryAfterSeconds })

/** 400 — well-formed but semantically invalid. */
export const badRequest = (detail: string): Problem =>
  new Problem('bad-request', detail)

// ── Validation problem — wraps a ZodError as a 400 with `issues` extension ─────

/** 400 — schema validation failure. Surfaces the Zod issues as a typed extension. */
export const validationProblem = (err: ZodError): Problem =>
  new Problem('validation', 'Request validation failed', { issues: err.issues })

/**
 * 400 — page-config STRUCTURAL validation failure (engine `validateConfig`).
 *
 * The sibling to {@link validationProblem}: a request can fail validation two
 * ways — Zod (the request envelope) or the engine's structural floor (the
 * config tree). Both surface through the SAME `'validation'` problem kind and
 * the SAME `issues` extension member, so a client parses ONE wire contract for
 * every validation failure regardless of which validator produced it (Postel /
 * least astonishment). The engine `ValidationError[]` is the `issues` payload —
 * each carries `{ path, code, message, severity }` (machine-readable, §3.2),
 * mirroring how the Zod variant carries `ZodError.issues`.
 *
 * This is the throw the save-path WARN→REJECT flip uses once the backfill audit
 * is green (see routes/config/pages.ts ENFORCE_CONFIG_VALIDATION).
 */
export const configValidationProblem = (errors: ValidationError[]): Problem =>
  new Problem('validation', 'Request validation failed', { issues: errors })

/**
 * Map any thrown value to a Problem. A `Problem` passes through. A Fastify/HTTP
 * error carrying a numeric `statusCode` is mapped to the matching registry kind
 * so framework-originated errors (e.g. body-parse 400) still emit a conformant
 * envelope. Everything else becomes a 500 `internal`. Single fail-fast seam the
 * central handler delegates to.
 */
export function toProblem(err: unknown): Problem {
  if (err instanceof Problem) return err
  const status = statusOf(err)
  const detail = err instanceof Error ? err.message : undefined
  return new Problem(kindForStatus(status), detail)
}

function statusOf(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    const sc = (err as { statusCode?: unknown }).statusCode
    if (typeof sc === 'number') return sc
  }
  return 500
}

/** Map a bare HTTP status to the closest registry kind (default: by class of code). */
function kindForStatus(status: number): ProblemKind {
  switch (status) {
    case 400: return 'bad-request'
    case 401: return 'unauthorized'
    case 403: return 'forbidden'
    case 404: return 'not-found'
    case 409: return 'conflict'
    case 410: return 'gone'
    case 429: return 'too-many-requests'
    default:  return status >= 500 ? 'internal' : 'bad-request'
  }
}
