// ── FF-EDITOR-CAPABILITY-PARITY — no spec-editing capability is silently lost ──────────
//
//  The trust-recovery gate (ADR-051 DU4). ADR-051 DU3 collapsed the two DataSpec editors into
//  ONE surface (the workbench), and Step A widened the fold gate — TOGETHER they silently
//  stripped editing power: whole kinds (timeseries/growth/pivot/transform) were diverted into
//  a READ-ONLY/LOSSY three-pane view, bypassing their intact dedicated editors; the type
//  picker, the query Advanced (encoding/measure/filter/wells), the raw JSON, and the single↔
//  multi growth toggle all became unreachable. "Gate-green" hid it because no test ENUMERATED
//  each capability against the survivor.
//
//  This gate does exactly that: it renders the SOLE surviving surface (`DataWorkbench`) with a
//  representative spec per capability and asserts the capability is REACHABLE — so a future
//  refactor that silently drops any of them REDS the build here. It is the concrete form of
//  the DoD "no capability lost".
//
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react'
import type { DataSpec, MetricDef } from '@statdash/engine'
import { DataWorkbench } from './workbench/DataWorkbench'
import { SpecTypePicker } from './workbench/WorkbenchAdvanced'
import { registerSpecEditors } from './registerSpecEditors'
import { useMetricCatalogStore } from '../../discovery/metricCatalog.store'
import { useRoleStore } from '../../studio/useRole'

// The live per-step grid + the metric palette are mocked deterministic (their own states are
// tested elsewhere) — this gate asserts the COMPOSITION/REACHABILITY, not their innards.
vi.mock('./pipeline-preview/PipelineStepGrid', () => ({
  PipelineStepGridView: () => <div data-testid="mock-step-grid">grid</div>,
  PipelineStepGrid:     () => <div data-testid="mock-step-grid">grid</div>,
}))
vi.mock('../../discovery/MetricPalette', () => ({
  MetricPalette: () => <button data-testid="mock-metric-palette">pick</button>,
}))
vi.mock('../../inspector/useActiveLocales', () => ({ useActiveLocales: () => ['ka', 'en'] }))

// Populate the rich-editor registry the way boot does — so SpecBody dispatches to the REAL
// dedicated editors (Timeseries/Growth/Pivot/Transform/Query), never a bare JSON fallback.
registerSpecEditors()

const metrics: Record<string, MetricDef> = { 'B1G': { label: { en: 'GDP', ka: 'მშპ' } } as never }
const dimensions = { geo: { code: 'geo', label: { en: 'Region', ka: 'რეგიონი' } } } as never

beforeEach(() => {
  useMetricCatalogStore.setState({ catalog: { status: 'ready', metrics, dimensions } })
  useRoleStore.setState({ role: 'steward' })
})
afterEach(() => {
  cleanup()
  useMetricCatalogStore.setState({ catalog: { status: 'idle' } })
})

describe('FF-EDITOR-CAPABILITY-PARITY — every restored spec-editing capability is reachable', () => {
  // ── R2 · timeseries opens its dedicated editor with EDITABLE code + years ──────────
  it('timeseries → editable `code` + `years` (TimeseriesEditor), NOT a lowered read-only head', () => {
    const onChange = vi.fn()
    render(<DataWorkbench value={{ type: 'timeseries', code: 'GDP', years: 'all' }} onChange={onChange} />)
    // It routes to the fallback lane's dedicated editor, NOT the read-only three panes.
    expect(screen.getByTestId('workbench-fallback-lane')).toBeInTheDocument()
    expect(screen.queryByTestId('workbench-rail')).toBeNull()
    // `code` is a live, editable TextField (the value-cell head made this read-only).
    const code = screen.getByDisplayValue('GDP')
    fireEvent.change(code, { target: { value: 'B1G' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'timeseries', code: 'B1G' }))
    // `years` is present (YearsField).
    expect(screen.getByText(/წლები/)).toBeInTheDocument()
  })

  // ── R2 + R5 · growth opens editable code + years AND the single↔multi toggle ───────
  it('growth → editable `code` + `years` AND a reachable single↔multi toggle (GrowthEditor)', () => {
    const onChange = vi.fn()
    render(<DataWorkbench value={{ type: 'growth', code: 'GDP', years: 'all' }} onChange={onChange} />)
    expect(screen.getByTestId('workbench-fallback-lane')).toBeInTheDocument()
    expect(screen.queryByTestId('workbench-rail')).toBeNull()
    // R5 — the single↔multi toggle (the one-way trap: it lived only in the fallback lane).
    const multi = screen.getByRole('button', { name: 'მრავალი' })
    expect(screen.getByRole('button', { name: 'ერთი' })).toBeInTheDocument()
    fireEvent.click(multi)
    // Toggling to multi rewrites `code` to an array — the escape from the single→multi trap.
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'growth', code: ['GDP'] }))
  })

  // ── R3 · pivot opens PivotEditor (rows / keyField / valueFields / colors) ──────────
  it('pivot → PivotEditor (rows/keyField/valueFields/colors), NOT the desugared melt pipeline', () => {
    const onChange = vi.fn()
    render(
      <DataWorkbench
        value={{ type: 'pivot', rows: [{ label: 'X', '2022': 1 }], keyField: 'label', valueFields: ['2022'] }}
        onChange={onChange}
      />,
    )
    expect(screen.getByTestId('workbench-fallback-lane')).toBeInTheDocument()
    expect(screen.queryByTestId('workbench-rail')).toBeNull()
    // keyField is editable in pivot's OWN vocabulary (POLA — not a melt step).
    const keyInput = screen.getByLabelText(/keyField/)
    fireEvent.change(keyInput, { target: { value: 'series' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'pivot', keyField: 'series' }))
  })

  // ── R4 · transform edits inline `source` rows + `encoding` ─────────────────────────
  it('transform → editable inline `source` rows + `encoding` (TransformEditor)', () => {
    const onChange = vi.fn()
    render(<DataWorkbench value={{ type: 'transform', source: [], steps: [], encoding: { label: '' } }} onChange={onChange} />)
    expect(screen.getByTestId('workbench-fallback-lane')).toBeInTheDocument()
    // encoding — the `value` channel text input (EncodingEditor).
    const valueChannel = screen.getByPlaceholderText('value')
    fireEvent.change(valueChannel, { target: { value: 'amount' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ encoding: expect.objectContaining({ value: 'amount' }) }))
    // inline source — the literal-rows JSON escape hatch is present.
    expect(screen.getByText(/Record<string, DimVal>\[\]/)).toBeInTheDocument()
  })

  // ── Owner complaint · a query in the three-pane keeps its Advanced escape hatch ────
  it('query (three-pane) → an Advanced/raw panel with type-switch, the query editor, and read-only JSON', () => {
    render(<DataWorkbench value={{ type: 'query', query: { measure: 'B1G' }, pipe: [], encoding: { label: 'label' } }} onChange={() => {}} />)
    // The three panes lead …
    expect(screen.getByTestId('workbench-rail')).toBeInTheDocument()
    // … and the Advanced/raw disclosure keeps the deeper edits reachable in the SAME surface.
    const adv = screen.getByTestId('workbench-advanced')
    expect(within(adv).getByTestId('spec-type-picker')).toBeInTheDocument()   // R1/R7 type switch
    expect(within(adv).getByTestId('workbench-json')).toBeInTheDocument()     // R6 read-only JSON
    // The query's full editor (encoding / measure / filter / field-wells) is mounted here —
    // QuerySpecEditor's Field Wells section is its encoding-binding surface.
    expect(within(adv).getByText(/Field Wells/)).toBeInTheDocument()
  })

  // ── Owner complaint · a native pipeline gets a WRITABLE raw-JSON editor ────────────
  it('pipeline (three-pane) → writable raw JSON via the Advanced panel', () => {
    const onChange = vi.fn()
    render(
      <DataWorkbench
        value={{ type: 'pipeline', pipe: [{ op: 'source', metrics: ['B1G'] }], encoding: { label: 'label' } }}
        onChange={onChange}
      />,
    )
    const adv = screen.getByTestId('workbench-advanced')
    // Expand the collapsed "Advanced / raw" disclosure (progressive disclosure — the panes lead).
    fireEvent.click(within(adv).getByText(/გაფართოებული/))
    // A native pipeline is un-catalogued → SpecBody falls to the writable JSON editor.
    const box = within(adv).getByRole('textbox')
    fireEvent.change(box, {
      target: { value: '{"type":"pipeline","pipe":[{"op":"source","metrics":["X"]}],"encoding":{"label":"l"}}' },
    })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      type: 'pipeline', pipe: [{ op: 'source', metrics: ['X'] }],
    }))
  })

  // ── R1 · from-scratch type creation is reachable in the workbench ──────────────────
  it('an UNBOUND element exposes the from-scratch type picker (R1 create-from-scratch)', () => {
    render(<DataWorkbench value={undefined} onChange={() => {}} />)
    const scratch = screen.getByTestId('workbench-from-scratch')
    expect(within(scratch).getByTestId('spec-type-picker')).toBeInTheDocument()
  })
})

// ── SpecTypePicker — the actual inter-kind CONVERT + from-scratch behaviour (R1/R7) ──
//
//  The picker is the OWNED Radix Select: open with ArrowDown on the combobox trigger (the APG
//  keyboard path), then commit an option — the same idiom FF-RADIX-A11Y-INTACT drives.
describe('FF-EDITOR-CAPABILITY-PARITY — the type picker converts + creates via make()', () => {
  it('from-scratch: picking a kind seeds a fresh spec of that kind (make())', async () => {
    const onChange = vi.fn()
    render(<SpecTypePicker value={null} onChange={onChange} locale="en" />)
    const trigger = screen.getByRole('combobox')
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    await screen.findByRole('listbox')
    fireEvent.click(screen.getByRole('option', { name: /Pivot/ }))
    const seeded = onChange.mock.calls.at(-1)![0] as DataSpec
    expect(seeded.type).toBe('pivot')   // a fresh, valid pivot seed
  })

  it('inter-kind convert: picking another kind converts an existing spec (make() of the new kind)', async () => {
    const onChange = vi.fn()
    render(<SpecTypePicker value={{ type: 'row-list', rows: [] }} onChange={onChange} locale="en" />)
    const trigger = screen.getByRole('combobox')
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    await screen.findByRole('listbox')
    fireEvent.click(screen.getByRole('option', { name: /Timeseries/ }))
    const converted = onChange.mock.calls.at(-1)![0] as DataSpec
    expect(converted.type).toBe('timeseries')
  })
})
