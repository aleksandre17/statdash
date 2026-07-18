// ── FF-OFFER-ROUNDTRIP — every transform op is AUTHORABLE, never lost (card 0087) ──
//
//  Owner guarantee #2 ("nothing unbuildable"): for EVERY op the engine registers, the
//  workbench offers an authoring surface — a bespoke form (filter/sort/lookup), the
//  GENERIC role-projecting editor (any op carrying a PropSchema), or the honest raw-JSON
//  escape hatch (a schema-less op — still editable, round-trips losslessly). No op falls
//  into a dead/blank state. Parameterized over `listTransformOps()` (the engine SSOT), so a
//  NEW op joins the sweep automatically and must earn its authoring story or fail here.
//
//  Pairs with FF-ROLE-COVERAGE (every schema field is roled ⇒ the projector has a control
//  for it) and FF-FILTER-PARITY (the filter modes resolve byte-identically). Together:
//  every engine-accepted payload is authorable via the projected form OR honest free text.
//
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { EngineRow, TransformStep } from '@statdash/engine'
import { listTransformOps, getTransformStepSchema } from '@statdash/engine'
import { StepForm } from './StepForm'
import { defaultStep } from './defaultStep'
import { buildStepInputOffer } from '../../../pipeline-preview/stepInput'

// The agnostic offer substrate — columns + members + sample derived from live rows.
const SAMPLE: EngineRow[] = [
  { geo: 'GE', year: 2020, sector: 'S1', value: 10 },
  { geo: 'AB', year: 2021, sector: 'S2', value: 20 },
]
const offer = buildStepInputOffer({
  rows: SAMPLE,
  columnLabel: (f) => f,
  cellLabel: (_f, v) => String(v),
  locale: 'en',
})

// `source` is the pipeline HEAD (authored by GetHead / GetGrainEditor, not a StepForm tail
// op) — excluded from the tail-editor sweep.
const TAIL_OPS = listTransformOps().filter((op) => op !== 'source')

// Bespoke forms (their own hand-tuned editors) vs the generic projector.
const BESPOKE = new Set(['filter', 'sort', 'lookup'])

describe('FF-OFFER-ROUNDTRIP — every op has an authoring surface (never lost)', () => {
  it('the sweep is non-trivial (guards against an empty parameterization)', () => {
    expect(TAIL_OPS.length).toBeGreaterThan(10)
  })

  it.each(TAIL_OPS)('op "%s" renders an editable surface — never a dead/blank form', (op) => {
    // defaultStep models most ops; the few it does not (blend/joinByField) render from a
    // minimal `{op}` — the projector/raw-hatch both tolerate absent values.
    const seed = defaultStep(op)
    const step: TransformStep = seed.op === op ? seed : ({ op } as TransformStep)

    render(<StepForm step={step} onChange={vi.fn()} input={offer} />)

    // An authoring surface exists — at least one operable control (not empty, not dead).
    const controls = [
      ...screen.queryAllByRole('textbox'),
      ...screen.queryAllByRole('checkbox'),
      ...screen.queryAllByRole('combobox'),
      ...screen.queryAllByRole('button'),
    ]
    expect(controls.length, `op "${op}" rendered no editable control`).toBeGreaterThan(0)

    // A bespoke or schema-carrying op must show its real form — never the raw-JSON hatch.
    if (BESPOKE.has(op) || getTransformStepSchema(op) != null) {
      expect(
        screen.queryByText(/ვიზუალური ფორმა მიუწვდომელია/),
        `op "${op}" fell through to the raw-JSON hatch despite having a form`,
      ).toBeNull()
    }
  })
})
