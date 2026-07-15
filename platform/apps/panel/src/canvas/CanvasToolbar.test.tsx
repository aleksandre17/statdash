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
import { CanvasToolbar, type CanvasToolbarProps } from './CanvasToolbar'

// Default props — the two toggles are both required; tests override what they assert.
const props = (over: Partial<CanvasToolbarProps> = {}): CanvasToolbarProps => ({
  mode: 'live', status: 'live', onModeChange: vi.fn(),
  themePreview: 'light', onThemePreviewChange: vi.fn(),
  ...over,
})

describe('CanvasToolbar — preview-mode toggle (C2)', () => {
  it('renders a live|structural radiogroup and marks the active mode', () => {
    render(<CanvasToolbar {...props()} />)
    const group = screen.getByRole('radiogroup', { name: 'გადახედვის რეჟიმი' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'ცოცხალი მონაცემები' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'სტრუქტურა' })).toHaveAttribute('aria-checked', 'false')
  })

  it('clicking a mode reports it', () => {
    const onModeChange = vi.fn()
    render(<CanvasToolbar {...props({ onModeChange })} />)
    fireEvent.click(screen.getByRole('radio', { name: 'სტრუქტურა' }))
    expect(onModeChange).toHaveBeenCalledWith('structural')
  })

  it('shows the fail-soft badge ONLY when live is unavailable', () => {
    const { rerender } = render(<CanvasToolbar {...props()} />)
    expect(screen.queryByTestId('canvas-live-unavailable')).not.toBeInTheDocument()

    rerender(<CanvasToolbar {...props({ status: 'unavailable' })} />)
    expect(screen.getByTestId('canvas-live-unavailable')).toBeInTheDocument()
  })

  it('carries NO perspective switch — the page perspective-bar node is the one control (G9)', () => {
    render(<CanvasToolbar {...props()} />)
    expect(screen.queryByTestId('canvas-perspective-switch')).not.toBeInTheDocument()
    // Two radiogroups now: the preview-MODE toggle + the theme-PREVIEW toggle — and no
    // third (removed) perspective radiogroup.
    expect(screen.getAllByRole('radiogroup')).toHaveLength(2)
  })
})

describe('CanvasToolbar — dark-mode canvas preview toggle (P7)', () => {
  it('renders a light|dark radiogroup and marks the active theme', () => {
    render(<CanvasToolbar {...props({ themePreview: 'dark' })} />)
    const group = screen.getByRole('radiogroup', { name: 'გადახედვის თემა' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /მუქი/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /ნათელი/ })).toHaveAttribute('aria-checked', 'false')
  })

  it('clicking a theme reports it (and is independent of the preview-mode callback)', () => {
    const onThemePreviewChange = vi.fn()
    const onModeChange = vi.fn()
    render(<CanvasToolbar {...props({ onThemePreviewChange, onModeChange })} />)
    fireEvent.click(screen.getByRole('radio', { name: /მუქი/ }))
    expect(onThemePreviewChange).toHaveBeenCalledWith('dark')
    // The theme toggle NEVER drives the data-preview mode — the two are orthogonal.
    expect(onModeChange).not.toHaveBeenCalled()
  })
})
