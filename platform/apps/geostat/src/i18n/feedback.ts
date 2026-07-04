// ── feedback i18n — GENERIC UI CHROME en baseline (ADR-017 / ADR-019) ──────
//
//  The 'feedback' namespace backs engine/react's shared feedback COMPONENTS
//  (EmptyState, ExportBar, SharePermalinkButton). These are
//  framework UI chrome labels ("No data", "Export data", "Copy permalink") — NOT
//  tenant editorial content. engine/react is locale-agnostic: it consumes
//  useT('feedback') but must not carry locale literals, so the runner ships a
//  tenant-NEUTRAL English baseline here.
//
//  Tenant locales (e.g. ka) and any override of these chrome labels arrive at
//  boot from the manifest i18n CATALOG (manifest.i18n.catalog, the /api/bootstrap
//  path) — loaded by registerManifestI18n() (./manifest-catalog.ts, ADR-019).
//  The runner itself bakes in ONLY this English fallback so it carries zero
//  tenant/brand content (a pure generic runner): en is also the emptyManifest /
//  offline locale, so this baseline must render before any manifest exists.
//
//  registerFeedbackI18n() is called from setupRegistrations(), which runs after
//  i18next.init() in main.tsx. It registers the baseline NON-CLOBBERING via
//  addResourceBundle with deep=true, overwrite=false — i18next's deepExtend then
//  fills ONLY missing keys and never overrides a tenant value the manifest catalog
//  supplied. (deep=false would shallow-merge new-over-old regardless of overwrite,
//  which WOULD clobber the catalog — so deep=true is load-bearing here.) The load
//  order between this (lazy renderer chunk) and the catalog (eager boot effect) is
//  therefore irrelevant; the tenant catalog always wins. Idempotent → safe to
//  re-run. Same addResourceBundle path the catalog loader uses (manifest-catalog.ts)
//  so 'feedback' keys store + resolve identically for baseline and tenant values.
//
import i18next from 'i18next'

const FEEDBACK_I18N: Record<string, Record<string, string>> = {
  en: {
    'empty.title':        'No data',
    'empty.desc':         '',
    'export.toolbar':     'Export data',
    'export.download':    'Download {{fmt}}',
    'share.permalink':    'Copy permalink',
  },
}

export function registerFeedbackI18n(): void {
  Object.entries(FEEDBACK_I18N).forEach(([locale, keys]) =>
    // deep=true, overwrite=false — a gap-fill baseline: deepExtend only fills
    // MISSING keys, so it never clobbers a manifest-catalog value (ADR-019
    // fallback-layer semantics). deep=false would shallow-merge new-over-old.
    i18next.addResourceBundle(locale, 'feedback', keys, true, false),
  )
}
