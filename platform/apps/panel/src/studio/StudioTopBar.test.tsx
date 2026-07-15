import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StudioTopBar } from './StudioTopBar'

// Relay Step 1 (BLUEPRINT-panel-canonical-relay): the top bar is STRIPPED to global
// context only — wordmark + breadcrumb, the locale preview, ⌘K, the PUBLISH terminal
// (PageWorkflowBar) and logout. The scattered doors it used to carry (Compose⇄Data
// switch, "Site & chrome", "Brand & theme") are RETIRED to their ONE home on the rail
// (LAW C / FF-ONE-HOME-PER-CAPABILITY).
describe('StudioTopBar — global context + the PUBLISH terminal (relay Step 1)', () => {
  const base = {
    locale: 'en' as const,
    locales: ['ka', 'en'] as const,
    onLocaleChange: vi.fn(),
    onOpenCommand: vi.fn(),
  }

  it('shows the product wordmark (global context)', () => {
    render(<StudioTopBar {...base} />)
    expect(screen.getByText('Strata')).toBeInTheDocument()
  })

  it('renders the locale preview switcher and changes locale on click', () => {
    const onLocaleChange = vi.fn()
    render(<StudioTopBar {...base} onLocaleChange={onLocaleChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'ka' }))
    expect(onLocaleChange).toHaveBeenCalledWith('ka')
  })

  it('opens the command palette from the ⌘K button', () => {
    const onOpenCommand = vi.fn()
    render(<StudioTopBar {...base} onOpenCommand={onOpenCommand} />)
    fireEvent.click(screen.getByRole('button', { name: /⌘K/ }))
    expect(onOpenCommand).toHaveBeenCalledTimes(1)
  })

  it('carries the logout session action', () => {
    render(<StudioTopBar {...base} />)
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument()
  })

  it('RETIRES the scattered doors — they are now rail modes, not top-bar controls (LAW C)', () => {
    render(<StudioTopBar {...base} />)
    for (const name of ['Compose', 'Data model', 'Site & chrome', 'Brand & theme']) {
      expect(screen.queryByRole('button', { name })).toBeNull()
    }
    // The page-nav Select is retired too (bottom tabs are the ONE home).
    expect(screen.queryByRole('combobox', { name: 'Active page' })).toBeNull()
  })
})
