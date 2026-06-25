// ── FieldWells — the click-to-bind (keyboard/click) path writes config (V5) ───
//
//  The drag's keyboard/click EQUIVALENT (WCAG 2.1 AA): pick a chip, then click
//  the well, and the SAME pure binding write runs as a pointer drop. We exercise
//  that path here (jsdom has no real pointer drag) and assert the emitted config
//  is byte-identical to the typed editors — the same invariant binding.test.ts
//  pins on the pure functions, now proven through the rendered component.
//
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { DataSpec } from '@statdash/engine'
import type { CubeProfile } from '../../../lib/cubeApi'

// Mock the two data hooks FieldWells reads: a ready profile + a default locale.
const PROFILE: CubeProfile = {
  datasetCode: 'DS',
  dimensions: [{ code: 'SECTOR', conceptRole: null, isTime: false, members: [] }],
  measures: [{
    code: 'GDP', label: { en: 'GDP', ka: 'მშპ' },
    unit: { unit_code: null, symbol: null, label: null, unit_type: null,
            unit_mult: null, decimals: null, base_period: null, source: 'none' },
  }],
  actualRegion: { available: false, combinations: null },
}

vi.mock('../../../discovery/useActiveProfile', () => ({
  useActiveProfile: () => ({ status: 'ready', profile: PROFILE }),
}))
vi.mock('../../../store/constructor.store', () => ({
  useSite: () => ({ defaultLocale: 'en' }),
}))

import { FieldWells } from './FieldWells'

type QuerySpec = Extract<DataSpec, { type: 'query' }>

const emptyQuery: QuerySpec = { type: 'query', query: { measure: [] }, pipe: [], encoding: { label: '' } }

describe('FieldWells — pick→click binding (keyboard/click equivalent of drag)', () => {
  it('picking a measure chip then clicking the measure well binds it (byte-identical)', () => {
    const onChange = vi.fn<(next: QuerySpec) => void>()
    render(<FieldWells value={emptyQuery} onChange={onChange} />)

    // Arm the GDP measure chip (the keyboard/click "grab").
    fireEvent.click(screen.getByRole('button', { name: /GDP — მაჩვენებელი/ }))
    // Click the now-armed measure well (the "drop" equivalent).
    fireEvent.click(screen.getByRole('button', { name: /მიამაგრე არჩეული ველი: მაჩვენებელი/ }))

    expect(onChange).toHaveBeenCalled()
    const next = onChange.mock.calls.at(-1)![0]
    // Identical to what MeasureSelector emits: query.measure = ['GDP'].
    expect(next.query.measure).toEqual(['GDP'])
  })

  it('picking a dimension chip then clicking the label well binds a bare string', () => {
    const onChange = vi.fn<(next: QuerySpec) => void>()
    render(<FieldWells value={emptyQuery} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /SECTOR — განზომილება/ }))
    fireEvent.click(screen.getByRole('button', { name: /მიამაგრე არჩეული ველი: ეტიკეტი/ }))

    const next = onChange.mock.calls.at(-1)![0]
    // Identical to EncodingEditor.setLabel('SECTOR'): a bare string, not a ChannelDef.
    expect(next.encoding.label).toBe('SECTOR')
    expect(typeof next.encoding.label).toBe('string')
  })

  it('a measure chip does not arm the categorical (label) well — shelf rule (POLA)', () => {
    const onChange = vi.fn<(next: QuerySpec) => void>()
    render(<FieldWells value={emptyQuery} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /GDP — მაჩვენებელი/ }))
    // The label well must NOT become an armed button for a measure chip.
    expect(screen.queryByRole('button', { name: /მიამაგრე არჩეული ველი: ეტიკეტი/ })).toBeNull()
  })
})
