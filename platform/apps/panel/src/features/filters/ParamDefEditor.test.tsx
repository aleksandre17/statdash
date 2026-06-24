// ── ParamDefEditor — schema-driven ParamDef authoring + round-trip [V0] ────────
//
//  Proves the ADR mechanism for page-level filters: a ParamDef type's PropSchema
//  (carried in the engine param-schema registry) renders through the SAME generic
//  Inspector, and a scalar edit round-trips a ParamDef with the discriminant
//  (`type`) and `key` preserved — no bespoke per-control form, no second engine.
//
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { getParamSchema } from '@statdash/engine'
import type { ParamNode } from '@statdash/engine'
import { ParamDefEditor } from './ParamDefEditor'

describe('ParamDefEditor — schema-driven ParamDef authoring (V0)', () => {
  it('renders a ParamDef PropSchema through the generic Inspector', () => {
    const param: ParamNode = { type: 'hidden', key: 'mode', default: '' }
    render(<ParamDefEditor param={param} onChange={() => {}} />)
    expect(screen.getByTestId('inspector')).toBeInTheDocument()
    // hidden declares a `default` field — its control has the deterministic id.
    expect(document.getElementById('insp-default')).not.toBeNull()
    expect(screen.queryByText(/No property schema/i)).toBeNull()
  })

  it('round-trips a scalar edit and preserves the type discriminant + key', () => {
    const onChange = vi.fn<(next: ParamNode) => void>()
    const param: ParamNode = { type: 'hidden', key: 'mode', default: '' }
    render(<ParamDefEditor param={param} onChange={onChange} />)

    const input = document.getElementById('insp-default') as HTMLElement
    fireEvent.change(input, { target: { value: 'range' } })

    expect(onChange).toHaveBeenCalled()
    const next = onChange.mock.calls.at(-1)![0]
    expect(next).toMatchObject({ type: 'hidden', key: 'mode', default: 'range' })
    // Discriminant + key are immutable through the editor (no schema field targets them).
    expect(next.type).toBe('hidden')
    expect(next.key).toBe('mode')
  })

  it('renders the cube-bound dimension picker for a select control (no dead panel)', () => {
    // select carries an enum-ref `key` (cube.dimensions) → EnumRefField, a <select>.
    const param: ParamNode = {
      type: 'select', key: 'region', options: { type: 'static', items: [] }, default: '',
    }
    render(<ParamDefEditor param={param} onChange={() => {}} />)
    expect(screen.getByTestId('inspector')).toBeInTheDocument()
    // The `key` enum-ref control is a <select> (cube-profile-bound; empty when no
    // dataset is bound — fail-soft, never crashes).
    const keySelect = document.getElementById('insp-key') as HTMLSelectElement | null
    expect(keySelect).not.toBeNull()
    expect(keySelect!.tagName).toBe('SELECT')
  })

  it('every ParamDef type renders a populated Inspector (schema-driven path wired for all)', () => {
    const PARAMS: ParamNode[] = [
      { type: 'hidden', key: 'h', default: '' },
      { type: 'year-select', key: 'y', default: '' },
      { type: 'cascade', key: 'c', label: '', tree: [], default: '' },
      { type: 'select', key: 's', options: { type: 'static', items: [] }, default: '' },
      { type: 'range', key: 'r', label: '', default: '' },
      { type: 'multi-select', key: 'm', label: '', options: { type: 'static', items: [] }, default: '' },
      { type: 'chip-select', key: 'cs', options: { type: 'static', items: [] }, default: '' },
    ]
    for (const param of PARAMS) {
      expect(getParamSchema(param.type), `${param.type} should carry a schema`).toBeTruthy()
      const { unmount } = render(<ParamDefEditor param={param} onChange={() => {}} />)
      expect(screen.getByTestId('inspector')).toBeInTheDocument()
      expect(screen.queryByText(/No property schema/i)).toBeNull()
      unmount()
    }
  })
})
