// ── GET /api/schema/page-config — serve the JSON Schema artifact ───────────────
//
//  ADR adr-config-and-render-vision §7. The Constructor (and any external client)
//  needs the MACHINE-READABLE contract for a page config: the JSON Schema the
//  engine's validateConfig enforces. We serve the COMMITTED, GENERATED artifact
//  (packages/contracts/schema/page-config.schema.json) verbatim — the single
//  source of truth, generated from the same types, never hand-edited here.
//
//  WHY a static file read, not an app-tier import: the schema is DATA, not code.
//  The arrow forbids apps/api from importing react/engine internals, but reading a
//  JSON file that the contracts package SHIPS (its `files` + a subpath export) is
//  arrow-clean — contracts is the innermost layer api may depend on. We resolve
//  the file through the contracts package's OWN export map via createRequire, so
//  the path is correct in BOTH the dev source tree AND a built/deployed image
//  (pnpm symlink, hoist, or a flat node_modules — Node's resolver handles each),
//  with NO brittle relative '../../../' walk that breaks the moment the layout moves.
//
//  Read ONCE at plugin registration (the file is small + immutable per deploy):
//  no per-request disk I/O on the hot path, and a missing/corrupt artifact fails
//  FAST at boot (a deploy-time error) rather than silently 500ing per request.

import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import type { FastifyPluginAsync } from 'fastify'

// The media type for a JSON Schema document (JSON Schema spec / IANA).
const SCHEMA_CONTENT_TYPE = 'application/schema+json'

// Resolve the artifact through the contracts package's subpath export. This is
// package-manager-agnostic: Node finds the real file wherever @statdash/contracts
// is installed (workspace symlink in dev, node_modules in the image). Resolved at
// MODULE LOAD so a missing artifact is a fail-fast boot error, not a runtime 500.
const require = createRequire(import.meta.url)
const SCHEMA_PATH = require.resolve('@statdash/contracts/schema/page-config.schema.json')

export const schemaRoutes: FastifyPluginAsync = async (app) => {
  // Read + parse once at registration. Parsing validates it IS JSON up front
  // (fail-fast at boot); we re-serialize on send so the body is canonical JSON.
  const pageConfigSchema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')) as Record<string, unknown>
  const body = JSON.stringify(pageConfigSchema)

  // GET /page-config — the page-config JSON Schema. Public (no JWT): the contract
  // is not a secret, and the Constructor reads it before any auth. Explicit
  // content-type header (not reply.type) so a downstream JSON serializer cannot
  // override it back to application/json — same discipline as the Problem handler.
  app.get('/page-config', async (_req, reply) =>
    reply.header('content-type', SCHEMA_CONTENT_TYPE).send(body),
  )
}
