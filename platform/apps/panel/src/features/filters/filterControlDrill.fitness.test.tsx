// ── FF-FILTER-CONTROL-DRILL — the filter-bar control DRILL BRIDGE (AR-49 D7.3) ─
//
//  Red-on-regression gate for the node → filterSchema bridge:
//
//   1. RESOLVE — selecting a filter-bar node surfaces its filterSchema controls,
//      resolved from the node's `barIds` (absent ⇒ every bar) — the reach that was
//      missing (the node used to show only a raw `barIds` array).
//   2. DRILL — clicking a control drills into THAT specific control's editor (the
//      existing ParamDefEditor / generic Inspector) with a breadcrumb back.
//   3. WRITE-THROUGH TO SSOT — every edit lands in page.meta.filterSchema through
//      the SAME reducer the Page drawer uses; the node's `barIds` is NEVER written
//      and controls are NEVER copied onto the node (no denormalization).
//
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { FilterSchemaInput } from '@statdash/engine'
import { useConstructorStore } from '../../store/constructor.store'
import { FilterBarControlsBridge } from './FilterBarControlsBridge'
import type { CanvasNode, CanvasPage, PageMeta } from '../../types/constructor'

// ── Seeding ────────────────────────────────────────────────────────────────────

function seedSchema(filterSchema: FilterSchemaInput) {
  const page: CanvasPage = {
    id: 'p1', type: 'inner-page', title: { ka: 'გვ', en: 'Pg' }, slug: 'pg',
    nodeIds: [], nodes: {}, meta: { filterSchema } as PageMeta,
  }
  useConstructorStore.setState({ pages: [page], activePageId: 'p1' })
}

/** The live filterSchema in the store — the SSOT the bridge must write through. */
function liveSchema(): FilterSchemaInput {
  return useConstructorStore.getState().pages[0].meta!.filterSchema as FilterSchemaInput
}

/** A filter-bar node — the placeholder that references bars via `barIds`. */
function filterBarNode(barIds?: string[]): CanvasNode {
  return { id: 'fb', type: 'filter-bar', props: barIds ? { barIds } : {}, childIds: [] }
}

const ONE_BAR: FilterSchemaInput = {
  bars: {
    bar1: {
      position: 'sticky',
      filters: {
        region: { type: 'select', options: { type: 'static', items: [] }, default: '' },
      },
    },
  },
} as unknown as FilterSchemaInput

const TWO_BARS: FilterSchemaInput = {
  bars: {
    bar1: { position: 'sticky', filters: { region: { type: 'hidden', default: '' } } },
    bar2: { position: 'sticky', filters: { year:   { type: 'year-select', default: '' } } },
  },
} as unknown as FilterSchemaInput

beforeEach(() => {
  useConstructorStore.setState({ pages: [], activePageId: null, selection: null })
})

// ── 1. RESOLVE from barIds ──────────────────────────────────────────────────────
describe('FF-FILTER-CONTROL-DRILL — resolves controls from the node barIds', () => {
  it('names bars → shows ONLY those bars\' controls as drill rows', () => {
    seedSchema(TWO_BARS)
    render(<FilterBarControlsBridge node={filterBarNode(['bar1'])} locale="en" />)
    expect(screen.getByTestId('param-row-region')).toBeInTheDocument()
    expect(screen.queryByTestId('param-row-year')).toBeNull() // bar2 not referenced
  })

  it('barIds absent → resolves EVERY bar (mirrors the renderer default)', () => {
    seedSchema(TWO_BARS)
    render(<FilterBarControlsBridge node={filterBarNode()} locale="en" />)
    expect(screen.getByTestId('param-row-region')).toBeInTheDocument()
    expect(screen.getByTestId('param-row-year')).toBeInTheDocument()
  })

  it('controls are NOT expanded in the list (drill canon — collapsed summary rows)', () => {
    seedSchema(ONE_BAR)
    render(<FilterBarControlsBridge node={filterBarNode()} locale="en" />)
    // The per-control Inspector is NOT mounted until a row is drilled into.
    expect(screen.queryByTestId('inspector')).toBeNull()
  })
})

// ── 2. DRILL into a specific control ─────────────────────────────────────────────
describe('FF-FILTER-CONTROL-DRILL — drilling a control opens its editor', () => {
  it('clicking a row opens the ParamDefEditor + a breadcrumb back', () => {
    seedSchema(ONE_BAR)
    render(<FilterBarControlsBridge node={filterBarNode()} locale="en" />)

    fireEvent.click(screen.getByRole('button', { name: 'Configure region' }))

    // The specific control's editor (generic Inspector) is now mounted…
    expect(screen.getByTestId('inspector')).toBeInTheDocument()
    // …with a breadcrumb whose root navigates back to the list.
    const back = screen.getByRole('button', { name: 'Filter Bar' })
    fireEvent.click(back)
    expect(screen.queryByTestId('inspector')).toBeNull()
    expect(screen.getByTestId('param-row-region')).toBeInTheDocument()
  })
})

// ── 3. WRITE-THROUGH to the filterSchema SSOT (no denormalization) ──────────────
describe('FF-FILTER-CONTROL-DRILL — edits write through to page.meta.filterSchema', () => {
  it('editing a drilled control lands in the filterSchema SSOT', () => {
    // A `hidden` control's `default` is a free-text scalar (a `select` default is a
    // cube-bound picker with no options absent a profile) — so the edit is testable.
    seedSchema({
      bars: { bar1: { position: 'sticky', filters: {
        mode: { type: 'hidden', default: '' },
      } } },
    } as unknown as FilterSchemaInput)
    render(<FilterBarControlsBridge node={filterBarNode()} locale="en" />)
    fireEvent.click(screen.getByRole('button', { name: 'Configure mode' }))

    const input = document.getElementById('insp-default') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'range' } })

    const def = liveSchema().bars.bar1.filters.mode as { default?: string }
    expect(def.default).toBe('range')
  })

  it('the node is NEVER written — controls stay in the filterSchema, not on barIds', () => {
    seedSchema(ONE_BAR)
    const node = filterBarNode(['bar1'])
    render(<FilterBarControlsBridge node={node} locale="en" />)
    fireEvent.click(screen.getByRole('button', { name: 'Configure region' }))
    fireEvent.change(document.getElementById('insp-default') as HTMLElement, { target: { value: 'GE' } })

    // No denormalization: the node prop is untouched, no `filters`/`bars` copied on.
    expect(node.props).toEqual({ barIds: ['bar1'] })
    // The store's node record (if any) carries no control copy either — the SSOT is
    // the filterSchema, asserted above.
    expect((node.props as Record<string, unknown>).filters).toBeUndefined()
  })

  it('reorder writes through: bar filter insertion order flips', () => {
    seedSchema({
      bars: { bar1: { position: 'sticky', filters: {
        a: { type: 'hidden', default: '' }, b: { type: 'hidden', default: '' },
      } } },
    } as unknown as FilterSchemaInput)
    render(<FilterBarControlsBridge node={filterBarNode()} locale="en" />)

    const rowA = screen.getByTestId('param-row-a')
    fireEvent.click(within(rowA).getByRole('button', { name: 'Move down: a' }))

    expect(Object.keys(liveSchema().bars.bar1.filters)).toEqual(['b', 'a'])
  })

  it('remove writes through: the control leaves the filterSchema', () => {
    seedSchema(ONE_BAR)
    render(<FilterBarControlsBridge node={filterBarNode()} locale="en" />)
    const row = screen.getByTestId('param-row-region')
    fireEvent.click(within(row).getByRole('button', { name: 'Remove control: region' }))
    expect(liveSchema().bars.bar1.filters.region).toBeUndefined()
  })

  it('OTHER bars + advanced top-level keys survive an edit verbatim (additive)', () => {
    seedSchema({
      bars: {
        bar1: { position: 'sticky', filters: { region: { type: 'hidden', default: '' } } },
        bar2: { position: 'sticky', filters: { year: { type: 'year-select', default: '' } } },
      },
      crossValidate: [{ marker: true }],
    } as unknown as FilterSchemaInput)
    render(<FilterBarControlsBridge node={filterBarNode(['bar1'])} locale="en" />)
    const row = screen.getByTestId('param-row-region')
    fireEvent.click(within(row).getByRole('button', { name: 'Remove control: region' }))

    const s = liveSchema() as FilterSchemaInput & { crossValidate?: unknown[] }
    expect(s.bars.bar2.filters.year).toBeDefined()          // untouched bar preserved
    expect(s.crossValidate).toEqual([{ marker: true }])     // advanced key verbatim
  })
})
