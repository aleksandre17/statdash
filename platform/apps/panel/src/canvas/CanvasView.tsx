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
//  Data: the canvas renders against a staticStore (empty rows) wrapped in a
//  SiteProvider — never a real API call. Charts/tables render their empty/
//  placeholder state, which is exactly the structural preview the editor wants.
//
//  Registry: setupCanvasRegistry() must have run so every node type the page
//  references has a registered shell. CanvasView calls it defensively (the
//  call is idempotent) so the component renders correctly in isolation/tests.
//
//  Law 3: CanvasView lives in apps/panel — the engine stays app-agnostic. It
//  consumes NodePageRenderer as-is; no fork.
//
import { useMemo }            from 'react'
import { MemoryRouter }       from 'react-router-dom'
import { SiteProvider }       from '@statdash/react'
import { NodePageRenderer }   from '@statdash/react/engine'
import { staticStore }        from '@statdash/engine'
import type { NodePageConfig } from '@statdash/react/engine'
import { setupCanvasRegistry } from './setupCanvasRegistry'
import { CanvasOverlay }      from './CanvasOverlay'
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
  // Empty static store under every key a page might reference. The canvas is a
  // structural preview — no rows, no fetch. resolveStore falls back to the first
  // key, so a single 'default' entry covers any storeKey.
  const stores = useMemo(() => ({ default: staticStore }), [])

  const rootClass = `canvas-root${dragging ? ' canvas-root--dragging' : ''}`

  return (
    <div className={rootClass} data-testid="canvas-root">
      {/* Layer 1 — the real renderer, visually live but non-interactive. */}
      <div className="canvas-layer canvas-layer--renderer" aria-hidden="true">
        <MemoryRouter>
          <SiteProvider stores={stores} nav={[]} pages={{}} i18n={CANVAS_I18N}>
            <NodePageRenderer page={page} />
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
