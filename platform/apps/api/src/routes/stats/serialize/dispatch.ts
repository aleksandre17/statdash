// ── `?format=` dispatch — the route-side wiring of the serializer port ────────────
//
//  ONE place defines: (1) the `?format=` query slot's validation, and (2) what an
//  UNREGISTERED format does. Both stats serve routes import this so they cannot drift
//  on the negotiation contract (SSOT). The query/store logic stays in the route; this
//  is purely the OUTPUT serialization seam (ADR-0031 §6 improvement 6).

import type { FastifyReply } from 'fastify'
import { z } from 'zod'
import { badRequest } from '../../../lib/problem.js'
import { DEFAULT_FORMAT, getSerializer } from './registry.js'

/**
 * The `?format=` query slot. OPTIONAL — absent ⇒ the default (`json`), the
 * byte-identical path. A free string here (not a closed enum) so that:
 *   - the ERROR contract is uniform: any unregistered value — a typo OR a reserved-
 *     but-not-yet-registered format (`sdmx-csv`) — flows through the SAME 400 Problem
 *     below, rather than a Zod enum issue for one and a registry miss for the other;
 *   - reserving a format is a pure registry registration (OCP) — adding `sdmx-csv`
 *     needs NO edit to a Zod enum here (the schema already accepts the string; the
 *     route starts honouring it the instant a serializer is registered).
 * Mix this into a route's existing query object: `z.object({ …, format: formatField })`.
 */
export const formatField = z.string().optional()

/**
 * Resolve the serializer for the request's `?format=`, or throw a 400 Problem
 * (RFC 9457) for an unregistered format. CHOICE (documented): an unknown/unregistered
 * format is a CLIENT ERROR, not a silent json fallback —
 *
 *   - Postel says be liberal in what we ACCEPT, but a format we cannot honour is not
 *     something to accept-and-substitute: silently returning json under `?format=parquet`
 *     would violate least-astonishment (the client asked for parquet bytes and got
 *     JSON with a 200) and could corrupt a consumer that trusts the requested format.
 *     Fail-fast at the boundary is the safer contract.
 *   - It also keeps the reserve-the-port honest: `?format=sdmx-csv` returns a crisp
 *     400 ("format not supported") TODAY and will return CSV the day that serializer
 *     is registered — the dispatch is provably wired, and the change is purely additive.
 *
 * The 400 carries the requested + supported formats as RFC 9457 extension members
 * (machine-readable, §3.2), never a stringified blob.
 */
export function resolveSerializer(format: string | undefined) {
  const requested = format ?? DEFAULT_FORMAT
  const serializer = getSerializer(requested)
  if (!serializer) {
    throw badRequest(`Unsupported format '${requested}'`)
  }
  return serializer
}

/**
 * Serialize a query result for the request's `?format=` and dispatch it onto `reply`.
 *
 * For `json` (and the no-`?format=` default) the serializer returns the `{ data }`
 * envelope as a plain object with no content-type override, so this is byte-identical
 * to the pre-port `return ok(result)`: Fastify's default JSON path serializes the SAME
 * bytes with the SAME `application/json; charset=utf-8`. A format that returns a
 * string/Buffer body sets its own content-type; only THAT path differs.
 *
 * Returns the body for the route to `return` (so the ETag/304 short-circuit and the
 * RFC-9457 error path the routes already own stay exactly where they are).
 */
export function serializeReply(
  reply: FastifyReply,
  format: string | undefined,
  result: unknown,
): unknown {
  const serializer = resolveSerializer(format)
  const { body, contentType } = serializer(result)
  if (contentType) reply.header('content-type', contentType)
  return body
}
