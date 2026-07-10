// ── FF-PALETTE-CONTEXTUAL — the palette offers exactly the compatible children ──
//
//  AR-49 M4.1 Thread A. With a CONTAINER selected the Insert palette narrows to the
//  schema-compatible child set (the selected slice's `slots.accepts` + the
//  `canHaveChildren` leaf gate); with a LEAF selected it offers NO node tile and a
//  guided hint; with NOTHING selected it shows the full frame-level set. The
//  invariant is a strict superset of today (FF-NO-WORKFLOW-GATE): the palette
//  NARROWS, it never BLOCKS — a legal insert stays reachable by selecting a
//  compatible container or clearing the selection. And every offered tile ACTUALLY
//  nests where shown (no `resolveInsertParent` silent redirect).
//
import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { setupCanvasRegistry } from './setupCanvasRegistry'
import { NodePalette }         from './NodePalette'
import { getPaletteEntries }   from './paletteEntries'
import { nestAccepts, isDropTarget, resolveInsertPlan } from './insertNode'
import type { CanvasPage } from '../types/constructor'

beforeAll(() => { setupCanvasRegistry() })

// A page with one container (section) + one leaf (hero), each selectable.
const page: CanvasPage = {
  id: 'p1', type: 'inner-page', title: { ka: 'გ', en: 'P' }, slug: 'p',
  nodeIds: ['sec', 'her'],
  nodes: {
    sec: { id: 'sec', type: 'section',   props: {}, childIds: [] },
    her: { id: 'her', type: 'hero',      props: {}, childIds: [] },
  },
}

const droppableTypes = () => getPaletteEntries().map((e) => e.type)
const buttonTypes = () =>
  screen.queryAllByRole('button').map((b) => b.getAttribute('data-node-type'))

describe('FF-PALETTE-CONTEXTUAL — the leaf/container discriminant (D-M4.1-A)', () => {
  it('isDropTarget: a container is a target, a leaf (even with empty slots) is not', () => {
    expect(isDropTarget('section')).toBe(true)      // canHaveChildren: true
    expect(isDropTarget('hero')).toBe(false)        // canHaveChildren: false (+ slots:{})
    expect(isDropTarget('filter-bar')).toBe(false)  // leaf — no children
    expect(isDropTarget(undefined)).toBe(true)      // page root — top-level target
  })

  it('nestAccepts honours the container accept-set and refuses every leaf', () => {
    // section declares accepts: chart/table/kpi-strip/columns/grid/wrap/geograph
    expect(nestAccepts('section', 'chart')).toBe(true)
    expect(nestAccepts('section', 'table')).toBe(true)
    expect(nestAccepts('section', 'hero')).toBe(false)      // not in section's accepts
    expect(nestAccepts('section', 'filter-bar')).toBe(false)
    // a leaf accepts NOTHING (the silent-fail fix — was permissive before)
    expect(nestAccepts('hero', 'chart')).toBe(false)
    expect(nestAccepts('filter-bar', 'chart')).toBe(false)
  })
})

describe('FF-PALETTE-CONTEXTUAL — the palette projection', () => {
  it('(a) container selected → offers ONLY the accept-set, no incompatible tile', () => {
    render(<NodePalette selectedType="section" />)
    const offered = buttonTypes()
    expect(offered.length).toBeGreaterThan(0)
    for (const t of offered) {
      expect(nestAccepts('section', t!), `offered incompatible tile: ${t}`).toBe(true)
    }
    // concretely: data/layout children in, leaves + self out.
    expect(offered).toContain('chart')
    expect(offered).toContain('table')
    expect(offered).not.toContain('hero')
    expect(offered).not.toContain('filter-bar')
    expect(offered).not.toContain('section')
  })

  it('(b) every offered tile actually nests into the selection (no silent redirect)', () => {
    render(<NodePalette selectedType="section" />)
    for (const t of buttonTypes()) {
      // A container is selected and the tile is offered ⇒ the plan is a DIRECT nest
      // into that container (never a redirect to page-top, never an auto-wrap).
      expect(resolveInsertPlan(page, 'sec', t!), `tile ${t} did not nest into the selection`)
        .toEqual({ kind: 'direct', parentId: 'sec' })
    }
  })

  it('(c) nothing selected → the full frame-level set (today’s behaviour, unchanged)', () => {
    render(<NodePalette selectedType={null} />)
    const offered = buttonTypes().sort()
    expect(offered).toEqual([...droppableTypes()].sort())
  })

  it('(d) leaf selected → NO node tile + the guided Inspector hint (guidance, not a block)', () => {
    render(<NodePalette selectedType="filter-bar" />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByTestId('node-palette-leaf-hint')).toBeInTheDocument()
  })

  it('FF-NO-WORKFLOW-GATE — a leaf never blocks: clearing the selection restores the full set', () => {
    const { rerender } = render(<NodePalette selectedType="hero" />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)   // leaf → hint only
    rerender(<NodePalette selectedType={null} />)
    expect(screen.queryAllByRole('button').length).toBe(droppableTypes().length)
  })
})
