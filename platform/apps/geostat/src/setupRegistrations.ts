import * as Chrome    from '@plugins/chrome'
import * as Pages     from '@plugins/pages'
import * as Panels    from '@plugins/panels'
import * as Nodes     from '@plugins/nodes'
import * as Controls  from '@plugins/controls'
import { registerSlice, middlewareRegistry } from '@statdash/react/engine'
import { createElement }                     from 'react'
import { registerStoreBuilders } from '@statdash/plugins/datasources'
import { registerFeedbackI18n }  from './i18n/feedback'
import { setupExtensions }       from './extensions/setupExtensions'
// Locale formatters are registered at boot from manifest.i18n.locales
// (App.tsx, post-bootstrap) — see i18n/formatters.ts registerFormatters().

export function setupRegistrations(): void {
  registerStoreBuilders()

  // Core (non-slice) i18n: 'feedback' namespace for engine/react shared
  // feedback components (EmptyState). Runs after i18next.init() in main.tsx.
  registerFeedbackI18n()

  // Extension point contributions — plugin-style registration for app-tier slots.
  setupExtensions()

  // Modes are app DATA, not a compiled capability — they now live in the
  // SiteManifest (manifest.modes) and are registered at boot from whichever
  // manifest is active (App.tsx). See data/modes.config.ts (offline fallback).

  ;[
    ...Object.values(Chrome),
    ...Object.values(Pages),
    ...Object.values(Panels),
    ...Object.values(Nodes),
    ...Object.values(Controls),
  ].forEach(s => registerSlice(s as Parameters<typeof registerSlice>[0]))

  // Gap 10: Middleware — dev node-debug wrapper (AOP, Grafana middleware pattern)
  if (import.meta.env.DEV) {
    middlewareRegistry.use({
      name: 'dev:node-debug',
      after: (el, node) => el == null ? el : createElement('div', {
        'data-node-type': node.type,
        'data-node-id':   node.id ?? '',
        style: { display: 'contents' },
      }, el),
    })
  }

  // ── DEV observability seam (app layer only) ──────────────────────────────
  if (import.meta.env.DEV) {
    ;(async () => {
      const { setSpecResolveObserver, setFilterDeriveObserver, setDiagnosticObserver } = await import('@statdash/engine')
      setSpecResolveObserver((tag, _ctx, rows) => {
        console.debug(`[engine] ${tag} → ${rows.length} rows`)
      })
      setFilterDeriveObserver((key, op) => {
        console.warn(
          `[FilterDerive] op='${op}' uses an inline-array source (key='${key}'). ` +
          `Phase-2-incompatible: inline arrays couple config to compiled data. ` +
          `Use { $cl: 'dimCode' } or { $d: 'dimCode' } instead.`
        )
      })
      setDiagnosticObserver((d) => console.warn(`[Engine] ${d.code}: ${d.message}`))
    })()
  }
}