// ── CanvasView — live WYSIWYG canvas for the Constructor (N35) ────────────
//
//  Turns the form-only Constructor into a true WYSIWYG editor: the REAL
//  @statdash/react NodePageRenderer is the canvas, with an interaction overlay
//  on top. Two stacked layers (Builder.io / Craft.js pattern):
//
//    Layer 1  renderer  — NodePageRenderer drawing the live NodePageConfig,
//                         pointer-events:none so it is purely visual.
//    Layer 2  overlay   — CanvasOverlay: selection frames + slot drop zones,
//                         pointer-events re-enabled per interactive element.
//
//  Data: by DEFAULT the canvas renders against a staticStore (empty rows) wrapped
//  in a SiteProvider — never a real API call. Charts/tables render their empty/
//  placeholder state, which is exactly the structural preview the editor wants.
//
//  G3.1 — LIVE PREVIEW (opt-in): a structural|live toggle in the canvas chrome
//  lets the author preview against the REAL stats cube. Live mode swaps the
//  `stores` prop for a map built through the SHARED 'stats' store-builder
//  (buildStoreManifest) — the SAME seam the geostat runner uses. The toggle is
//  view-state local to this component (transient, like `dragging`), defaulting to
//  structural so the canvas opens zero-fetch and byte-identical to pre-G3. Live is
//  FAIL-SOFT: no cube-bound source / profile error / API unreachable falls back to
//  the static store and shows a non-blocking badge — the editor never crashes.
//
//  Registry: the engine registries (node/store-builder/projector slices +
//  perspectives) are populated by `setupCanvasRegistry()` as an EXPLICIT boot
//  step in `App.startApp` (before the app reaches 'ready'), NOT as a side effect
//  of this module loading. CanvasView therefore ASSUMES the registry is already
//  populated — which holds because the app boots it before any surface mounts,
//  including for a brand-new / empty site with no page yet. Tests that render
//  CanvasView in isolation run the same boot step in a `beforeAll`.
//
//  Law 3: CanvasView lives in apps/panel — the engine stays app-agnostic. It
//  consumes NodePageRenderer as-is; no fork.
//
import { useState }           from 'react'
import { MemoryRouter }       from 'react-router-dom'
import { SiteProvider }       from '@statdash/react'
import { NodePageRenderer }   from '@statdash/react/engine'
import type { NodePageConfig } from '@statdash/react/engine'
import { CanvasOverlay }      from './CanvasOverlay'
import { CanvasToolbar }      from './CanvasToolbar'
import { useLivePreviewStores, type PreviewMode } from './useLivePreviewStores'
import { useDebouncedLivePage } from './useDebouncedLivePage'
import type { NodeBase }      from '@statdash/react/engine'
import './canvas.css'

const CANVAS_I18N = { locales: ['ka', 'en'], defaultLocale: 'ka', fallbackLocale: 'ka' }

export interface CanvasViewProps {
  /** The live NodePageConfig being edited — rendered verbatim by the engine. */
  page:            NodePageConfig
  selectedNodeId?: string
  /** True while a palette item is being dragged — reveals drop zones. */
  dragging?:       boolean
  /**
   * The perspective the author is PREVIEWING (the Perspectives-pane switcher's local
   * selection). The canvas renders `perspective = f(previewState)` — the SAME
   * perspectiveState SSOT the live renderer reads — by seeding the canvas router's
   * URL with the axis param. Constructor-LOCAL (the author's preview, distinct from
   * runtime URL state); absent ⇒ the engine folds to perspectives[0] (the SSOT
   * default), so the canvas opens on the default perspective with no param.
   */
  previewPerspectiveId?: string
  onSelectNode:   (nodeId: string | null) => void
  onDropNode:     (parentId: string, slotKey: string, nodeType: string) => void
  /** Reserved for node-to-node moves (drag an existing node into another slot). */
  onMoveNode?:    (nodeId: string, targetParentId: string, targetSlot: string) => void
  /**
   * Bind a governed metric (dragged from the Metric Palette) onto a block on the
   * canvas — the drag half of AR-49 M0 item 9's bind affordance. The overlay's
   * node frames become metric drop targets; the write is the host's byte-identical
   * metricBinding write (spec §3). Absent ⇒ metric drops are ignored.
   */
  onBindMetric?:  (nodeId: string, metricId: string) => void
}

export function CanvasView({
  page, selectedNodeId, dragging, previewPerspectiveId, onSelectNode, onDropNode, onBindMetric,
}: CanvasViewProps) {
  // Preview mode is canvas view-state — transient and local to this component
  // (the same pattern as `dragging`; there is no persisted canvas-view-state slice
  // in the constructor store). Default 'structural': the canvas opens zero-fetch.
  const [mode, setMode] = useState<PreviewMode>('structural')

  // Resolve the store map for the requested mode. Structural ≡ pre-G3 static map
  // (byte-identical). Live builds through the shared 'stats' builder and degrades
  // to the static map (status 'unavailable') on any failure — never throws.
  const { stores, status } = useLivePreviewStores(mode)

  // G3.2 — request-volume guard: in live mode, only the SETTLED page descriptor
  // drives the data-fetching renderer (Layer 1), so an edit burst collapses to a
  // single live query. Structural mode is identity passthrough (byte-identical,
  // instant). The overlay (Layer 2) keeps the live `page` so selection/drop stay
  // responsive — the debounce is scoped to the data-fetch layer only.
  const renderedPage = useDebouncedLivePage(page, mode)

  const rootClass = `canvas-root scroll-fancy${dragging ? ' canvas-root--dragging' : ''}`

  // Perspective PREVIEW — seed the canvas router URL with the active axis param so the
  // live renderer switches perspective. The renderer's perspectiveState SSOT derives
  // entirely from the URL filter param (FilterProvider reads location.search on mount →
  // usePerspectiveContext.current), so the canvas needs no engine prop: setting the
  // initial entry IS the wiring. The param key is the page's axis key — the SAME
  // derivation SiteRenderer uses (Object.keys(page.perspectives)[0]). Absent preview /
  // no axis ⇒ '/' ⇒ the engine folds to perspectives[0] (the SSOT default).
  const perspectiveKey   = Object.keys(renderedPage.perspectives ?? {})[0]
  const previewEntry      = perspectiveKey && previewPerspectiveId
    ? `/?${encodeURIComponent(perspectiveKey)}=${encodeURIComponent(previewPerspectiveId)}`
    : '/'

  return (
    <div className={rootClass} data-testid="canvas-root">
      {/* Canvas chrome — preview-mode toggle + fail-soft badge. */}
      <CanvasToolbar mode={mode} status={status} onModeChange={setMode} />

      {/* Layer 1 — the real renderer, visually live but non-interactive. The router's
          initialEntries carries the previewed perspective param (keyed so a preview
          switch remounts FilterProvider → fresh perspectiveState). */}
      <div className="canvas-layer canvas-layer--renderer" aria-hidden="true">
        <MemoryRouter key={previewEntry} initialEntries={[previewEntry]}>
          <SiteProvider stores={stores} nav={[]} pages={{}} i18n={CANVAS_I18N}>
            <NodePageRenderer page={renderedPage} />
          </SiteProvider>
        </MemoryRouter>
      </div>

      {/* Layer 2 — interaction overlay. */}
      <CanvasOverlay
        page={page as NodeBase}
        selectedNodeId={selectedNodeId}
        dragging={dragging}
        onSelect={onSelectNode}
        onDrop={onDropNode}
        onBindMetric={onBindMetric}
      />
    </div>
  )
}
