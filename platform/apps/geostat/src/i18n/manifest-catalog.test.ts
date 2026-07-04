// ── registerManifestI18n — the runtime wire (ADR-019) ─────────────────────────
//
//  Proves the boot seam actually pours manifest.i18n.catalog into i18next so a
//  useT() lookup resolves the tenant locale — the RUNTIME complement to the
//  authoring gate INV3 (which proves the CONFIG is complete). Also pins the two
//  load-order-independence guarantees the design relies on: the tenant catalog
//  wins over the en baseline, and the gap-fill baseline never clobbers it.
//
import { describe, it, expect, beforeEach } from 'vitest'
import i18next from 'i18next'
import type { I18nConfig } from '@statdash/react'
import { registerManifestI18n } from './manifest-catalog'
import { registerFeedbackI18n } from './feedback'

const bilingual: I18nConfig = {
  locales: ['ka', 'en'],
  defaultLocale: 'ka',
  fallbackLocale: 'ka',
  catalog: {
    en: { feedback: { 'empty.title': 'No data', 'share.permalink': 'Copy permalink' } },
    ka: { feedback: { 'empty.title': 'მონაცემები არ არის', 'share.permalink': 'ბმულის კოპირება' } },
  },
}

beforeEach(() => {
  // fallbackLng 'en' mirrors main.tsx so an unresolved key surfaces the baseline,
  // never a thrown key. The SUT registers onto the i18next SINGLETON (as the runner
  // does), so isolate each test by clearing the feedback bundle it mutates.
  i18next.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } })
  for (const lng of ['en', 'ka']) i18next.removeResourceBundle(lng, 'feedback')
})

describe('registerManifestI18n (ADR-019)', () => {
  it('loads the tenant catalog so useT resolves the active locale', () => {
    registerManifestI18n(bilingual)
    expect(i18next.t('feedback:empty.title', { lng: 'ka' })).toBe('მონაცემები არ არის')
    expect(i18next.t('feedback:empty.title', { lng: 'en' })).toBe('No data')
    expect(i18next.t('feedback:share.permalink', { lng: 'ka' })).toBe('ბმულის კოპირება')
  })

  it('is a no-op when no catalog is present (Postel — en-baseline status quo)', () => {
    const { catalog: _omit, ...noCatalog } = bilingual
    void _omit
    registerManifestI18n(noCatalog)
    registerFeedbackI18n()
    // ka has no catalog and no baseline → falls back to the en baseline (not a throw).
    expect(i18next.t('feedback:empty.title', { lng: 'ka' })).toBe('No data')
  })

  it('the tenant catalog wins over the en baseline regardless of load order', () => {
    // baseline BEFORE catalog: catalog (overwrite=true) must still win for en.
    registerFeedbackI18n()
    registerManifestI18n({
      ...bilingual,
      catalog: { en: { feedback: { 'empty.title': 'Nothing here' } } },
    })
    expect(i18next.t('feedback:empty.title', { lng: 'en' })).toBe('Nothing here')
  })

  it('the gap-fill baseline never clobbers a catalog value (order-independent)', () => {
    // catalog BEFORE baseline: the non-clobbering baseline must NOT overwrite en.
    registerManifestI18n({
      ...bilingual,
      catalog: { en: { feedback: { 'empty.title': 'Nothing here' } } },
    })
    registerFeedbackI18n()
    expect(i18next.t('feedback:empty.title', { lng: 'en' })).toBe('Nothing here')
    // and the baseline still fills a gap the catalog did NOT provide:
    expect(i18next.t('feedback:export.toolbar', { lng: 'en' })).toBe('Export data')
  })
})
