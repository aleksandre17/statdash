// ── Site-config wire contract (GET /api/config/site) ──────────────────────────
//
//  The AUTHORING surface the Constructor panel reads to hydrate its site session
//  (apps/panel/src/lib/api.ts → configApi.site.get → fromApiSite). Distinct from
//  SiteManifestContract (manifest.ts), which is the DELIVERY surface the geostat
//  runner boots from (GET /api/bootstrap). Both project from config.*, but they
//  serve different consumers, so they are separate contracts.
//
//  The body is, and stays, an OPEN key/value map: site_config is a typed JSONB
//  key/value table (name, logo, theme_overrides, chrome, …) the panel persists
//  without a migration per setting (Postel — liberal in what it accepts). This
//  contract therefore EXTENDS Record<string, unknown> and names only the two
//  fields the api guarantees on top of that map:
//
//    - activeLocales / defaultLocale are a PROJECTION of config.locale (the SSOT
//      locale registry, V13). They are NOT stored in the site_config blob — the
//      api derives them on read (SELECT … FROM config.locale), so the locale set
//      has exactly one home (Law 1 / SSOT). The panel's locale editor reads
//      `activeLocales` instead of hardcoding ['ka','en'] (I18N-4).
//
//  Both sides import this one shape rather than re-declaring it: the api produces
//  it, the panel consumes it. It lives here (zero-dep contracts) because the api
//  cannot import a frontend package across the dependency arrow (Law 3).

/**
 * Response of GET /api/config/site.
 *
 * An open settings map (the site_config key/value blob, verbatim) PLUS two fields
 * the api always projects from the config.locale registry:
 *
 * @property activeLocales  Ordered active-locale codes —
 *   `SELECT code FROM config.locale WHERE is_active ORDER BY ord, code`.
 *   A projection of the SSOT registry, never duplicated into the site_config blob.
 * @property defaultLocale  The `is_default` locale code, falling back to the first
 *   `activeLocales` entry when no row is flagged default.
 */
export interface SiteConfigResponse extends Record<string, unknown> {
  activeLocales: string[]
  defaultLocale: string
}
