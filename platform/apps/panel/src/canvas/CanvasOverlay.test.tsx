import { describe, it, expect, beforeAll, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CanvasOverlay } from './CanvasOverlay'
import { walkNodes, parentMap } from './walkNodes'
import { setupCanvasRegistry } from './setupCanvasRegistry'
import { writeMetricDrag } from '../discovery/metricDrag'
import type { NodeBase } from '@statdash/react/engine'

// Minimal DataTransfer stub (jsdom has none) exposing the surface the overlay uses.
function fakeDataTransfer(): DataTransfer {
  const store = new Map<string, string>()
  return {
    setData: (f: string, d: string) => { store.set(f.toLowerCase(), d) },
    getData: (f: string) => store.get(f.toLowerCase()) ?? '',
    get types() { return [...store.keys()] },
    effectAllowed: 'none', dropEffect: 'none',
  } as unknown as DataTransfer
}

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

describe('parentMap (0112 R5)', () => {
  it('maps every child id to its container id over the rendered tree', () => {
    const tree: NodeBase = {
      type: 'inner-page', id: 'page-1',
      children: [{ type: 'section', id: 'sec-1', children: [{ type: 'chart', id: 'chart-1' }] }],
    } as unknown as NodeBase
    const parents = parentMap(tree)
    expect(parents.get('chart-1')).toBe('sec-1')
    expect(parents.get('sec-1')).toBe('page-1')
    expect(parents.get('page-1')).toBeUndefined()   // the root has no parent
  })

  it('does not cross data-carrying keys (an inline `data` spec is not a child)', () => {
    const tree: NodeBase = {
      type: 'section', id: 'sec-2',
      data: { type: 'row-list', id: 'not-a-child', rows: [] },
      children: [],
    } as unknown as NodeBase
    expect(parentMap(tree).has('not-a-child')).toBe(false)
  })
})

// ── Select-behind (0112 R5) — an edge-to-edge child cannot orphan its container ──────
//  The deepest child frame paints ON TOP (framed last), so a parent an edge-to-edge child
//  fully covers is otherwise unclickable. A repeat click on the already-selected node cycles
//  selection UP to its container (Figma/Illustrator-class), keeping the parent reachable.
describe('CanvasOverlay — select-behind (0112 R5)', () => {
  const nested: NodeBase = {
    type: 'inner-page', id: 'page-1',
    children: [{ type: 'section', id: 'sec-1', children: [{ type: 'chart', id: 'chart-1' }] }],
  } as unknown as NodeBase

  const renderNested = (props: { selectedNodeId?: string; onSelect: () => void }) =>
    render(
      <div className="canvas-root">
        <div className="canvas-layer canvas-layer--renderer">
          <div data-part-node-id="page-1"><div>page</div></div>
          <div data-part-node-id="sec-1"><div>section</div></div>
          <div data-part-node-id="chart-1"><div>chart</div></div>
        </div>
        <CanvasOverlay
          page={nested}
          selectedNodeId={props.selectedNodeId}
          onSelect={props.onSelect}
          onDrop={vi.fn()}
        />
      </div>,
    )

  const clickNode = (id: string) =>
    fireEvent.click(document.querySelector(`.canvas-node[data-node-id="${id}"]`)!)

  it('first click selects the clicked (deepest) node — unchanged direct-select', () => {
    const onSelect = vi.fn()
    renderNested({ onSelect })
    clickNode('chart-1')
    expect(onSelect).toHaveBeenCalledWith('chart-1')
  })

  it('a repeat click on the already-selected child cycles UP to its container (the covered parent)', () => {
    const onSelect = vi.fn()
    // chart-1 is already selected (it fully covers sec-1) → clicking it again reaches sec-1.
    renderNested({ selectedNodeId: 'chart-1', onSelect })
    clickNode('chart-1')
    expect(onSelect).toHaveBeenCalledWith('sec-1')
  })

  it('the cycle walks the whole ancestor chain; the root deselects (closing the loop)', () => {
    const onSelect = vi.fn()
    // sec-1 selected → repeat click reaches page-1 (the section's container).
    const { rerender } = renderNested({ selectedNodeId: 'sec-1', onSelect })
    clickNode('sec-1')
    expect(onSelect).toHaveBeenLastCalledWith('page-1')
    // page-1 selected (the root) → repeat click has no parent → deselect (null).
    rerender(
      <div className="canvas-root">
        <div className="canvas-layer canvas-layer--renderer">
          <div data-part-node-id="page-1"><div>page</div></div>
          <div data-part-node-id="sec-1"><div>section</div></div>
          <div data-part-node-id="chart-1"><div>chart</div></div>
        </div>
        <CanvasOverlay page={nested} selectedNodeId="page-1" onSelect={onSelect} onDrop={vi.fn()} />
      </div>,
    )
    clickNode('page-1')
    expect(onSelect).toHaveBeenLastCalledWith(null)
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
          <div data-part-node-id="page-1"><div>page</div></div>
          <div data-part-node-id="sec-1"><div>section</div></div>
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

  it('at rest: shows EMPTY-slot zones (the at-rest affordance) but hides POPULATED ones', () => {
    // 0102 R1 · Part 2 — an empty slot shows its labelled drop affordance at rest so the
    // author sees where content goes; a populated slot's zone stays drag-only (no clutter).
    render(
      <div className="canvas-root">
        <div className="canvas-layer canvas-layer--renderer">
          <div data-part-node-id="page-1"><div>page</div></div>
          <div data-part-node-id="sec-1"><div>section</div></div>
        </div>
        <CanvasOverlay page={page} onSelect={vi.fn()} onDrop={vi.fn()} />
      </div>,
    )
    // Empty slots (sec-1.children, page-1.sticky) render at rest, flagged --empty.
    const secZone = screen.getByTestId('dropzone-sec-1:children')
    expect(secZone).toBeInTheDocument()
    expect(secZone.className).toContain('canvas-dropzone--empty')
    expect(screen.getByTestId('dropzone-page-1:sticky')).toBeInTheDocument()
    // page-1.main holds sec-1 → populated → hidden at rest (revealed only while dragging).
    expect(screen.queryByTestId('dropzone-page-1:main')).not.toBeInTheDocument()
  })
})

describe('CanvasOverlay — metric drag-to-bind (AR-49 M0 item 9)', () => {
  function renderOverlay(onBindMetric = vi.fn()) {
    render(
      <div className="canvas-root">
        <div className="canvas-layer canvas-layer--renderer">
          <div data-part-node-id="page-1"><div>page</div></div>
          <div data-part-node-id="sec-1"><div>section</div></div>
        </div>
        <CanvasOverlay page={page} onSelect={vi.fn()} onDrop={vi.fn()} onBindMetric={onBindMetric} />
      </div>,
    )
    return onBindMetric
  }

  it('binds a dropped metric onto the node frame it lands on', () => {
    const onBindMetric = renderOverlay()
    const dt = fakeDataTransfer()
    writeMetricDrag(dt, 'gdp.realGrowth')

    // The node frame carries data-node-id; drop the metric onto sec-1's frame.
    const frame = document.querySelector('.canvas-node[data-node-id="sec-1"]')!
    fireEvent.drop(frame, { dataTransfer: dt })

    expect(onBindMetric).toHaveBeenCalledWith('sec-1', 'gdp.realGrowth')
  })

  it('ignores a foreign (node-type) drag — no metric bind', () => {
    const onBindMetric = renderOverlay()
    const dt = fakeDataTransfer()
    dt.setData('nodeType', 'chart') // a palette node-type drag, not a metric

    const frame = document.querySelector('.canvas-node[data-node-id="sec-1"]')!
    fireEvent.drop(frame, { dataTransfer: dt })

    expect(onBindMetric).not.toHaveBeenCalled()
  })
})
