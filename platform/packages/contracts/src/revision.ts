// ── @statdash/contracts — the config revision-log contract (ADR-052) ───────────
//
//  The append-only revision record every versioned config document carries. It
//  crosses the api↔panel boundary the dependency arrow forbids a direct import
//  across (the panel READS history + restore; the api WRITES the log) — exactly
//  what this innermost zero-dep contracts layer is for (the same rationale as
//  `ProblemDetails` / `SiteManifest`).
//
//  Pure types only (JSON-serializable). No logic, no classes. The runtime that
//  writes/reads these rows lives in `apps/api` (the route + the revision-log
//  helper); this file is the SHAPE both sides agree on.
//
//  Design (ADR-052 §2):
//    • Identity = `id` (UUID PK). Logical key = (docKind, docId, revisionNumber)
//      UNIQUE; ordering = `revisionNumber` ASC (authoritative — `createdAt` is
//      display-only, immune to clock skew).
//    • Immutable + append-only — a row is never UPDATEd/DELETEd; restore = a NEW
//      revision whose `body` is an old body and whose `restoredFrom` points at its
//      source (history is never rewritten).
//    • Full snapshot — `body` is the COMPLETE logical document a PUT can set, so
//      restore is a pure re-apply, no diff replay.

/** The config-document families that carry a revision history (ADR-052 §2). */
export type ConfigDocKind = 'data_spec' | 'data_source' | 'site_config' | 'page'

/** A single append-only revision of one config document (full snapshot). */
export interface RevisionRecord {
  /** UUID — revision identity (PK). */
  id:             string
  /** Which config family this revision belongs to. */
  docKind:        ConfigDocKind
  /** The document identity (uuid-as-text; a TEXT key for `site_config`). */
  docId:          string
  /** Monotonic per (docKind, docId), 1-based, trigger-assigned. */
  revisionNumber: number
  /** The FULL validated document body — restore re-applies this verbatim. */
  body:           unknown
  /** JWT sub, or `system:provisioning` / `system:adoption`; null tolerated. */
  actor:          string | null
  /** Optional author message from the publish/save affordance. */
  note:           string | null
  /** UUID of the source revision when this row is a restore (append-only lineage). */
  restoredFrom:   string | null
  /** ISO 8601 — append time (display-only; ordering is by `revisionNumber`). */
  createdAt:      string
  // `tenantId` is a STORAGE-side seam column (ADR-052 §3), deliberately NOT
  // projected on the wire in single-tenant v1.
}

/**
 * List-view row — `body` OMITTED for weight (mirrors the pages `GET /:id/versions`
 * projection, which returns metadata only, never the full config tree).
 */
export type RevisionSummary = Omit<RevisionRecord, 'body'>
