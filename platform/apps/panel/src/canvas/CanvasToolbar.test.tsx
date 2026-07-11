// ── CanvasToolbar.test — the in-canvas perspective switch (BE-3 / 0061) ─────────
//
//  The switch is a PURE PROJECTION of the page's DECLARED perspective axis: given
//  the options + the active id + a callback, it renders one radio per declared
//  perspective, marks the active, and reports the chosen DECLARED id. No per-page
//  special-case; hidden when the page declares <2 perspectives. (The end-to-end
//  re-render — previewPerspectiveId → MemoryRouter remount → FilterProvider — is the
//  pre-existing wiring CanvasView already owns; here we lock the surfaced control.)
//
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CanvasToolbar } from './CanvasToolbar'

const PERSPECTIVES = [
  { id: 'year',  label: 'წლიური' },
  { id: 'range', label: 'დინამიკა' },
]

describe('CanvasToolbar — in-canvas perspective switch (BE-3)', () => {
  it('renders one radio per declared perspective and marks the active one', () => {
    render(
      <CanvasToolbar
        mode="structural" status="structural" onModeChange={vi.fn()}
        perspectives={PERSPECTIVES} activePerspectiveId="year" onPerspectiveChange={vi.fn()}
      />,
    )
    expect(screen.getByTestId('canvas-perspective-switch')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'წლიური' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'დინამიკა' })).toHaveAttribute('aria-checked', 'false')
  })

  it('clicking a perspective reports its DECLARED id', () => {
    const onChange = vi.fn()
    render(
      <CanvasToolbar
        mode="structural" status="structural" onModeChange={vi.fn()}
        perspectives={PERSPECTIVES} activePerspectiveId="year" onPerspectiveChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('radio', { name: 'დინამიკა' }))
    expect(onChange).toHaveBeenCalledWith('range')
  })

  it('hides the switch when the page declares fewer than 2 perspectives', () => {
    render(
      <CanvasToolbar
        mode="structural" status="structural" onModeChange={vi.fn()}
        perspectives={[{ id: 'year', label: 'წლიური' }]}
        activePerspectiveId="year" onPerspectiveChange={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('canvas-perspective-switch')).not.toBeInTheDocument()
  })
})
