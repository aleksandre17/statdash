import { describe, it, expect, beforeAll, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CanvasOverlay } from './CanvasOverlay'
import { walkNodes }     from './walkNodes'
import { setupCanvasRegistry } from './setupCanvasRegistry'
import type { NodeBase } from '@statdash/react/engine'

beforeAll(() => { setupCanvasRegistry() })

// A minimal tree: a section (which registers a `children` SlotDef) holding one leaf.
const page: NodeBase = {
  type: 'inner-page',
  id:   'page-1',
  children: [
    { type: 'section', id: 'sec-1', children: [] },
  ],
} as NodeBase

describe('walkNodes', () => {
  it('flattens every node carrying a type, skipping data keys', () => {
    const ids = walkNodes(page).map((w) => w.node.id)
    expect(ids).toEqual(['page-1', 'sec-1'])
  })

  it('does not descend into data-carrying keys', () => {
    const withData: NodeBase = {
      type: 'section', id: 'sec-2',
      data: { type: 'row-list', rows: [] },
      children: [],
    } as unknown as NodeBase
    const types = walkNodes(withData).map((w) => w.type)
    expect(types).toEqual(['section'])
  })
})

describe('CanvasOverlay', () => {
  it('renders drop zones for a node with registered slots when dragging', () => {
    // Anchors live in the renderer layer; the overlay measures its parent. We
    // render the overlay inside a .canvas-root with a stub anchor for sec-1 so
    // getBoundingClientRect resolves (jsdom returns zero-rects, which is fine).
    render(
      <div className="canvas-root">
        <div className="canvas-layer canvas-layer--renderer">
          <div data-canvas-node-id="page-1"><div>page</div></div>
          <div data-canvas-node-id="sec-1"><div>section</div></div>
        </div>
        <CanvasOverlay
          page={page}
          dragging
          onSelect={vi.fn()}
          onDrop={vi.fn()}
        />
      </div>,
    )

    // inner-page declares `sticky` + `main` slots; section declares `children`.
    expect(screen.getByTestId('dropzone-page-1:main')).toBeInTheDocument()
    expect(screen.getByTestId('dropzone-page-1:sticky')).toBeInTheDocument()
    expect(screen.getByTestId('dropzone-sec-1:children')).toBeInTheDocument()
  })

  it('hides drop zones when not dragging', () => {
    render(
      <div className="canvas-root">
        <div className="canvas-layer canvas-layer--renderer">
          <div data-canvas-node-id="sec-1"><div>section</div></div>
        </div>
        <CanvasOverlay page={page} onSelect={vi.fn()} onDrop={vi.fn()} />
      </div>,
    )
    expect(screen.queryByTestId('dropzone-sec-1:children')).not.toBeInTheDocument()
  })
})
