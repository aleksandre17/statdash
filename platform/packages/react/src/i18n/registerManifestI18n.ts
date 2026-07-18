// ── registerManifestI18n — pour a tenant i18n catalog into i18next (ADR-019) ──
//
//  The framework runner (and any authoring host that PREVIEWS a tenant's pages)
//  ships only a neutral source-language (English) baseline for generic
//  framework-chrome namespaces (feedback, and control/chrome slice metas). A
//  tenant's OTHER locales for that chrome — a localized `feedback` string, a
//  control's localized aria `label` (e.g. the year-select) — are AUTHORED
//  per-tenant in provisioning and travel on the bootstrap manifest as
//  `i18n.catalog` (the i18next `Resource` shape: locale → namespace → key →
//  string). This is the ONE seam that loads it.
//
//  LOCALE-AGNOSTIC (Law 1): it iterates whatever locales/namespaces the manifest
//  declares — it names no locale. A future tenant in any language localizes the
//  same chrome through the same field with zero host change.
//
//  addResourceBundle(locale, ns, keys, deep=true, overwrite=true): the tenant
//  catalog is AUTHORITATIVE — it wins over the en baseline regardless of load
//  order (the baseline is registered non-clobbering; see registerFeedbackI18n /
//  registerSliceI18n's addResources). Idempotent: a re-boot / manifest refetch
//  re-registers the same bundle. Absent or empty catalog ⇒ a no-op (Postel — the
//  en-baseline status quo is preserved).
//
//  This is the i18n sibling of @statdash/engine's registerManifestMetrics /
//  registerManifestDimensions: the shared, host-agnostic boot seam BOTH the
//  tenant runner (bootstrapSite → App) AND the authoring Constructor
//  (bootstrapCatalog) register through, so their tenant-preview renders cannot
//  drift. It lives in @statdash/react (not the pure engine) because i18next is a
//  UI concern (an optional peer here), never a dependency of the agnostic core.
//
import i18next, { type i18n as I18nInstance } from 'i18next'
import type { I18nConfig } from '../context/SiteContext'

export function registerManifestI18n(i18n: I18nConfig): void {
  const catalog = i18n.catalog
  if (!catalog) return
  const inst: I18nInstance =
      ((i18next as unknown) as { default?: I18nInstance }).default ?? (i18next as I18nInstance)
  for (const [locale, namespaces] of Object.entries(catalog)) {
    if (!namespaces) continue
    for (const [ns, keys] of Object.entries(namespaces)) {
      if (!keys) continue
      inst.addResourceBundle(locale, ns, keys, /* deep */ true, /* overwrite */ true)
    }
  }
}
