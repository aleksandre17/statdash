// ── ingest route schemas — boundary validation (validate at the edge) ─────────
//
// Zod schemas that narrow `unknown` request input to typed values BEFORE any SQL.
// Kept apart from the plugin so the route file holds handlers only (one concern
// per file, `05`/`09` hygiene).
//
// payload is intentionally `unknown`: the pipeline's conform/validate filters are
// the authority on payload shape, not this route — the route's job is only to
// persist the bronze blob faithfully. We require it PRESENT (not undefined) so an
// empty body fails fast as a 400.

import { z } from 'zod'

const PayloadField = z.unknown().refine((v) => v !== undefined, {
  message: 'payload is required',
})

export const FactsBody = z.object({
  datasetCode: z.string().min(1),
  format: z.enum(['sdmx-json', 'bundle', 'csv']),
  payload: PayloadField,
  dryRun: z.boolean().optional().default(false),
  source: z.string().min(1).optional(),
})

export const CodelistsBody = z.object({
  dimCode: z.string().min(1).optional(),
  format: z.enum(['sdmx-json', 'bundle']),
  payload: PayloadField,
  dryRun: z.boolean().optional().default(false),
  source: z.string().min(1).optional(),
})

export const DisplaysBody = z.object({
  format: z.enum(['xlsx-rows', 'bundle']),
  payload: PayloadField,
  dryRun: z.boolean().optional().default(false),
  source: z.string().min(1).optional(),
})

export const JobsQuery = z.object({
  status: z
    .enum(['received', 'parsing', 'staged', 'publishing', 'published', 'failed', 'rejected'])
    .optional(),
  kind: z.enum(['facts', 'codelists', 'displays']).optional(),
  // bound the response: default 50, capped at 200 so a client cannot ask for all.
  limit: z.coerce.number().int().positive().max(200).default(50),
})

export const IdParam = z.object({ id: z.string().uuid() })

export const IssuesQuery = z.object({
  severity: z.enum(['error', 'warn', 'info']).optional(),
})
