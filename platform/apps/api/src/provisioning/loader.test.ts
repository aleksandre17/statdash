import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runProvisioning } from './loader.js'
import type { PgPool, PgClient, QueryResult } from './types.js'

// ── FakePg — an in-memory stand-in for the PgPool port ────────────────────────
// Models just enough of config.page + config.page_version to assert the loader's
// idempotency contract without a real database. The loader depends on the PgPool
// PORT, so this fake is a drop-in (Dependency Inversion in action).

interface PageRow { id: string; slug: string; title: string; status: string }
interface VersionRow { id: string; page_id: string; version_number: number; config: unknown; data_specs: unknown; is_published: boolean }
interface SiteConfigRow { key: string; value: unknown }

class FakePg implements PgPool {
  pages: PageRow[] = []
  versions: VersionRow[] = []
  siteConfig: SiteConfigRow[] = []
  private seq = 0
  /** Counts every page_version INSERT — the idempotency assertion hinges on this. */
  versionInserts = 0
  /** Counts every is_published promotion UPDATE — asserts the publish-fix fires. */
  publishUpdates = 0

  async connect(): Promise<PgClient> {
    return {
      query: <R>(sql: string, params?: unknown[]) => this.query<R>(sql, params),
      release: () => {},
    }
  }

  async query<R = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<QueryResult<R>> {
    const s = sql.replace(/\s+/g, ' ').trim()

    if (s.startsWith('BEGIN') || s.startsWith('COMMIT') || s.startsWith('ROLLBACK')) {
      return { rows: [] }
    }
    if (s.includes('SELECT id FROM config.page WHERE slug')) {
      const row = this.pages.find((p) => p.slug === params[0])
      return { rows: (row ? [{ id: row.id }] : []) as R[] }
    }
    if (s.startsWith('INSERT INTO config.page ')) {
      const id = `page-${++this.seq}`
      this.pages.push({ id, slug: params[0] as string, title: params[1] as string, status: params[2] as string })
      return { rows: [{ id }] as R[] }
    }
    if (s.startsWith('UPDATE config.page SET title')) {
      const p = this.pages.find((x) => x.id === params[0])
      if (p) { p.title = params[1] as string; p.status = params[2] as string }
      return { rows: [] }
    }
    if (s.includes('SELECT id, config, data_specs, is_published FROM config.page_version')) {
      const latest = this.latestVersion(params[0] as string)
      return {
        rows: (latest
          ? [{ id: latest.id, config: latest.config, data_specs: latest.data_specs, is_published: latest.is_published }]
          : []) as R[],
      }
    }
    if (s.includes('SELECT id, is_published FROM config.page_version')) {
      const latest = this.latestVersion(params[0] as string)
      return { rows: (latest ? [{ id: latest.id, is_published: latest.is_published }] : []) as R[] }
    }
    if (s.startsWith('INSERT INTO config.page_version')) {
      this.versionInserts++
      const pageId = params[0] as string
      const next = this.versions.filter((v) => v.page_id === pageId).length + 1
      this.versions.push({
        id: `ver-${pageId}-${next}`,
        page_id: pageId,
        version_number: next,
        config: JSON.parse(params[1] as string),
        data_specs: JSON.parse(params[2] as string),
        is_published: false,
      })
      return { rows: [] }
    }
    if (s.startsWith('UPDATE config.page_version SET is_published')) {
      this.publishUpdates++
      const pageId = params[0] as string
      const headId = params[1] as string
      for (const v of this.versions) {
        if (v.page_id === pageId) v.is_published = v.id === headId
      }
      return { rows: [] }
    }
    if (s.includes('SELECT value FROM config.site_config WHERE key')) {
      const row = this.siteConfig.find((r) => r.key === params[0])
      return { rows: (row ? [{ value: row.value }] : []) as R[] }
    }
    if (s.startsWith('INSERT INTO config.site_config')) {
      const key = params[0] as string
      const value = JSON.parse(params[1] as string)
      const existing = this.siteConfig.find((r) => r.key === key)
      if (existing) existing.value = value
      else this.siteConfig.push({ key, value })
      return { rows: [] }
    }
    throw new Error(`FakePg: unhandled SQL: ${s}`)
  }

  private latestVersion(pageId: string): VersionRow | undefined {
    return this.versions
      .filter((v) => v.page_id === pageId)
      .sort((a, b) => b.version_number - a.version_number)[0]
  }
}

async function withDir(files: Record<string, string>, fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'prov-'))
  try {
    for (const [name, content] of Object.entries(files)) {
      await writeFile(join(dir, name), content, 'utf8')
    }
    await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

const PAGE_JSON = JSON.stringify({ id: 'gdp', type: 'inner-page', path: '/gdp', children: [] })

describe('runProvisioning', () => {
  let pg: FakePg
  beforeEach(() => { pg = new FakePg() })

  it('creates a page from a direct page-config file', async () => {
    await withDir({ 'gdp.page.json': PAGE_JSON }, async (dir) => {
      const report = await runProvisioning(pg, { dir, logger: silent })
      expect(report.results).toEqual([{ kind: 'page', key: 'gdp', outcome: 'created' }])
      expect(pg.pages).toHaveLength(1)
      expect(pg.versionInserts).toBe(1)
    })
  })

  it('is idempotent: a second run on an unchanged file appends no new version', async () => {
    await withDir({ 'gdp.page.json': PAGE_JSON }, async (dir) => {
      await runProvisioning(pg, { dir, logger: silent })
      const second = await runProvisioning(pg, { dir, logger: silent })
      expect(second.results).toEqual([{ kind: 'page', key: 'gdp', outcome: 'unchanged' }])
      expect(pg.versionInserts).toBe(1)          // still 1 — no churn
      expect(pg.publishUpdates).toBe(1)          // published once on first run; not re-promoted
    })
  })

  // ── Publish-state fix (ADR-0026 Phase B, gap #1) ──────────────────────────────
  // A provisioned page that defaults to status='published' must have its appended
  // version's is_published flipped true (bootstrap needs BOTH p.status='published'
  // AND v.is_published). Without this, a provisioned page returns ZERO from bootstrap.

  it('publishes the appended version when status defaults to published', async () => {
    await withDir({ 'gdp.page.json': PAGE_JSON }, async (dir) => {
      await runProvisioning(pg, { dir, logger: silent })
      const head = pg.versions.find((v) => v.page_id === pg.pages[0].id && v.version_number === 1)
      expect(head?.is_published).toBe(true)      // the gap-#1 fix
      expect(pg.publishUpdates).toBe(1)
    })
  })

  it('promotes the new version + demotes the old one when a published page changes', async () => {
    await withDir({ 'gdp.page.json': PAGE_JSON }, async (dir) => {
      await runProvisioning(pg, { dir, logger: silent })
      await writeFile(
        join(dir, 'gdp.page.json'),
        JSON.stringify({ id: 'gdp', type: 'inner-page', path: '/gdp', children: [{ type: 'filter-bar' }] }),
        'utf8',
      )
      await runProvisioning(pg, { dir, logger: silent })
      const byNumber = pg.versions
        .filter((v) => v.page_id === pg.pages[0].id)
        .sort((a, b) => a.version_number - b.version_number)
      expect(byNumber).toHaveLength(2)
      expect(byNumber[0].is_published).toBe(false)   // old version demoted
      expect(byNumber[1].is_published).toBe(true)    // new version published
    })
  })

  it('does NOT publish a draft-status page (must stay out of bootstrap)', async () => {
    const manifest = JSON.stringify({
      version: 1,
      pages: [{ slug: 'wip', title: { en: 'WIP' }, config: { type: 'inner-page' }, status: 'draft' }],
    })
    await withDir({ 'site.json': manifest }, async (dir) => {
      await runProvisioning(pg, { dir, logger: silent })
      const head = pg.versions[0]
      expect(head.is_published).toBe(false)      // draft never publishes
      expect(pg.publishUpdates).toBe(0)
    })
  })

  it('appends a new version when the config tree changes', async () => {
    await withDir({ 'gdp.page.json': PAGE_JSON }, async (dir) => {
      await runProvisioning(pg, { dir, logger: silent })
      // Mutate the file, re-run.
      await writeFile(
        join(dir, 'gdp.page.json'),
        JSON.stringify({ id: 'gdp', type: 'inner-page', path: '/gdp', children: [{ type: 'filter-bar' }] }),
        'utf8',
      )
      const report = await runProvisioning(pg, { dir, logger: silent })
      expect(report.results[0].outcome).toBe('updated')
      expect(pg.versionInserts).toBe(2)
    })
  })

  it('dryRun writes nothing', async () => {
    await withDir({ 'gdp.page.json': PAGE_JSON }, async (dir) => {
      const report = await runProvisioning(pg, { dir, dryRun: true, logger: silent })
      expect(report.results[0]).toMatchObject({ outcome: 'skipped', reason: 'dry-run' })
      expect(pg.pages).toHaveLength(0)
      expect(pg.versionInserts).toBe(0)
    })
  })

  it('parses a multi-resource manifest (version: 1)', async () => {
    const manifest = JSON.stringify({
      version: 1,
      pages: [{ slug: 'a', title: { en: 'A' }, config: { type: 'inner-page' } }],
    })
    await withDir({ 'site.json': manifest }, async (dir) => {
      const report = await runProvisioning(pg, { dir, logger: silent })
      expect(report.parsed).toBe(1)
      expect(report.results[0]).toMatchObject({ kind: 'page', key: 'a', outcome: 'created' })
    })
  })

  it('records a malformed file as a failure without aborting the run', async () => {
    await withDir({ 'bad.json': '{ not json', 'gdp.page.json': PAGE_JSON }, async (dir) => {
      const report = await runProvisioning(pg, { dir, logger: silent })
      expect(report.failures).toHaveLength(1)
      expect(report.failures[0].file).toMatch(/bad\.json$/)
      expect(report.results).toHaveLength(1)     // the good file still applied
    })
  })

  it('returns a no-op report when the directory does not exist', async () => {
    const report = await runProvisioning(pg, { dir: join(tmpdir(), 'does-not-exist-xyz'), logger: silent })
    expect(report.files).toBe(0)
    expect(report.results).toHaveLength(0)
  })

  // ── siteConfig upsert (ADR-0026 Phase B) ──────────────────────────────────────

  it('upserts site_config entries (key/value blobs) from a manifest', async () => {
    const manifest = JSON.stringify({
      version: 1,
      siteConfig: [
        { key: 'index_page_id', value: 'landing' },
        { key: 'nav', value: [{ id: 'gdp', label: 'მშპ', path: '/gdp' }] },
      ],
    })
    await withDir({ 'site.json': manifest }, async (dir) => {
      const report = await runProvisioning(pg, { dir, logger: silent })
      expect(report.results).toEqual([
        { kind: 'siteConfig', key: 'index_page_id', outcome: 'created' },
        { kind: 'siteConfig', key: 'nav', outcome: 'created' },
      ])
      expect(pg.siteConfig).toEqual([
        { key: 'index_page_id', value: 'landing' },
        { key: 'nav', value: [{ id: 'gdp', label: 'მშპ', path: '/gdp' }] },
      ])
    })
  })

  it('is idempotent for site_config: unchanged value short-circuits to unchanged', async () => {
    const manifest = JSON.stringify({
      version: 1,
      siteConfig: [{ key: 'i18n', value: { locales: ['ka'], defaultLocale: 'ka' } }],
    })
    await withDir({ 'site.json': manifest }, async (dir) => {
      await runProvisioning(pg, { dir, logger: silent })
      const second = await runProvisioning(pg, { dir, logger: silent })
      expect(second.results).toEqual([{ kind: 'siteConfig', key: 'i18n', outcome: 'unchanged' }])
    })
  })

  it('updates a site_config value that changed', async () => {
    await withDir({ 'site.json': JSON.stringify({ version: 1, siteConfig: [{ key: 'chrome', value: { AppBanner: 'hidden' } }] }) }, async (dir) => {
      await runProvisioning(pg, { dir, logger: silent })
      await writeFile(
        join(dir, 'site.json'),
        JSON.stringify({ version: 1, siteConfig: [{ key: 'chrome', value: { AppBanner: 'visible' } }] }),
        'utf8',
      )
      const report = await runProvisioning(pg, { dir, logger: silent })
      expect(report.results).toEqual([{ kind: 'siteConfig', key: 'chrome', outcome: 'updated' }])
      expect(pg.siteConfig[0].value).toEqual({ AppBanner: 'visible' })
    })
  })

  it('dryRun does not write site_config', async () => {
    await withDir({ 'site.json': JSON.stringify({ version: 1, siteConfig: [{ key: 'chrome', value: {} }] }) }, async (dir) => {
      const report = await runProvisioning(pg, { dir, dryRun: true, logger: silent })
      expect(report.results[0]).toMatchObject({ kind: 'siteConfig', outcome: 'skipped', reason: 'dry-run' })
      expect(pg.siteConfig).toHaveLength(0)
    })
  })

  // ── Governed-catalog data-safety (AR-49 M2.2 / SPEC-M2 decision #4) ────────────
  // `metrics`/`dimensions` are steward-authorable IN-TOOL: a steward save writes into
  // the same site_config keys provisioning seeds. Provisioning must therefore MERGE
  // per entry-id, never replace — so a re-provision can seed genuinely-new catalog
  // entries yet NEVER wipes a metric/dimension a steward authored in the tool.

  const catalogManifest = (metrics: unknown[]): string =>
    JSON.stringify({ version: 1, siteConfig: [{ key: 'metrics', value: metrics }] })

  const A = { id: 'gdp.current', code: 'gdp-cur', label: { en: 'GDP' }, dataSource: 'gdp' }
  const STEWARD = { id: 'steward.custom', code: 'x-custom', label: { en: 'Steward metric' }, dataSource: 'gdp' }

  it('seeds a genuinely-absent governed catalog on first provision (create)', async () => {
    await withDir({ 'site.json': catalogManifest([A]) }, async (dir) => {
      const report = await runProvisioning(pg, { dir, logger: silent })
      expect(report.results).toEqual([{ kind: 'siteConfig', key: 'metrics', outcome: 'created' }])
      expect(pg.siteConfig[0].value).toEqual([A])
    })
  })

  it('a steward-authored metric SURVIVES a re-provision (no wipe — the data-safety guard)', async () => {
    await withDir({ 'site.json': catalogManifest([A]) }, async (dir) => {
      // 1) Initial provision seeds the catalog with the provisioning-owned metric A.
      await runProvisioning(pg, { dir, logger: silent })
      expect(pg.siteConfig[0].value).toEqual([A])

      // 2) Simulate the steward authoring a metric in-tool: PUT /api/config/site
      //    replaces `metrics` with [provisioned + steward-authored].
      pg.siteConfig[0].value = [A, STEWARD]

      // 3) Re-run provisioning with the UNCHANGED file (only A). A naive wholesale
      //    replace would clobber STEWARD; the per-id merge preserves it.
      const second = await runProvisioning(pg, { dir, logger: silent })

      // A's id already present ⇒ nothing to seed ⇒ merged === stored ⇒ unchanged.
      expect(second.results).toEqual([{ kind: 'siteConfig', key: 'metrics', outcome: 'unchanged' }])
      expect(pg.siteConfig[0].value).toEqual([A, STEWARD])   // STEWARD survived
    })
  })

  it('seeds a genuinely-new provisioning metric while preserving steward-authored ones', async () => {
    const B = { id: 'gdp.deflator', code: 'gdp-def', label: { en: 'Deflator' }, dataSource: 'gdp' }
    await withDir({ 'site.json': catalogManifest([A]) }, async (dir) => {
      await runProvisioning(pg, { dir, logger: silent })
      pg.siteConfig[0].value = [A, STEWARD]                  // steward authored one

      // Provisioning JSON grows a genuinely-new metric B.
      await writeFile(join(dir, 'site.json'), catalogManifest([A, B]), 'utf8')
      const report = await runProvisioning(pg, { dir, logger: silent })

      expect(report.results).toEqual([{ kind: 'siteConfig', key: 'metrics', outcome: 'updated' }])
      // B seeded (absent id), STEWARD kept, A untouched — union by id.
      expect(pg.siteConfig[0].value).toEqual([A, STEWARD, B])
    })
  })

  it('does NOT overwrite a steward-edited metric that shares a provisioning id (existing wins — the accepted trade-off)', async () => {
    await withDir({ 'site.json': catalogManifest([A]) }, async (dir) => {
      await runProvisioning(pg, { dir, logger: silent })
      // Steward edits A's label in-tool (same id).
      const editedA = { ...A, label: { en: 'GDP (steward-renamed)' } }
      pg.siteConfig[0].value = [editedA]

      // Re-provision with the original A: its id is present ⇒ NOT re-applied.
      const report = await runProvisioning(pg, { dir, logger: silent })
      expect(report.results).toEqual([{ kind: 'siteConfig', key: 'metrics', outcome: 'unchanged' }])
      expect(pg.siteConfig[0].value).toEqual([editedA])      // steward edit preserved
    })
  })

  it('leaves OTHER site_config keys on wholesale replace (merge is scoped to the catalog keys)', async () => {
    await withDir({ 'site.json': JSON.stringify({ version: 1, siteConfig: [{ key: 'nav', value: [{ id: 'a' }] }] }) }, async (dir) => {
      await runProvisioning(pg, { dir, logger: silent })
      // A non-governed key still fully replaces on change (no per-id union).
      await writeFile(join(dir, 'site.json'), JSON.stringify({ version: 1, siteConfig: [{ key: 'nav', value: [{ id: 'b' }] }] }), 'utf8')
      const report = await runProvisioning(pg, { dir, logger: silent })
      expect(report.results).toEqual([{ kind: 'siteConfig', key: 'nav', outcome: 'updated' }])
      expect(pg.siteConfig[0].value).toEqual([{ id: 'b' }])  // replaced, not merged to [{a},{b}]
    })
  })
})

const silent = { info() {}, warn() {}, error() {} }
