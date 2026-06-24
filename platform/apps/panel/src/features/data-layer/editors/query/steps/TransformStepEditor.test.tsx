// ── TransformStepEditor — schema-driven op authoring + round-trip [V1] ─────────
//
//  Proves the ADR's mechanism: an op's PropSchema (carried in the engine
//  step-registry) renders through the SAME generic Inspector, and a scalar edit
//  round-trips a TransformStep with the discriminant (`op`) preserved — no
//  bespoke per-op form, no second form engine.
//
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { getTransformStepSchema } from '@statdash/engine'
import type { TransformStep } from '@statdash/engine'
import { TransformStepEditor } from './TransformStepEditor'

describe('TransformStepEditor — schema-driven transform-op authoring', () => {
  it('renders an op PropSchema through the Inspector (a previously JSON-only op)', () => {
    // `template` had NO bespoke form before V1 — it now carries a PropSchema and
    // is authored by the generic Inspector. Its schema declares `as` and `tpl`.
    // The Inspector resolves labels in the store's default locale (ka).
    const step: TransformStep = { op: 'template', as: '', tpl: '' }
    render(<TransformStepEditor step={step} onChange={() => {}} />)
    expect(screen.getByTestId('inspector')).toBeInTheDocument()
    // Both schema field labels render (ka). Each field has a control with a
    // deterministic id (`insp-<field>`), proving the schema drove the panel.
    expect(screen.getByText('გამოსავალი ველი')).toBeInTheDocument() // `as` label
    expect(screen.getByText('შაბლონი ({field})')).toBeInTheDocument() // `tpl` label
    expect(document.getElementById('insp-as')).not.toBeNull()
    expect(document.getElementById('insp-tpl')).not.toBeNull()
  })

  it('round-trips a scalar edit and preserves the op discriminant', () => {
    const onChange = vi.fn<(next: TransformStep) => void>()
    const step: TransformStep = { op: 'template', as: '', tpl: '' }
    render(<TransformStepEditor step={step} onChange={onChange} />)

    // Edit the `tpl` field (a plain string control), addressed by its stable id.
    const input = document.getElementById('insp-tpl') as HTMLElement
    fireEvent.change(input, { target: { value: '{label} ({measure})' } })

    expect(onChange).toHaveBeenCalled()
    const next = onChange.mock.calls.at(-1)![0]
    expect(next).toMatchObject({ op: 'template', tpl: '{label} ({measure})' })
    // The discriminant is immutable through the editor (no schema field targets `op`).
    expect(next.op).toBe('template')
  })

  it('every authorable op (schema-carrying) renders without falling back to a dead panel', () => {
    // Fitness-style: each op that carries a schema must produce a populated
    // Inspector (the schema-driven path is wired for ALL of them, not just one).
    const SCHEMA_OPS: TransformStep[] = [
      { op: 'melt', idFields: [], valueFields: [] },
      { op: 'rename', fields: {} },
      { op: 'cast', fields: {} },
      { op: 'concat', fields: [], as: '' },
      { op: 'addField', name: '', value: '' },
      { op: 'select', fields: [] },
      { op: 'aggregate', groupBy: [], aggregations: [] },
      { op: 'rollup', dim: '', as: '', of: '*', agg: 'sum' },
      { op: 'group', by: [] },
      { op: 'reduce', fn: 'sum', field: '' },
      { op: 'window', fn: 'movingAvg', over: '' },
      { op: 'join', with: { $cl: '' }, on: '' },
    ]
    for (const step of SCHEMA_OPS) {
      expect(getTransformStepSchema(step.op), `${step.op} should carry a schema`).toBeTruthy()
      const { unmount } = render(<TransformStepEditor step={step} onChange={() => {}} />)
      expect(screen.getByTestId('inspector')).toBeInTheDocument()
      // No "no property schema" dead-panel invitation for a schema-carrying op.
      expect(screen.queryByText(/No property schema/i)).toBeNull()
      unmount()
    }
  })
})
