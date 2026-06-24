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
//  Registry: setupCanvasRegistry() must have run so every node type the page
//  references has a registered shell. CanvasView calls it defensively (the
//  call is idempotent) so the component renders correctly in isolation/tests.
//
//  Law 3: CanvasView lives in apps/panel — the engine stays app-agnostic. It
//  consumes NodePageRenderer as-is; no fork.
//
import { useState }           from 'react'
import { MemoryRouter }       from 'react-router-dom'
import { SiteProvider }       from '@statdash/react'
import { NodePageRenderer }   from '@statdash/react/engine'
import type { NodePageConfig } from '@statdash/react/engine'
import { setupCanvasRegistry } from './setupCanvasRegistry'
import { CanvasOverlay }      from './CanvasOverlay'
import { CanvasToolbar }      from './CanvasToolbar'
import { useLivePreviewStores, type PreviewMode } from './useLivePreviewStores'
import { useDebouncedLivePage } from './useDebouncedLivePage'
import type { NodeBase }      from '@statdash/react/engine'
import './canvas.css'

// One-time, idempotent. Module scope so it runs before first render.
setupCanvasRegistry()

const CANVAS_I18N = { locales: ['ka', 'en'], defaultLocale: 'ka', fallbackLocale: 'ka' }

export interface CanvasViewProps {
  /** The live NodePageConfig being edited — rendered verbatim by the engine. */
  page:            NodePageConfig
  selectedNodeId?: string
  /** True while a palette item is being dragged — reveals drop zones. */
  dragging?:       boolean
  onSelectNode:   (nodeId: string | null) => void
  onDropNode:     (parentId: string, slotKey: string, nodeType: string) => void
  /** Reserved for node-to-node moves (drag an existing node into another slot). */
  onMoveNode?:    (nodeId: string, targetParentId: string, targetSlot: string) => void
}

export function CanvasView({
  page, selectedNodeId, dragging, onSelectNode, onDropNode,
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

  const rootClass = `canvas-root${dragging ? ' canvas-root--dragging' : ''}`

  return (
    <div className={rootClass} data-testid="canvas-root">
      {/* Canvas chrome — preview-mode toggle + fail-soft badge. */}
      <CanvasToolbar mode={mode} status={status} onModeChange={setMode} />

      {/* Layer 1 — the real renderer, visually live but non-interactive. */}
      <div className="canvas-layer canvas-layer--renderer" aria-hidden="true">
        <MemoryRouter>
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
      />
    </div>
  )
}
