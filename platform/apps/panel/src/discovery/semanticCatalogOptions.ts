// ── semanticCatalogOptions — resolve enum-ref options from the semantic catalog ─
//
//  PURE resolvers for the GOVERNED PropFieldSource discriminants (AR-49 M0, §2.2):
//    'metrics'     → the registered MetricDef ids (label = governed label + unit hint)
//    'dimensions'  → the registered DimensionDef ids (label = governed label)
//
//  This is the semantic-catalog peer of `cubeEnumOptions.ts`: where the cube
//  resolvers surface RAW SDMX codes from a fetched cube profile, these surface the
//  GOVERNED nouns from the semantic layer (`describeApp().metrics/.dimensions`, held
//  by `metricCatalog.store`). Same option shape (`CubeOption`) → the existing
//  EnumRefField `<select>` renders both families unchanged (spec §2.2). The author
//  PICKS a governed noun, never types a code (Law 2 declarative authoring).
//
//  Kept pure (catalog in → options out) and OFF the network/store so it is trivially
//  testable (FF-CATALOG-DISCOVERY-PURE). The live wiring (describeApp() → store →
//  these resolvers) is metricCatalog.store's + EnumRefField's job; this module only
//  maps a catalog to options and so imports NO store / network / React.
//
//  Locale: labels are LocaleString (string | {ka,en,…}); readCatalogLabel resolves
//  to the active locale, falling back active → en → any → the id/code (never blank),
//  mirroring cubeEnumOptions.readCubeLabel exactly.
//
//  Law 1 (no privileged dimensions): dimensions are resolved generically by their
//  registry id — no dimension name is special-cased here.
//
import type { MetricDef, LocaleString } from '@statdash/engine'
import type { Locale } from '../types/constructor'
import type { CubeOption } from './cubeEnumOptions'

/**
 * The scalar universe a governed dimension pins (`DimVal` mirror — Law 1 generic).
 * Kept as a local structural alias so this pure leaf carries no cross-arrow import.
 */
export type DimScalar = string | number | boolean | null

/**
 * Panel-local structural view of the engine `DimensionDef` (AR-49 M0 item 2, core).
 *
 * The engine's `DimensionDef` (packages/core `data/dimension.ts`) is not yet merged;
 * `describeApp().dimensions` (item 5) lands with it. This mirror carries exactly the
 * read-surface the palette/inspector need, so item 7 builds against the spec'd shape
 * NOW and stays structurally assignable once the engine type ships (no consumer
 * change — the resolvers key off `label`/`code` only). See SPEC §1.2.
 */
export interface CatalogDimension {
  /** Underlying SDMX/cube dimension code this governs (members resolve FROM the DSD, Law 5). */
  code:           string
  /** Governed bilingual label (the cube profile carries only a thin code label). */
  label:          LocaleString
  /** Advisory concept-role hint ('geo'|'time'|…) — OPEN string, never privileged (Law 1). */
  conceptRole?:   string
  /** Default member pin when the author drops the dim without choosing. */
  defaultMember?: DimScalar
  /** Optional curation whitelist — a SUBSET-reference into the profile's members (Law 5). */
  members?:       DimScalar[]
  /** Longer bilingual description for the info-affordance. */
  description?:   LocaleString
}

/**
 * Resolve a LocaleString to a display string for `locale` (never blank). Mirrors
 * cubeEnumOptions.readCubeLabel, plus the LocaleString `string` legacy branch:
 * active locale → 'en' → first available → `fallback` (the id/code, never blank).
 */
export function readCatalogLabel(
  label:    LocaleString | null | undefined,
  locale:   Locale,
  fallback: string,
): string {
  if (label == null) return fallback
  if (typeof label === 'string') return label.length > 0 ? label : fallback
  return label[locale] ?? label['en'] ?? Object.values(label)[0] ?? fallback
}

/**
 * Metric-id options from the catalog — the governed measure picker's vocabulary.
 * label = governed label + a unit hint when the metric declares one (e.g.
 * "GDP · მლნ ₾"), the same `{ value, label }` shape measureOptions returns so the
 * existing select renders it unchanged (spec §2.2). value = the registry id (a
 * metric-id resolveMeasureRef lowers to underlying code(s)). Sorted by id for a
 * deterministic, testable order (describeApp() preserves insertion order).
 */
export function metricOptions(
  metrics: Record<string, MetricDef>,
  locale:  Locale,
): CubeOption[] {
  return Object.entries(metrics)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, def]) => {
      const base = readCatalogLabel(def.label, locale, id)
      const unit = def.unit ? readCatalogLabel(def.unit, locale, '') : ''
      return { value: id, label: unit ? `${base} · ${unit}` : base }
    })
}

/**
 * Dimension-id options from the catalog — the governed dimension picker's vocabulary.
 * label = the governed bilingual label (fallback to the SDMX code); value = the
 * registry id (symmetric with metricOptions — the picker emits the governed id, not a
 * raw code). Members are NOT enumerated here (Law 5 — they resolve from the cube
 * profile at bind time). Sorted by id for deterministic order.
 */
export function dimensionOptions(
  dimensions: Record<string, CatalogDimension>,
  locale:     Locale,
): CubeOption[] {
  return Object.entries(dimensions)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, def]) => ({
      value: id,
      label: readCatalogLabel(def.label, locale, def.code),
    }))
}

/**
 * Build a cube-dimension-code → GOVERNED bilingual label resolver from the catalog.
 * The cube profile carries only a thin code for its dimensions; the governed label
 * lives in the semantic catalog, keyed by registry id but carrying the underlying
 * cube `code`. This inverts the catalog to `code → label(locale)` so the cube-profile
 * pickers (EnumRefField `cube.dimensions`, the field-well chips) can show the author a
 * governed noun instead of the raw SDMX code+conceptRole echo (Law 4). Unknown code ⇒
 * `undefined` (the caller falls back to the bare code — never blank). Law 1: generic
 * over every dimension, none special-cased.
 */
export function governedDimensionLabels(
  dimensions: Record<string, CatalogDimension>,
  locale:     Locale,
): (code: string) => string | undefined {
  const byCode = new Map<string, string>()
  for (const def of Object.values(dimensions)) {
    if (!byCode.has(def.code)) byCode.set(def.code, readCatalogLabel(def.label, locale, def.code))
  }
  return (code) => byCode.get(code)
}

/** The governed-catalog PropFieldSource discriminants this module resolves (spec §2.1). */
export const SEMANTIC_SOURCES = ['metrics', 'dimensions'] as const
export type SemanticSource = typeof SEMANTIC_SOURCES[number]

/**
 * True when a PropFieldSource string is a governed-catalog source this module
 * resolves ('metrics' | 'dimensions'). The discriminant EnumRefField's semantic
 * branch (item 8) gates on (mirrors cubeEnumOptions.isCubeSource).
 */
export function isSemanticSource(source: string | undefined): source is SemanticSource {
  return source === 'metrics' || source === 'dimensions'
}
