// ── @statdash/contracts — zero-dependency shared boundary contracts ────────────
//
//  The single source of truth for DTOs that cross a layer boundary the dependency
//  arrow forbids a direct import across. The classic case: `apps/api` MUST NOT
//  import `@statdash/react` (Law 3 — react is a frontend layer), yet the api and
//  the geostat runner exchange a SiteManifest over HTTP and the api persists a
//  PageDataSnapshot opaquely. Without a shared home, each side RE-DECLARES the
//  boundary shape — DRY + SSOT violation enforced by the (otherwise correct) arrow.
//
//  This package is the home both sides import instead of re-typing:
//    contracts ← expr ← core ← charts ← react ← plugins ← apps   (innermost, imports nothing)
//    contracts ← api
//
//  RULES (fitness-guarded):
//    - ZERO runtime + ZERO workspace dependencies. No React, no @statdash/* imports,
//      no engine internals. A type that needs an engine internal does NOT belong here;
//      it belongs in the layer that owns it.
//    - Pure types only (JSON-serializable shapes). No logic, no classes, no values
//      beyond const literals used as types.
//    - Backward-compatible evolution (expand-contract). A stored manifest / snapshot
//      authored against an older shape must keep parsing.

export * from './json'
export * from './manifest'
export * from './perspective-axis'
export * from './problem'
export * from './reference-metadata'
export * from './site'
export * from './snapshot'
