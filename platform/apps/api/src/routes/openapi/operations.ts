// ── OpenAPI operation metadata (API-16) ───────────────────────────────────────
//
//  The curated human metadata (summary/tags) + the Zod schemas to document, per
//  operation. The SCHEMAS are imported from their route modules (the SSOT), never
//  re-declared here — so the published contract is generated from the exact shapes
//  the routes validate against. Routes without an entry still appear in the doc
//  (the routing SSOT is the live Fastify router); an entry only ADDS request/
//  response shape detail.

import type { OperationDoc } from '../../lib/openapi/document.js'
import { LoginBody } from '../auth/index.js'
import { CreateSnapshotBody, TokenParams, SigQuery } from '../embed/index.js'
import { AuditLogQuery } from '../admin/index.js'

export const API_OPERATIONS: readonly OperationDoc[] = [
  {
    method: 'POST',
    path: '/api/auth',
    summary: 'Exchange credentials for a signed JWT.',
    tags: ['auth'],
    public: true,
    request: { body: LoginBody },
  },
  {
    method: 'POST',
    path: '/api/snapshots',
    summary: 'Persist an engine snapshot and mint a signed embed URL (JWT-guarded).',
    tags: ['embed'],
    request: { body: CreateSnapshotBody },
  },
  {
    method: 'GET',
    path: '/api/embed/:token',
    summary: 'Read a snapshot by token, authorized by an HMAC signature (public).',
    tags: ['embed'],
    public: true,
    request: { params: TokenParams, query: SigQuery },
  },
  {
    method: 'GET',
    path: '/api/admin/audit-log',
    summary: 'Read the most-recent governance audit entries (admin-only).',
    tags: ['admin'],
    request: { query: AuditLogQuery },
  },
] as const
