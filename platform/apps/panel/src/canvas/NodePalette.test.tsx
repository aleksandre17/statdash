import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NodePalette }       from './NodePalette'
import { getPaletteEntries } from './paletteEntries'
import { setupCanvasRegistry } from './setupCanvasRegistry'

// The palette reads nodeRegistry — slices must be registered first.
beforeAll(() => { setupCanvasRegistry() })

describe('NodePalette', () => {
  it('lists registered node types', () => {
    const entries = getPaletteEntries()
    expect(entries.length).toBeGreaterThan(0)
    // A known leaf/layout type must be offered.
    expect(entries.map((e) => e.type)).toContain('section')
  })

  it('excludes rootOnly page templates', () => {
    const types = getPaletteEntries().map((e) => e.type)
    // inner-page / tab-page / container-page are rootOnly → never droppable.
    expect(types).not.toContain('inner-page')
    expect(types).not.toContain('tab-page')
    expect(types).not.toContain('container-page')
  })

  it('renders one draggable item per type with a nodeType payload', () => {
    render(<NodePalette />)
    // Node tiles only — the additive Starters band (ADR-049 P2b) renders composed-PRESET
    // tiles (carrying `data-preset-id`), a distinct concern guarded by presetInsert.fitness.
    const items = screen.getAllByRole('button').filter((el) => !el.hasAttribute('data-preset-id'))
    expect(items.length).toBe(getPaletteEntries().length)
    const section = items.find((el) => el.getAttribute('data-node-type') === 'section')
    expect(section).toBeTruthy()
    expect(section).toHaveAttribute('draggable', 'true')
  })
})
