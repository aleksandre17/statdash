// ── ViewSnapshot — the delivery-port SSOT (AR-48 P0) ──────────────────────────
//
//  DESIGN-delivery-port-export-embed-snapshot.md §2: statdash answers "what is on
//  screen?" from exactly ONE substrate. Before this type, extract (the live
//  `ctx.rows` read a section already resolved) and snapshot/embed
//  (`renderPageToJSON`'s own resolution walk) each independently produced "the
//  rows" — they agreed by construction (both honour the active-view gate) but
//  were never proven to be one thing. `ViewSnapshot` names that one thing so a
//  future divergence between the two reads is a type-level fact, not a hope.
//
//  Two modes over the SAME shape (§4b): PINNED (`data` present — the frozen,
//  reproducible citation/embed artifact, OWID/Datawrapper/Grafana-snapshot
//  standard) and LIVE (`data` absent — `configRef` + `viewState` only, the
//  consumer re-resolves on open). Structurally assignable to `SnapshotEnvelope`
//  (has `generatedAt: string`; every other field is a subtype of `unknown`) so a
//  future mint client (P2) can POST a `ViewSnapshot` as-is — no adapter needed
//  at the persistence boundary, exactly as the engine's richer `PageDataSnapshot`
//  already is.
//
//  `data` and `provenance` are OPAQUE JSON here (like `SiteManifestContract`'s
//  renderer-owned blobs) — their inner shape is owned by the layer that resolves
//  them (`@statdash/engine` rows / `ReferenceMetadataContract` projections).
//  contracts stays the zero-dep wire shape; the react layer (DeliveryPort) is the
//  refinement point, never contracts itself.

import type { JsonRecord } from './json'

/** Which page config this view is drawn against — the Memento's identity half. */
export interface ViewSnapshotConfigRef {
  /** Page node.id, when the snapshot is page-scoped. */
  pageId?:        string
  /** Config schema version the view was authored/resolved against. */
  schemaVersion?: number
}

/**
 * The un-frozen view coordinates — the SAME state a permalink URL encodes
 * (filter params, active perspective, locale). Optional per-field: a
 * per-panel EXTRACT snapshot (one section's already-resolved rows) genuinely
 * does not carry the full page's view state at its call site, and Postel's Law
 * says a partial substrate beats inventing values the caller does not have.
 * A full-page SNAPSHOT/EMBED build (`renderPageToJSON`) populates every field.
 */
export interface ViewSnapshotViewState {
  filterParams?:   Record<string, unknown>
  /** Active perspective id, keyed by the page's perspective axis param. */
  perspective?:    Record<string, unknown>
  locale?:         string
  fallbackLocale?: string
}

/**
 * Minimal citation provenance carried on the snapshot (Law 9 / AR-48 P1,
 * DESIGN §4 D6 "minimal" — source + lastUpdated + methodology link + permalink;
 * the full ESMS report stays one click away via `methodologyUrl`). Structurally
 * mirrors `@statdash/engine`'s `ExportMeta.provenance` (core's export-artifact
 * projection) and `ReferenceMetadataContract` (the DB-backed report) — each
 * owns its own boundary shape rather than importing across the arrow (the same
 * choice `ManifestMetric.methodology` vs `ProvenanceRecord.methodology` makes).
 */
export interface ViewSnapshotProvenance {
  source?:         string
  lastUpdated?:    string
  methodologyUrl?: string
  /** The citation URL for this exact view (the permalink leg of the same port). */
  permalink?:      string
  /** ISO timestamp the artifact was generated/accessed — the reproducibility stamp. */
  accessedAt?:     string
}

/**
 * The ONE substrate the delivery facets (extract · embed · permalink) compose
 * over (DESIGN §2). `data` is a JSON projection of the engine's resolved
 * frame(s) — present ⟺ PINNED; absent ⟺ LIVE (re-resolve on open, §4b D1).
 */
export interface ViewSnapshot {
  configRef:    ViewSnapshotConfigRef
  viewState:    ViewSnapshotViewState
  /** Pinned resolved data (rows / node-tree), opaque here — engine-owned shape. */
  data?:        JsonRecord | JsonRecord[]
  provenance?:  ViewSnapshotProvenance
  /** ISO 8601 timestamp of snapshot generation — the one field a storage boundary reads. */
  generatedAt:  string
}
