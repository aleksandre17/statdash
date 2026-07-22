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

// ── Shared react/feedback baseline (card 0112 fold-in) ──────────────────────────────
//  engine/react's shared feedback COMPONENTS (EmptyState/ExportMenu/error boundary) read
//  `useT('feedback')` for their chrome labels. The runner (geostat) seeds a neutral English
//  baseline for exactly these keys; the panel canvas renders the SAME components but boots
//  its own i18next with empty resources — so a key the manifest catalog does not carry (e.g.
//  `empty.desc`) rendered as the RAW KEY on the canvas (the leaked-key defect). This gap-fill
//  baseline registers the same neutral keys NON-CLOBBERING (deep=true, overwrite=false — fill
//  only what is MISSING), so a tenant value from the manifest catalog always wins; with
//  fallbackLng 'en' a ka render of an en-only baseline key resolves the English value (an
//  empty desc renders no line — never a raw key). Idempotent.
const FEEDBACK_BASELINE: Record<string, string> = {
  'empty.title':     'No data',
  'empty.desc':      '',
  'export.toolbar':  'Export data',
  'export.download': 'Download {{fmt}}',
  'share.permalink': 'Copy permalink',
  'share.copied':    'Copied',
  'collapse':        'Collapse',
  'expand':          'Expand',
  'error.title':     'Failed to load component',
  'error.retry':     'Retry',
  'skip.toContent':  'Skip to main content',
}

export function initPanelI18n(): void {
  if (i18next.isInitialized) {
    // Idempotent re-entry (HMR / test re-init): still ensure the baseline is present.
    i18next.addResourceBundle('en', 'feedback', FEEDBACK_BASELINE, true, false)
    return
  }
  void i18next.init({
    lng:            'ka',
    fallbackLng:    'en',
    resources:      {},
    interpolation:  { escapeValue: false },
  })
  // init() synchronously creates the ResourceStore (the Gap-B invariant), so the shared
  // feedback baseline can be registered immediately — before the first canvas render.
  i18next.addResourceBundle('en', 'feedback', FEEDBACK_BASELINE, true, false)
}
