// ── FF-ROUNDTRIP-CANONICAL / FF-DIALECT-DECLARED (card 0112 §R4 · D5, U0) ──────────
//
//  THE LIE (measured, §R4): the steward JSON pane (`describeStewardDetail`) showed the
//  LOWERED ASSEMBLY (`desugarToPipeline`'s `pipeline`, 8 steps for the traced gdp chart)
//  as if it were the STORED artifact (a `query` spec, 7 steps) — zero dialect marker. For
//  every legacy `query` element the author's JSON comparison was guaranteed to mismatch.
//
//  THE FIX (D5, panel-only — the engine desugar stays the one truth, unchanged):
//    • `toWorkbenchModel` threads the stored spec verbatim onto `WorkbenchModel.storedSpec`.
//    • `describeStewardDetail` returns `{ storedJson (byte-true), canonicalJson (the
//      labeled assembly), dialect: { stored, shown } }` — never the assembly AS the artifact.
//
//  This file pins the two fitness oracles the design names (SPEC §5 · U0):
//    • FF-ROUNDTRIP-CANONICAL — a canonical `pipeline` spec: open→no-edit→emit is IDENTITY.
//    • FF-DIALECT-DECLARED    — a stored `query` spec: the stored pane is byte-equal to the
//      stored serialization AND carries the dialect marker; the canonical pane is present
//      + labeled (proven both at the pure-model layer and rendered in the pane itself).
//
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { DataSpec, MetricDef } from '@statdash/engine'
import { fromWorkbenchModel, toWorkbenchModel } from './workbenchModel'
import { describeStewardDetail } from './generatedQuery'
import { GeneratedQueryPane } from './GeneratedQueryPane'
import { useMetricCatalogStore } from '../../../discovery/metricCatalog.store'
import { useRoleStore } from '../../../studio/useRole'

// ── FF-ROUNDTRIP-CANONICAL — a canonical pipeline spec round-trips IDENTICALLY ──────
describe('FF-ROUNDTRIP-CANONICAL — a canonical `pipeline` spec: open→no-edit→emit ≡ identity', () => {
  it('JSON(fromWorkbenchModel(toWorkbenchModel(s))) === JSON(s) for a stored pipeline', () => {
    const s: DataSpec = {
      type: 'pipeline',
      pipe: [
        { op: 'source', metrics: ['m.gdp'], where: { REGION: 'GE' } },
        { op: 'filter', where: { REGION: 'GE' } } as never,
        { op: 'sort', by: 'value', dir: 'asc' } as never,
      ],
      encoding: { label: 'label', value: 'value' },
    }
    const emitted = fromWorkbenchModel(toWorkbenchModel(s)!)
    expect(JSON.stringify(emitted)).toBe(JSON.stringify(s))
  })

  it('holds for a query-shaped tail too (empty pipe)', () => {
    const s: DataSpec = { type: 'pipeline', pipe: [{ op: 'source', metrics: ['B1G'] }], encoding: { label: 'l' } }
    const emitted = fromWorkbenchModel(toWorkbenchModel(s)!)
    expect(JSON.stringify(emitted)).toBe(JSON.stringify(s))
  })
})

// ── FF-DIALECT-DECLARED — a stored `query` spec: stored ≠ assembly, both DECLARED ──
//
//  The corpus shape mirrors §R4's traced element: a steward `query` head (measure + filter)
//  + a multi-step tail — the exact form whose byte-parity the owner (correctly) found
//  broken (query→pipeline, 7→8 steps, the query relocated into a synthesized head).
const STORED_QUERY: DataSpec = {
  type:  'query',
  query: { measure: '*', filter: { geo: 'GE', approach: 'EXP' } },
  pipe: [
    { op: 'aggregate' } as never,
    { op: 'derive', as: 'a', expr: '1' } as never,
    { op: 'derive', as: 'b', expr: '1' } as never,
    { op: 'sort', by: 'value', dir: 'asc' } as never,
  ],
  encoding: { label: 'label', value: 'value' },
}

describe('FF-DIALECT-DECLARED (model layer) — a stored `query` never masquerades as the assembly', () => {
  const model = toWorkbenchModel(STORED_QUERY)!
  const detail = describeStewardDetail(model, 'en')

  it('carries the stored spec verbatim onto the model (D5 thread)', () => {
    expect(model.storedSpec).toBe(STORED_QUERY)
  })

  it('storedJson is BYTE-EQUAL to the stored serialization — never the lowered assembly', () => {
    expect(detail.storedJson).toBe(JSON.stringify(STORED_QUERY, null, 2))
  })

  it('the dialect marker declares BOTH discriminants honestly', () => {
    expect(detail.dialect).toEqual({ stored: 'query', shown: 'pipeline', coincide: false })
  })

  it('the canonical pane is present — the desugarToPipeline assembly, labeled a projection', () => {
    expect(detail.canonicalJson.length).toBeGreaterThan(0)
    expect(JSON.parse(detail.canonicalJson).type).toBe('pipeline')
    // the synthesized source head + the same tail verbatim — one step MORE than stored
    // (§R4: 7 stored → 8 assembled for the traced element; here 4 stored tail → 5 assembled).
    expect(JSON.parse(detail.canonicalJson).pipe).toHaveLength(STORED_QUERY.pipe!.length + 1)
  })

  it('stored ≠ canonical for a legacy query — the measured R4 divergence, now DECLARED not hidden', () => {
    expect(detail.storedJson).not.toBe(detail.canonicalJson)
  })
})

describe('FF-DIALECT-DECLARED (model layer) — a stored `pipeline` COINCIDES (one dialect, no marker noise)', () => {
  it('storedJson === canonicalJson when the stored artifact IS the canonical spine', () => {
    const storedPipeline: DataSpec = {
      type: 'pipeline', pipe: [{ op: 'source', metrics: ['m.gdp'] }], encoding: { label: 'l' },
    }
    const model = toWorkbenchModel(storedPipeline)!
    const detail = describeStewardDetail(model, 'en')
    expect(detail.dialect).toEqual({ stored: 'pipeline', shown: 'pipeline', coincide: true })
    expect(detail.storedJson).toBe(detail.canonicalJson)
  })

  it('coincidence is STRUCTURAL — jsonb-reordered keys are the SAME artifact (the U3 walk finding)', () => {
    // A stored pipeline whose key order differs from the emission (Postgres jsonb
    // reorders object keys) is byte-different but structurally identical — ONE block,
    // never a phantom "lowered" duplicate. Byte-comparison over-reported divergence.
    const reordered = JSON.parse(JSON.stringify({
      encoding: { label: 'l' }, pipe: [{ metrics: ['m.gdp'], op: 'source' }], type: 'pipeline',
    })) as DataSpec
    const model = toWorkbenchModel(reordered)!
    const detail = describeStewardDetail(model, 'en')
    expect(detail.storedJson).not.toBe(detail.canonicalJson)   // bytes differ (key order)
    expect(detail.dialect.coincide).toBe(true)                 // structure identical → one block
  })

  it('a REAL divergence (different steps) still declares coincide=false', () => {
    const stored: DataSpec = {
      type: 'pipeline', pipe: [{ op: 'source', metrics: ['m.gdp'] }, { op: 'sort', by: 'l', dir: 'asc' }],
      encoding: { label: 'l' },
    }
    const model = toWorkbenchModel(stored)!
    // Simulate an edited model whose emission dropped the sort (a genuine divergence).
    model.tail = []
    const detail = describeStewardDetail(model, 'en')
    expect(detail.dialect.coincide).toBe(false)
  })
})

// ── FF-DIALECT-DECLARED (rendered) — the pane itself never lies ────────────────────
const metrics: Record<string, MetricDef> = {
  'm.gdp': { label: { en: 'Gross Domestic Product', ka: 'მშპ' } } as never,
}
const dimensions = { geo: { code: 'geo', label: { en: 'Geo', ka: 'გეო' } } } as never

beforeEach(() => {
  useMetricCatalogStore.setState({ catalog: { status: 'ready', metrics, dimensions } })
  useRoleStore.setState({ role: 'steward' })
})
afterEach(() => {
  useMetricCatalogStore.setState({ catalog: { status: 'idle' } })
  useRoleStore.setState({ role: 'author' })
})

describe('FF-DIALECT-DECLARED (rendered pane) — stored FIRST, byte-true; assembly labeled, only when it diverges', () => {
  it('a stored `query` renders BOTH blocks: the stored artifact + the labeled lowered assembly', () => {
    const model = toWorkbenchModel(STORED_QUERY)!
    render(<GeneratedQueryPane model={model} locale="en" />)
    // The dialect label sits on the WireBlock's AccordionSummary (sibling of the body —
    // a WCAG-labelled disclosure), the byte-true JSON in the AccordionDetails `pre` (testid).
    expect(screen.getByText('Stored artifact (query)')).toBeInTheDocument()
    expect(screen.getByTestId('gq-json').textContent).toBe(JSON.stringify(STORED_QUERY, null, 2))
    expect(screen.getByText('Lowered — engine desugarToPipeline')).toBeInTheDocument()
    expect(screen.getByTestId('gq-canonical-json')).toBeInTheDocument()
  })

  it('a stored `pipeline` renders ONE block only — no redundant duplicate, no marker noise', () => {
    const storedPipeline: DataSpec = {
      type: 'pipeline', pipe: [{ op: 'source', metrics: ['m.gdp'] }], encoding: { label: 'label' },
    }
    const model = toWorkbenchModel(storedPipeline)!
    render(<GeneratedQueryPane model={model} locale="en" />)
    expect(screen.getByText('Stored artifact (pipeline)')).toBeInTheDocument()
    expect(screen.queryByTestId('gq-canonical-json')).toBeNull()
    expect(screen.queryByText('Lowered — engine desugarToPipeline')).toBeNull()
  })

  it('is bilingual — the Georgian dialect labels', () => {
    const model = toWorkbenchModel(STORED_QUERY)!
    render(<GeneratedQueryPane model={model} locale="ka" />)
    expect(screen.getByText('შენახული ჩანაწერი (query)')).toBeInTheDocument()
    expect(screen.getByText('დაშლილი — engine desugarToPipeline')).toBeInTheDocument()
  })
})
