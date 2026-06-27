// ── OpenAPI 3.1 document builder (API-16) ─────────────────────────────────────
//
//  Assembles a machine-readable OpenAPI contract from TWO single sources of truth,
//  never a hand-written parallel spec:
//
//    1. The ROUTING is harvested from the live Fastify router (the collected
//       method+url list) — so the path inventory cannot drift from what the server
//       actually serves.
//    2. The SHAPES are derived from the existing Zod boundary schemas via
//       zodToJsonSchema — so the documented request/response shapes cannot drift
//       from the runtime validation.
//
//  Human metadata (summaries/tags) is the only hand-authored part, because it has
//  no other home; it is attached per operation, never the schema itself.

import type { z } from 'zod'
import { PROBLEM_CONTENT_TYPE, PROBLEM_URN_PREFIX } from '@statdash/contracts'
import { zodToJsonSchema, type JsonSchema } from './zod-to-schema.js'

/** One collected Fastify route (the routing SSOT). */
export interface RouteRef {
  readonly method: string
  readonly url: string
}

/** Per-operation human metadata + the Zod schemas to document (the shape SSOT). */
export interface OperationDoc {
  readonly method: string
  /** Fastify-style path (with :params); matched against the collected routes. */
  readonly path: string
  readonly summary: string
  readonly tags?: readonly string[]
  /** Whether the route is public (unguarded) — surfaced as a tag/description hint. */
  readonly public?: boolean
  readonly request?: {
    readonly body?: z.ZodTypeAny
    readonly query?: z.ZodTypeAny
    readonly params?: z.ZodTypeAny
  }
  /** Success response body schema (200/201). */
  readonly response?: z.ZodTypeAny
}

export interface OpenApiInfo {
  readonly title: string
  readonly version: string
  readonly description?: string
}

export interface BuildOpenApiArgs {
  readonly info: OpenApiInfo
  readonly routes: readonly RouteRef[]
  readonly operations: readonly OperationDoc[]
}

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])

/** Fastify `/api/embed/:token` → OpenAPI `/api/embed/{token}`. */
function toOpenApiPath(url: string): string {
  return url.replace(/:([A-Za-z0-9_]+)/g, '{$1}')
}

/** Drop a trailing slash (except the root) so prefix+'/' and bare prefix match. */
function normalizeUrl(url: string): string {
  return url.length > 1 ? url.replace(/\/$/, '') : url
}

/** Expand a Zod object schema into OpenAPI parameter objects for `in`. */
function expandParameters(schema: z.ZodTypeAny, location: 'query' | 'path'): JsonSchema[] {
  const js = zodToJsonSchema(schema)
  const props = (js.properties ?? {}) as Record<string, JsonSchema>
  const required = new Set((js.required ?? []) as string[])
  return Object.entries(props).map(([name, propSchema]) => ({
    name,
    in: location,
    // Path params are ALWAYS required by the OpenAPI spec, regardless of the schema.
    required: location === 'path' ? true : required.has(name),
    schema: propSchema,
  }))
}

/** The shared RFC 9457 problem response (referenced by every operation's 4xx/5xx). */
function problemResponse(description: string): JsonSchema {
  return {
    description,
    content: { [PROBLEM_CONTENT_TYPE]: { schema: { $ref: '#/components/schemas/ProblemDetails' } } },
  }
}

/** The ProblemDetails component schema (RFC 9457) — the api's universal error shape. */
function problemComponent(): JsonSchema {
  return {
    type: 'object',
    description: 'RFC 9457 Problem Details — the api\'s one error envelope.',
    properties: {
      type:     { type: 'string', description: `URI of the problem kind (prefix ${PROBLEM_URN_PREFIX}).` },
      title:    { type: 'string' },
      status:   { type: 'integer' },
      detail:   { type: 'string' },
      instance: { type: 'string' },
      requestId: { type: 'string', description: 'Correlation id (x-request-id) for this occurrence.' },
    },
    required: ['type', 'title', 'status'],
    additionalProperties: true,
  }
}

/**
 * Build the OpenAPI 3.1 document. Every collected route becomes a path item; an
 * operation with documented Zod schemas is enriched with its request/response
 * shapes, and every operation carries the shared Problem error responses.
 */
export function buildOpenApiDocument(args: BuildOpenApiArgs): JsonSchema {
  const { info, routes, operations } = args
  const opIndex = new Map(operations.map((o) => [`${o.method.toUpperCase()} ${normalizeUrl(o.path)}`, o]))

  const paths: Record<string, Record<string, JsonSchema>> = {}

  for (const route of routes) {
    const method = route.method.toUpperCase()
    if (!METHODS.has(method)) continue
    const url = normalizeUrl(route.url)
    // Skip the documentation/scrape endpoints themselves.
    if (url === '/api/openapi.json' || url === '/metrics') continue

    const oaPath = toOpenApiPath(url)
    const op = opIndex.get(`${method} ${url}`)

    const operation: JsonSchema = {
      summary: op?.summary ?? `${method} ${oaPath}`,
      tags: op?.tags ? [...op.tags] : [tagFor(route.url)],
      responses: {
        '200': { description: 'Success' },
        '4XX': problemResponse('Client error (RFC 9457).'),
        '5XX': problemResponse('Server error (RFC 9457).'),
      },
    }

    const parameters: JsonSchema[] = []
    if (op?.request?.params) parameters.push(...expandParameters(op.request.params, 'path'))
    if (op?.request?.query) parameters.push(...expandParameters(op.request.query, 'query'))
    if (parameters.length) operation.parameters = parameters

    if (op?.request?.body) {
      operation.requestBody = {
        required: true,
        content: { 'application/json': { schema: zodToJsonSchema(op.request.body) } },
      }
    }
    if (op?.response) {
      ;(operation.responses as Record<string, JsonSchema>)['200'] = {
        description: 'Success',
        content: { 'application/json': { schema: zodToJsonSchema(op.response) } },
      }
    }

    paths[oaPath] = paths[oaPath] ?? {}
    paths[oaPath][method.toLowerCase()] = operation
  }

  return {
    openapi: '3.1.0',
    info: { title: info.title, version: info.version, ...(info.description ? { description: info.description } : {}) },
    paths,
    components: { schemas: { ProblemDetails: problemComponent() } },
  }
}

/** Derive a coarse tag from the URL's first /api/<segment> (grouping in Swagger UI). */
function tagFor(url: string): string {
  const m = /^\/api\/([^/]+)/.exec(url)
  return m ? m[1] : 'root'
}
