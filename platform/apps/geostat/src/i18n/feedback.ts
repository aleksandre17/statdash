// ── feedback i18n catalog — GENERIC UI CHROME fallback (ADR-0028) ──────────
//
//  The 'feedback' namespace backs engine/react's shared feedback COMPONENTS
//  (EmptyState, ExportBar, SharePermalinkButton). These are
//  framework UI chrome labels ("No data", "Export data", "Copy permalink") — NOT
//  tenant editorial content. engine/react is locale-agnostic: it consumes
//  useT('feedback') but must not carry locale literals, so the runner ships a
//  tenant-NEUTRAL English baseline here.
//
//  Tenant locales (e.g. ka) and any override of these chrome labels arrive at
//  boot from the manifest i18n catalog (the /api/bootstrap path); the runner
//  itself bakes in ONLY this English fallback so it carries zero tenant/brand
//  content (ADR-0028: a pure generic runner). en is the emptyManifest locale.
//
//  registerFeedbackI18n() is called from setupRegistrations(), which runs after
//  i18next.init() in main.tsx. addResources is idempotent → safe to re-run.
//  i18next keySeparator defaults to '.', so 'empty.title' nests as empty:{title}.
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
    i18next.addResources(locale, 'feedback', keys),
  )
}
