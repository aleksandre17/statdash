// @vitest-environment jsdom
// ── FF-NODE-FRAME-REMEASURE — anchors stamped AFTER mount ⇒ frames re-measure (0112 S1) ──
//
//  The re-measure RACE (card 0112 · S1): the overlay's node frames are anchored to RENDERED
//  node boxes whose `data-part-node-id` anchors a live-mode node stamps ASYNC — AFTER the
//  page-change layout effect measured. The old triggers (a ResizeObserver on the FIXED
//  scroll-parent + window.resize) never fire for inner async growth (scrollHeight grows, the
//  observed border-box does not), so a just-navigated / sparse page rendered ZERO clickable
//  frames until some unrelated resize — the owner's «other pages don't take clicks». Firing a
//  `window.resize` repaired it every time, proving the geometry was fine and only the
//  re-measure SIGNAL was missing.
//
//  This guard pins the missing signal: a `data-part-node-id` anchor appended to the canvas
//  content AFTER mount re-measures with NO resize and NO user gesture (the MutationObserver
//  on the canvas content subtree). jsdom has no layout engine, so geometry non-degeneracy is
//  pinned by the Playwright e2e; here we pin the WIRING — anchors stamped ⇒ frames measured.
//
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { CanvasOverlay } from './CanvasOverlay'
import { setupCanvasRegistry } from './setupCanvasRegistry'
import type { NodeBase } from '@statdash/react/engine'

beforeAll(() => { setupCanvasRegistry() })

// A page whose section is a live-mode node — on the real canvas its anchor stamps async.
const page: NodeBase = {
  type: 'inner-page', id: 'page-1',
  children: [{ type: 'section', id: 'sec-1', children: [] }],
} as NodeBase

describe('FF-NODE-FRAME-REMEASURE — the overlay re-measures when anchors settle (0112 S1)', () => {
  it('a node anchor appended after mount is framed WITHOUT any resize/gesture', async () => {
    const { container } = render(
      <div className="canvas-root">
        <div className="canvas-layer canvas-layer--renderer" data-testid="renderer">
          {/* Only page-1 is stamped at mount — sec-1's live node has NOT settled yet (the
              just-navigated race: the layout effect measures before the async anchor lands). */}
          <div data-part-node-id="page-1"><div>page</div></div>
        </div>
        <CanvasOverlay page={page} onSelect={vi.fn()} onDrop={vi.fn()} />
      </div>,
    )

    // Before the anchor settles, sec-1 has NO frame → a click would hit bare canvas-root
    // and select nothing (the reproduced defect). page-1 (stamped) IS framed.
    expect(container.querySelector('.canvas-node[data-node-id="sec-1"]')).toBeNull()
    expect(container.querySelector('.canvas-node[data-node-id="page-1"]')).not.toBeNull()

    // The live node settles: it stamps its `data-part-node-id` into the renderer subtree.
    // NO window.resize, NO ResizeObserver-visible size change — ONLY this DOM mutation.
    const renderer = container.querySelector('[data-testid="renderer"]')!
    const anchor = document.createElement('div')
    anchor.setAttribute('data-part-node-id', 'sec-1')
    const box = document.createElement('div'); box.textContent = 'section'
    anchor.appendChild(box)
    renderer.appendChild(anchor)

    // The INVARIANT: anchors stamped ⇒ frames measured, no user gesture required.
    await waitFor(() => {
      expect(container.querySelector('.canvas-node[data-node-id="sec-1"]')).not.toBeNull()
    })
  })
})
