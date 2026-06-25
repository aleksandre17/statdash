// ── Save-path config validation — REJECT mode contract (ADR §6) ────────────────
//
//  The save guard validates every config against the engine's structural floor
//  (validateConfig — the SAME validator the renderer runs). ENFORCE_CONFIG_
//  VALIDATION is now flipped to REJECT (the backfill audit proved the stored
//  corpus clean, 2026-06-25): a failing config is REJECTED at the api boundary
//  with the RFC-9457 `validation` problem (400, application/problem+json) and is
//  NOT persisted; a clean config persists (201) with no validation warning. This
//  suite pins that contract WITHOUT a real DB — a fake pg records any INSERT so we
//  can assert a rejected config never reached the version table.
//
//  We deliberately use a corpus invalid case whose failure is REGISTRY-INDEPENDENT
//  (a non-page root type) so the assertion holds in the api process where the
//  node-type registry is empty (fail-open) — exactly the state a deployed api runs
//  in until react injects its set.

import { describe, it, expect } from 'vitest'
import type { FastifyInstance, FastifyBaseLogger } from 'fastify'
import { migratePageConfig, validateConfig, CURRENT_SCHEMA_VERSION } from '@statdash/engine'

process.env.DATABASE_URL   ??= 'postgres://test'
process.env.JWT_SECRET     ??= 'test-jwt-secret-at-least-32-chars-long!!'
process.env.ADMIN_USERNAME ??= 'admin'
process.env.ADMIN_PASSWORD ??= 'password1'
process.env.NODE_ENV        = 'test'

// A structural-floor-INVALID config that fails WITHOUT needing the node-type
// registry: a non-page root type is a closed structural fact the engine owns, so
// validateConfig flags INVALID_PAGE_ROOT_TYPE even with an empty registry.
const INVALID_CONFIG = { type: 'section', id: 'p', children: [] }
// A structural-floor-VALID config (inner-page root, empty children, no unknown types).
const VALID_CONFIG = { type: 'inner-page', id: 'p', children: [] }

// Sanity: the chosen fixtures really sit on the right side of the floor (so a
// green test means the guard fired, not that the fixture was mislabelled).
function floorErrors(config: unknown): string[] {
  return validateConfig(migratePageConfig(config as Record<string, unknown>)).map((e) => e.code)
}

// ── Capturing logger (Pino-compatible enough for Fastify 5's loggerInstance) ──
interface WarnRecord { obj: unknown; msg: string }
function capturingLogger(sink: WarnRecord[]): FastifyBaseLogger {
  const self = {
    level: 'warn',
    warn: (obj: unknown, msg?: string) => { sink.push({ obj, msg: msg ?? '' }) },
    info: () => {}, error: () => {}, debug: () => {}, fatal: () => {}, trace: () => {},
    silent: () => {},
    child: () => self,
  }
  return self as unknown as FastifyBaseLogger
}

// ── Fake pg that records the version INSERT (proves persistence) ──────────────
interface StoredVersion { config: unknown }
function recordingFakePg(stored: StoredVersion[]): FastifyInstance['pg'] {
  const client = {
    async query(text: string, values?: unknown[]) {
      // POST: first INSERT returns the new page id; the version INSERT records config.
      if (/INSERT INTO config\.page \(/i.test(text)) {
        return { rows: [{ id: '11111111-1111-1111-1111-111111111111' }] }
      }
      if (/INSERT INTO config\.page_version/i.test(text)) {
        // config is the 2nd bound param (page_id, config, data_specs) — stored as JSON.
        stored.push({ config: JSON.parse(String(values?.[1])) })
        return { rows: [{ version_number: 1 }] }
      }
      return { rows: [] }
    },
    release() {},
  }
  return {
    async query() { return { rows: [] } },
    async connect() { return client },
  } as unknown as FastifyInstance['pg']
}

async function buildApp(stored: StoredVersion[], warns: WarnRecord[]): Promise<FastifyInstance> {
  const Fastify = (await import('fastify')).default
  const { pagesRoutes } = await import('./pages.js')
  const { registerProblemErrorHandler } = await import('../../lib/error-handler.js')

  const app = Fastify({ loggerInstance: capturingLogger(warns) })
  app.decorate('pg', recordingFakePg(stored))
  registerProblemErrorHandler(app)
  await app.register(pagesRoutes(), { prefix: '/api/config/pages' })
  await app.ready()
  return app
}

describe('POST /api/config/pages — config validation REJECT mode (ADR §6)', () => {
  it('fixtures sit on the expected sides of the structural floor', () => {
    expect(floorErrors(INVALID_CONFIG)).toContain('INVALID_PAGE_ROOT_TYPE')
    expect(floorErrors(VALID_CONFIG)).toEqual([])
  })

  it('an INVALID config is REJECTED at the boundary (RFC-9457) and NOT persisted', async () => {
    const stored: StoredVersion[] = []
    const warns: WarnRecord[] = []
    const app = await buildApp(stored, warns)

    const res = await app.inject({
      method: 'POST',
      url: '/api/config/pages',
      payload: { slug: 'bad-page', title: { ka: 'ც', en: 'C' }, config: INVALID_CONFIG },
    })

    // REJECT: 400 with the RFC-9457 problem+json envelope (validation kind).
    expect(res.statusCode).toBe(400)
    expect(res.headers['content-type']).toContain('application/problem+json')
    const body = res.json() as { type: string; title: string; status: number; issues?: { code: string }[] }
    expect(body.type).toMatch(/validation$/)
    expect(body.status).toBe(400)
    // The structural-floor errors are surfaced as the typed `issues` extension —
    // the SAME wire contract a Zod request failure uses (Postel / one contract).
    expect(body.issues?.some((i) => i.code === 'INVALID_PAGE_ROOT_TYPE')).toBe(true)

    // NOT persisted — the rejecting throw happens before the version INSERT.
    expect(stored).toHaveLength(0)
  })

  it('a VALID config persists (201) and logs NO validation warning', async () => {
    const stored: StoredVersion[] = []
    const warns: WarnRecord[] = []
    const app = await buildApp(stored, warns)

    const res = await app.inject({
      method: 'POST',
      url: '/api/config/pages',
      payload: { slug: 'good-page', title: { ka: 'კ', en: 'G' }, config: VALID_CONFIG },
    })

    expect(res.statusCode).toBe(201)
    expect(stored).toHaveLength(1)
    // The STORED config is the MIGRATED one (schemaVersion stamped to current).
    expect((stored[0].config as { schemaVersion?: number }).schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(warns.some((w) => /structural validation/i.test(w.msg))).toBe(false)
  })
})
