import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StudioTopBar } from './StudioTopBar'

// M1.4 fills the reserved top-bar regions (spec §2.1): a locale PREVIEW switcher
// and a brand/theme access button that summons the Style editor.
describe('StudioTopBar — locale + brand/theme regions filled (AR-49 M1.4)', () => {
  const base = {
    locale: 'en' as const,
    locales: ['ka', 'en'] as const,
    role: 'author' as const,
    onToggleRole: vi.fn(),
    onLocaleChange: vi.fn(),
    onOpenCommand: vi.fn(),
    onOpenStyle: vi.fn(),
  }

  it('renders the locale preview switcher and changes locale on click', () => {
    const onLocaleChange = vi.fn()
    render(<StudioTopBar {...base} onLocaleChange={onLocaleChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'ka' }))
    expect(onLocaleChange).toHaveBeenCalledWith('ka')
  })

  it('renders the brand/theme access button and opens the Style surface', () => {
    const onOpenStyle = vi.fn()
    render(<StudioTopBar {...base} onOpenStyle={onOpenStyle} />)
    fireEvent.click(screen.getByRole('button', { name: 'Brand & theme' }))
    expect(onOpenStyle).toHaveBeenCalled()
  })
})

// ── Role lens toggle — "Model mode" (AR-49 M2.0) ──────────────────────────────
//
//  The toggle is the affordance that enters/exits the Steward lens. It must be a
//  keyboard-reachable native button with a stable accessible name and toggle
//  semantics (aria-pressed), so it works for keyboard + AT users (WCAG 2.1 AA).
describe('StudioTopBar — role lens toggle (AR-49 M2.0)', () => {
  const base = {
    locale: 'en' as const,
    locales: ['ka', 'en'] as const,
    role: 'author' as const,
    onToggleRole: vi.fn(),
    onLocaleChange: vi.fn(),
    onOpenCommand: vi.fn(),
    onOpenStyle: vi.fn(),
  }

  it('renders a keyboard-reachable Model-mode toggle and fires onToggleRole on click', () => {
    const onToggleRole = vi.fn()
    render(<StudioTopBar {...base} onToggleRole={onToggleRole} />)
    const toggle = screen.getByRole('button', { name: 'Model mode' })
    // Native <button> — keyboard-operable by construction (WCAG 4.1.2).
    expect(toggle.tagName).toBe('BUTTON')
    fireEvent.click(toggle)
    expect(onToggleRole).toHaveBeenCalledTimes(1)
  })

  it('reflects the lens state via aria-pressed (author → false, steward → true)', () => {
    const { rerender } = render(<StudioTopBar {...base} role="author" />)
    expect(screen.getByRole('button', { name: 'Model mode' })).toHaveAttribute('aria-pressed', 'false')
    rerender(<StudioTopBar {...base} role="steward" />)
    expect(screen.getByRole('button', { name: 'Model mode' })).toHaveAttribute('aria-pressed', 'true')
  })
})
