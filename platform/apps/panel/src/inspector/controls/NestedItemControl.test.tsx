// ── FF-NESTED-ITEM-EDITOR — the recursive nested-item DRILL-IN editor (D7.1b) ─
//
//  Proves the contextual-relevance canon for nested authoring:
//    • An array renders as a LIST of SUMMARY ROWS — NO item's fields are shown.
//    • At any instant AT MOST ONE item's field-editor is rendered (the active
//      drill target). Clicking a row drills in; only that item's fields appear.
//    • A BREADCRUMB reflects the drill path; a crumb navigates back to that level.
//    • add creates + drills into a new item; remove/reorder operate from the list.
//    • Recursion: a nested array/object sub-field is a DRILL ROW (not expanded);
//      drilling it pushes another crumb, arbitrary depth, collision-free ids.
//    • Writes are immutable nested writes (`items.N.field`), siblings stable.
//    • A field WITHOUT itemSchema still resolves to JsonControl (graceful fallback).
//
import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { PropField } from '@statdash/react/engine'
import { ArrayOfControl, ObjectControl } from './NestedItemControl'
import { fieldControlRegistry } from '../FieldControlRegistry'

// Two-field item schema: a string `label` (also the list title) + numeric `value`.
const ITEM_SCHEMA: PropField[] = [
  { field: 'label', type: 'string', label: 'Label' },
  { field: 'value', type: 'number', label: 'Value' },
]

const arrayField = (over: Partial<PropField> = {}): PropField => ({
  field: 'items', type: 'array', label: 'KPI metrics',
  itemSchema: ITEM_SCHEMA, itemLabel: 'label', ...over,
})

/** Controlled harness — mirrors how the Inspector owns the value store. */
function ArrayHarness({
  field, initial, onEmit,
}: { field: PropField; initial: unknown[]; onEmit?: (v: unknown[]) => void }) {
  const [val, setVal] = useState<unknown[]>(initial)
  return (
    <ArrayOfControl
      field={field}
      id="insp-items"
      value={val}
      locales={['ka', 'en']}
      locale="en"
      onChange={(next) => { onEmit?.(next as unknown[]); setVal(next as unknown[]) }}
    />
  )
}

describe('FF-NESTED-ITEM-EDITOR — array is a LIST of summary rows (no fields expanded)', () => {
  it('shows only row titles + actions — NO item field editor until drilled in', () => {
    const { container } = render(
      <ArrayHarness field={arrayField()} initial={[{ label: 'Alpha', value: 1 }, { label: 'Beta', value: 2 }]} />,
    )
    // Both row titles are present…
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    // …but NO item's fields are rendered (the D7.1b canon: at most one — here zero — editor).
    expect(container.querySelector('#insp-items-0-label')).not.toBeInTheDocument()
    expect(container.querySelector('#insp-items-1-label')).not.toBeInTheDocument()
    // No raw-JSON blob either.
    expect(container.querySelector('.insp-field__json')).not.toBeInTheDocument()
  })

  it('drilling into ONE row shows ONLY that item\'s fields + a breadcrumb back', () => {
    const { container } = render(
      <ArrayHarness field={arrayField()} initial={[{ label: 'Alpha', value: 1 }, { label: 'Beta', value: 2 }]} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit Alpha' }))
    // Active item's structured fields appear, namespaced by its drill path.
    expect(container.querySelector('#insp-items-0-label')).toBeInTheDocument()
    expect(container.querySelector('#insp-items-0-value')).toBeInTheDocument()
    // The OTHER item's editor is NOT rendered (only the active one's everything shows).
    expect(container.querySelector('#insp-items-1-label')).not.toBeInTheDocument()
    // Breadcrumb reflects the path: root field label › active item title.
    const crumbs = within(screen.getByRole('navigation', { name: 'Breadcrumb' }))
    expect(crumbs.getByRole('button', { name: 'KPI metrics' })).toBeInTheDocument()
    expect(crumbs.getByText('Alpha')).toBeInTheDocument()
  })

  it('the breadcrumb crumb navigates back to the list level', () => {
    const { container } = render(
      <ArrayHarness field={arrayField()} initial={[{ label: 'Alpha', value: 1 }]} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit Alpha' }))
    expect(container.querySelector('#insp-items-0-label')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'KPI metrics' }))
    // Back at the list — the item editor is gone, the row remains.
    expect(container.querySelector('#insp-items-0-label')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit Alpha' })).toBeInTheDocument()
  })
})

describe('FF-NESTED-ITEM-EDITOR — add / remove / reorder from the list', () => {
  it('add appends a new item (immutable — prior items preserved) and drills into it', () => {
    const emit = vi.fn()
    const { container } = render(
      <ArrayHarness field={arrayField()} initial={[{ label: 'Alpha', value: 1 }]} onEmit={emit} />,
    )
    fireEvent.click(screen.getByText('+ Add item'))
    const next = emit.mock.calls[0][0] as unknown[]
    expect(next).toHaveLength(2)
    expect(next[0]).toEqual({ label: 'Alpha', value: 1 })
    // Add drills straight into the new (2nd) item — its editor is now active.
    expect(container.querySelector('#insp-items-1-label')).toBeInTheDocument()
  })

  it('editing a drilled item sub-field writes items.N.field immutably (siblings stable)', () => {
    const emit = vi.fn()
    const a = { label: 'Alpha', value: 1 }
    const b = { label: 'Beta', value: 2 }
    const { container } = render(<ArrayHarness field={arrayField()} initial={[a, b]} onEmit={emit} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Alpha' }))
    const input = container.querySelector<HTMLInputElement>('#insp-items-0-label')!
    fireEvent.change(input, { target: { value: 'GDP' } })
    const nextArr = emit.mock.calls.at(-1)![0] as Array<Record<string, unknown>>
    expect(nextArr[0]).toEqual({ label: 'GDP', value: 1 })
    // Untouched sibling item stays referentially identical (setAtPath structural sharing).
    expect(nextArr[1]).toBe(b)
  })

  it('remove drops the item (immutable filter) from the list', () => {
    const emit = vi.fn()
    render(<ArrayHarness field={arrayField()} initial={[{ label: 'Alpha', value: 1 }, { label: 'Beta', value: 2 }]} onEmit={emit} />)
    fireEvent.click(screen.getByLabelText('Remove Alpha'))
    const next = emit.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(next).toHaveLength(1)
    expect(next[0]).toEqual({ label: 'Beta', value: 2 })
  })

  it('reorder (move down) swaps adjacent items', () => {
    const emit = vi.fn()
    render(<ArrayHarness field={arrayField()} initial={[{ label: 'Alpha', value: 1 }, { label: 'Beta', value: 2 }]} onEmit={emit} />)
    fireEvent.click(screen.getByLabelText('Move Alpha down'))
    const next = emit.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(next.map((i) => i.label)).toEqual(['Beta', 'Alpha'])
  })

  it('move-up disabled on first, move-down disabled on last (bounds)', () => {
    render(<ArrayHarness field={arrayField()} initial={[{ label: 'Alpha' }, { label: 'Beta' }]} />)
    expect(screen.getByLabelText('Move Alpha up')).toBeDisabled()
    expect(screen.getByLabelText('Move Beta down')).toBeDisabled()
  })

  it('empty array renders an empty-state + an enabled add affordance', () => {
    render(<ArrayHarness field={arrayField()} initial={[]} />)
    expect(screen.getByText('No items yet.')).toBeInTheDocument()
    expect(screen.getByText('+ Add item')).toBeEnabled()
  })

  it('falls back to "Item N" when no itemLabel resolves', () => {
    render(<ArrayHarness field={arrayField({ itemLabel: undefined })} initial={[{ label: 'Alpha' }]} />)
    expect(screen.getByText('Item 1')).toBeInTheDocument()
  })
})

describe('FF-NESTED-ITEM-EDITOR — graceful fallback (no itemSchema)', () => {
  it('an array field WITHOUT itemSchema resolves to a SummaryCard (never raw JSON)', () => {
    const field: PropField = { field: 'blob', type: 'array', label: 'Blob' }
    const Control = fieldControlRegistry.resolve(field)
    const { container } = render(
      <Control field={field} id="insp-blob" value={[1, 2]} locales={['en']} locale="en" onChange={() => {}} />,
    )
    // The new opaque default (§3.1, FF-NO-RAW-JSON-DEFAULT) — a constant-weight
    // glance card, NOT a raw-JSON <textarea> and not a structured drill list.
    expect(container.querySelector('.summary-card')).toBeInTheDocument()
    expect(container.querySelector('.insp-field__json')).not.toBeInTheDocument()
    expect(container.querySelector('.insp-nested')).not.toBeInTheDocument()
  })
})

describe('FF-NESTED-ITEM-EDITOR — ObjectControl (root object)', () => {
  it('renders the object\'s own fields and writes sub-fields immutably', () => {
    const emit = vi.fn()
    const field: PropField = {
      field: 'axis', type: 'object', label: 'Axis',
      itemSchema: [{ field: 'title', type: 'string', label: 'Title' }],
    }
    function ObjHarness() {
      const [val, setVal] = useState<Record<string, unknown>>({ title: 'x' })
      return (
        <ObjectControl
          field={field} id="insp-axis" value={val} locales={['en']} locale="en"
          onChange={(next) => { emit(next); setVal(next as Record<string, unknown>) }}
        />
      )
    }
    const { container } = render(<ObjHarness />)
    // A root object shows its everything (single object) — its fields render inline.
    const input = container.querySelector<HTMLInputElement>('#insp-axis-title')!
    expect(input).toBeInTheDocument()
    fireEvent.change(input, { target: { value: 'Year' } })
    expect(emit).toHaveBeenCalledWith({ title: 'Year' })
  })
})

describe('FF-NESTED-ITEM-EDITOR — recursion (drill all the way in, unified breadcrumb)', () => {
  // KPI-item-like schema: a scalar name + a nested `value` OBJECT + a nested
  // `axes` ARRAY. Both nested containers are drill targets, not inline forms.
  const field: PropField = {
    field: 'items', type: 'array', label: 'Charts', itemLabel: 'name',
    itemSchema: [
      { field: 'name', type: 'string', label: 'Name' },
      {
        field: 'value', type: 'object', label: 'Value', itemLabel: 'unit',
        itemSchema: [{ field: 'unit', type: 'string', label: 'Unit' }],
      },
      {
        field: 'axes', type: 'array', label: 'Axes', itemLabel: 'title',
        itemSchema: [{ field: 'title', type: 'string', label: 'Title' }],
      },
    ],
  }

  it('nested array/object sub-fields are DRILL ROWS (not expanded) inside the item', () => {
    const { container } = render(
      <ArrayHarness field={field} initial={[{ name: 'Bar', value: { unit: '%' }, axes: [{ title: 'x' }] }]} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit Bar' }))
    // The item's scalar field is inline.
    expect(container.querySelector('#insp-items-0-name')).toBeInTheDocument()
    // The nested containers are DRILL ROWS — their inner fields are NOT rendered yet.
    expect(screen.getByRole('button', { name: 'Edit Value' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit Axes' })).toBeInTheDocument()
    expect(container.querySelector('#insp-items-0-value-unit')).not.toBeInTheDocument()
    expect(container.querySelector('#insp-items-0-axes-0-title')).not.toBeInTheDocument()
  })

  it('drilling a nested OBJECT sub-field pushes a crumb and shows only that level', () => {
    const { container } = render(
      <ArrayHarness field={field} initial={[{ name: 'Bar', value: { unit: '%' }, axes: [] }]} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit Bar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit Value' }))
    // Now the value object's own field is the active editor…
    const unit = container.querySelector<HTMLInputElement>('#insp-items-0-value-unit')
    expect(unit).toBeInTheDocument()
    expect(unit!.value).toBe('%')
    // …and the item's scalar field is no longer rendered (only the deepest level shows).
    expect(container.querySelector('#insp-items-0-name')).not.toBeInTheDocument()
    // Unified breadcrumb spans the whole path: Charts › Bar › Value.
    const crumbs = within(screen.getByRole('navigation', { name: 'Breadcrumb' }))
    expect(crumbs.getByRole('button', { name: 'Charts' })).toBeInTheDocument()
    expect(crumbs.getByRole('button', { name: 'Bar' })).toBeInTheDocument()
    expect(crumbs.getByText('Value')).toBeInTheDocument()
  })

  it('drilling a nested ARRAY → its item writes at the deep path with collision-free ids', () => {
    const emit = vi.fn()
    const { container } = render(
      <ArrayHarness field={field} initial={[{ name: 'Bar', value: {}, axes: [{ title: 'x' }] }]} onEmit={emit} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit Bar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit Axes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit x' }))
    const inner = container.querySelector<HTMLInputElement>('#insp-items-0-axes-0-title')!
    expect(inner).toBeInTheDocument()
    expect(inner.value).toBe('x')
    fireEvent.change(inner, { target: { value: 'Year' } })
    // Immutable deep write: items.0.axes.0.title, everything else preserved.
    const nextArr = emit.mock.calls.at(-1)![0] as Array<Record<string, unknown>>
    expect(nextArr[0].name).toBe('Bar')
    expect((nextArr[0].axes as Array<Record<string, unknown>>)[0]).toEqual({ title: 'Year' })
  })
})
