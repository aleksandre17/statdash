import type { ZodTypeAny, z } from 'zod'
import { Problem, validationProblem, notFound as problemNotFound } from './problem.js'

// ── Response envelope ────────────────────────────────────────────────────────
// Every success returns { data: ... }; every failure the RFC 9457 problem body.
// One success shape so the Constructor client never branches on route.
export const ok = <T>(data: T): { data: T } => ({ data })

// ── HttpError → Problem (Strangler-Fig) ───────────────────────────────────────
//
//  `new HttpError(status, message)` historically threw a status-carrying Error the
//  global handler mapped to an ad-hoc { error, message } body. The error contract
//  is now RFC 9457 (Problem), so HttpError is a thin adapter that constructs the
//  registry Problem matching the status — preserving EVERY existing call site and
//  its HTTP status while routing through the one canonical mechanism. New code
//  should throw `problem(kind, …)` / the semantic helpers directly; HttpError
//  remains for the status-first call sites that read most naturally that way.
const STATUS_KIND = {
  400: 'bad-request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not-found',
  409: 'conflict',
  410: 'gone',
} as const

export class HttpError extends Problem {
  constructor(statusCode: number, message: string) {
    const kind = STATUS_KIND[statusCode as keyof typeof STATUS_KIND]
    super(kind ?? (statusCode >= 500 ? 'internal' : 'bad-request'), message)
    this.name = 'HttpError'
  }
}

/** 404 helper — re-exported from the problem registry (single source of truth). */
export const notFound = problemNotFound

// ── parse* helpers — validate at the boundary, narrow `unknown` ────────────────
// A failure throws the validation Problem (400 with `issues`), never reaches SQL.
export function parseBody<S extends ZodTypeAny>(schema: S, body: unknown): z.infer<S> {
  const r = schema.safeParse(body)
  if (!r.success) throw validationProblem(r.error)
  return r.data
}

export function parseParams<S extends ZodTypeAny>(schema: S, params: unknown): z.infer<S> {
  const r = schema.safeParse(params)
  if (!r.success) throw validationProblem(r.error)
  return r.data
}

export function parseQuery<S extends ZodTypeAny>(schema: S, query: unknown): z.infer<S> {
  const r = schema.safeParse(query)
  if (!r.success) throw validationProblem(r.error)
  return r.data
}
