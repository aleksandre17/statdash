// ── TransformStepEditor — the GENERIC ROLE PROJECTION (card 0087) ──────────────
//
//  Proves the P-OFFER mechanism: an op's PropSchema (carried in the engine
//  step-registry) renders through the ONE role-projecting editor — field → column
//  pick, expr → autocomplete + live preview, literal → typed input, aggregations →
//  a structured list — with NO bespoke per-op form and NO raw JSON staring back. A
//  scalar edit round-trips the TransformStep with the discriminant (`op`) preserved.
//
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { TransformStep, EngineRow } from '@statdash/engine'
import { getTransformStepSchema } from '@statdash/engine'
import { TransformStepEditor } from './TransformStepEditor'
import { buildStepInputOffer } from '../../../pipeline-preview/stepInput'

// A tiny offer over sample rows — the agnostic substrate (columns + members + sample).
const SAMPLE: EngineRow[] = [
  { geo: 'GE', year: 2020, value: 10 },
  { geo: 'AB', year: 2021, value: 20 },
]
const offer = buildStepInputOffer({
  rows: SAMPLE,
  columnLabel: (f) => f,
  cellLabel: (_f, v) => String(v),
  locale: 'en',
})

describe('TransformStepEditor — role-projected transform-op authoring', () => {
  it('projects a schema through the role editor (never the raw Inspector)', () => {
    const step: TransformStep = { op: 'template', as: '', tpl: '' }
    render(<TransformStepEditor step={step} onChange={() => {}} input={offer} />)
    expect(screen.getByTestId('transform-step-editor')).toBeInTheDocument()
    // No raw-JSON dead panel for a schema-carrying op.
    expect(screen.queryByText(/property schema/i)).toBeNull()
  })

  it('a newName field round-trips a scalar edit and preserves the op discriminant', () => {
    const onChange = vi.fn<(next: TransformStep) => void>()
    const step: TransformStep = { op: 'template', as: '', tpl: '' }
    render(<TransformStepEditor step={step} onChange={onChange} input={offer} />)
    const input = document.getElementById('step-as') as HTMLElement
    fireEvent.change(input, { target: { value: 'label_col' } })
    expect(onChange).toHaveBeenCalled()
    const next = onChange.mock.calls.at(-1)![0]
    expect(next).toMatchObject({ op: 'template', as: 'label_col' })
    expect(next.op).toBe('template')
  })

  it('an expr field offers the input columns as scope + a live per-row preview', () => {
    const step: TransformStep = { op: 'derive', as: 'doubled', expr: 'value * 2' }
    render(<TransformStepEditor step={step} onChange={() => {}} input={offer} />)
    // The expr editor is a combobox (ExprAutocompleteInput).
    const expr = document.getElementById('step-expr') as HTMLElement
    expect(expr.getAttribute('role')).toBe('combobox')
    // Live preview shows the computed values (10*2=20, 20*2=40) through the ONE evaluator.
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('40')).toBeInTheDocument()
  })

  it('a field-role column pick offers the input columns (agnostic — from the rows)', () => {
    const onChange = vi.fn<(next: TransformStep) => void>()
    const step: TransformStep = { op: 'reduce', fn: 'sum', field: '' }
    render(<TransformStepEditor step={step} onChange={onChange} input={offer} />)
    // The `field` (measure column) is a Select over the offered columns — geo/year/value.
    const select = document.getElementById('step-field') as HTMLElement
    expect(select).not.toBeNull()
    const combobox = within(select.closest('.MuiFormControl-root') as HTMLElement).getByRole('combobox')
    fireEvent.mouseDown(combobox)
    const listbox = screen.getByRole('listbox')
    expect(within(listbox).getByText('value')).toBeInTheDocument()
    expect(within(listbox).getByText('geo')).toBeInTheDocument()
  })

  it('aggregate renders a structured aggregations list (add appends an authorable item)', () => {
    const onChange = vi.fn<(next: TransformStep) => void>()
    const step: TransformStep = { op: 'aggregate', groupBy: ['geo'], aggregations: [] }
    render(<TransformStepEditor step={step} onChange={onChange} input={offer} />)
    // groupBy is a column checklist over the offered columns — geo appears as a checkbox.
    const groups = screen.getAllByRole('group')
    const groupByGroup = groups.find((g) => within(g).queryByText('geo'))
    expect(groupByGroup).toBeTruthy()
    // Add an aggregation (the ONE add button — the aggregations list; groupBy is checkboxes).
    const addButtons = screen.getAllByRole('button')
    fireEvent.click(addButtons[addButtons.length - 1])
    const next = onChange.mock.calls.at(-1)![0] as unknown as { aggregations: unknown[] }
    expect(next.aggregations.length).toBe(1)
  })

  it('every schema-carrying op renders without a dead panel', () => {
    const SCHEMA_OPS: TransformStep[] = [
      { op: 'melt', idFields: [], valueFields: [] },
      { op: 'rename', fields: {} },
      { op: 'cast', fields: {} },
      { op: 'concat', fields: [], as: '' },
      { op: 'addField', name: '', value: '' },
      { op: 'select', fields: [] },
      { op: 'aggregate', groupBy: [], aggregations: [] },
      { op: 'rollup', dim: '', as: '', of: [], agg: 'sum' },
      { op: 'group', by: [] },
      { op: 'reduce', fn: 'sum', field: '' },
      { op: 'window', fn: 'movingAvg', over: '' },
      { op: 'join', with: { $cl: '' }, on: '' },
      { op: 'derive', as: '', expr: '' },
    ]
    for (const step of SCHEMA_OPS) {
      expect(getTransformStepSchema(step.op), `${step.op} should carry a schema`).toBeTruthy()
      const { unmount } = render(<TransformStepEditor step={step} onChange={() => {}} input={offer} />)
      expect(screen.getByTestId('transform-step-editor')).toBeInTheDocument()
      unmount()
    }
  })
})
