// @vitest-environment jsdom
// ── FF-DATA-DOOR-PROJECTION — the Data door reads, and routes to the owner (0112 S2/S3) ──
//
//  Two roots, one control (card 0112):
//    • S3 — OPEN IS A READ. Opening the workbench door writes NOTHING to the store. The old
//      seed-on-open (`onChange(freshPipelineSpec())`) made a look-only gesture destructive —
//      on a data-LESS inheriting child it wrote an empty own-spec that SHADOWED the section's
//      inherited rows and vanished the visual (Law 11). Guard: onChange fires ZERO times on
//      open, for every role.
//    • S2 — the door follows CONTAINMENT. A data-LESS inheriting child names its owner in the
//      summary and routes its door to the OWNER's `data` (an `ownerId` escalation), never a
//      fresh unbound spec on itself. A data-OWNING element opens its own spec (no ownerId).
//
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { DataSpec } from '@statdash/engine'
import type { PropField } from '@statdash/react/engine'
import { DataFacetField } from './DataFacetField'
import { FocusEscalationContext, type FocusEscalationRequest } from '../focusEscalation'
import { DataOwnershipProvider, type DataOwnership } from '../dataOwnership'
import type { FieldControlProps } from '../fieldControl.types'

// The live source read + grid labels are exercised elsewhere; here the door's ROUTING +
// the no-write-on-open invariant are the subject, so they are stubbed deterministically.
vi.mock('../../features/data-layer/pipeline-preview/usePipelineSourceRows', () => ({
  usePipelineSourceRows: () => ({ status: 'ok', sourceRows: [], pipeCtx: {} }),
}))
vi.mock('../../features/data-layer/pipeline-preview/useGridLabels', () => ({
  useGridLabels: () => ({ columnLabel: () => 'GDP' }),
}))
vi.mock('../../discovery/MetricPalette', () => ({
  MetricPalette: () => <div data-testid="mock-metric-palette" />,
}))

const OWNER_SPEC: DataSpec = {
  type: 'pipeline', pipe: [{ op: 'source', metrics: ['m.gdp'] }], encoding: { label: 'label' },
} as DataSpec

const field: PropField = { field: 'data', type: 'data-pipeline', label: { ka: '', en: 'Data' } } as PropField

function renderFacet(opts: { value?: DataSpec; ownership: DataOwnership | null }) {
  const onChange = vi.fn()
  const escalate = vi.fn()
  const props: FieldControlProps = {
    field, id: 'insp-data', value: opts.value, locales: ['en'], locale: 'en', onChange,
  }
  render(
    <FocusEscalationContext.Provider value={{ escalate }}>
      <DataOwnershipProvider value={opts.ownership}>
        <DataFacetField {...props} />
      </DataOwnershipProvider>
    </FocusEscalationContext.Provider>,
  )
  return { onChange, escalate }
}

const lastReq = (escalate: ReturnType<typeof vi.fn>): FocusEscalationRequest =>
  escalate.mock.calls[escalate.mock.calls.length - 1][0]

describe('FF-DATA-DOOR-PROJECTION — S3: opening the door writes NOTHING', () => {
  it('an UNBOUND element — open writes zero onChange (seeds only on a real edit)', () => {
    const { onChange, escalate } = renderFacet({ value: undefined, ownership: { role: 'unbound' } })
    fireEvent.click(screen.getByTestId('open-data-workbench'))
    expect(onChange).not.toHaveBeenCalled()
    expect(escalate).toHaveBeenCalledTimes(1)
    // No owner routing for a genuinely-unbound element — it binds its own field.
    expect(lastReq(escalate)).toMatchObject({ source: 'node-field', fieldPath: 'data' })
    expect((lastReq(escalate) as { ownerId?: string }).ownerId).toBeUndefined()
  })

  it('an INHERITING child — open writes zero onChange (never a shadow spec)', () => {
    const { onChange } = renderFacet({
      value: undefined,
      ownership: { role: 'inheriting', ownerId: 'sec-1', ownerLabel: 'Production', ownerSpec: OWNER_SPEC },
    })
    fireEvent.click(screen.getByTestId('open-data-workbench'))
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('FF-DATA-DOOR-PROJECTION — S2: the door follows containment', () => {
  it('an INHERITING child names its owner and routes its door to the OWNER’s data', () => {
    const { escalate } = renderFacet({
      value: undefined,
      ownership: { role: 'inheriting', ownerId: 'sec-1', ownerLabel: 'Production', ownerSpec: OWNER_SPEC },
    })
    // Honest inheritance summary — never a fake «unbound» over inherited rows (Law 11).
    expect(screen.getByTestId('summary-inherited')).toHaveTextContent('Production')
    expect(screen.queryByTestId('summary-unbound')).toBeNull()
    // The door routes to the OWNER's `data` field (ownerId), not a fresh spec on the child.
    fireEvent.click(screen.getByTestId('open-data-workbench'))
    expect(lastReq(escalate)).toMatchObject({ source: 'node-field', fieldPath: 'data', ownerId: 'sec-1' })
  })

  it('a data-OWNING element opens ITS OWN spec (no owner routing)', () => {
    const { escalate } = renderFacet({ value: OWNER_SPEC, ownership: { role: 'owner' } })
    expect(screen.queryByTestId('summary-inherited')).toBeNull()
    fireEvent.click(screen.getByTestId('open-data-workbench'))
    expect((lastReq(escalate) as { ownerId?: string }).ownerId).toBeUndefined()
  })

  it('an inheriting child offers NO quick-bind (its metric would shadow the inherited data)', () => {
    renderFacet({
      value: undefined,
      ownership: { role: 'inheriting', ownerId: 'sec-1', ownerLabel: 'Production', ownerSpec: OWNER_SPEC },
    })
    expect(screen.queryByTestId('mock-metric-palette')).toBeNull()
  })
})
