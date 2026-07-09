// ── Dimension registry [AR-49 / M0] ────────────────────────────────────
//
//  DESIGN INVARIANT: this file must NOT import defaultRegistry, interpretSpec,
//  or any module from registry/. It is a pure vocabulary leaf — the PEER of
//  metric.ts (Law 1: dimensions are equal citizens of the semantic layer, not a
//  metric afterthought). Fitness test: dimension.fitness.test.ts asserts no such
//  import exists.
//
//  THIN by design: a DimensionDef CURATES the raw cube-profile dimension (a
//  governed bilingual label, a concept-role hint, a default member, an optional
//  member whitelist). It is NOT a modeling language — no filters, no joins, no
//  sql (the same "LookML line" metric.ts holds). Members are NEVER copied into
//  config: the resolved member list is read from the cube profile at runtime (the
//  fromSDMX boundary, Law 5). DimensionDef only references/curates that list.
//
import type { LocaleString }         from '../i18n/types'
import type { DimVal }               from '../sdmx'

/**
 * Definition of one governed dimension — the peer of `MetricDef`.
 * Thin curation over the cube-profile dimension; not a modeling language.
 */
export interface DimensionDef {
  /**
   * The SDMX/cube dimension code this governs. Members come FROM the DSD at
   * runtime (Law 5) — this code names WHICH cube dimension the governed label /
   * default / whitelist curate, never the members themselves.
   */
  code:           string
  /**
   * Governed bilingual label. The cube profile carries only a thin code label;
   * this is the display noun the palette / picker shows (Law 4 bilingual).
   */
  label:          LocaleString
  /**
   * Concept-role hint: 'geo' | 'time' | 'sector' | … — an OPEN string, NOT a
   * privileged union (Law 1). Purely advisory metadata for the palette / ShowMe;
   * the engine NEVER branches on a hardcoded dimension name. Absent ⇒ no hint.
   */
  conceptRole?:   string
  /**
   * Default member pin when the author drops the dim without choosing (e.g. the
   * SDMX total '_T'). A generic DimVal coordinate (Law 1 — any dim, never
   * time-special), pure data, never a function (Law 2).
   */
  defaultMember?: DimVal
  /**
   * Curation whitelist: expose only these members to the author. A SUBSET-
   * reference into the cube profile's member list — ABSENT ⇒ all members from the
   * profile (Law 5: we never DUPLICATE the SDMX member list in config; we
   * reference/curate it). The resolved members are always read from the DSD; this
   * only narrows what the picker offers.
   */
  members?:       DimVal[]
  /** Longer description for the info-affordance. */
  description?:   LocaleString
}

const _registry = new Map<string, DimensionDef>()

/** Register a named dimension. Last-write-wins. */
export function registerDimension(id: string, def: DimensionDef): void {
  _registry.set(id, def)
}

/**
 * Bulk-register a dimension catalog keyed by id — the agnostic seam a tenant's
 * semantic layer is delivered through, mirroring `registerMetrics`. The catalog
 * is pure DATA (a `Record<id, DimensionDef>`), so it carries NO tenant identity
 * into core: the app boot reads its tenant catalog (from the manifest, the same
 * way it reads `manifest.metrics`) and hands it here. Idempotent + last-write-
 * wins per id. Empty catalog ⇒ no-op (byte-identical to the raw cube-member
 * status quo — dimensions still reach the author as raw profile members).
 */
export function registerDimensions(catalog: Record<string, DimensionDef>): void {
  for (const [id, def] of Object.entries(catalog)) _registry.set(id, def)
}

/** Look up a registered dimension by id. */
export function getDimension(id: string): DimensionDef | undefined {
  return _registry.get(id)
}

/** Return all registered dimension ids, sorted. */
export function listDimensions(): string[] {
  return [..._registry.keys()].sort()
}

/**
 * Return all registered dimensions as a JSON-serializable Record keyed by id.
 * Used by describeApp() to populate the Constructor's governed-dimension picker
 * (the peer of listMetricDefs()).
 */
export function listDimensionDefs(): Record<string, DimensionDef> {
  return Object.fromEntries(_registry.entries())
}
