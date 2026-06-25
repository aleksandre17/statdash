// ── TransformEditor / PivotEditor — structured DataSpec authoring + round-trip [V2]
//
//  Proves the ADR V2 reuse mechanism:
//    • TransformEditor authors {source, steps, encoding} by REUSING the EXISTING
//      PipelineBuilder (steps) and EncodingEditor (encoding) — no rebuilt pipeline
//      surface — plus a JSON `source` leaf; the spec round-trips losslessly.
//    • PivotEditor authors pivot's own friendly shape (rows/keyField/valueFields/
//      colors); pivot stays authorable (it desugars to transform+melt in the engine).
//
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { DataSpec } from '@statdash/engine'
import { TransformEditor } from './TransformEditor'
import { PivotEditor } from './PivotEditor'

type TransformSpec = Extract<DataSpec, { type: 'transform' }>
type PivotSpec     = Extract<DataSpec, { type: 'pivot' }>

describe('TransformEditor — {source, steps, encoding} reuse (V2)', () => {
  it('reuses the PipelineBuilder: adding a step round-trips into transform.steps', () => {
    const onChange = vi.fn<(next: TransformSpec) => void>()
    const value: TransformSpec = {
      type: 'transform', source: [{ label: 'A', v: 1 }], steps: [], encoding: { label: 'label' },
    }
    render(<TransformEditor value={value} onChange={onChange} />)

    // The PipelineBuilder's "add step" button (default op = derive) appends a step.
    fireEvent.click(screen.getByRole('button', { name: /ნაბიჯის დამატება/ }))

    expect(onChange).toHaveBeenCalled()
    const next = onChange.mock.calls.at(-1)![0]
    expect(next.type).toBe('transform')
    expect(next.steps.length).toBe(1)
    // The literal source + encoding slices are preserved untouched (lossless).
    expect(next.source).toEqual([{ label: 'A', v: 1 }])
    expect(next.encoding).toEqual({ label: 'label' })
  })

  it('reuses the EncodingEditor: editing a channel round-trips into transform.encoding', () => {
    const onChange = vi.fn<(next: TransformSpec) => void>()
    const value: TransformSpec = {
      type: 'transform', source: [], steps: [], encoding: { label: '' },
    }
    render(<TransformEditor value={value} onChange={onChange} />)

    // EncodingEditor's `value` channel is a text input placeholder="value".
    const valueChannel = screen.getByPlaceholderText('value') as HTMLInputElement
    fireEvent.change(valueChannel, { target: { value: 'amount' } })

    const next = onChange.mock.calls.at(-1)![0]
    expect(next.encoding).toMatchObject({ value: 'amount' })
  })

  it('authors the literal source via the JSON leaf (round-trips parsed rows)', () => {
    const onChange = vi.fn<(next: TransformSpec) => void>()
    const value: TransformSpec = {
      type: 'transform', source: [], steps: [], encoding: { label: 'label' },
    }
    render(<TransformEditor value={value} onChange={onChange} />)

    // The source textarea (the literal-data escape hatch) — type valid JSON rows.
    const textarea = screen.getByText(/Record<string, DimVal>\[\]/)
      .closest('.MuiBox-root')!
      .querySelector('textarea') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '[{"k":"x","v":2}]' } })

    const next = onChange.mock.calls.at(-1)![0]
    expect(next.source).toEqual([{ k: 'x', v: 2 }])
  })
})

describe('PivotEditor — friendly pivot authoring (V2)', () => {
  it('edits keyField → round-trips, preserving rows/valueFields', () => {
    const onChange = vi.fn<(next: PivotSpec) => void>()
    const value: PivotSpec = {
      type: 'pivot', rows: [{ label: 'X', '2022': 1 }], keyField: 'label', valueFields: ['2022'],
    }
    render(<PivotEditor value={value} onChange={onChange} />)

    const keyInput = screen.getByLabelText(/keyField/) as HTMLInputElement
    fireEvent.change(keyInput, { target: { value: 'series' } })

    const next = onChange.mock.calls.at(-1)![0]
    expect(next).toMatchObject({
      type: 'pivot', keyField: 'series', valueFields: ['2022'],
    })
    expect(next.rows).toEqual([{ label: 'X', '2022': 1 }])
  })

  it('clears colors to {} → omits the colors key from the emitted spec', () => {
    const onChange = vi.fn<(next: PivotSpec) => void>()
    const value: PivotSpec = {
      type: 'pivot', rows: [], keyField: 'label', valueFields: [], colors: { a: '#f00' },
    }
    render(<PivotEditor value={value} onChange={onChange} />)

    const colorsArea = screen.getByText(/Record<series, color>/)
      .closest('.MuiBox-root')!
      .querySelector('textarea') as HTMLTextAreaElement
    fireEvent.change(colorsArea, { target: { value: '{}' } })

    const next = onChange.mock.calls.at(-1)![0]
    expect('colors' in next).toBe(false)
  })
})
