import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StudioTopBar } from './StudioTopBar'

// M1.4 fills the reserved top-bar regions (spec §2.1): a locale PREVIEW switcher
// and a brand/theme access button that summons the Style editor.
describe('StudioTopBar — locale + brand/theme regions filled (AR-49 M1.4)', () => {
  const base = {
    locale: 'en' as const,
    locales: ['ka', 'en'] as const,
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
