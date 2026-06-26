// ── Serializer registry — the reserved content-negotiation port (ADR-0031 §3/§6) ─
//
//  THE SEAM. The stats serve routes (observations, datasets, …) all produce the
//  SAME internal shape: a query result (an array of rows, or a single descriptor).
//  How that shape is rendered onto the wire is, today, hardwired to ONE format —
//  the `{ data }` JSON envelope (lib/http.ts `ok`). This registry lifts that single
//  decision into an OCP extension point: a `?format=` value → a serializer.
//
//  Registry pattern (the platform's open-registry discipline, mirrors PROBLEM_REGISTRY
//  + the ingest op/rule registries): the dispatch table is closed for modification
//  (the routes never change), open for extension (a new format = ONE registration,
//  no route edit). ADR-0031 §3 reserves SIX future formats — `sdmx-json-2.0`,
//  `sdmx-csv`, `qb-turtle`, `datapackage`, `parquet`, `prov` — behind this one seam
//  (the North-Star's single highest-leverage decision). Per YAGNI we register ONLY
//  `json` now; the rest are reserved (SEAM-DEFER, trigger: first ecosystem consumer).
//
//  BYTE-IDENTICAL INVARIANT (expand-contract / Postel): with no `?format=` or
//  `?format=json`, the wire output is BYTE-FOR-BYTE what the route produced before
//  this port existed. The `json` serializer returns the SAME JS value the route used
//  to `return` (the `{ data }` envelope) with NO explicit content-type, so Fastify's
//  default JSON serialization path runs unchanged. A new format that emits text/binary
//  returns a string/Buffer body + an explicit content-type; only THOSE paths differ.

import { ok } from '../../../lib/http.js'

/**
 * The output of a serializer: the response body + an OPTIONAL content-type override.
 *
 *  - `body` is what the route hands to `reply.send` / `return`s. For `json` it is the
 *    plain `{ data }` JS object, so Fastify serializes it exactly as before (the
 *    byte-identical guarantee). A binary/text format returns a `string` | `Buffer`.
 *  - `contentType` is OMITTED for `json` (Fastify's default
 *    `application/json; charset=utf-8` is correct and must not change). A future
 *    format (`sdmx-csv` → `text/csv`, `parquet` → `application/vnd.apache.parquet`,
 *    `prov` → `application/ld+json`) sets it explicitly.
 */
export interface SerializedResult {
  readonly body: unknown
  readonly contentType?: string
}

/**
 * A serializer renders a query result (the shape the stats routes already build —
 * an array of observation/dataset rows, or any JSON-able value) onto the wire.
 *
 * Generic in the result type so it is dimension- / route-agnostic (Law 1): it takes
 * "whatever the route queried" and returns a `SerializedResult`. The registry never
 * inspects the shape; each serializer owns its own rendering.
 */
export type Serializer = (result: unknown) => SerializedResult

/** The reserved format vocabulary (ADR-0031 §3). Only `json` is registered today. */
export type SerializerFormat =
  | 'json'
  // ── reserved (SEAM-DEFER — trigger: first ecosystem consumer) ──────────────────
  | 'sdmx-json-2.0'
  | 'sdmx-csv'
  | 'qb-turtle'
  | 'datapackage'
  | 'parquet'
  | 'prov'

/** The DEFAULT format when the request carries no `?format=` — the byte-identical path. */
export const DEFAULT_FORMAT: SerializerFormat = 'json'

// The dispatch table. Module-scoped (one registry per process), seeded below with the
// single `json` entry. A new format calls `registerSerializer` at module load.
const registry = new Map<string, Serializer>()

/**
 * Register a serializer for a `?format=` value (OCP extension point).
 *
 * Idempotent-by-last-write within a process; a registration for an already-known
 * format replaces it (a deliberate override seam — there is no covert double-register
 * in production because each format is registered exactly once at module load).
 */
export function registerSerializer(format: SerializerFormat, fn: Serializer): void {
  registry.set(format, fn)
}

/**
 * Resolve the serializer for a `?format=` value, or `undefined` if none is registered.
 *
 * Returning `undefined` (rather than throwing) keeps the POLICY at the route boundary:
 * the route decides how an unknown/unregistered format is surfaced (a 400 Problem —
 * see the routes), so the dispatch mechanism here stays pure and the error contract
 * stays in one place (RFC 9457). A reserved-but-unregistered format (`sdmx-csv`) is
 * indistinguishable from an unknown one — both resolve to `undefined` until the day
 * that format is registered, which is exactly the reserve-the-port semantics.
 */
export function getSerializer(format: string): Serializer | undefined {
  return registry.get(format)
}

/** True iff a serializer is registered for `format` (the capability-discovery probe). */
export function hasSerializer(format: string): boolean {
  return registry.has(format)
}

// ── The ONLY registration today: `json` — byte-identical to the pre-port output ──
//
//  Returns the `{ data }` envelope as a PLAIN JS OBJECT with NO content-type override.
//  The route returns this value through Fastify's normal path, so the serialized bytes
//  AND the `application/json; charset=utf-8` header are exactly what the route emitted
//  before the registry existed. This is the expand-contract anchor: `json` is the
//  contract every current consumer (the geostat front + panel) already depends on.
registerSerializer('json', (result) => ({ body: ok(result) }))
