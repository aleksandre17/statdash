// ── Provisioning — boundary contracts (ports + file format) [P2-5] ────────────
//
// The FILE format authored in PROVISIONING_DIR and the narrow DB port the loader
// depends on. Kept separate from logic so both the loader and the export route
// share one source of truth for the manifest shape.

// ── Ports (Dependency Inversion) ──────────────────────────────────────────────

/** Minimal query result — only what the loader reads. */
export interface QueryResult<R = Record<string, unknown>> {
  rows: R[]
}

/** A pooled client for a single transactional unit of work. */
export interface PgClient {
  query<R = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<R>>
  release(): void
}

/**
 * The narrow Postgres surface the loader needs. @fastify/postgres' `app.pg`
 * satisfies this structurally; a fake satisfies it in tests. The loader depends
 * on this port, never on the driver — swap the adapter, the loader is unchanged.
 */
export interface PgPool {
  query<R = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<R>>
  connect(): Promise<PgClient>
}

/**
 * Structured logger port (subset of Fastify's logger). Defaults to console so the
 * loader is usable from scripts/CI without a Fastify app. Pass app.log in boot.
 */
export interface ProvisioningLogger {
  info(obj: unknown, msg?: string): void
  warn(obj: unknown, msg?: string): void
  error(obj: unknown, msg?: string): void
}

export const consoleLogger: ProvisioningLogger = {
  info:  (o, m) => console.log(m ?? '', o),
  warn:  (o, m) => console.warn(m ?? '', o),
  error: (o, m) => console.error(m ?? '', o),
}

// ── Manifest contract (file format) ───────────────────────────────────────────
// Validated structurally at the boundary (Postel's law: liberal in what we accept
// — unknown extra keys are ignored — but every load that reaches the DB has been
// narrowed to a known shape).

export type LocaleString = Record<string, string>

export interface PageProvision {
  /** URL path segment + the idempotency key (config.page.slug is UNIQUE). */
  slug:       string
  /** Multilingual page title, e.g. { ka: 'მშპ', en: 'GDP' }. */
  title:      LocaleString
  /** The NodePageConfig JSON (the editable NodeDef tree). Opaque here. */
  config:     unknown
  /** NamedDataSpec[] snapshot persisted alongside the version. Optional. */
  dataSpecs?: unknown[]
  /** Lifecycle target. Defaults to 'published' so a provisioned page is live. */
  status?:    'draft' | 'published' | 'archived'
}

export interface NavItemProvision {
  /** Multilingual label. */
  label:   LocaleString
  /** External link (mutually exclusive with `pageSlug`). */
  href?:   string
  /** Internal target — resolved to a page id by slug at upsert time. */
  pageSlug?: string
  /** Sibling order. */
  ord?:    number
}

export type ConnectionStatus = 'idle' | 'connected' | 'error' | 'pending'

export interface DataSourceProvision {
  /** Idempotency key (emulated UNIQUE — no DB UNIQUE on name in V3). */
  name:   string
  type:   'sdmx-json' | 'rest' | 'static'
  /**
   * Store base URL. OMITTED (→ NULL) for the single-origin reverse-proxy topology:
   * the public client uses its OWN relative `/api` base when this is null. A non-null
   * url is only for an external/cross-origin source. Never default this to localhost.
   */
  url?:   string
  config?: Record<string, unknown>
  /**
   * Lifecycle. Defaults to 'connected' at upsert time (a declared source is meant to
   * be live — mirrors PageProvision.status defaulting to 'published'). Set explicitly
   * to keep a provisioned source out of the public GET /api/data-sources read, which
   * surfaces only status='connected'. The DB column default ('idle') is NOT relied on:
   * an unset status here would render the source invisible to the client.
   */
  status?: ConnectionStatus
}

/**
 * A site-level setting written to config.site_config (ADR-0026 Phase B). The key
 * is the real PRIMARY KEY (simpler idempotency than the other upserters need); the
 * value is any JSON blob stored verbatim (e.g. nav as NavEntry[], chrome, i18n).
 * The backend does not own the inner value shape — the renderer does.
 */
export interface SiteConfigProvision {
  key:   string
  value: unknown
}

/**
 * One predicate row of an allowed cube region (ADR-0027 ContentConstraint).
 * Authored, generic over dim codes (Law 1).
 *   { dimCode, code }                       — unconditional: `dimCode` may be `code`.
 *   { dimCode, code, when: { dimCode, code }} — conditional: `dimCode` may be `code`
 *                                              ONLY WHEN when.dimCode = when.code.
 * Multiple conditional members on the same (dimCode, code) are AND-conjoined
 * (mirrors stats.dim_key_in_allowed_region).
 */
export interface ContentConstraintMemberProvision {
  dimCode: string
  code:    string
  /** Cross-dimension condition. Absent = unconditional allowed-set member. */
  when?:   { dimCode: string; code: string }
}

/**
 * The authored allowed cube region for a dataset (ADR-0027). Identity by
 * (datasetCode, role); role is fixed to 'allowed' (the 'actual' region is the
 * derived stats.cube_actual_region view, never authored). The member set is
 * replaced transactionally only when it changed (jsonEqual on the canonical list).
 */
export interface ContentConstraintProvision {
  datasetCode: string
  /** Fixed 'allowed' — the only authorable role. Defaulted by the parser. */
  role?:    'allowed'
  label?:   LocaleString
  members:  ContentConstraintMemberProvision[]
}

export interface ProvisioningManifest {
  version: 1
  pages?:       PageProvision[]
  navItems?:    NavItemProvision[]
  dataSources?: DataSourceProvision[]
  /** Site-level key/value settings (ADR-0026 Phase B — nav, chrome, i18n, modes…). */
  siteConfig?:  SiteConfigProvision[]
  /** Authored allowed cube regions (ADR-0027 ContentConstraint). */
  contentConstraints?: ContentConstraintProvision[]
}

// ── Result / report types ─────────────────────────────────────────────────────

export type UpsertOutcome = 'created' | 'updated' | 'unchanged' | 'skipped'

export interface ResourceResult {
  kind:    'page' | 'navItem' | 'dataSource' | 'siteConfig' | 'contentConstraint'
  key:     string            // slug / name / label / site-config key / dataset:role — the human-recognizable id
  outcome: UpsertOutcome
  reason?: string            // populated for 'skipped'
}

export interface ProvisioningReport {
  dir:       string
  dryRun:    boolean
  files:     number          // files discovered
  parsed:    number          // files that parsed into a manifest
  results:   ResourceResult[]
  failures:  Array<{ file: string; error: string }>
}

export interface ProvisioningOptions {
  /** Directory to scan. Default './provisioning' (relative to process.cwd()). */
  dir?:    string
  /** When true, log what WOULD be upserted but never write. CI validation mode. */
  dryRun?: boolean
  /** Structured logger (Fastify app.log in prod). Defaults to console. */
  logger?: ProvisioningLogger
}

/** Per-resource apply context threaded into each upserter. */
export interface ApplyCtx {
  dryRun: boolean
  log:    ProvisioningLogger
}
