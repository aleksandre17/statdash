import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CanvasView } from './CanvasView'
import { setupCanvasRegistry } from './setupCanvasRegistry'
import type { NodePageConfig } from '@statdash/react/engine'

// Registration is now an explicit boot step (App.startApp), not a CanvasView
// module-eval side effect — so a test rendering CanvasView in isolation runs the
// same boot step the app runs, exactly as every other registry-dependent suite.
beforeAll(() => { setupCanvasRegistry() })

// Minimal inner-page with one section — exercises the engine renderer end to
// end (SiteProvider + staticStore + NodePageRenderer) plus the overlay layer.
const page = {
  type: 'inner-page',
  id:   'page-1',
  path: 'gdp',
  children: [
    { type: 'section', id: 'sec-1', title: 'GDP', children: [] },
  ],
} as unknown as NodePageConfig

describe('CanvasView', () => {
  it('renders the two-layer canvas without crashing', () => {
    render(
      <CanvasView
        page={page}
        onSelectNode={vi.fn()}
        onDropNode={vi.fn()}
      />,
    )
    expect(screen.getByTestId('canvas-root')).toBeInTheDocument()
    expect(screen.getByTestId('canvas-overlay')).toBeInTheDocument()
  })

  it('marks the root as dragging when the dragging prop is set', () => {
    render(
      <CanvasView
        page={page}
        dragging
        onSelectNode={vi.fn()}
        onDropNode={vi.fn()}
      />,
    )
    expect(screen.getByTestId('canvas-root')).toHaveClass('canvas-root--dragging')
  })

  // ── Perspective preview (Item 1, the P-final follow-up) ───────────────────
  //
  //  The canvas renders `perspective = f(previewPerspectiveId)`: seeding the prop
  //  seeds the canvas router URL with the axis param, so the SAME perspectiveState
  //  SSOT the live renderer reads drives the canvas. A section gated
  //  `view.visibleWhen: perspective-is(range)` is present ONLY when the range
  //  preview is active — the author SEES the selected perspective rendered.
  //  The canvas-node-anchor middleware stamps data-canvas-node-id on every node,
  //  so a gated section's anchor presence/absence is the visible-state oracle.
  const perspectivePage = {
    // container-page renders children.rendered directly (no sidebar chrome), so the
    // gated section's visibility is the only variable under test.
    type: 'container-page',
    id:   'page-2',
    path: 'gdp',
    // The page's perspective axis, keyed by the URL param 'mode' (year = default).
    perspectives: {
      mode: {
        perspectives: [
          { id: 'year',  label: { ka: 'წლიური', en: 'Year' } },
          { id: 'range', label: { ka: 'დინამიკა', en: 'Range' } },
        ],
      },
    },
    children: [
      // Always visible — the baseline anchor.
      { type: 'section', id: 'sec-always', title: 'Always', children: [] },
      // Gated: shows ONLY when the active perspective is 'range'.
      {
        type: 'section', id: 'sec-range', title: 'Range only', children: [],
        view: { visibleWhen: { op: 'perspective-is', perspective: 'range', param: 'mode' } },
      },
    ],
  } as unknown as NodePageConfig

  const anchor = (id: string) =>
    document.querySelector(`[data-canvas-node-id="${id}"]`)

  it('defaults to perspectives[0]: a range-gated node is hidden with no preview', () => {
    render(
      <CanvasView page={perspectivePage} onSelectNode={vi.fn()} onDropNode={vi.fn()} />,
    )
    // The default perspective (year) is active → the range-gated section is absent…
    expect(anchor('sec-always')).not.toBeNull()
    expect(anchor('sec-range')).toBeNull()
  })

  it('previewing the range perspective renders that perspective\'s gated node', () => {
    render(
      <CanvasView
        page={perspectivePage}
        previewPerspectiveId="range"
        onSelectNode={vi.fn()}
        onDropNode={vi.fn()}
      />,
    )
    // The range preview is active → the perspective-is(range) section now renders.
    expect(anchor('sec-always')).not.toBeNull()
    expect(anchor('sec-range')).not.toBeNull()
  })
})
