// ── FF-NESTED-ITEM-EDITOR — the generic recursive nested-item editor (D7.1) ──
//
//  Proves: a field WITH itemSchema renders the structured list/object editor
//  (not raw JSON); add / remove / reorder produce correct IMMUTABLE nested writes
//  (`items.N.field`, siblings referentially stable); a field WITHOUT itemSchema
//  still resolves to JsonControl (graceful fallback); a doubly-nested itemSchema
//  renders recursively with collision-free ids.
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
  field: 'items', type: 'array', label: 'Items',
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

describe('FF-NESTED-ITEM-EDITOR — ArrayOfControl', () => {
  it('renders a STRUCTURED list (not raw JSON) with per-item structured controls', () => {
    const { container } = render(
      <ArrayHarness field={arrayField()} initial={[{ label: 'Alpha', value: 1 }]} />,
    )
    // Structured: the item body carries the itemSchema's own labelled controls,
    // addressed by collision-free namespaced ids — NOT a raw-JSON textarea.
    expect(container.querySelector('#insp-items-item-0-label')).toBeInTheDocument()
    expect(container.querySelector('#insp-items-item-0-value')).toBeInTheDocument()
    expect(container.querySelector('.insp-field__json')).not.toBeInTheDocument()
    // itemLabel drives the row title.
    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })

  it('add appends a new item (immutable — new array, prior items preserved)', () => {
    const emit = vi.fn()
    render(<ArrayHarness field={arrayField()} initial={[{ label: 'Alpha', value: 1 }]} onEmit={emit} />)
    fireEvent.click(screen.getByText('+ Add item'))
    const next = emit.mock.calls[0][0] as unknown[]
    expect(next).toHaveLength(2)
    expect(next[0]).toEqual({ label: 'Alpha', value: 1 })
  })

  it('editing an item sub-field writes items.N.field immutably (siblings stable)', () => {
    const emit = vi.fn()
    const a = { label: 'Alpha', value: 1 }
    const b = { label: 'Beta', value: 2 }
    const { container } = render(<ArrayHarness field={arrayField()} initial={[a, b]} onEmit={emit} />)
    const input = container.querySelector<HTMLInputElement>('#insp-items-item-0-label')!
    fireEvent.change(input, { target: { value: 'GDP' } })
    const next = emit.mock.calls.at(-1)![0] as Array<Record<string, unknown>>
    expect(next[0]).toEqual({ label: 'GDP', value: 1 })
    // Untouched sibling item stays referentially identical (setAtPath structural sharing).
    expect(next[1]).toBe(b)
  })

  it('remove drops the item (immutable filter)', () => {
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
  it('an array field WITHOUT itemSchema resolves to + renders the raw-JSON control', () => {
    const field: PropField = { field: 'blob', type: 'array', label: 'Blob' }
    const Control = fieldControlRegistry.resolve(field)
    const { container } = render(
      <Control field={field} id="insp-blob" value={[1, 2]} locales={['en']} locale="en" onChange={() => {}} />,
    )
    // The documented opaque default — a raw-JSON <textarea>, no structured list.
    expect(container.querySelector('.insp-field__json')).toBeInTheDocument()
    expect(container.querySelector('.insp-nested')).not.toBeInTheDocument()
  })
})

describe('FF-NESTED-ITEM-EDITOR — ObjectControl', () => {
  it('renders the itemSchema fields for the object value and writes sub-fields immutably', () => {
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
    const input = container.querySelector<HTMLInputElement>('#insp-axis-obj-title')!
    expect(input).toBeInTheDocument()
    fireEvent.change(input, { target: { value: 'Year' } })
    expect(emit).toHaveBeenCalledWith({ title: 'Year' })
  })
})

describe('FF-NESTED-ITEM-EDITOR — recursion (itemSchema within itemSchema)', () => {
  it('a doubly-nested itemSchema renders a nested list with collision-free ids', () => {
    const field: PropField = {
      field: 'charts', type: 'array', label: 'Charts', itemLabel: 'name',
      itemSchema: [
        { field: 'name', type: 'string', label: 'Name' },
        {
          field: 'axes', type: 'array', label: 'Axes', itemLabel: 'title',
          itemSchema: [{ field: 'title', type: 'string', label: 'Title' }],
        },
      ],
    }
    const { container } = render(
      <ArrayHarness field={field} initial={[{ name: 'Bar', axes: [{ title: 'x' }] }]} />,
    )
    // Outer item's own field.
    expect(container.querySelector('#insp-items-item-0-name')).toBeInTheDocument()
    // Inner (recursed) list's field — a distinct, namespaced id proves depth + no collision.
    const innerInput = container.querySelector<HTMLInputElement>('#insp-items-item-0-axes-item-0-title')
    expect(innerInput).toBeInTheDocument()
    expect(innerInput!.value).toBe('x')
    // The inner list is itself a structured nested editor, not raw JSON.
    const inner = container.querySelector('#insp-items-item-0-axes-title')
    expect(inner).not.toBeInTheDocument() // the inner value lives under its own item namespace
    expect(within(container).getAllByText('+ Add item').length).toBeGreaterThan(1) // outer + inner add
  })
})
