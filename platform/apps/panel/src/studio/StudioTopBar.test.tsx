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
    onOpenDataModel: vi.fn(),
    onExitDataModel: vi.fn(),
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

// ── Workspace switch — Compose ⇄ Data model (AR-49 defect fix) ─────────────────
//
//  The segmented switch is the single discoverable affordance that enters/exits the
//  Data-model workspace. It names the DESTINATION ("Data model"), not the internal
//  "role lens": choosing "Data model" is ONE intentful action that both flips the
//  Steward lens and lands the user in metric authoring (StudioShell composes
//  onOpenDataModel). Both segments are keyboard-reachable native <button aria-pressed>
//  so state reads for keyboard + AT users (WCAG 2.1 AA · 4.1.2).
describe('StudioTopBar — workspace switch (AR-49 defect fix)', () => {
  const base = {
    locale: 'en' as const,
    locales: ['ka', 'en'] as const,
    role: 'author' as const,
    onOpenDataModel: vi.fn(),
    onExitDataModel: vi.fn(),
    onLocaleChange: vi.fn(),
    onOpenCommand: vi.fn(),
    onOpenStyle: vi.fn(),
  }

  it('offers keyboard-reachable Compose + Data model segments (native buttons)', () => {
    render(<StudioTopBar {...base} />)
    const compose = screen.getByRole('button', { name: 'Compose' })
    const model   = screen.getByRole('button', { name: 'Data model' })
    expect(compose.tagName).toBe('BUTTON')
    expect(model.tagName).toBe('BUTTON')
  })

  it('choosing "Data model" from the author lens fires onOpenDataModel (the one-action jump)', () => {
    const onOpenDataModel = vi.fn()
    render(<StudioTopBar {...base} role="author" onOpenDataModel={onOpenDataModel} />)
    fireEvent.click(screen.getByRole('button', { name: 'Data model' }))
    expect(onOpenDataModel).toHaveBeenCalledTimes(1)
  })

  it('choosing "Compose" from the steward lens fires onExitDataModel', () => {
    const onExitDataModel = vi.fn()
    render(<StudioTopBar {...base} role="steward" onExitDataModel={onExitDataModel} />)
    fireEvent.click(screen.getByRole('button', { name: 'Compose' }))
    expect(onExitDataModel).toHaveBeenCalledTimes(1)
  })

  it('reflects the active workspace via aria-pressed (author → Compose, steward → Data model)', () => {
    const { rerender } = render(<StudioTopBar {...base} role="author" />)
    expect(screen.getByRole('button', { name: 'Compose' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Data model' })).toHaveAttribute('aria-pressed', 'false')
    rerender(<StudioTopBar {...base} role="steward" />)
    expect(screen.getByRole('button', { name: 'Compose' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Data model' })).toHaveAttribute('aria-pressed', 'true')
  })
})
