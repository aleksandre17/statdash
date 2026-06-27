// ── Central RFC 9457 error handler — the ONE place errors become responses ─────
//
//  Registered once in index.ts (and by tests, via registerProblemErrorHandler, so
//  the suite exercises the EXACT production serializer — no hand-rolled copy that
//  could drift). Any thrown value is normalized to a `Problem` (toProblem), then
//  serialized into the `application/problem+json` envelope with the matching
//  status. Routes throw typed problems; this seam owns content-type + status +
//  body. Fail-fast: nothing is swallowed; 5xx is logged at error, 4xx at warn.

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { PROBLEM_CONTENT_TYPE } from '@statdash/contracts'
import { toProblem } from './problem.js'

export interface ProblemHandlerOptions {
  /** Include the stack as a non-standard `stack` extension (dev only). */
  readonly includeStack?: boolean
}

export function registerProblemErrorHandler(
  app: FastifyInstance,
  opts: ProblemHandlerOptions = {},
): void {
  app.setErrorHandler((error: unknown, req: FastifyRequest, reply: FastifyReply) => {
    const problem = toProblem(error)

    if (problem.status >= 500) app.log.error(error)
    else app.log.warn(error)

    const body = problem.toProblemDetails(req.url)
    // Correlation: stamp the request id (x-request-id propagated or minted, see
    // lib/observability.ts) into the problem body so a client can quote ONE id
    // that also appears on every server log line for the request (req.log binds
    // reqId). Closes the log↔error loop without the client parsing headers.
    if (req.id) body['requestId'] = req.id
    if (opts.includeStack && error instanceof Error && error.stack) {
      body['stack'] = error.stack
    }

    // RFC 9110 §10.2.3 Retry-After on a 429: a Problem carrying retryAfterSeconds
    // (rate-limit / bulkhead load-shed) sets the standard header here, ONE place,
    // so every throw site just throws tooManyRequests(detail, n, code) and the
    // header follows automatically (no per-route header plumbing).
    const retryAfter = problem.extensions['retryAfterSeconds']
    if (typeof retryAfter === 'number') {
      reply.header('retry-after', String(Math.ceil(retryAfter)))
    }

    // Serialize ourselves and set the content-type via header so the RFC 9457
    // media type survives regardless of route/scope serializer configuration
    // (reply.type() can be overridden by a downstream JSON serializer; an explicit
    // header on a pre-serialized string is authoritative).
    return reply
      .status(problem.status)
      .header('content-type', PROBLEM_CONTENT_TYPE)
      .send(JSON.stringify(body))
  })
}
