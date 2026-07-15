// ── CanvasToolbar.test — the preview-mode toggle (W1 · Canon C2) ───────────────
//
//  The toolbar is a PURE PROJECTION of (mode, status): a live|structural radiogroup
//  (live leads — it is the default reality of the canvas) plus a fail-soft badge when
//  live was requested but is unavailable. Perspective is NOT switched here anymore
//  (W1 · G9) — the page's own perspective-bar node is the faithful control; a second
//  tab-bar in this chrome duplicated it. This suite locks BOTH: the mode contract AND
//  the ABSENCE of the removed perspective switch.
//
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CanvasToolbar } from './CanvasToolbar'

describe('CanvasToolbar — preview-mode toggle (C2)', () => {
  it('renders a live|structural radiogroup and marks the active mode', () => {
    render(<CanvasToolbar mode="live" status="live" onModeChange={vi.fn()} />)
    const group = screen.getByRole('radiogroup', { name: 'გადახედვის რეჟიმი' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'ცოცხალი მონაცემები' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'სტრუქტურა' })).toHaveAttribute('aria-checked', 'false')
  })

  it('clicking a mode reports it', () => {
    const onModeChange = vi.fn()
    render(<CanvasToolbar mode="live" status="live" onModeChange={onModeChange} />)
    fireEvent.click(screen.getByRole('radio', { name: 'სტრუქტურა' }))
    expect(onModeChange).toHaveBeenCalledWith('structural')
  })

  it('shows the fail-soft badge ONLY when live is unavailable', () => {
    const { rerender } = render(<CanvasToolbar mode="live" status="live" onModeChange={vi.fn()} />)
    expect(screen.queryByTestId('canvas-live-unavailable')).not.toBeInTheDocument()

    rerender(<CanvasToolbar mode="live" status="unavailable" onModeChange={vi.fn()} />)
    expect(screen.getByTestId('canvas-live-unavailable')).toBeInTheDocument()
  })

  it('carries NO perspective switch — the page perspective-bar node is the one control (G9)', () => {
    render(<CanvasToolbar mode="live" status="live" onModeChange={vi.fn()} />)
    expect(screen.queryByTestId('canvas-perspective-switch')).not.toBeInTheDocument()
    // Exactly one radiogroup (the mode toggle) — no duplicate perspective radiogroup.
    expect(screen.getAllByRole('radiogroup')).toHaveLength(1)
  })
})
