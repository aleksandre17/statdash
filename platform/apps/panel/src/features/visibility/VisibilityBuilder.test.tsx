// ── VisibilityBuilder / VisibilityLeafEditor — V4 condition-builder fitness ────
//
//  Proves the ADR V4 mechanism end-to-end:
//    (1) a leaf op's PropSchema renders through the SAME generic Inspector and a
//        scalar edit round-trips the leaf with its `op` discriminant preserved;
//    (2) the recursive builder composes / edits a nested and/or/not tree;
//    (3) an authored VisibilityExpr round-trips losslessly AND evalVisibility
//        agrees with the author's intent (the tree means what it shows).
//
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { evalVisibility, getVisibilityLeafSchema, modeRegistry } from '@statdash/engine'
import type { VisibilityExpr } from '@statdash/engine'
import { VisibilityLeafEditor, type VisibilityLeaf } from './VisibilityLeafEditor'
import { VisibilityBuilder } from './VisibilityBuilder'
import { makeVisibilityExpr } from './visibilityFactory'

// The `mode` leaf field is an enum-ref bound to the modeRegistry — register the
// built-in modes so the picker has options to select in the test environment.
beforeAll(() => {
  modeRegistry.register({ id: 'year',  label: 'Year' })
  modeRegistry.register({ id: 'range', label: 'Range' })
})

/** Pick an option in a MUI Select (not a native <select> — open, then click). */
function selectMuiOption(combobox: HTMLElement, optionName: string) {
  fireEvent.mouseDown(combobox)
  const listbox = within(screen.getByRole('listbox'))
  fireEvent.click(listbox.getByText(optionName))
}

describe('VisibilityLeafEditor — schema-driven leaf authoring (V4)', () => {
  it('renders a leaf PropSchema through the generic Inspector', () => {
    const leaf: VisibilityLeaf = { op: 'in', param: 'region', values: [] }
    render(<VisibilityLeafEditor path="root" leaf={leaf} onChange={() => {}} />)
    expect(screen.getByTestId('inspector')).toBeInTheDocument()
    // `in` declares `param` (enum-ref) + `values` (array) — their controls exist.
    expect(document.getElementById('insp-param')).not.toBeNull()
    expect(document.getElementById('insp-values')).not.toBeNull()
    expect(screen.queryByText(/No property schema/i)).toBeNull()
  })

  it('round-trips a scalar edit and preserves the op discriminant', () => {
    const onChange = vi.fn<(next: VisibilityLeaf) => void>()
    const leaf: VisibilityLeaf = { op: 'mode-is', mode: '' }
    render(<VisibilityLeafEditor path="root" leaf={leaf} onChange={onChange} />)

    const input = document.getElementById('insp-mode') as HTMLElement
    fireEvent.change(input, { target: { value: 'year' } })

    expect(onChange).toHaveBeenCalled()
    const next = onChange.mock.calls.at(-1)![0]
    expect(next).toMatchObject({ op: 'mode-is', mode: 'year' })
    expect(next.op).toBe('mode-is') // discriminant immutable through the editor
  })

  it('every leaf op carries a schema that renders a populated Inspector', () => {
    const LEAVES: VisibilityLeaf[] = [
      { op: 'eq',       param: 'r', is: null },
      { op: 'neq',      param: 'r', is: null },
      { op: 'in',       param: 'r', values: [] },
      { op: 'isset',    param: 'r' },
      { op: 'mode-is',  mode: '' },
      { op: 'mode-in',  modes: [] },
      { op: 'mode-not', mode: '' },
    ]
    for (const leaf of LEAVES) {
      expect(getVisibilityLeafSchema(leaf.op), `${leaf.op} should carry a schema`).toBeTruthy()
      const { unmount } = render(<VisibilityLeafEditor path="root" leaf={leaf} onChange={() => {}} />)
      expect(screen.getByTestId('inspector')).toBeInTheDocument()
      expect(screen.queryByText(/No property schema/i)).toBeNull()
      unmount()
    }
  })
})

describe('VisibilityBuilder — recursive condition tree (V4)', () => {
  it('renders a leaf node with an op picker', () => {
    const expr: VisibilityExpr = { op: 'isset', param: 'region' }
    render(<VisibilityBuilder path="root" expr={expr} onChange={() => {}} />)
    expect(screen.getByTestId('vis-node-root')).toBeInTheDocument()
    expect(screen.getByLabelText('condition type')).toBeInTheDocument()
  })

  it('adds a child condition into an and-group', () => {
    const onChange = vi.fn<(next: VisibilityExpr) => void>()
    const expr: VisibilityExpr = { op: 'and', exprs: [] }
    render(<VisibilityBuilder path="root" expr={expr} onChange={onChange} />)

    // "+ პირობა" appends a seeded leaf into the group's exprs[].
    fireEvent.click(screen.getByRole('button', { name: 'პირობა' }))
    const next = onChange.mock.calls.at(-1)![0]
    expect(next.op).toBe('and')
    expect((next as Extract<VisibilityExpr, { op: 'and' }>).exprs).toHaveLength(1)
  })

  it('flips an and-group to or while keeping its children (round-trip)', () => {
    const onChange = vi.fn<(next: VisibilityExpr) => void>()
    const child: VisibilityExpr = { op: 'isset', param: 'region' }
    const expr: VisibilityExpr = { op: 'and', exprs: [child] }
    render(<VisibilityBuilder path="root" expr={expr} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'any of' }))
    const next = onChange.mock.calls.at(-1)![0] as Extract<VisibilityExpr, { op: 'or' }>
    expect(next.op).toBe('or')
    expect(next.exprs).toEqual([child]) // children preserved verbatim
  })

  it('removes a child from a group', () => {
    const onChange = vi.fn<(next: VisibilityExpr) => void>()
    const expr: VisibilityExpr = {
      op: 'and',
      exprs: [{ op: 'isset', param: 'a' }, { op: 'isset', param: 'b' }],
    }
    render(<VisibilityBuilder path="root" expr={expr} onChange={onChange} />)

    // Remove the FIRST child (the first "remove condition" button).
    const removeButtons = screen.getAllByRole('button', { name: 'remove condition' })
    fireEvent.click(removeButtons[0])
    const next = onChange.mock.calls.at(-1)![0] as Extract<VisibilityExpr, { op: 'and' }>
    expect(next.exprs).toHaveLength(1)
    expect(next.exprs[0]).toMatchObject({ param: 'b' })
  })

  it('changing a node\'s op reseeds it to a valid shape of the new op', () => {
    const onChange = vi.fn<(next: VisibilityExpr) => void>()
    const expr: VisibilityExpr = { op: 'isset', param: 'region' }
    render(<VisibilityBuilder path="root" expr={expr} onChange={onChange} />)

    selectMuiOption(screen.getByLabelText('condition type'), 'ALL of (AND)')
    const next = onChange.mock.calls.at(-1)![0]
    expect(next).toEqual(makeVisibilityExpr('and'))
  })
})

describe('VisibilityExpr — lossless round-trip + evalVisibility agreement (V4)', () => {
  // The author builds "Show when [region = GE] AND [mode is year]". The tree the
  // builder produces must MEAN that — evalVisibility agrees with the intent.
  const tree: VisibilityExpr = {
    op: 'and',
    exprs: [
      { op: 'eq', param: 'region', is: 'GE' },
      { op: 'mode-is', mode: 'year' },
    ],
  }

  it('a built tree round-trips byte-identical through JSON (serializable, Law 2)', () => {
    expect(JSON.parse(JSON.stringify(tree))).toEqual(tree)
  })

  it('evalVisibility agrees: visible only when region=GE AND mode=year', () => {
    // P1 — the active perspective id is the perspectiveState SSOT (Record<param,id>),
    // not a positional string. A param-less mode-is op reads the conventional axis.
    expect(evalVisibility(tree, { region: 'GE' }, { mode: 'year' })).toBe(true)
    expect(evalVisibility(tree, { region: 'AM' }, { mode: 'year' })).toBe(false) // wrong region
    expect(evalVisibility(tree, { region: 'GE' }, { mode: 'range' })).toBe(false) // wrong mode
    expect(evalVisibility(tree, {}, { mode: 'year' })).toBe(false)                // region unset
  })

  it('a nested not/or tree evaluates correctly (recursive composition)', () => {
    // Show when NOT( region in [AM, AZ] )  →  hidden for AM/AZ, shown otherwise.
    const notIn: VisibilityExpr = {
      op: 'not',
      expr: { op: 'in', param: 'region', values: ['AM', 'AZ'] },
    }
    expect(evalVisibility(notIn, { region: 'GE' }, undefined)).toBe(true)
    expect(evalVisibility(notIn, { region: 'AM' }, undefined)).toBe(false)
  })
})
