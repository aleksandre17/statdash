import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StyleSurface } from './StyleSurface'
import { useConstructorStore } from '../../store/constructor.store'

// The writable brand editor: it writes SiteDef.themeOverrides through the EXISTING
// updateSite action (byte-identical to hand-authoring the map), and reset removes
// the override. StudioShell applies that map live — proven here at the data layer.
beforeEach(() => {
  useConstructorStore.getState().updateSite({ themeOverrides: {} })
})

describe('StyleSurface — writable themeOverrides editor (AR-49 M1.4)', () => {
  it('editing a brand token writes SiteDef.themeOverrides (round-trip via updateSite)', () => {
    render(<StyleSurface locale="en" />)
    fireEvent.change(screen.getByLabelText('Card Radius'), { target: { value: '11px' } })
    expect(useConstructorStore.getState().site.themeOverrides['radii.card']).toBe('11px')
  })

  it('the write is data only — the override map is a plain tokenKey→value record', () => {
    render(<StyleSurface locale="en" />)
    fireEvent.change(screen.getByLabelText('Accent'), { target: { value: '#0055aa' } })
    const overrides = useConstructorStore.getState().site.themeOverrides
    expect(overrides['color.accent']).toBe('#0055aa')
    // No function / code path leaked into config (Law 2).
    for (const v of Object.values(overrides)) expect(typeof v).toBe('string')
  })

  it('reset-to-default removes the override for that token', () => {
    useConstructorStore.getState().updateSite({ themeOverrides: { 'radii.card': '9px' } })
    render(<StyleSurface locale="en" />)
    const reset = screen.getByLabelText('Reset Card Radius')
    expect(reset).toBeEnabled()
    fireEvent.click(reset)
    expect('radii.card' in useConstructorStore.getState().site.themeOverrides).toBe(false)
  })
})
