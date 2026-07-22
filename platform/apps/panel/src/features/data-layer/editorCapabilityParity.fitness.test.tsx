// ── FF-EDITOR-CAPABILITY-PARITY — the Capability Matrix, probed (DESIGN-0104 §2·C2 · E1) ─
//
//  The trust-recovery gate (ADR-051 DU4) GENERALIZED from a human's memory of the incident
//  into MACHINERY. It no longer enumerates capabilities by hand — it reads them from the
//  DECLARATION: kinds DECLARE what they require (`SPEC_CATALOG[kind].capabilities`), editors
//  DECLARE what they provide (`registerSpecEditor(..., provides)`), the workbench DECLARES its
//  core acts (`WORKBENCH_CORE_CAPABILITIES`). This gate proves the three agree, so the 0104
//  regression class — a kind stripped of an editing capability by a silent refactor — REDS
//  here. Three red conditions (the design's honesty check):
//    1. NO ORPHAN REQUIREMENT — a required capability with no provider.
//    2. NO UNPROBED CLAIM     — a provided/required capability with no render probe.
//    3. ALL PROBES PASS       — a probe's capability not actually reachable in its surface.
//  The probe registry `CapabilityId → probe` holds the SAME render assertions the old
//  hand-written gate did (editable timeseries code/years, the growth toggle, pivot fields,
//  transform inline source, the query Advanced, the writable pipeline JSON) — now KEYED BY
//  the capability they prove, enumerated from the matrix instead of from the incident.
//
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react'
import type { CapabilityId, DataSpec, MetricDef } from '@statdash/engine'
import { SPEC_CATALOG, capabilitiesFor } from '@statdash/engine'
import { DataWorkbench } from './workbench/DataWorkbench'
import { SpecTypePicker } from './workbench/WorkbenchAdvanced'
import {
  WORKBENCH_CORE_CAPABILITIES, isWorkbenchAdmissible, requiredCapabilities,
} from './workbench/workbenchCapabilities'
import { registerSpecEditors } from './registerSpecEditors'
import {
  getSpecEditor, providedByRegisteredEditors, registerSpecEditor, specEditorProvides,
  unregisterSpecEditor,
} from './specEditorRegistry'
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

// ── The representative fixture per kind + shared assertions ─────────────────────────────
const QUERY:    DataSpec = { type: 'query',    query: { measure: 'B1G' }, pipe: [], encoding: { label: 'label' } }
const PIPELINE: DataSpec = { type: 'pipeline', pipe: [{ op: 'source', metrics: ['B1G'] }], encoding: { label: 'label' } }
const PIVOT:    DataSpec = { type: 'pivot', rows: [{ label: 'X', '2022': 1 }], keyField: 'label', valueFields: ['2022'] }

// The JsonFallback degradation sentinel — its ABSENCE proves the kind's REAL (dedicated or
// schema) editor mounted; its PRESENCE is the honest degraded state (J-PARITY).
const JSON_FALLBACK = /ვიზუალური რედაქტორი.*ჯერ არ არის/

/** Assert a kind routed to its dedicated fallback editor — the panes never lie read-only. */
function expectDedicatedFallback(): void {
  expect(screen.getByTestId('workbench-fallback-lane')).toBeInTheDocument()
  expect(screen.queryByTestId('workbench-rail')).toBeNull()   // NEVER a read-only three-pane
  expect(screen.queryByText(JSON_FALLBACK)).toBeNull()        // a real editor, not the JSON escape
}

// ── The probe registry — one render assertion per capability (typed over the WHOLE union, so a
//    new CapabilityId without a probe is a COMPILE error → "no unprobed claim" by construction). ─
type Probe = () => void
const CAPABILITY_PROBES: Record<CapabilityId, Probe> = {
  // ── Pipeline-spine acts — reachable in the query / pipeline three-pane ────────────────
  'head.source.pick': () => {
    render(<DataWorkbench value={QUERY} onChange={vi.fn()} />)
    expect(screen.getByTestId('workbench-rail')).toBeInTheDocument()
    expect(screen.getByTestId('workbench-get')).toBeInTheDocument()       // the source-pick head
  },
  'head.filter-builder': () => {
    render(<DataWorkbench value={QUERY} onChange={vi.fn()} />)
    const adv = screen.getByTestId('workbench-advanced')
    expect(within(adv).getByText(/ფილტრები \(filter\)/)).toBeInTheDocument()
  },
  'pipeline.steps.edit': () => {
    render(<DataWorkbench value={PIPELINE} onChange={vi.fn()} />)
    expect(screen.getByTestId('workbench-rail')).toBeInTheDocument()      // PipelineBuilder lives here
  },
  'encoding.edit': () => {
    render(<DataWorkbench value={QUERY} onChange={vi.fn()} />)
    const adv = screen.getByTestId('workbench-advanced')
    expect(within(adv).getByText(/Field Wells/)).toBeInTheDocument()
  },
  'raw-json.write': () => {
    const onChange = vi.fn()
    render(<DataWorkbench value={PIPELINE} onChange={onChange} />)
    const adv = screen.getByTestId('workbench-advanced')
    fireEvent.click(within(adv).getByText(/გაფართოებული/))                // expand the disclosure
    fireEvent.change(within(adv).getByRole('textbox'), {
      target: { value: '{"type":"pipeline","pipe":[{"op":"source","metrics":["X"]}],"encoding":{"label":"l"}}' },
    })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      type: 'pipeline', pipe: [{ op: 'source', metrics: ['X'] }],
    }))
  },

  // ── Value-cell head acts — timeseries / growth dedicated editors (the incident kinds) ─
  'head.measure-code.edit': () => {
    const onChange = vi.fn()
    render(<DataWorkbench value={{ type: 'timeseries', code: 'GDP', years: 'all' }} onChange={onChange} />)
    expectDedicatedFallback()
    fireEvent.change(screen.getByDisplayValue('GDP'), { target: { value: 'B1G' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'timeseries', code: 'B1G' }))
  },
  'head.years.edit': () => {
    render(<DataWorkbench value={{ type: 'timeseries', code: 'GDP', years: 'all' }} onChange={vi.fn()} />)
    expect(screen.getByText(/წლები/)).toBeInTheDocument()                 // YearsField
  },
  'growth.single-multi.toggle': () => {
    const onChange = vi.fn()
    render(<DataWorkbench value={{ type: 'growth', code: 'GDP', years: 'all' }} onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'ერთი' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'მრავალი' }))      // the single→multi trap escape
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'growth', code: ['GDP'] }))
  },

  // ── Pivot acts — the PivotEditor's four distinct controls (POLA, not a melt pipeline) ─
  'pivot.rows.edit': () => {
    render(<DataWorkbench value={PIVOT} onChange={vi.fn()} />)
    expectDedicatedFallback()
    expect(screen.getAllByText(/სტრიქონები \(rows\)/).length).toBeGreaterThan(0)
  },
  'pivot.key-field.edit': () => {
    const onChange = vi.fn()
    render(<DataWorkbench value={PIVOT} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(/keyField/), { target: { value: 'series' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'pivot', keyField: 'series' }))
  },
  // getAllByText — MUI outlined labels render the text twice (visible label + notched legend).
  'pivot.value-fields.edit': () => {
    render(<DataWorkbench value={PIVOT} onChange={vi.fn()} />)
    expect(screen.getAllByText(/valueFields/).length).toBeGreaterThan(0)
  },
  'pivot.colors.edit': () => {
    render(<DataWorkbench value={PIVOT} onChange={vi.fn()} />)
    expect(screen.getAllByText(/colors/).length).toBeGreaterThan(0)
  },

  // ── Transform inline source (+ its encoding step) ────────────────────────────────────
  'transform.source.edit': () => {
    render(<DataWorkbench value={{ type: 'transform', source: [], steps: [], encoding: { label: '' } }} onChange={vi.fn()} />)
    expect(screen.getByTestId('workbench-fallback-lane')).toBeInTheDocument()
    expect(screen.getByText(/Record<string, DimVal>\[\]/)).toBeInTheDocument()   // inline source escape
  },

  // ── Explicit-rows / ratio / metric — dedicated (or schema) editors, reachable not-JSON ─
  'row-list.rows.edit': () => {
    render(<DataWorkbench value={{ type: 'row-list', rows: [{ code: 'GDP' }] }} onChange={vi.fn()} />)
    expectDedicatedFallback()                                             // RowListEditor mounted
  },
  'ratio-list.pairs.edit': () => {
    render(<DataWorkbench value={{ type: 'ratio-list', pairs: [{ code: 'A', denom: 'B' }] } as DataSpec} onChange={vi.fn()} />)
    expectDedicatedFallback()                                             // schema arm → Inspector mounted
  },
  'metric.refs.edit': () => {
    render(<DataWorkbench value={{ type: 'metric', metrics: ['B1G'] } as DataSpec} onChange={vi.fn()} />)
    expectDedicatedFallback()                                             // MetricSpecEditor mounted
  },
  'metric.grain.edit': () => {
    render(<DataWorkbench value={{ type: 'metric', metrics: ['B1G'] } as DataSpec} onChange={vi.fn()} />)
    expectDedicatedFallback()                                             // MetricSpecEditor provides both
  },
}

describe('FF-EDITOR-CAPABILITY-PARITY — the matrix is complete, provided, and probed', () => {
  const ALL_KINDS = [...Object.keys(SPEC_CATALOG), 'pipeline']

  // The PARITY provider pool (completeness — broader than admissibility): the workbench core,
  // every registered editor's claim, AND schema-arm kinds' own caps (the generic Inspector
  // provides them). Admissibility (the ROUTING pool, workbenchCapabilities.ts) is core-only.
  const schemaProvided = new Set<CapabilityId>(
    Object.keys(SPEC_CATALOG)
      .filter((k) => (SPEC_CATALOG[k]!.schema?.length ?? 0) > 0)
      .flatMap((k) => capabilitiesFor(k)),
  )
  const parityProvided = new Set<CapabilityId>([
    ...WORKBENCH_CORE_CAPABILITIES,
    ...providedByRegisteredEditors(),
    ...schemaProvided,
  ])

  it('NO ORPHAN REQUIREMENT — every capability a kind requires has a provider', () => {
    for (const kind of ALL_KINDS) {
      for (const cap of requiredCapabilities(kind)) {
        expect(parityProvided.has(cap), `${kind} requires "${cap}" but nothing provides it`).toBe(true)
      }
    }
  })

  it('NO UNPROBED CLAIM — every provided or required capability has a render probe', () => {
    const needProbe = new Set<CapabilityId>([...parityProvided, ...ALL_KINDS.flatMap(requiredCapabilities)])
    for (const cap of needProbe) {
      expect(CAPABILITY_PROBES[cap], `"${cap}" is claimed/required but has no probe`).toBeTypeOf('function')
    }
  })

  // ALL PROBES PASS — one isolated test per capability (fast, per-cap failure granularity;
  // afterEach cleanup runs between). A probe that cannot reach its capability REDS by name.
  it.each(Object.entries(CAPABILITY_PROBES) as [CapabilityId, Probe][])(
    'PROBE PASSES — "%s" is reachable in its surface',
    (_cap, probe) => { probe() },
  )
})

// ── J-PARITY (the wave gate) — graceful degradation, never a read-only three-pane ────────
describe('FF-EDITOR-CAPABILITY-PARITY — J-PARITY: a dropped editor degrades gracefully', () => {
  it('the read-only three-pane is UNREPRESENTABLE for a value-cell kind — refused by DERIVATION', () => {
    // Registry-independent: timeseries/growth/pivot require acts the workbench core does not
    // provide, so no registry state can ever admit them to the panes. The 0104 regression
    // (a read-only three-pane) cannot be reached — this is the lock the matrix installs.
    expect(isWorkbenchAdmissible('timeseries')).toBe(false)
    expect(isWorkbenchAdmissible('growth')).toBe(false)
    expect(isWorkbenchAdmissible('pivot')).toBe(false)
    expect(isWorkbenchAdmissible('query')).toBe(true)      // the spine stays admissible
    expect(isWorkbenchAdmissible('pipeline')).toBe(true)
  })

  it('unregistering a kind\'s editor degrades it to the honest fallback — never a broken three-pane', () => {
    // Simulate a future regression that drops the timeseries editor. Capture → drop → restore.
    const saved = getSpecEditor('timeseries')!
    const savedProvides = specEditorProvides('timeseries')
    unregisterSpecEditor('timeseries')
    try {
      render(<DataWorkbench value={{ type: 'timeseries', code: 'GDP', years: 'all' }} onChange={vi.fn()} />)
      // STILL the fallback lane (timeseries is never admissible) — NEVER the three panes …
      expect(screen.getByTestId('workbench-fallback-lane')).toBeInTheDocument()
      expect(screen.queryByTestId('workbench-rail')).toBeNull()
      // … and with no dedicated editor, SpecBody degrades HONESTLY to the writable JSON escape
      // (Law 11) — a graceful fallback, not a lying/read-only surface.
      expect(screen.getByText(JSON_FALLBACK)).toBeInTheDocument()
    } finally {
      registerSpecEditor('timeseries', saved, savedProvides)   // restore for other suites
    }
  })
})

// ── SpecTypePicker — the from-scratch + inter-kind CONVERT behaviour (R1/R7) ─────────────
//
//  The picker is the OWNED Radix Select: open with ArrowDown on the combobox trigger (the APG
//  keyboard path), then commit an option — the same idiom FF-RADIX-A11Y-INTACT drives.
describe('FF-EDITOR-CAPABILITY-PARITY — the type picker converts + creates via make()', () => {
  it('an UNBOUND element exposes the from-scratch type picker (R1 create-from-scratch)', () => {
    render(<DataWorkbench value={undefined} onChange={() => {}} />)
    const scratch = screen.getByTestId('workbench-from-scratch')
    expect(within(scratch).getByTestId('spec-type-picker')).toBeInTheDocument()
  })

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
