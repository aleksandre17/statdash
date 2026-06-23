import { describe, it, expect, beforeAll, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { nodeRegistry } from '@statdash/react/engine'
import { Inspector } from './Inspector'
import { setupCanvasRegistry } from '../canvas/setupCanvasRegistry'
import type { CanvasNode } from '../types/constructor'

// The Inspector reads nodeRegistry.getSchema — slices must be registered first.
beforeAll(() => { setupCanvasRegistry() })

const node = (over: Partial<CanvasNode>): CanvasNode =>
  ({ id: 'n', type: 'hero', props: {}, childIds: [], ...over })

describe('Inspector — schema-driven rendering (C1)', () => {
  it('renders a panel for any registered type that has a schema', () => {
    render(<Inspector node={node({ type: 'hero' })} onChange={() => {}} />)
    // hero declares a `title` LocaleString field — the panel renders SOME control.
    expect(screen.getByTestId('inspector')).toBeInTheDocument()
    expect(screen.getByText('სათაური')).toBeInTheDocument() // hero title label (ka)
  })

  it('fitness: EVERY registered non-root type with a schema renders a panel', () => {
    const withSchema = nodeRegistry.list()
      .filter((e) => !e.rootOnly && e.schema && (e.schema as unknown[]).length > 0)
    expect(withSchema.length).toBeGreaterThan(0)
    for (const entry of withSchema) {
      const { unmount } = render(
        <Inspector node={node({ type: entry.type, variant: entry.variant })} onChange={() => {}} />,
      )
      expect(screen.getByTestId('inspector')).toBeInTheDocument()
      unmount()
    }
  })

  it('shows an invitation (not a dead panel) for a type without a schema', () => {
    render(<Inspector node={node({ type: 'not-a-real-type' })} onChange={() => {}} />)
    expect(screen.getByText(/No property schema/i)).toBeInTheDocument()
  })

  it('renders a LocaleField with one input per active locale for LocaleString fields', () => {
    render(<Inspector node={node({ type: 'hero' })} onChange={() => {}} />)
    // hero.title is a LocaleString → one badge per active locale (ka, en).
    const groups = screen.getAllByRole('group', { name: /title \(localized\)/i })
    expect(groups.length).toBeGreaterThan(0)
    // Two locale inputs inside the title group.
    const inputs = groups[0].querySelectorAll('input[type="text"]')
    expect(inputs.length).toBe(2)
  })

  it('emits a COMPLETE LocaleString on edit (write-through, all locales present)', () => {
    const onChange = vi.fn()
    render(<Inspector node={node({ type: 'hero' })} onChange={onChange} />)
    const group  = screen.getAllByRole('group', { name: /title \(localized\)/i })[0]
    const inputs = group.querySelectorAll('input[type="text"]')
    fireEvent.change(inputs[0], { target: { value: 'GDP' } })
    expect(onChange).toHaveBeenCalledWith('title', expect.objectContaining({ ka: expect.any(String), en: expect.any(String) }))
  })
})
