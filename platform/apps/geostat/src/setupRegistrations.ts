import * as Chrome    from '@plugins/chrome'
import * as Pages     from '@plugins/pages'
import * as Panels    from '@plugins/panels'
import * as Nodes     from '@plugins/nodes'
import * as Controls  from '@plugins/controls'
import { registerSlice, middlewareRegistry } from '@geostat/react/engine'
import { modeRegistry }                      from '@geostat/engine'
import { createElement }                     from 'react'
import { registerStoreBuilders } from './data/stats-registrations'

export function setupRegistrations(): void {
  registerStoreBuilders()

  modeRegistry.register({ id: 'year',    label: 'წლიური',    icon: 'calendar',       dataKey: 'year'    })
  modeRegistry.register({ id: 'range',   label: 'დინამიკა',  icon: 'calendar-range', dataKey: 'range'   })
  modeRegistry.register({ id: 'compare', label: 'შედარება',  icon: 'git-compare',    dataKey: 'compare' })

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
      const { setSpecResolveObserver, setFilterDeriveObserver, setDiagnosticObserver } = await import('@geostat/engine')
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
      setDiagnosticObserver((code, detail) => console.warn(`[Engine] ${code}: ${detail}`))
    })()
  }
}