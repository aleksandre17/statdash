// ── manifest i18n catalog — tenant UI-chrome locales at boot (ADR-019) ────
//
//  The de-tenanted runner (ADR-017) ships only an EN baseline for generic
//  framework-chrome namespaces (see ./feedback.ts). Tenant locales for that
//  chrome are AUTHORED per-tenant in provisioning and travel on the bootstrap
//  manifest as `i18n.catalog` (the i18next resource shape). Loading that catalog
//  into i18next is now a SHARED, host-agnostic seam in @statdash/react
//  (`registerManifestI18n`) — the i18n sibling of registerManifestMetrics /
//  registerManifestDimensions — so the runner AND the panel Constructor's
//  tenant-preview boot register through ONE code path and cannot drift (Law 8).
//
//  Re-exported here so the runner's boot (App.tsx) and this module's callers keep
//  their local import; the behaviour + its ADR-019 semantics live in the package.
//
export { registerManifestI18n } from '@statdash/react'
