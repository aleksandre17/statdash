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
import { nestAccepts, isDropTarget, resolveInsertPlan, pageRootInsertability } from './insertNode'
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
// SPEC S2: the honest page-root set — types the page directly accepts OR that land via
// the canonical auto-wrap. A homeless content block (blocked) is omitted, not shown.
const pageRootTypes = () =>
  getPaletteEntries()
    .map((e) => e.type)
    .filter((t) => pageRootInsertability('inner-page', t) !== 'blocked')
const buttonTypes = () =>
  screen.queryAllByRole('button').map((b) => b.getAttribute('data-node-type'))

describe('FF-PALETTE-CONTEXTUAL — the leaf/container discriminant (D-M4.1-A)', () => {
  it('isDropTarget: a container is a target, a leaf (even with empty slots) is not', () => {
    expect(isDropTarget('section')).toBe(true)      // canHaveChildren: true
    expect(isDropTarget('hero')).toBe(false)        // canHaveChildren: false (+ slots:{})
    expect(isDropTarget('filter-bar')).toBe(false)  // leaf — no children
    expect(isDropTarget(undefined)).toBe(true)      // page root — top-level target
  })

  it('nestAccepts honours the container CONTENT MODEL (capability grammar) and refuses every leaf', () => {
    // section admits any `flow` block, BY DECLARATION — not a hardcoded type list.
    expect(nestAccepts('section', 'chart')).toBe(true)         // flow content
    expect(nestAccepts('section', 'table')).toBe(true)         // flow content
    expect(nestAccepts('section', 'hero')).toBe(true)          // flow content (formerly homeless)
    expect(nestAccepts('section', 'filter-bar')).toBe(false)   // page structure — not flow
    expect(nestAccepts('section', 'page-header')).toBe(false)  // page structure — not flow
    // a leaf admits NOTHING (the silent-fail fix — was permissive before)
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
    // concretely: any `flow` block in (data/layout/content), page-structure + self out.
    expect(offered).toContain('chart')
    expect(offered).toContain('table')
    expect(offered).toContain('hero')          // flow content — now admitted (capability grammar)
    expect(offered).not.toContain('filter-bar')  // page structure — not flow
    expect(offered).not.toContain('page-header') // page structure — not flow
    expect(offered).not.toContain('section')     // section is not flow → not self-nestable
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

  it('(c) nothing selected → the HONEST page-root set (page-accepts ∪ wrap-reachable), not the whole registry', () => {
    render(<NodePalette selectedType={null} pageType="inner-page" />)
    const offered = buttonTypes().sort()
    // The blank-page palette offers exactly what can be placed at the page root —
    // directly (section/…) or via auto-wrap (chart/table/… into a section) — and OMITS
    // homeless content blocks that would bounce (the "blank page only section" fix).
    expect(offered).toEqual([...pageRootTypes()].sort())
    expect(offered).toContain('section')                 // direct
    expect(offered).toContain('chart')                   // wrap-reachable (page → section → chart)
    expect(offered).toContain('table')                   // wrap-reachable
    expect(offered).toContain('hero')                    // wrap-reachable (page → section → hero) — the fix
    expect(offered.length).toBeGreaterThan(1)            // never "only a section"
    // A block admitted by NEITHER the page root NOR a section (not `flow`, not page-structure)
    // is still honestly omitted — the grammar is a real filter, not "everything is placeable".
    expect(offered).not.toContain('featured-slider')
    // Every offered tile actually resolves to a valid placement (no bouncing tile).
    for (const t of offered) {
      expect(resolveInsertPlan(page, null, t!).kind, `tile ${t} is not placeable at page root`)
        .not.toBe('blocked')
    }
  })

  it('(c2) absent pageType → permissive page root (isolated-mount back-compat: whole registry)', () => {
    render(<NodePalette selectedType={null} />)
    expect(buttonTypes().sort()).toEqual([...droppableTypes()].sort())
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
