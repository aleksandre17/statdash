// ── initPanelI18n — the app's i18next bootstrap (Gap B root-cause SSOT) ─────────
//
//  i18next.init() synchronously creates the ResourceStore and wires the instance's
//  addResources / addResourceBundle methods. It MUST run before anything exercises
//  the engine's slice registry: the live canvas lazily pulls setupCanvasRegistry →
//  registerSlice → registerSliceI18n → i18next.addResources(...). On an un-init'd
//  singleton that call throws ("addResources is not a function"), white-screening
//  the Page step. geostat's main.tsx already does this; the panel's did not — the
//  boot gap this module closes.
//
//  Extracted to ONE function (not inlined in main.tsx) so the boot config is a
//  single SSOT shared by the app entry (main.tsx) AND the test harness
//  (vitest.setup.ts) — the two can no longer drift (the drift that let the tests
//  stay green while the running app white-screened). The source guard
//  (mainI18nInit.test) asserts main.tsx actually calls it.
//
//  'ka' is the panel's primary authoring locale (the Constructor chrome + the
//  MetricPalette default to Georgian); 'en' is the fallback. resources start empty
//  and are filled by the slice catalogs registerSliceI18n adds at registry setup.
//
import i18next from 'i18next'

export function initPanelI18n(): void {
  if (i18next.isInitialized) return
  void i18next.init({
    lng:            'ka',
    fallbackLng:    'en',
    resources:      {},
    interpolation:  { escapeValue: false },
  })
}
