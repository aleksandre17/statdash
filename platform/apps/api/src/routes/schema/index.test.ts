// ── GET /api/schema/page-config — serves the JSON Schema artifact (ADR §7) ─────
//
//  The endpoint returns the COMMITTED page-config JSON Schema verbatim with the
//  application/schema+json media type. This suite proves the content-type + that
//  the body is a structurally valid JSON Schema document. No DB, no auth needed —
//  the contract is public.

import { describe, it, expect } from 'vitest'
import type { FastifyInstance } from 'fastify'

process.env.DATABASE_URL ??= 'postgres://test'
process.env.JWT_SECRET   ??= 'test-jwt-secret-at-least-32-chars-long!!'
process.env.NODE_ENV      = 'test'

async function buildApp(): Promise<FastifyInstance> {
  const Fastify = (await import('fastify')).default
  const { schemaRoutes } = await import('./index.js')
  const app = Fastify()
  await app.register(schemaRoutes, { prefix: '/api/schema' })
  await app.ready()
  return app
}

describe('GET /api/schema/page-config', () => {
  it('returns application/schema+json', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/schema/page-config' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/schema+json')
  })

  it('returns a structurally valid JSON Schema document', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/schema/page-config' })
    const schema = res.json() as Record<string, unknown>

    // A JSON Schema document is an object; the generated artifact declares a
    // $schema dialect and a top-level type/$ref or properties — assert it is a
    // non-empty object carrying the dialect marker (the minimal JSON Schema floor).
    expect(typeof schema).toBe('object')
    expect(schema).not.toBeNull()
    expect(typeof schema.$schema).toBe('string')
    expect(String(schema.$schema)).toMatch(/json-schema\.org/)
  })
})
