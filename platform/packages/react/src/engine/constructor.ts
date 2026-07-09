// ── constructor.ts — N2: single entry point for the Constructor manifest ─────
//
//  Aggregates every registry's output into one JSON-serializable payload.
//  The visual builder (Constructor) calls describeApp() once on startup and
//  builds its palette, property panel, chart picker, spec picker, and mode
//  selector from the result.
//
//  Architecture: @statdash/constructor (Phase 2 package boundary)
//    Until the separate @statdash/constructor package is created, this lives
//    in @statdash/react/engine so existing consumers can import it now.
//    Migration: extract to its own package when the Constructor is a separate
//    workstream — one import-path change, no API change.
//
//  JSON-serializable invariant: describeApp() output must satisfy
//    JSON.parse(JSON.stringify(describeApp())) deep-equals describeApp()
//  All registry outputs already satisfy this (no fns, no class instances).
//

import type { RegistryManifest }  from './NodeRegistry'
import type { SpecDescriptor, PerspectiveOption } from '@statdash/engine'
import { nodeRegistry }                     from './register-all'
import { chartRegistry }                    from '@statdash/charts'
import { SPEC_CATALOG, perspectiveRegistry, listTransformOps, listMetricDefs, listDimensionDefs, listExportFormats } from '@statdash/engine'
import type { MetricDef, DimensionDef }                from '@statdash/engine'
import { registeredKinds }                  from './storeManifest'
import { filterControlRegistry }            from './filterControlRegistry'

// ── contractVersion — the SemVer of the capability contract (SSOT) ────────────
//
//  describeApp() ships externally: the panel/Constructor builds its whole UI
//  (palette, property panel, chart/spec/mode pickers, datasource manager) from
//  this manifest, and apps/api serves a JSON Schema GENERATED from it. The
//  manifest IS the published API/contract of the renderer engine. A capability
//  that silently disappears is a SILENT BREAKING CHANGE for every consumer.
//
//  CONTRACT_VERSION is the single, manifest-owned SemVer of that contract. It is
//  the ONLY version source — the generated page-config JSON Schema derives its
//  version from here (no parallel truth). Bump it CONSCIOUSLY when the contract
//  surface changes, per the policy below.
//
//  ── Bump policy (SemVer over the capability SURFACE) ──────────────────────────
//    MAJOR — a capability is REMOVED, or a surface shape changes incompatibly:
//            a manifest axis dropped/renamed, a node type / panel type / spec
//            type retired, or a field's type changed in a breaking way.
//    MINOR — a capability is ADDED back-compatibly: a new manifest axis, a new
//            node/panel/spec type, a new chart type, mode, datasource kind, etc.
//            (Adding VALUES is back-compatible; existing consumers keep working.)
//    PATCH — doc / metadata-only change: clarified description, label text, an
//            example tweak — nothing a consumer can observe structurally.
//
//  The contract-surface fitness (constructor.fitness.test.ts) locks the SET of
//  axes + the SET of built-in capability ids that ship at import time. Removing
//  one fails that test, forcing this constant to be bumped consciously rather
//  than drifting silently.
//
//  1.1.0 — MINOR (AR-49/M0): added the back-compatible `dimensions` axis (the
//  governed-dimension catalog, peer of `metrics`, Law 1). A new axis of VALUES,
//  no existing axis renamed/dropped/reshaped — every existing consumer keeps
//  working (an unknown axis is ignored). Per the bump policy above, a new axis is
//  MINOR, not MAJOR.
export const CONTRACT_VERSION = '1.1.0' as const

// ── AppManifest — the Constructor's full build contract ───────────────────────

/**
 * Full Constructor manifest — JSON-serializable.
 *
 * `contractVersion` is the SemVer of this whole surface (see CONTRACT_VERSION).
 * Every other field corresponds to one axis of the visual builder:
 *   palette             → draggable node/panel/page tiles
 *   propertySchemas     → property-panel form per tile
 *   chartTypes          → chart-type picker inside the chart panel
 *   specTypes           → DataSpec type picker inside any data-bearing panel
 *   perspectives        → perspective selector (year / range / …)
 *   datasourceKinds     → datasource-kind picker in the datasource manager
 *   transformOps        → transform-step picker in the pipeline editor [N12]
 *   metrics             → data-catalog picker for metric-based specs [N26]
 *   dimensions          → governed-dimension picker (peer of metrics) [AR-49/M0]
 *   exportFormats       → export-format picker in the panel config [N16]
 *   filterControlTypes  → filter control type picker in the filter-bar builder
 */
export interface AppManifest {
  /**
   * SemVer of the capability contract this manifest expresses (== CONTRACT_VERSION).
   * The SINGLE version source: the generated page-config JSON Schema derives its
   * version from here. Bump policy is documented on CONTRACT_VERSION above.
   */
  contractVersion:  string
  /** Node/page/panel palette tiles with display metadata and caps. */
  palette:          RegistryManifest['palette']
  /** Typed property schemas keyed by `${type}:${variant}`. */
  propertySchemas:  RegistryManifest['propertySchemas']
  /** Registered chart type strings — drives the chart-type picker. */
  chartTypes:       string[]
  /** All DataSpec types with fields, descriptions, examples. */
  specTypes:        Record<string, SpecDescriptor>
  /** Registered perspectives — drives the perspective-switcher palette. */
  perspectives:     PerspectiveOption[]
  /** Registered datasource kind strings — drives the datasource manager. */
  datasourceKinds:  string[]
  /** Registered transform op codes — drives the transform-step picker [N12]. */
  transformOps:     string[]
  /**
   * All registered metrics keyed by id — the Constructor's data-catalog picker [N26].
   * Populated after setupRegistrations(); empty in test/SSR environments.
   */
  metrics:          Record<string, MetricDef>
  /**
   * All registered governed dimensions keyed by id — the Constructor's
   * dimension-ref picker, the PEER of `metrics` (Law 1: dimensions are equal
   * citizens of the semantic layer) [AR-49/M0]. Members still resolve FROM the
   * cube profile at runtime (Law 5); this catalog carries only the governed
   * curation (label / conceptRole / default / whitelist). Populated after
   * setupRegistrations(); empty in test/SSR environments.
   */
  dimensions:       Record<string, DimensionDef>
  /**
   * Registered export format ids (e.g. ['csv', 'sdmx-json']) — drives the
   * Constructor's export-format picker and panel export menu [N16].
   * JSON-serializable: contains ids only, not SerializeFn references.
   */
  exportFormats:    string[]
  /**
   * Registered filter control type ids (e.g. ['year-select', 'cascade', 'select']).
   * Drives the Constructor's filter-bar builder — which control type to use per param.
   */
  filterControlTypes: string[]
}

// ── describeApp ───────────────────────────────────────────────────────────────

/**
 * Produce the full Constructor manifest by compositing every registered
 * registry's current state.
 *
 * Must be called AFTER setupRegistrations() completes — all registries must
 * be populated before this is called.
 *
 * ```ts
 * setupRegistrations()           // registers all slices
 * const manifest = describeApp() // composites the manifest
 * ```
 *
 * @returns JSON-serializable AppManifest.
 */
export function describeApp(): AppManifest {
  const { palette, propertySchemas } = nodeRegistry.describeRegistry()
  return {
    contractVersion: CONTRACT_VERSION,
    palette,
    propertySchemas,
    chartTypes:      chartRegistry.chartTypes(),
    specTypes:       SPEC_CATALOG,
    perspectives:    perspectiveRegistry.list(),
    datasourceKinds: registeredKinds(),
    transformOps:        listTransformOps(),
    metrics:             listMetricDefs(),
    dimensions:          listDimensionDefs(),
    exportFormats:       listExportFormats(),
    filterControlTypes:  filterControlRegistry.types(),
  }
}
