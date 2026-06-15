import type { ZodError, ZodTypeAny, z } from 'zod'

// ── Response envelope ────────────────────────────────────────────────────────
// Every success returns { data: ... }; every failure { error, message }.
// One shape so the Constructor client never branches on route.
export const ok = <T>(data: T): { data: T } => ({ data })

// ── HttpError — carries an HTTP status the global error handler honours ───────
// Throwing this from a route is the fail-fast path: the handler maps .statusCode
// straight to the response. Fastify reads `statusCode` off any thrown error.
export class HttpError extends Error {
  readonly statusCode: number
  constructor(statusCode: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.statusCode = statusCode
  }
}

export const notFound = (what: string): HttpError =>
  new HttpError(404, `${what} not found`)

// ── ValidationError — 400 wrapper around a ZodError ───────────────────────────
// Distinct name so clients can tell a bad request from a server fault.
export class ValidationError extends Error {
  readonly statusCode = 400
  readonly issues: ZodError['issues']
  constructor(err: ZodError) {
    super('Request validation failed')
    this.name = 'ValidationError'
    this.issues = err.issues
  }
}

// parse* helpers — validate at the boundary, narrow `unknown` to a typed value
// before any DB access. A failure throws ValidationError → 400, never reaches SQL.
export function parseBody<S extends ZodTypeAny>(schema: S, body: unknown): z.infer<S> {
  const r = schema.safeParse(body)
  if (!r.success) throw new ValidationError(r.error)
  return r.data
}

export function parseParams<S extends ZodTypeAny>(schema: S, params: unknown): z.infer<S> {
  const r = schema.safeParse(params)
  if (!r.success) throw new ValidationError(r.error)
  return r.data
}

export function parseQuery<S extends ZodTypeAny>(schema: S, query: unknown): z.infer<S> {
  const r = schema.safeParse(query)
  if (!r.success) throw new ValidationError(r.error)
  return r.data
}
