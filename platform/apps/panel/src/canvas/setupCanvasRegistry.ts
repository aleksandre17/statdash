// ── setupCanvasRegistry — register plugin shells for the live canvas ─────
//
//  N35: the Constructor canvas mounts the REAL @statdash/react NodePageRenderer.
//  The renderer dispatches every node through nodeRegistry.get(type, variant),
//  so the panel must register the same runtime shells the live site uses.
//
//  This mirrors apps/geostat/src/setupRegistrations.ts — the heavy face of
//  @statdash/plugins (Shell components + skeletons + control codecs). It pulls
//  the chart/geo render deps (react-apexcharts, leaflet), which is why the
//  panel now declares them. The lightweight @statdash/plugins/catalog path is
//  still used for palette metadata aggregation (platform-capabilities.ts).
//
//  Idempotent: registering the same slice twice is a no-op overwrite, but we
//  guard with a module-level flag so StrictMode double-mount / HMR re-runs are
//  cheap and order-stable.
//
//  Law 3 (engine app-agnostic): this wiring lives in apps/panel, not in
//  engine/react. The engine exposes registerSlice(); the app decides which
//  slices to register.
//
import * as Chrome    from '@plugins/chrome'
import * as Pages     from '@plugins/pages'
import * as Panels    from '@plugins/panels'
import * as Nodes     from '@plugins/nodes'
import * as Controls  from '@plugins/controls'
import { createElement }              from 'react'
import { registerSlice, middlewareRegistry } from '@statdash/react/engine'
import { modeRegistry }   from '@statdash/engine'
import { registerStoreBuilders } from '@statdash/plugins/datasources'
import { registerPresentationProjectors } from '@statdash/plugins/presentation'

let done = false

/**
 * Register every plugin slice into the engine registries.
 * Safe to call multiple times — the body runs once per session.
 */
export function setupCanvasRegistry(): void {
  if (done) return
  done = true

  // Modes drive timeMode-aware nodes (mode-bar, by-mode DataSpec). The canvas
  // renders with a staticStore so no data flows, but mode metadata must exist
  // for the shells to resolve their labels without throwing.
  modeRegistry.register({ id: 'year',    label: 'წლიური',    icon: 'calendar',       dataKey: 'year'    })
  modeRegistry.register({ id: 'range',   label: 'დინამიკა',  icon: 'calendar-range', dataKey: 'range'   })
  modeRegistry.register({ id: 'compare', label: 'შედარება',  icon: 'git-compare',    dataKey: 'compare' })

  ;[
    ...Object.values(Chrome),
    ...Object.values(Pages),
    ...Object.values(Panels),
    ...Object.values(Nodes),
    ...Object.values(Controls),
  ].forEach((s) => registerSlice(s as Parameters<typeof registerSlice>[0]))

  // ── G3.0 — register the SHARED 'stats' store-builder (SSOT) ──────────────
  //
  //  The same builder the geostat runner boots (@statdash/plugins/datasources).
  //  Registration is INERT until G3.1 calls buildStoreManifest(descriptors) with
  //  live stats datasources — it adds the 'stats' kind to the store-builder
  //  registry so the panel can later inject a LIVE store map through the same
  //  SiteProvider stores= seam the runner uses. No network happens here; the
  //  structural (empty-store) preview keeps working byte-identically until then.
  registerStoreBuilders()

  // ── Presentation projectors [N-ADR-0029 v2] ──────────────────────────────
  //
  //  Same SSOT the geostat runner boots: color → CSS var, crumbs →
  //  navContext.crumbs. The canvas mounts the REAL NodePageRenderer, which
  //  iterates these generically — so the live preview projects page presentation
  //  byte-identically to the runner.
  registerPresentationProjectors()

  // ── Canvas anchor middleware (AOP — engine-supported, no engine change) ──
  //
  //  The CanvasOverlay positions its selection frames + drop zones by reading
  //  the rendered DOM. It needs a stable, queryable anchor per node. Rather
  //  than fork NodePageRenderer, we wrap every rendered node with a
  //  display:contents element carrying data-canvas-node-id / -type.
  //
  //  `display: contents` keeps the wrapper visually inert (it contributes no
  //  box), so node layout is identical to the live site — only the overlay
  //  can find each node. Only nodes with an id get an anchor (the adapter
  //  stamps every CanvasNode id), so the overlay maps anchors → store nodes.
  //
  middlewareRegistry.use({
    name: 'canvas:node-anchor',
    after: (el, node) =>
      el == null
        ? el
        : createElement(
            'div',
            {
              'data-canvas-node-id':   node.id ?? '',
              'data-canvas-node-type': node.type,
              style: { display: 'contents' },
            },
            el,
          ),
  })
}
