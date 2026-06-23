import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CanvasView } from './CanvasView'
import type { NodePageConfig } from '@statdash/react/engine'

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
})
