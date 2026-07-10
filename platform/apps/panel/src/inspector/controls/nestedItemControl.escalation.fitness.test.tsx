// ── FF-NO-CRAMMED-DOCK (live) + FF-OVERFLOW-DETERMINISTIC (II) — the SL-4 wiring ──
//
//  Proves the escalation is WIRED at the nested-item drill boundary, deterministically
//  from the Placement Law:
//    • a WORKSPACE-weight item (rich itemSchema) does NOT drill into the dock — it
//      ESCALATES (the host's `escalate` fires; its editor never renders in-dock);
//    • a FORM-weight item drills in the dock exactly as D7.1b did (no escalation,
//      breadcrumb + fields render in place) — zero regression;
//    • the escalated request carries the subject's LOCATION (fieldPath) + name, and its
//      `render(bind)` mounts the SAME editor SEEDED at the escalation point, so the ONE
//      breadcrumb spine continues (field › item) and the binding edits live config;
//    • FAIL-SOFT: with NO host (isolation) even a workspace item drills in-dock — the
//      editor degrades gracefully, never crashes.
//
import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { PropField } from '@statdash/react/engine'
import { ArrayOfControl } from './NestedItemControl'
import { FocusEscalationContext, type FocusEscalation, type FocusEscalationRequest } from '../focusEscalation'

const FORM_ITEM: PropField[] = [
  { field: 'label', type: 'string', label: 'Label' },
  { field: 'value', type: 'number', label: 'Value' },
]
// A WORKSPACE item — a rich DataSpec field dominates → the Placement Law weighs it
// workspace, so entering it must escalate OUT of the dock, never drill in it.
const WORKSPACE_ITEM: PropField[] = [
  { field: 'label', type: 'string', label: 'Series' },
  { field: 'query', type: 'DataSpec', label: 'Query' },
]

const arrayField = (itemSchema: PropField[]): PropField => ({
  field: 'series', type: 'array', label: 'Series', itemSchema, itemLabel: 'label',
})

/** Controlled harness with an optional escalation host (the dock's StudioShell seam). */
function Harness({
  field, initial, host,
}: { field: PropField; initial: unknown[]; host: FocusEscalation | null }) {
  const [val, setVal] = useState<unknown[]>(initial)
  return (
    <FocusEscalationContext.Provider value={host}>
      <ArrayOfControl
        field={field}
        id="insp-series"
        value={val}
        locales={['en']}
        locale="en"
        onChange={(next) => setVal(next as unknown[])}
      />
    </FocusEscalationContext.Provider>
  )
}

describe('FF-NO-CRAMMED-DOCK (live) — a workspace item ESCALATES, never drills in-dock', () => {
  it('opening a workspace item fires escalate and renders NO item form in the dock', () => {
    const escalate = vi.fn()
    render(
      <Harness field={arrayField(WORKSPACE_ITEM)} initial={[{ label: 'GDP', query: {} }]} host={{ escalate }} />,
    )
    // The bounded LIST is in the dock (a form-weight affordance)…
    fireEvent.click(screen.getByRole('button', { name: 'Edit GDP' }))
    // …and opening the workspace item ESCALATED instead of drilling in the dock:
    expect(escalate).toHaveBeenCalledTimes(1)
    // no in-dock drill happened — the drill breadcrumb + the item's fields are absent.
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull()
    expect(screen.queryByLabelText('Query')).toBeNull()
  })

  it('the escalation request is DETERMINISTIC — carries the subject location + name', () => {
    let captured: FocusEscalationRequest | undefined
    render(
      <Harness
        field={arrayField(WORKSPACE_ITEM)}
        initial={[{ label: 'GDP', query: {} }]}
        host={{ escalate: (r) => { captured = r } }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit GDP' }))
    expect(captured).toBeDefined()
    const req = captured!
    expect(req.source).toBe('node-field')        // a nested-item drill is a NODE-FIELD escalation
    if (req.source !== 'node-field') throw new Error('expected node-field escalation')
    expect(req.fieldPath).toBe('series')         // the top-level field on the node
    expect(req.title.en).toBe('GDP')             // the subject's own name
  })

  it('the escalated render(bind) mounts the SAME editor seeded at the item — one spine, live', () => {
    let captured: FocusEscalationRequest | undefined
    render(
      <Harness
        field={arrayField(WORKSPACE_ITEM)}
        initial={[{ label: 'GDP', query: {} }]}
        host={{ escalate: (r) => { captured = r } }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit GDP' }))
    // Render the escalated body with a LIVE binding (what StudioShell supplies from the
    // store). It opens directly at the item, and the breadcrumb spine continues (Series
    // › GDP) — the dock-drill path is replayed in the focus-view, one navigable spine.
    const req = captured!
    if (req.source !== 'node-field') throw new Error('expected node-field escalation')
    const onChange = vi.fn()
    render(req.render({ value: [{ label: 'GDP', query: {} }], onChange }))
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(crumbs).getByText('Series')).toBeInTheDocument()
    expect(within(crumbs).getByText('GDP')).toBeInTheDocument()
    // The item's own fields are now authored here (the rich Query control is present).
    expect(screen.getByLabelText('Query')).toBeInTheDocument()
  })
})

describe('FF-OVERFLOW-DETERMINISTIC (II) — form-weight items still dock-drill (no regression)', () => {
  it('a FORM-weight item drills IN the dock — escalate never fires (D7.1b preserved)', () => {
    const escalate = vi.fn()
    render(
      <Harness field={arrayField(FORM_ITEM)} initial={[{ label: 'Alpha', value: 1 }]} host={{ escalate }} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit Alpha' }))
    expect(escalate).not.toHaveBeenCalled()
    // The in-dock drill happened: the breadcrumb + the item's fields render in place.
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument()
    expect(screen.getByLabelText('Value')).toBeInTheDocument()
  })

  it('FAIL-SOFT — with NO host, even a workspace item drills in-dock (graceful, no crash)', () => {
    render(
      <Harness field={arrayField(WORKSPACE_ITEM)} initial={[{ label: 'GDP', query: {} }]} host={null} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit GDP' }))
    // No escalation host → it degrades to the in-dock drill exactly as before.
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument()
    expect(screen.getByLabelText('Query')).toBeInTheDocument()
  })
})
