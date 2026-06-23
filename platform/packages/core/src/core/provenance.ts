// ── Provenance — data quality + lineage record [N14] ──────────────────
//
//  Unifies the ad-hoc provenance signals that existed separately:
//    - DataRow.status (SDMX OBS_STATUS — existing, preserved)
//    - KpiSpec.preliminary (boolean flag — mapped to status 'p')
//    - Table STATUS_LABELS (per-shell constant — moved here, becomes SSOT)
//
//  MetadataPort: the engine seam through which a DataStore exposes
//  per-indicator provenance without the renderers knowing the store type.
//
//  Reference: roadmap Layer 9.2 [N14]. ONS / IMF / Eurostat provenance
//  standards: preliminary badge · last-updated · methodology link.
//

import type { SectionContext } from './context'

// ── ObsStatus — SDMX OBS_STATUS codes (ISO 17369) ────────────────────

/**
 * SDMX OBS_STATUS codes (ISO 17369 / IMF / Eurostat convention).
 *
 * A = normal (produced as expected) — not displayed
 * p = preliminary — data is subject to revision; badge 'P'
 * e = estimated   — value is an estimate; badge 'E'
 * r = revised     — previously published value has been revised; badge 'R'
 * c = confidential — data cannot be published; typically suppressed
 */
export type ObsStatus = 'A' | 'p' | 'e' | 'r' | 'c'

/**
 * Human-readable labels for non-normal OBS_STATUS codes.
 * Single source of truth — replaces per-shell STATUS_LABELS constants.
 *
 * Usage:
 *   import { OBS_STATUS_LABELS } from '@statdash/engine'
 *   OBS_STATUS_LABELS['p']  // 'წინასწარი'
 */
export const OBS_STATUS_LABELS: Readonly<Record<Exclude<ObsStatus, 'A'>, string>> = {
  p: 'წინასწარი',
  e: 'შეფასებული',
  r: 'განახლებული',
  c: 'კონფიდენციალური',
}

// ── ProvenanceRecord — typed provenance descriptor ────────────────────

/**
 * Typed provenance record attached to a DataRow or resolved from a store.
 *
 * Every field is optional — renderers degrade gracefully when absent.
 * The union of present fields drives the info-affordance UI:
 *   status     → badge (P / E / R / C)
 *   lastUpdated / source → info tooltip
 *   methodology → info link (ℹ icon)
 */
export interface ProvenanceRecord {
  /** SDMX OBS_STATUS — data quality flag. */
  status?:       ObsStatus
  /** ISO 8601 date of the last data update, e.g. '2024-09-15'. */
  lastUpdated?:  string
  /** Name of the data source, e.g. 'Geostat National Accounts'. */
  source?:       string
  /** Dataset vintage identifier, e.g. '2024 revision'. */
  vintage?:      string
  /** Free-text provenance note (shown in tooltip). */
  note?:         string
  /** URL to the methodology page (drives the ℹ link). */
  methodology?:  string
}

// ── MetadataPort — engine seam for per-indicator provenance ──────────
//
//  Implemented optionally by DataStore.  The engine passes the active
//  SectionContext so the store can resolve vintage/status by time period.
//
//  Pattern: Grafana datasource metadata() / Cube.js meta() API.
//
//  Usage (store implementation):
//    implements MetadataPort {
//      provenance(code, ctx) { return this._meta[code] ?? undefined }
//    }
//
//  Usage (renderer):
//    const prov = (store as Partial<MetadataPort>).provenance?.(code, ctx)
//

/** Engine seam: a DataStore may implement this to expose per-indicator provenance. */
export interface MetadataPort {
  /**
   * Resolve provenance metadata for a given indicator code + section context.
   * Returns undefined when no metadata is available for the code.
   */
  provenance(code: string, ctx: SectionContext): ProvenanceRecord | undefined
}
