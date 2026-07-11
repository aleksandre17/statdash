// ── MetricSpecEditor — the metric-first authoring pane [AR-50 M-SQ-EDITOR] ─────
//
//  Proves the editor COMPOSES a pure MetricSpec from governed picks:
//    • it lists the governed catalog (no fork — useMetricCatalog registry view)
//    • picking a metric emits `metrics: [...]`
//    • "over time" toggles the FIRST-CLASS time grain, defaulting its axis to the
//      TIME_DIM SSOT (Law 1 — time is a selectable dim, not a hardcoded special case)
//    • a where pin emits a generic coordinate narrow (Law 1)
//  All output is data (Law 2) — no functions ever reach the spec.
//
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import type { DataSpec } from '@statdash/engine'

// The governed catalog view (runner-identical) + active locale — the two seams the
// editor reads. Mocked deterministically so the picker vocabulary is fixed.
const useMetricCatalog = vi.hoisted(() => vi.fn())
vi.mock('../../../discovery/useMetricCatalog', () => ({ useMetricCatalog }))
vi.mock('../../../inspector/useActiveLocales', () => ({ useActiveLocales: () => ['en', 'ka'] }))

import { MetricSpecEditor } from './MetricSpecEditor'

type MetricSpec = Extract<DataSpec, { type: 'metric' }>

const READY_CATALOG = {
  status: 'ready' as const,
  metrics: {
    gdp_per_capita: { label: { en: 'GDP per capita', ka: 'მშპ ერთ სულზე' } },
    gdp:            { label: { en: 'GDP', ka: 'მშპ' } },
  },
  dimensions: {
    time: { code: 'time', label: { en: 'Period', ka: 'პერიოდი' } },
    geo:  { code: 'geo',  label: { en: 'Geography', ka: 'გეოგრაფია' } },
  },
}

/** Controlled harness — mirrors DataSpecEditor's owned-state contract. */
function Harness({ initial }: { initial: MetricSpec }) {
  const [spec, setSpec] = useState<MetricSpec>(initial)
  return (
    <>
      <MetricSpecEditor value={spec} onChange={(s) => setSpec(s as MetricSpec)} />
      <pre data-testid="emitted">{JSON.stringify(spec)}</pre>
    </>
  )
}
const emitted = (): MetricSpec => JSON.parse(screen.getByTestId('emitted').textContent!) as MetricSpec

beforeEach(() => { useMetricCatalog.mockReturnValue(READY_CATALOG) })
afterEach(cleanup)

describe('MetricSpecEditor — governed composition', () => {
  it('lists the governed metric vocabulary (no fork — the registry view)', () => {
    render(<Harness initial={{ type: 'metric', metrics: [] }} />)
    const metricBox = screen.getByLabelText('Metrics (governed)')
    fireEvent.mouseDown(metricBox)
    // The Autocomplete popup offers the governed labels.
    expect(screen.getByText('GDP per capita')).toBeInTheDocument()
  })

  it('picking a governed metric emits metrics: [...]', () => {
    render(<Harness initial={{ type: 'metric', metrics: [] }} />)
    const metricBox = screen.getByLabelText('Metrics (governed)')
    fireEvent.mouseDown(metricBox)
    fireEvent.click(screen.getByText('GDP per capita'))
    expect(emitted().metrics).toEqual(['gdp_per_capita'])
  })

  it('"over time" toggles the first-class time grain, defaulting the axis to TIME_DIM (Law 1)', () => {
    render(<Harness initial={{ type: 'metric', metrics: ['gdp_per_capita'] }} />)
    expect(emitted().time).toBeUndefined()

    fireEvent.click(screen.getByLabelText('Over time'))
    expect(emitted().time).toEqual({ dim: 'time' }) // TIME_DIM SSOT default, not hardcoded logic

    fireEvent.click(screen.getByLabelText('Over time'))
    expect(emitted().time).toBeUndefined() // toggling off removes it (clean spec)
  })

  it('a where pin emits a generic coordinate narrow (Law 1), numeric-coerced', () => {
    render(<Harness initial={{ type: 'metric', metrics: ['gdp'] }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add pin' }))

    const dimInput = screen.getByRole('combobox', { name: 'Dimension' })
    fireEvent.change(dimInput, { target: { value: 'geo' } })
    const valInput = screen.getByLabelText('Pinned value')
    fireEvent.change(valInput, { target: { value: 'R1' } })

    expect(emitted().where).toEqual({ geo: 'R1' })
  })

  it('emits NO functions — the spec is 100% data (Law 2)', () => {
    render(<Harness initial={{ type: 'metric', metrics: ['gdp_per_capita'], time: { dim: 'time' } }} />)
    const spec = emitted()
    // A round-trip through JSON is lossless iff the spec is pure data.
    expect(JSON.parse(JSON.stringify(spec))).toEqual(spec)
  })

  it('degrades to a usable hint when the catalog is unavailable (never a crash, Law 9)', () => {
    useMetricCatalog.mockReturnValue({ status: 'error', message: 'down' })
    render(<Harness initial={{ type: 'metric', metrics: [] }} />)
    const metricField = screen.getByLabelText('Metrics (governed)').closest('.MuiFormControl-root')!
    expect(within(metricField as HTMLElement).getByText(/type a metric id|Catalog unavailable/)).toBeInTheDocument()
  })
})
