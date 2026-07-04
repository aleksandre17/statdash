// ── manifest i18n catalog — tenant UI-chrome locales at boot (ADR-019) ────
//
//  The de-tenanted runner (ADR-017) ships only an EN baseline for generic
//  framework-chrome namespaces (see ./feedback.ts). Tenant locales for that
//  chrome (e.g. the Georgian `feedback` strings) are AUTHORED per-tenant in
//  provisioning and travel on the bootstrap manifest as `i18n.catalog` — the
//  i18next resource shape (locale → namespace → key → string). This loader is
//  the boot seam that pours that catalog into i18next.
//
//  LOCALE-AGNOSTIC (Law 1): it iterates whatever locales/namespaces the manifest
//  declares — it never references 'ka'/'en' by name. A future non-Georgian tenant
//  localizes the same chrome through the same field with zero runner change.
//
//  addResourceBundle(locale, ns, keys, deep=true, overwrite=true): the tenant
//  catalog is AUTHORITATIVE — it wins over the en baseline regardless of load
//  order (the baseline is registered non-clobbering; see registerFeedbackI18n).
//  Idempotent: a re-boot / manifest refetch re-registers the same bundle. Absent
//  or empty catalog ⇒ a no-op (Postel — the en-baseline status quo is preserved).
//
import i18next from 'i18next'
import type { I18nConfig } from '@statdash/react'

export function registerManifestI18n(i18n: I18nConfig): void {
  const catalog = i18n.catalog
  if (!catalog) return
  for (const [locale, namespaces] of Object.entries(catalog)) {
    if (!namespaces) continue
    for (const [ns, keys] of Object.entries(namespaces)) {
      if (!keys) continue
      i18next.addResourceBundle(locale, ns, keys, /* deep */ true, /* overwrite */ true)
    }
  }
}
