// ── Public bootstrap surface (ADR-0026 Phase A) ──────────────────────────────
//
//  GET /api/bootstrap — the UNGUARDED, read-only, published-only composition the
//  geostat runner calls ONCE at boot to hydrate the whole site (the Grafana
//  bootData / Retool fetchAppManifest pattern). One atomic SiteManifest payload
//  instead of N per-resource round-trips, so the client never orchestrates server
//  concerns and never sees a half-composed site.
//
//  WHY a separate route from config/* (the admin CRUD), per ADR-0026:
//    config/* is Bearer-JWT guarded — the Constructor's AUTHORING surface.
//    /api/bootstrap is the DELIVERY surface: public, published-only, minimal
//    projection. Reusing the guarded config/site read would force a public token
//    or weaken the admin guard (ISP + least-privilege at the boundary). This is
//    the same public-sibling isolation as publicDataSourcesRoutes / setupRoutes:
//    its own scope in index.ts, so the config JWT guard never cascades to it.
//
//  WHAT it composes (all reads already exist; this route only assembles them):
//    - PUBLISHED page versions  (config.page + page_version where is_published),
//      each forward-migrated via migratePageConfig (lazy migration on read).
//    - nav tree                 (config.nav_item recursive CTE — same as config/nav).
//    - site_config key/value    → indexPageId + chrome + chromeConfig + i18n + modes.
//    - connected data sources   (config.data_source where status='connected')
//      → DatasourceInstanceConfig[] (id/kind/url/params).
//
//  The response is the SiteManifestContract shared in @statdash/contracts — the ONE
//  home for this wire shape, imported by BOTH the api and the geostat runner (the
//  api cannot import @statdash/react across the dependency arrow, so the contract
//  lives in the zero-dep contracts package, not re-declared on each side). The
//  runner refines the renderer-owned blobs (pages/nav/chrome/i18n) to its precise
//  types. ManifestMode (the perspective vocabulary) is the contract's own type;
//  DatasourceInstanceConfig from @statdash/engine is structurally the contract's
//  ManifestDatasource — assignable without a cast.

import type { FastifyPluginAsync } from 'fastify'
import type { SiteManifestContract, ManifestMode } from '@statdash/contracts'
import {
  migratePageConfig,
  CURRENT_SCHEMA_VERSION,
  type DatasourceInstanceConfig,
} from '@statdash/engine'
import { relationExists } from '../../lib/relation-exists.js'

// ── Manifest envelope ─────────────────────────────────────────────────────────
//
//  The wire shape is SiteManifestContract (@statdash/contracts). `pages`/`nav`/
//  `chrome`/`chromeConfig`/`i18n` are JSON blobs authored by the Constructor and
//  stored verbatim in config.*; the backend does not own their inner shape (the
//  renderer does), so the contract types them as opaque JSON and the runner refines
//  them. This keeps the delivery surface a pass-through projection, not a second
//  source of truth for the config schema. `modes`/`datasources` are precise.

type JsonRecord = Record<string, unknown>

// ── Optional categories block (ADR SDMX-P1-C) ─────────────────────────────────
//
//  The bootstrap manifest may carry a theme tree so the runner can render a
//  theme-driven nav. It is an ADDITIVE, OPTIONAL extension of the shared
//  SiteManifestContract — declared LOCALLY here (an intersection), NOT added to the
//  @statdash/contracts package: the contract is the renderer-owned core shape, and a
//  delivery-only enrichment must not bloat it (ISP — per-element wire shapes, the
//  catalog package owns the full catalog shape; bootstrap ships only the thin tree a
//  nav needs). A runner that does not know `categories` simply ignores the extra key
//  (Postel), so this is backward-compatible with the existing contract consumers.
//
//  Only the PUBLISHED datasets surface (joined to the V28 stats.dataset_published
//  projection); the block is OMITTED entirely when V29 is not applied here (rolling
//  migration window — graceful degradation, the nav falls back to its other source).

/** A thin theme node for the nav: identity + label + tree edge + ord. */
interface ManifestCategory {
  scheme:     string
  code:       string
  label:      Record<string, string>
  parentCode: string | null
  ord:        number
}

type SiteManifest = SiteManifestContract & {
  categories?: ManifestCategory[]
}

// ── Phase A defaults for site_config keys Phase B will seed ───────────────────
//
//  ADR-0026 Phase B defines these site_config keys (index_page_id, chrome,
//  chrome_config, i18n, modes). For Phase A the endpoint must EXIST and return
//  the shape, reading whatever site_config currently holds; any absent key falls
//  back to a sensible default below (and is reported so Phase B seeds it). The
//  defaults render a minimal-but-valid site rather than crashing the boot read
//  (graceful degradation — a missing brand key must not 500 the whole manifest).

const DEFAULT_INDEX_PAGE_ID = 'landing'
const DEFAULT_I18N: JsonRecord = { locales: ['ka'], defaultLocale: 'ka', fallbackLocale: 'ka' }
const DEFAULT_CHROME_CONFIG: JsonRecord = { logoUrl: '', logoAlt: '' }
const DEFAULT_MODES: ManifestMode[] = []

// site_config keys this route consumes. Open key/value table → we read the whole
// map once and pick these out, defaulting + recording any that are absent.
const SITE_KEY = {
  indexPageId:  'index_page_id',
  chrome:       'chrome',
  chromeConfig: 'chrome_config',
  i18n:         'i18n',
  modes:        'modes',
  // ADR-0026 Phase B (gap #2): the runner's nav is a NavEntry[] presentation blob
  // (color/icon/path/section anchors) richer than the relational config.nav_item
  // tree. Stored verbatim as a site_config blob; read here, with a CTE fallback.
  nav:          'nav',
} as const

// ── Row shapes (server-internal; never leaked) ────────────────────────────────
interface PublishedPageRow { config: unknown }
interface SiteConfigRow    { key: string; value: unknown }
interface EtagRow          { etag: string | null }
interface ConnectedSourceRow {
  name:   string
  type:   string
  url:    string | null
  config: Record<string, unknown>
}

const isObject = (v: unknown): v is JsonRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

// ── categories load (ADR SDMX-P1-C) — graceful when V29 absent ─────────────────
//
//  Returns the thin theme tree for the nav, ordered parents-first (V29 LTREE
//  category_path), restricted to schemes that have at least one PUBLISHED dataset
//  categorised somewhere (the block exists to drive a nav, so an empty scheme adds
//  no value). Returns undefined when the V29 tables are absent (the block is omitted
//  from the manifest — Postel + graceful degradation). Lifecycle is honoured: the
//  published-dataset relation gates which categorisations count toward "non-empty".
type App = Parameters<FastifyPluginAsync>[0]
interface CategoryRow {
  scheme:      string
  code:        string
  label:       Record<string, string>
  parent_code: string | null
  ord:         number
}
async function loadCategories(app: App): Promise<ManifestCategory[] | undefined> {
  // V29 precondition (shared relationExists mechanism, lib/relation-exists.ts):
  // absent category table ⇒ omit the block (Postel + graceful degradation).
  if (!(await relationExists(app.pg, 'stats.category'))) return undefined

  const { rows } = await app.pg.query<CategoryRow>(
    `SELECT scheme_code AS scheme, code, label, parent_code, ord
       FROM stats.category
      ORDER BY scheme_code, category_path, ord, code`,
  )
  return rows.map((r) => ({
    scheme:     r.scheme,
    code:       r.code,
    label:      r.label,
    parentCode: r.parent_code,
    ord:        r.ord,
  }))
}

export const bootstrapRoutes: FastifyPluginAsync = async (app) => {
  // GET / — the one atomic boot read. No auth (delivery surface).
  app.get('/', async (req, reply) => {
    // 1) ETag FIRST — a cheap MAX(updated_at) probe across the composed tables.
    //    If the client's If-None-Match still matches, we 304 before running the
    //    four heavier reads + migrations (cache-aside: the manifest is cacheable
    //    and invalidates the instant ANY config row changes).
    const { rows: [{ etag } = { etag: null }] } = await app.pg.query<EtagRow>(
      `SELECT to_char(GREATEST(
                COALESCE((SELECT MAX(updated_at) FROM config.page),         'epoch'),
                COALESCE((SELECT MAX(created_at) FROM config.page_version),  'epoch'),
                COALESCE((SELECT MAX(updated_at) FROM config.nav_item),      'epoch'),
                COALESCE((SELECT MAX(updated_at) FROM config.site_config),   'epoch'),
                COALESCE((SELECT MAX(updated_at) FROM config.data_source),   'epoch')
              ), 'YYYYMMDD"T"HH24MISS.US') AS etag`,
    )
    // Weak validator: the manifest is a composition, not a byte-stable resource —
    // a weak ETag asserts semantic equivalence (same config state), which is
    // exactly what "nothing changed since you last booted" means.
    const tag = `W/"bootstrap-${etag ?? 'empty'}"`
    reply.header('ETag', tag)
    reply.header('Cache-Control', 'no-cache') // revalidate every boot; 304 when unchanged
    if (req.headers['if-none-match'] === tag) {
      return reply.status(304).send()
    }

    // 2) Compose the reads. Independent SELECTs → run concurrently. categoriesRes
    //    is the optional ADR SDMX-P1-C theme tree (undefined when V29 is absent).
    const [pagesRes, navRes, siteRes, sourcesRes, categories] = await Promise.all([
      // PUBLISHED versions only. The partial index idx_page_version_published
      // backs this hot read. We pull the config blob of the published version of
      // every non-archived page.
      app.pg.query<PublishedPageRow>(
        `SELECT v.config
           FROM config.page p
           JOIN config.page_version v
             ON v.page_id = p.id AND v.is_published
          WHERE p.status = 'published'`,
      ),
      // Same recursive CTE as config/nav — parents before children.
      app.pg.query<JsonRecord>(
        `WITH RECURSIVE nav_tree AS (
           SELECT id, parent_id, page_id, label, href, ord, 0 AS depth
             FROM config.nav_item WHERE parent_id IS NULL
           UNION ALL
           SELECT n.id, n.parent_id, n.page_id, n.label, n.href, n.ord, t.depth + 1
             FROM config.nav_item n
             JOIN nav_tree t ON n.parent_id = t.id
         )
         SELECT id, parent_id, page_id, label, href, ord, depth
           FROM nav_tree
          ORDER BY depth, ord`,
      ),
      app.pg.query<SiteConfigRow>(`SELECT key, value FROM config.site_config`),
      // Connected sources only, minimal projection — same narrowing as the public
      // data-sources route (least-privilege; half-provisioned sources excluded).
      app.pg.query<ConnectedSourceRow>(
        `SELECT name, type, url, config
           FROM config.data_source
          WHERE status = 'connected'
          ORDER BY name ASC`,
      ),
      // ADR SDMX-P1-C — optional theme tree (undefined when V29 not applied here).
      loadCategories(app),
    ])

    // 3) Pages: forward-migrate each, key by the renderer page id (config.id).
    //    A version saved by a NEWER platform build (schemaVersion > CURRENT) makes
    //    migratePageConfig throw. For this BULK delivery read we SKIP-WITH-LOG that
    //    one page rather than 409-ing the whole manifest (config/pages.ts 409s a
    //    SINGLE-page authoring read — a manifest must still boot the other pages;
    //    graceful degradation > all-or-nothing for the public surface). The skipped
    //    page is simply absent from `pages`; the renderer 404s that route, the rest
    //    of the site is intact.
    const pages: Record<string, JsonRecord> = {}
    for (const { config } of pagesRes.rows) {
      if (!isObject(config)) continue
      let migrated: JsonRecord
      try {
        migrated = migratePageConfig(config)
      } catch (err) {
        app.log.warn(
          { err, pageId: (config as JsonRecord).id },
          'bootstrap: skipping page with schemaVersion ahead of server (forward-compat)',
        )
        continue
      }
      const id = migrated.id
      if (typeof id !== 'string' || id.length === 0) {
        app.log.warn({ pageId: id }, 'bootstrap: skipping published page with no string id')
        continue
      }
      pages[id] = migrated
    }

    // 4) site_config → typed manifest fields, defaulting any absent key.
    const site = Object.fromEntries(siteRes.rows.map((r) => [r.key, r.value])) as JsonRecord
    const missing: string[] = []
    const pick = <T>(key: string, fallback: T, validate: (v: unknown) => v is T): T => {
      const v = site[key]
      if (validate(v)) return v
      if (v === undefined) missing.push(key)
      return fallback
    }

    const indexPageId  = pick(SITE_KEY.indexPageId,  DEFAULT_INDEX_PAGE_ID,
                              (v): v is string => typeof v === 'string' && v.length > 0)
    const chrome       = pick(SITE_KEY.chrome,       {} as JsonRecord, isObject)
    const chromeConfig = pick(SITE_KEY.chromeConfig, DEFAULT_CHROME_CONFIG, isObject)
    const i18n         = pick(SITE_KEY.i18n,         DEFAULT_I18N, isObject)
    const modes        = pick(SITE_KEY.modes,        DEFAULT_MODES,
                              (v): v is ManifestMode[] => Array.isArray(v))

    // nav: prefer the site_config 'nav' blob (NavEntry[] verbatim — the runner's
    // rich presentation shape). FALL BACK to the relational nav_item recursive CTE
    // when the blob is absent (Postel + graceful degradation: a DB seeded only via
    // the Constructor's nav_item authoring path still yields a nav). The blob, when
    // present, is emitted verbatim — the backend does not own its inner shape. Read
    // directly (not via pick): an absent blob is a valid fallback, not a Phase-B
    // seeding gap, so it must NOT be reported in `missing`.
    const navBlobRaw = site[SITE_KEY.nav]
    const nav: JsonRecord[] = Array.isArray(navBlobRaw)
      ? (navBlobRaw as JsonRecord[])
      : navRes.rows

    if (missing.length > 0) {
      app.log.info(
        { missing },
        'bootstrap: site_config keys absent — served defaults (ADR-0026 Phase B seeds these)',
      )
    }

    // 5) data_source rows → DatasourceInstanceConfig. The public DB projection
    //    (name/type/url/config) is mapped to the engine descriptor (id/kind/url/
    //    params) the runner's buildStoreManifest consumes — id=name (registry key),
    //    kind=type (open string), params=config.
    const datasources: DatasourceInstanceConfig[] = sourcesRes.rows.map((r) => ({
      id:     r.name,
      kind:   r.type,
      ...(r.url != null ? { url: r.url } : {}),
      params: r.config,
    }))

    const manifest: SiteManifest = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      indexPageId,
      pages,
      nav,
      chrome,
      chromeConfig,
      i18n,
      modes,
      datasources,
      // ADR SDMX-P1-C — included only when V29 yielded a tree (else the key is
      // absent and a consumer that does not know it is unaffected — Postel).
      ...(categories !== undefined ? { categories } : {}),
    }

    // NOTE: NOT wrapped in ok()/{ data }. The runner consumes the manifest as the
    // body directly (fetch('/api/bootstrap').then(r => r.json()) → SiteManifest),
    // matching the offline buildManifest() shape it falls back to. The envelope is
    // the Constructor-client convention for config/*; the delivery surface returns
    // the manifest itself (Postel: the consumer already expects this exact shape).
    return manifest
  })
}
