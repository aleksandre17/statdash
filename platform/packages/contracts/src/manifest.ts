// ── SiteManifest wire contract (GET /api/bootstrap) ───────────────────────────
//
//  The atomic boot payload the geostat runner fetches ONCE to hydrate the whole
//  site (Grafana bootData / Retool fetchAppManifest pattern). Produced by the api
//  (apps/api/src/routes/bootstrap), consumed by the runner (apps/geostat/src/data/
//  site-manifest.ts). BOTH sides previously re-declared this shape because the api
//  cannot import `@statdash/react`. This is the shared home.
//
//  LAYERING of the fields (why some are precise, some opaque):
//    - Backend/engine-owned JSON DTOs (datasources) are JSON-serializable and
//      tenant-agnostic, so they are typed precisely here. They are STRUCTURALLY
//      identical to engine's DatasourceInstanceConfig (the engine remains
//      their semantic owner; this is the wire mirror, kept assignable both ways so
//      the engine type and the contract interoperate without a cast).
//    - React/renderer-owned blobs (pages, nav, chrome, chromeConfig, i18n) have their
//      INNER shape owned by the renderer (NodePageConfig, NavEntry, ChromeConfig…).
//      The backend is a pass-through projection and must NOT become a second source
//      of truth for the config schema, so those are opaque JSON here. The runner
//      refines them to its precise types via `SiteManifest = SiteManifestContract & {…}`.

import type { JsonRecord, JsonValue } from './json'

/**
 * Named datasource descriptor. Wire mirror of engine DatasourceInstanceConfig.
 * `kind` is an open string ('external' | 'api' | 'stats' | …); `params` is
 * kind-specific JSON passed to the store builder.
 */
export interface ManifestDatasource {
  id:      string
  kind:    string
  url?:    string
  params?: Record<string, unknown>
}

/**
 * Named metric descriptor — the wire shape of one entry in a tenant's semantic
 * layer (the SAME delivery channel as `datasources`: pure config-data the api
 * projects out of site_config and the runner registers at boot via
 * `registerMetrics`). The runner refines this opaque blob into the engine's
 * `MetricDef` exactly as it refines `datasources` into DatasourceInstanceConfig —
 * the api is a pass-through projection and never owns the engine's semantic shape
 * (Law 3: api cannot import @statdash/engine's MetricDef across the arrow; this
 * zero-dep mirror is the shared home).
 *
 * `id` is the registry KEY (a metric-id a DataSpec references as its `measure`);
 * `code` is the underlying SDMX measure code(s) the store is queried with. A raw
 * code that is NOT a registered id passes through unchanged (Postel /
 * FF-RAW-CODE-IDENTICAL); a registered id additionally carries the governance
 * below. `unit`/`label` are LocaleString maps (Law 4 bilingual). `dataSource` is
 * the storeKey the metric lives in (the Cube.dev `dataSource`-on-measure pattern).
 */
/**
 * Wire shape of ONE component of a calculated metric (DC-01) — the zero-dep
 * mirror of engine `MetricInput`. `measure` is a raw SDMX code OR a metric-id;
 * `at` pins generic dims (Law 1 — any dim, never time-special) for THIS
 * component's point-read, merged over ctx.dims. `at` values are JSON scalars
 * (the `DimVal` universe: string | number | boolean | null) — pure coordinate
 * data, never a `$ctx`/`$ne` predicate (a point-read addresses a single cell).
 */
export interface ManifestMetricInput {
  measure: string
  at?:     Record<string, string | number | boolean | null>
}

/**
 * Wire shape of a calculated metric's value-algebra (DC-01) — the zero-dep
 * mirror of engine `MetricCalc`. `inputs` are the named component reads; `expr`
 * is the measure-algebra expression OVER them (ratio / accounting-identity / …),
 * carried OPAQUELY here as a JSON blob: the contract cannot import
 * `@statdash/expr`'s `Expr` across the dependency arrow (contracts ← expr), so
 * the runner refines this into a real `Expr` at the boot seam — exactly as it
 * refines the renderer-owned page blobs into their precise types. JSON-only, so
 * it survives the manifest round-trip (Law 2 — a tree, never a function).
 */
export interface ManifestMetricCalc {
  inputs: Record<string, ManifestMetricInput>
  expr:   JsonValue
}

export interface ManifestMetric {
  /** Registry key — the metric-id a DataSpec `measure` references. */
  id:           string
  /**
   * Underlying SDMX measure code(s) the store is actually queried with.
   * Present for a BASE metric; ABSENT for a CALCULATED metric (whose value comes
   * from `calc` — its underlying codes are its components'). Exactly one of
   * `code` / `calc` is present (mirrors engine MetricDef).
   */
  code?:        string | string[]
  /**
   * Calculated-metric value-algebra (DC-01) — a declarative expression over
   * named component measures. Present ⟺ a DERIVED metric (then `code` is absent);
   * the runner refines this opaque blob into engine `MetricCalc` at the boot seam
   * exactly as it refines `code` into a base `MetricDef`. Pure data — an
   * expression TREE, never a function (Law 2) — so it survives the JSON round-trip.
   */
  calc?:        ManifestMetricCalc
  /** Bilingual display label (LocaleString {ka,en}). */
  label:        Record<string, string>
  /** Bilingual unit of measure (LocaleString). Flows to provenance badges + panels. */
  unit?:        Record<string, string>
  /**
   * Default DISPLAY format key for the metric's scalar value — the wire mirror of
   * engine `MetricDef.format` (a `FormatKey`: 'mln_gel' | 'sign_pct' | 'pct' | …).
   * Typed as a plain string here because contracts is the innermost zero-dep layer
   * and cannot import engine's `FormatKey` across the arrow; the runner refines it
   * back into the union at the registerManifestMetrics boot seam. Additive /
   * backward-compatible — absent ⇒ current behavior. Pure config data (Law 2).
   */
  format?:      string
  /** External methodology page URL — flows into ProvenanceRecord.methodology. */
  methodology?: string
  /**
   * Default cross-time aggregation for the metric's value — the wire mirror of
   * engine `MetricDef.agg` (a `MetricAgg`: 'sum' | 'avg' | 'last'). A CLOSED literal
   * union, so — unlike `format` — it is mirrored precisely here (contracts stays
   * zero-dep; the runner refines it back onto MetricDef at the registerManifestMetrics
   * boot seam). Additive / backward-compatible — absent ⇒ current behavior. Pure
   * config data (Law 2). NOTE: governance-only metadata today — the resolved `agg`
   * is carried through resolveMeasureRef but not yet consumed by an interpreter.
   */
  agg?:         'sum' | 'avg' | 'last'
  /**
   * Grain-behaviour class (OLAP/DAX additivity) — the wire mirror of engine
   * `MetricDef.additivity` [AR-50 M2]. A CLOSED literal union (like `agg`), mirrored
   * precisely here (contracts stays zero-dep; the runner refines it onto MetricDef at
   * the registerManifestMetrics boot seam). `additive` (flows) sums over every axis;
   * `semi-additive` (stocks) sums over `semiAdditive.additiveOver` and collapses the
   * rest; `non-additive` (ratios) is re-derived from `calc` at grain, never summed
   * (FF-NO-SUM-OF-RATIO). Absent ⇒ the conservative structural default (a `calc`
   * metric ⇒ non-additive; a base metric ⇒ additive). Pure config data (Law 2),
   * Constructor-authorable — the CLASSIFICATION is explicit, never a runtime sniff.
   */
  additivity?:  'additive' | 'semi-additive' | 'non-additive'
  /** Per-axis rule for a SEMI-ADDITIVE measure (DAX LASTNONBLANK). Generic axes (Law 1). */
  semiAdditive?: { additiveOver: string[]; nonAdditiveOp: 'last' | 'first' | 'avg' }
  /** Default dimension filters merged as query DEFAULTS (explicit query filters win). */
  dims?:        Record<string, unknown>
  /** storeKey this metric routes a referencing node to (explicit node storeKey wins). */
  dataSource?:  string
  /**
   * Longer bilingual description for the info-affordance / tooltips — the wire mirror
   * of engine `MetricDef.description` (a LocaleString {ka,en} map, Law 4). Additive /
   * backward-compatible — absent ⇒ current behavior. Pure config data (Law 2).
   */
  description?: Record<string, string>
}

/**
 * Wire shape of ONE tier of a dimension's governed DRILL PATH [ADR-034 S4] — the
 * zero-dep mirror of engine `HierarchyLevel`. `dim` is the GENERIC grain axis this
 * level groups by (Law 1 — may equal the DimensionDef `code` for a self-nested
 * codelist, or a distinct dim for a star hierarchy; the engine never branches on a
 * hardcoded axis name). `label` is an OPTIONAL bilingual breadcrumb (LocaleString
 * map, Law 4). Member parent/child relations are NEVER carried here — they REIFY
 * from the SDMX codelist at runtime (Law 5); a level names only axis + label.
 */
export interface ManifestHierarchyLevel {
  dim:    string
  label?: Record<string, string>
}

/**
 * Wire shape of a dimension's declared DRILL PATH [ADR-034 S4] — the zero-dep mirror
 * of engine `DimensionHierarchy`. An ordered set of LEVELS (coarsest root → finest
 * leaf); the runner refines this opaque blob into engine `DimensionHierarchy` at the
 * registerManifestDimensions boot seam exactly as it refines `code`/`calc` on a
 * metric. Pure data (Law 2) — a tree, never a function — so it survives the JSON
 * round-trip. REIFIED from the codelist `parent_code` depth at manifest build (Law 5);
 * the level COUNT is the codelist tree depth, never hand-authored.
 */
export interface ManifestDimensionHierarchy {
  levels: ManifestHierarchyLevel[]
}

/**
 * Named dimension descriptor — the wire shape of one entry in a tenant's
 * semantic layer, the PEER of `ManifestMetric` (Law 1: dimensions are equal
 * citizens of the semantic layer, not a metric afterthought). Same delivery
 * channel as `metrics`/`datasources`: pure config-data the api projects out of
 * site_config and the runner registers at boot via `registerDimensions`. The
 * runner refines this opaque blob into the engine's `DimensionDef` exactly as it
 * refines `metrics` into `MetricDef` — the api is a pass-through projection and
 * never owns the engine's semantic shape (Law 3: api cannot import
 * @statdash/engine's DimensionDef across the arrow; this zero-dep mirror is the
 * shared home).
 *
 * The governed noun CURATES the raw cube-profile dimension; it never DUPLICATES
 * the SDMX member list into config (Law 5 — members resolve FROM the DSD at
 * runtime). `code` names the underlying SDMX/cube dimension this governs; `label`
 * is the governed bilingual noun (LocaleString map, Law 4). `conceptRole` is an
 * OPEN string advisory hint ('geo'|'time'|'sector'|…), NEVER a privileged union
 * (Law 1 — the engine never branches on a hardcoded dimension name).
 * `defaultMember` pins the member used when the author drops the dim without
 * choosing; `members` is an OPTIONAL curation whitelist (a subset-reference into
 * the profile's member list, ABSENT ⇒ all members from the cube profile — never
 * the SSOT). Member/default values are JSON scalars (the `DimVal` universe:
 * string | number | boolean | null).
 */
export interface ManifestDimension {
  /** Registry key — the dimension-id a picker/DataSpec references. */
  id:             string
  /** Underlying SDMX/cube dimension code this governs (members come FROM the DSD, Law 5). */
  code:           string
  /** Bilingual display label (LocaleString {ka,en}). */
  label:          Record<string, string>
  /** Advisory concept-role hint ('geo'|'time'|'sector'|…) — OPEN string, never a privileged union (Law 1). */
  conceptRole?:   string
  /** Default member pin when the author drops the dim without choosing (e.g. '_T'). */
  defaultMember?: string | number | boolean | null
  /** Optional curation whitelist — a SUBSET-reference into the profile's members, never the SSOT (Law 5). */
  members?:       (string | number | boolean | null)[]
  /**
   * Governed DRILL PATH [ADR-034 S4] — the ordered levels a query/selection may
   * descend, changing grain. REIFIED at manifest build from the codelist `parent_code`
   * depth (Law 5 — never hand-authored): a dim with any parent edges gets one level
   * per tree depth (coarsest→finest); a FLAT dim carries no hierarchy (absent). The
   * runner refines this into engine `DimensionDef.hierarchy` at registerManifest-
   * Dimensions so `getDimension(id).hierarchy` lights up the drill seam. Additive /
   * backward-compatible — absent ⇒ the un-hierarchied (flat) status quo, byte-identical.
   */
  hierarchy?:     ManifestDimensionHierarchy
  /** Longer bilingual description for the info-affordance (LocaleString). */
  description?:   Record<string, string>
}

/**
 * The SiteManifest as it crosses the api ↔ runner boundary.
 *
 * `pages`/`nav`/`chrome`/`chromeConfig`/`i18n` carry renderer-owned blobs typed as
 * opaque JSON — the runner refines them to NodePageConfig / NavEntry / ChromeConfig
 * / I18nConfig. Refine, never weaken: a consumer intersects this with its precise
 * field types; it never re-declares the envelope.
 */
export interface SiteManifestContract {
  /** Manifest envelope version — mirrors page schemaVersion forward-compat (ADR-0026). Optional for back-compat. */
  schemaVersion?: number
  /** The id of the page served at '/' — from site_config.index_page_id. */
  indexPageId:  string
  /** PUBLISHED page configs, keyed by renderer page id. Inner shape = NodePageConfig (renderer-owned). */
  pages:        Record<string, JsonRecord>
  /** Nav tree. Inner shape = NavEntry (renderer-owned). */
  nav:          JsonRecord[]
  /** Chrome slot → variant routing. Inner shape = Record<string, ChromeEntry> (renderer-owned). */
  chrome:       JsonRecord
  /** Brand identity. Inner shape = ChromeConfig (renderer-owned). */
  chromeConfig: JsonRecord
  /** Locale configuration. Inner shape = I18nConfig (renderer-owned). */
  i18n:         JsonRecord
  /**
   * The site's PORTABLE BRAND — a flat `tokenKey → CSS value` override map
   * (TOKENS_CATALOG keys, e.g. `'color.accent' → '#0080BE'`), the delivery mirror
   * of the Constructor's `SiteDef.themeOverrides`. This is the Law-5 fix: a tenant's
   * brand travels as CONFIG DATA the api projects out of `site_config.themeOverrides`,
   * NOT baked into an app's `[data-tenant]` CSS. Both the runner (applyThemeOverrides
   * at boot) and the Constructor canvas apply the SAME map through the SAME
   * `@statdash/styles` mechanism, so the canvas renders the published brand faithfully
   * ("the canvas never lies"). Absent/empty ⇒ the brand-neutral platform default
   * (byte-identical to the pre-brand-channel site — Postel). Pure data (Law 2): a flat
   * value map, never a theme function; the tokenKey↔CSS-var mapping lives in the
   * renderer's token catalog, never here.
   */
  themeOverrides?: Record<string, string>
  /** Connected datasource descriptors. */
  datasources?: ManifestDatasource[]
  /**
   * The tenant's semantic layer — named metrics the runner registers at boot
   * (`registerMetrics`) so a DataSpec can reference a metric-id instead of a raw
   * code, picking up its unit/methodology (provenance badges) + dataSource
   * routing. Delivered as config-data exactly like `datasources`. Absent/empty ⇒
   * the raw-code status quo (byte-identical, FF-RAW-CODE-IDENTICAL).
   */
  metrics?:     ManifestMetric[]
  /**
   * The tenant's governed dimensions — the PEER of `metrics` (Law 1). Named
   * dimensions the runner registers at boot (`registerDimensions`) so a picker
   * can bind a governed dimension (label/default/whitelist) whose members still
   * resolve FROM the cube profile at runtime (Law 5 — never copied into config).
   * Delivered as config-data exactly like `metrics`/`datasources`. Absent/empty ⇒
   * dimensions reach the author only as raw cube-profile members (byte-identical
   * status quo).
   */
  dimensions?:  ManifestDimension[]
}
