// ── Fitness function — DB-served bootstrap === committed geostat manifest ─────
//
// ADR-0026 Phase B, decision 5 (the api/DB half of the parity chain).
//
// CONTRACT: against a fresh-migrated DB, runProvisioning(generated dir) followed by
// the bootstrap composition (GET /api/bootstrap) yields a SiteManifest EQUIVALENT
// to the local buildManifest(). It is the gate proving the TS→JSON→DB extraction is
// LOSSLESS — that DB extraction can replace the TS sources with confidence.
//
// Equivalence is NOT byte-equality (decision 5): the API injects schemaVersion,
// forward-migrates pages on read, and derives datasources from config.data_source
// (covered separately by seed-data-sources). The canonical projection compared:
//   { indexPageId, pages (by config.id, migrated BOTH sides), nav (NavEntry[]),
//     chrome, chromeConfig, i18n, modes }.
// datasources are excluded (their parity is verify-parity.ts's concern).
//
// WHY the comparison target is the committed JSON, not buildManifest() imported
// here: apps/api deliberately does NOT compile the @statdash/react runtime graph
// (Law 3 / dependency arrow). The committed geostat.provisioning.json IS the
// serialized buildManifest() (the export script + its slug fail-fast guarantee
// that), and the geostat-side fitness test (export-provisioning.fitness.test.ts)
// proves committed-JSON === buildManifest(). So:
//     buildManifest() === committed JSON   (geostat test, no DB)
//     committed JSON   === DB-served bootstrap (this test, live DB)
//   ⇒ buildManifest() === DB-served bootstrap, with no arrow violation.
//
// NOTE — the equivalence proven is MIGRATED equality: this api-side compares
// migratePageConfig-stamped pages on BOTH operands, the geostat-side compares raw.
// Today they coincide (schemaVersion=1, no registered page-level migrations ⇒
// migrate is a pure stamp), but once a real page-level migration is registered the
// chain proves migrated-equality, not raw-equality.
//
// PLUS the i18n ↔ config.locale agreement assertion (decision 1): every code in
// i18n.locales exists + is_active in config.locale, and i18n.defaultLocale is the
// is_default locale. config.locale stays SSOT; site_config.i18n is its projection.
//
// ISOLATION: bootstrap returns ALL published pages, so a shared CI DB may hold
// pages beyond the geostat set (example.page.json, prior tests). We therefore
// assert the geostat content is a LOSSLESS SUBSET of what bootstrap returns (every
// committed page has an equivalent migrated page in bootstrap; the 6 site_config
// blobs match exactly — those keys are singletons, so they ARE owned by this run).
// This proves geostat round-trips losslessly without requiring DB exclusivity.
//
// Requires a live migrated DB → describe.skip when DATABASE_URL is absent (the
// upsert.scd2.test.ts pattern): a no-op locally, a real gate in CI.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, copyFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FastifyInstance } from 'fastify'

// Env contract is parsed at import time (env.ts); set required vars BEFORE any
// import that reads it. DATABASE_URL is the real gate — only present in CI.
process.env.JWT_SECRET     ??= 'test-jwt-secret-at-least-32-chars-long!!'
process.env.ADMIN_USERNAME ??= 'admin'
process.env.ADMIN_PASSWORD ??= 'password1'
process.env.NODE_ENV        = 'test'

const DATABASE_URL = process.env.DATABASE_URL
const suite = DATABASE_URL ? describe : describe.skip

const here = dirname(fileURLToPath(import.meta.url))
// src/routes/bootstrap → apps/api/provisioning/geostat.provisioning.json
const ARTIFACT_PATH = resolve(here, '../../../provisioning/geostat.provisioning.json')

// ── Canonical projection types ────────────────────────────────────────────────
interface PageEntry { slug: string; config: { id: string } & Record<string, unknown> }
interface SiteEntry { key: string; value: unknown }
interface Artifact  { version: number; pages: PageEntry[]; siteConfig: SiteEntry[] }

interface BootstrapManifest {
  schemaVersion: number
  indexPageId:   string
  pages:         Record<string, Record<string, unknown>>
  nav:           unknown
  chrome:        unknown
  chromeConfig:  unknown
  i18n:          { locales?: unknown; defaultLocale?: unknown }
  modes:         unknown
  datasources:   unknown[]
}

suite('DB-served bootstrap === committed geostat manifest (ADR-0026 Phase B)', () => {
  let app: FastifyInstance
  let tmpDir: string
  let artifact: Artifact
  let bootstrap: BootstrapManifest

  beforeAll(async () => {
    artifact = JSON.parse(await readFile(ARTIFACT_PATH, 'utf8')) as Artifact

    // Provision ONLY the geostat artifact (isolated temp dir) so the run upserts
    // exactly the content under test — not example.page.json or other files in the
    // committed provisioning dir.
    tmpDir = await mkdtemp(join(tmpdir(), 'geostat-parity-'))
    await copyFile(ARTIFACT_PATH, join(tmpDir, 'geostat.provisioning.json'))

    // Boot a minimal app: db plugin (app.pg) + the real bootstrap route. No mocks
    // — this exercises the actual composition SQL + migratePageConfig on read.
    const Fastify = (await import('fastify')).default
    const { dbPlugin } = await import('../../db.js')
    const { bootstrapRoutes } = await import('./index.js')
    const { runProvisioning } = await import('../../provisioning/loader.js')

    app = Fastify()
    await app.register(dbPlugin)
    await app.register(bootstrapRoutes, { prefix: '/api/bootstrap' })
    await app.ready()

    // Seed the DB from the generated artifact via the real loader (the same path
    // boot uses). Idempotent — converges whether or not it ran before.
    await runProvisioning(app.pg, { dir: tmpDir })

    const res = await app.inject({ method: 'GET', url: '/api/bootstrap/' })
    expect(res.statusCode).toBe(200)
    bootstrap = res.json() as BootstrapManifest
  })

  afterAll(async () => {
    if (app) await app.close()
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true })
  })

  // ── Pages: lossless subset, migrated on BOTH sides ──────────────────────────
  it('every committed page is present in bootstrap, migrated and equivalent', async () => {
    const { migratePageConfig } = await import('@statdash/engine')
    for (const page of artifact.pages) {
      const id = page.config.id
      const served = bootstrap.pages[id]
      expect(served, `bootstrap is missing page '${id}'`).toBeDefined()
      // Migrate the committed config the SAME way bootstrap migrates the stored one,
      // so the comparison is migrated-vs-migrated (decision 5), not raw-vs-migrated.
      const expected = migratePageConfig(JSON.parse(JSON.stringify(page.config)))
      expect(served).toEqual(expected)
    }
  })

  it('indexPageId matches the committed index_page_id', () => {
    const indexEntry = artifact.siteConfig.find((s) => s.key === 'index_page_id')
    expect(bootstrap.indexPageId).toBe(indexEntry?.value)
  })

  // ── The site_config blobs — emitted verbatim, exact equality ────────────────
  const blobKeys: Array<[string, keyof BootstrapManifest]> = [
    ['chrome',        'chrome'],
    ['chrome_config', 'chromeConfig'],
    ['i18n',          'i18n'],
    ['modes',         'modes'],
    ['nav',           'nav'],
  ]
  for (const [siteKey, manifestField] of blobKeys) {
    it(`bootstrap.${String(manifestField)} === committed site_config.${siteKey} (verbatim)`, () => {
      const entry = artifact.siteConfig.find((s) => s.key === siteKey)
      expect(bootstrap[manifestField]).toEqual(entry?.value)
    })
  }

  // ── i18n ↔ config.locale agreement (decision 1) ─────────────────────────────
  it('every i18n.locales code exists + is_active in config.locale; defaultLocale is the is_default locale', async () => {
    const locales = bootstrap.i18n.locales
    expect(Array.isArray(locales)).toBe(true)

    const { rows } = await app.pg.query<{ code: string; is_active: boolean; is_default: boolean }>(
      `SELECT code, is_active, is_default FROM config.locale`,
    )
    const byCode = new Map(rows.map((r) => [r.code, r]))

    for (const code of locales as string[]) {
      const row = byCode.get(code)
      expect(row, `i18n.locales code '${code}' is not in config.locale (SSOT)`).toBeDefined()
      expect(row!.is_active, `i18n.locales code '${code}' is not is_active in config.locale`).toBe(true)
    }

    const defaultRow = rows.find((r) => r.is_default)
    expect(defaultRow, 'config.locale has no is_default locale').toBeDefined()
    expect(bootstrap.i18n.defaultLocale).toBe(defaultRow!.code)
  })

  it('schemaVersion is stamped by the API (not present in the manifest sources)', () => {
    expect(typeof bootstrap.schemaVersion).toBe('number')
  })
})
