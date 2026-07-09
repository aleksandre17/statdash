import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TokenCatalogViewer } from './TokenCatalogViewer'

// The reusable, catalog-driven grouping/editor (the M1.3a observation-(a) fix —
// one component, no hand-rolled grouping). Scoped here to the `radii` group to
// keep the DOM small and the assertions stable.
describe('TokenCatalogViewer — self-describing token groups + editing', () => {
  it('renders a group heading and a labelled control per token', () => {
    render(
      <TokenCatalogViewer
        locale="en" value={{}} groups={['radii']}
        onChange={vi.fn()} onReset={vi.fn()}
      />,
    )
    expect(screen.getByText('Radii')).toBeInTheDocument()
    // The bilingual catalog label becomes the input's accessible name.
    expect(screen.getByLabelText('Card Radius')).toBeInTheDocument()
  })

  it('editing a token calls onChange(tokenKey, value) — round-trips the key', () => {
    const onChange = vi.fn()
    render(
      <TokenCatalogViewer
        locale="en" value={{}} groups={['radii']}
        onChange={onChange} onReset={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText('Card Radius'), { target: { value: '12px' } })
    expect(onChange).toHaveBeenCalledWith('radii.card', '12px')
  })

  it('reset is disabled with no override, enabled + fires onReset when overridden', () => {
    const onReset = vi.fn()
    const { rerender } = render(
      <TokenCatalogViewer
        locale="en" value={{}} groups={['radii']}
        onChange={vi.fn()} onReset={onReset}
      />,
    )
    expect(screen.getByLabelText('Reset Card Radius')).toBeDisabled()

    rerender(
      <TokenCatalogViewer
        locale="en" value={{ 'radii.card': '10px' }} groups={['radii']}
        onChange={vi.fn()} onReset={onReset}
      />,
    )
    const reset = screen.getByLabelText('Reset Card Radius')
    expect(reset).toBeEnabled()
    fireEvent.click(reset)
    expect(onReset).toHaveBeenCalledWith('radii.card')
  })

  it('a colour token renders a native colour swatch (per-type control)', () => {
    render(
      <TokenCatalogViewer
        locale="en" value={{}} groups={['color']}
        onChange={vi.fn()} onReset={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Accent colour')).toBeInTheDocument()
  })
})
