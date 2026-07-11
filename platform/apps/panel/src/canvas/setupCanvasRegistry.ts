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
import { registerSlice, middlewareRegistry, enablePromotion } from '@statdash/react/engine'
import { perspectiveRegistry }   from '@statdash/engine'
import type { KpiSpec }          from '@statdash/engine'
import { registerStoreBuilders } from '@statdash/plugins/datasources'
import { registerPresentationProjectors } from '@statdash/plugins/presentation'
import { registerNodeProjector } from './nodeProjection'

let done = false

/**
 * Register every plugin slice into the engine registries.
 * Safe to call multiple times — the body runs once per session.
 */
export function setupCanvasRegistry(): void {
  if (done) return
  done = true

  // Perspectives populate the Constructor's perspective palette (the perspective-*
  // visibility leaf picker). The canvas renders with a staticStore so no data flows;
  // this metadata exists so the visibility builder offers the registered ids.
  perspectiveRegistry.register({ id: 'year',  label: 'წლიური',   icon: 'calendar',       dataKey: 'year'  })
  perspectiveRegistry.register({ id: 'range', label: 'დინამიკა', icon: 'calendar-range', dataKey: 'range' })

  ;[
    ...Object.values(Chrome),
    ...Object.values(Pages),
    ...Object.values(Panels),
    ...Object.values(Nodes),
    ...Object.values(Controls),
  ].forEach((s) => registerSlice(s as Parameters<typeof registerSlice>[0]))

  // ── ADR-023 · R2 — ACTIVATE the kpi-card promotion (render + authoring) ─────
  //
  //  The promotion is authorized: FF-PROMOTION-LOSSLESS proves the promoted
  //  residence is byte-identical to the legacy items[] path over the whole
  //  geostat corpus. Activation is an APP-BOOT rollout decision (Law 1 keeps the
  //  engine flag generic — it names no type; Law 3 keeps the app deciding), in two
  //  symmetric faces:
  //    • RENDER — enablePromotion('kpi-card') routes each strip item through the
  //      first-class renderNode pipeline (the card as a real node, not the buried
  //      itemSchema value).
  //    • AUTHORING — a node projector surfaces each strip item as a SELECTABLE,
  //      EDITABLE card object on the canvas, WITHOUT migrating the stored config
  //      (items[] stays; the projection reuses the SAME `kpiSpecToCardNode`
  //      lowering the renderer uses, so the projected card's id matches the
  //      rendered card's DOM anchor). Edits write back into the strip's items[].
  //
  enablePromotion('kpi-card')
  registerNodeProjector('kpi-strip', {
    field: 'items',
    toNode: (item) => {
      const card = Panels.kpiCard.kpiSpecToCardNode(item as KpiSpec)
      const { type, id, ...props } = card
      return { id: id ?? '', type, props }
    },
  })

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
