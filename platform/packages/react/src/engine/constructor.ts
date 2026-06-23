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
import type { SpecDescriptor, ModeDef } from '@statdash/engine'
import { nodeRegistry }                     from './register-all'
import { chartRegistry }                    from '@statdash/charts'
import { SPEC_CATALOG, modeRegistry, listTransformOps, listMetricDefs, listExportFormats } from '@statdash/engine'
import type { MetricDef }                              from '@statdash/engine'
import { registeredKinds }                  from './storeManifest'
import { filterControlRegistry }            from './filterControlRegistry'

// ── AppManifest — the Constructor's full build contract ───────────────────────

/**
 * Full Constructor manifest — JSON-serializable.
 *
 * Every field corresponds to one axis of the visual builder:
 *   palette             → draggable node/panel/page tiles
 *   propertySchemas     → property-panel form per tile
 *   chartTypes          → chart-type picker inside the chart panel
 *   specTypes           → DataSpec type picker inside any data-bearing panel
 *   modes               → view-mode selector (year / range / compare)
 *   datasourceKinds     → datasource-kind picker in the datasource manager
 *   transformOps        → transform-step picker in the pipeline editor [N12]
 *   metrics             → data-catalog picker for metric-based specs [N26]
 *   exportFormats       → export-format picker in the panel config [N16]
 *   filterControlTypes  → filter control type picker in the filter-bar builder
 */
export interface AppManifest {
  /** Node/page/panel palette tiles with display metadata and caps. */
  palette:          RegistryManifest['palette']
  /** Typed property schemas keyed by `${type}:${variant}`. */
  propertySchemas:  RegistryManifest['propertySchemas']
  /** Registered chart type strings — drives the chart-type picker. */
  chartTypes:       string[]
  /** All DataSpec types with fields, descriptions, examples. */
  specTypes:        Record<string, SpecDescriptor>
  /** Registered view modes — drives the mode-switcher palette. */
  modes:            ModeDef[]
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
    palette,
    propertySchemas,
    chartTypes:      chartRegistry.chartTypes(),
    specTypes:       SPEC_CATALOG,
    modes:           modeRegistry.list(),
    datasourceKinds: registeredKinds(),
    transformOps:        listTransformOps(),
    metrics:             listMetricDefs(),
    exportFormats:       listExportFormats(),
    filterControlTypes:  filterControlRegistry.types(),
  }
}
