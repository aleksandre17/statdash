// ── OutlineTree.test — structural tree, bidirectional selection, a11y (V6) ────
import { describe, it, expect, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { OutlineTree } from './OutlineTree'
import { renderRouted } from '../test-support/renderStudio'
import { useConstructorStore } from '../store/constructor.store'
import type { CanvasPage } from '../types/constructor'

// OutlineTree navigates surfaces (empty-state CTA → Insert), so it needs a Router.
const render = (ui: Parameters<typeof renderRouted>[0]) => renderRouted(ui)

const page: CanvasPage = {
  id: 'p1', type: 'inner-page', title: { ka: 'გ', en: 'P' }, slug: 'p',
  nodeIds: ['a', 'b'],
  nodes: {
    a:  { id: 'a',  type: 'section', props: { title: 'Overview' }, childIds: ['a1'] },
    a1: { id: 'a1', type: 'kpi-strip', props: {}, childIds: [] },
    b:  { id: 'b',  type: 'hero', props: {}, childIds: [] },
  },
}

function seed(selectedNodeId: string | null = null) {
  useConstructorStore.setState({
    pages: [page], activePageId: 'p1', selectedNodeId, chromeSelection: null,
    undoStack: [], redoStack: [], canUndo: false, canRedo: false,
  })
}

beforeEach(() => seed(null))

describe('OutlineTree', () => {
  it('renders a WAI-ARIA tree with one treeitem per visible node', () => {
    render(<OutlineTree />)
    const tree = screen.getByRole('tree', { name: 'Page outline' })
    expect(tree).toBeInTheDocument()
    const items = screen.getAllByRole('treeitem')
    expect(items.map((el) => el.getAttribute('data-outline-id'))).toEqual(['a', 'a1', 'b'])
  })

  it('stamps aria-level / posinset / setsize on items', () => {
    render(<OutlineTree />)
    const a1 = screen.getByText('kpi-strip').closest('[role="treeitem"]')!
    expect(a1).toHaveAttribute('aria-level', '2')
    expect(a1).toHaveAttribute('aria-posinset', '1')
  })

  it('clicking a row selects the node in the SHARED store (bidirectional)', () => {
    render(<OutlineTree />)
    fireEvent.click(screen.getByText('Overview'))
    expect(useConstructorStore.getState().selectedNodeId).toBe('a')
  })

  it('reflects the store selection back onto the tree (canvas → outline)', () => {
    seed('b')
    render(<OutlineTree />)
    const b = screen.getByText('hero').closest('[role="treeitem"]')!
    expect(b).toHaveAttribute('aria-selected', 'true')
  })

  it('collapse hides descendants; expand restores them', () => {
    render(<OutlineTree />)
    // 'a' has a collapse toggle (it has children).
    const collapseBtn = screen.getByRole('button', { name: /Collapse Overview/ })
    fireEvent.click(collapseBtn)
    expect(screen.queryByText('kpi-strip')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Expand Overview/ }))
    expect(screen.getByText('kpi-strip')).toBeInTheDocument()
  })

  it('delete removes the node from the store', () => {
    render(<OutlineTree />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete hero' }))
    expect(useConstructorStore.getState().pages[0].nodeIds).toEqual(['a'])
  })
})
