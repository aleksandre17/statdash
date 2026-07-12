import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StudioTopBar } from './StudioTopBar'

// M1.4 fills the reserved top-bar regions (spec §2.1): a locale PREVIEW switcher
// and a brand/theme access button that summons the Style editor.
describe('StudioTopBar — locale + brand/theme regions filled (AR-49 M1.4)', () => {
  const base = {
    locale: 'en' as const,
    locales: ['ka', 'en'] as const,
    dataModelActive: false,
    onOpenDataModel: vi.fn(),
    onExitDataModel: vi.fn(),
    onLocaleChange: vi.fn(),
    onOpenCommand: vi.fn(),
    onOpenStyle: vi.fn(),
    onOpenSite: vi.fn(),
  }

  it('renders the locale preview switcher and changes locale on click', () => {
    const onLocaleChange = vi.fn()
    render(<StudioTopBar {...base} onLocaleChange={onLocaleChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'ka' }))
    expect(onLocaleChange).toHaveBeenCalledWith('ka')
  })

  it('renders the brand/theme access button and opens the Theme workspace', () => {
    const onOpenStyle = vi.fn()
    render(<StudioTopBar {...base} onOpenStyle={onOpenStyle} />)
    fireEvent.click(screen.getByRole('button', { name: 'Brand & theme' }))
    expect(onOpenStyle).toHaveBeenCalled()
  })

  it('renders the Pages & Site access button and summons the Site workspace (SPEC S5)', () => {
    const onOpenSite = vi.fn()
    render(<StudioTopBar {...base} onOpenSite={onOpenSite} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pages & Site' }))
    expect(onOpenSite).toHaveBeenCalled()
  })
})

// ── Workspace switch — Compose ⇄ Data model (AR-50 M5b: pure navigation) ───────
//
//  The segmented switch is a discoverable NAVIGATION affordance to the Data-model
//  destination. It names the DESTINATION ("Data model") and reflects which screen is
//  active — NOT the role lens. Choosing "Data model" navigates to the destination
//  WITHOUT escalating the lens (StudioShell composes onOpenDataModel as pure
//  navigation); the destination's body is then role-appropriate. Both segments are
//  keyboard-reachable native <button aria-pressed> (WCAG 2.1 AA · 4.1.2).
describe('StudioTopBar — workspace navigation switch (AR-50 M5b)', () => {
  const base = {
    locale: 'en' as const,
    locales: ['ka', 'en'] as const,
    dataModelActive: false,
    onOpenDataModel: vi.fn(),
    onExitDataModel: vi.fn(),
    onLocaleChange: vi.fn(),
    onOpenCommand: vi.fn(),
    onOpenStyle: vi.fn(),
    onOpenSite: vi.fn(),
  }

  it('offers keyboard-reachable Compose + Data model segments (native buttons)', () => {
    render(<StudioTopBar {...base} />)
    const compose = screen.getByRole('button', { name: 'Compose' })
    const model   = screen.getByRole('button', { name: 'Data model' })
    expect(compose.tagName).toBe('BUTTON')
    expect(model.tagName).toBe('BUTTON')
  })

  it('choosing "Data model" fires onOpenDataModel (navigate to the destination)', () => {
    const onOpenDataModel = vi.fn()
    render(<StudioTopBar {...base} onOpenDataModel={onOpenDataModel} />)
    fireEvent.click(screen.getByRole('button', { name: 'Data model' }))
    expect(onOpenDataModel).toHaveBeenCalledTimes(1)
  })

  it('choosing "Compose" while the data model is active fires onExitDataModel', () => {
    const onExitDataModel = vi.fn()
    render(<StudioTopBar {...base} dataModelActive onExitDataModel={onExitDataModel} />)
    fireEvent.click(screen.getByRole('button', { name: 'Compose' }))
    expect(onExitDataModel).toHaveBeenCalledTimes(1)
  })

  it('reflects the active SCREEN via aria-pressed (compose vs data-model), not the role', () => {
    const { rerender } = render(<StudioTopBar {...base} dataModelActive={false} />)
    expect(screen.getByRole('button', { name: 'Compose' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Data model' })).toHaveAttribute('aria-pressed', 'false')
    rerender(<StudioTopBar {...base} dataModelActive={true} />)
    expect(screen.getByRole('button', { name: 'Compose' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Data model' })).toHaveAttribute('aria-pressed', 'true')
  })
})
