// ── FF-EMPTY-CONTAINER-NEST-TARGET — an empty container accepts a first child (0102 R1) ─
//
//  The owner's PRIMARY blocker ("I can't even start assembling a site with layout
//  elements"): a dropped GRID rendered 0px and, on a MOVE, the resolver REFUSED an empty
//  container as a nest-target (the retired `childIds.length > 0` guard) — a dragged element
//  became a SIBLING, never the container's CHILD. This gate pins the fix: moving a node ONTO
//  an empty, accepting container nests it as a CHILD (`reparent` into the container), while
//  the deterministic target-based disambiguation is preserved —
//    • drop ON a container (empty OR populated) → nest as child;
//    • drop ON a leaf sibling               → sibling reorder within its container.
//  Registry-driven (`nestAccepts`), agnostic over every container kind.
//
import { describe, it, expect, beforeAll } from 'vitest'
import { setupCanvasRegistry } from './setupCanvasRegistry'
import { resolvePlacementPlan } from './insertNode'
import type { CanvasPage } from '../types/constructor'

beforeAll(() => { setupCanvasRegistry() })

// A page holding an EMPTY grid, an EMPTY section, and a leaf chart at the top level — all
// three legal top-level children of the inner-page frame, so the fixture is a valid tree.
function basePage(): CanvasPage {
  return {
    id: 'p1', type: 'inner-page', title: { ka: 'გ', en: 'P' }, slug: 'p',
    nodeIds: ['g', 'sec', 'cht'],
    nodes: {
      g:   { id: 'g',   type: 'grid',    props: {}, childIds: [] },      // empty container
      sec: { id: 'sec', type: 'section', props: {}, childIds: [] },      // empty container
      cht: { id: 'cht', type: 'chart',   props: {}, childIds: [] },      // leaf (sibling)
    },
  }
}

describe('FF-EMPTY-CONTAINER-NEST-TARGET — an empty container is a first-class nest-target', () => {
  it('MOVE onto an empty grid nests the source as its CHILD (not a sibling)', () => {
    const page = basePage()
    // Drag the chart (source) onto the empty grid (target). It must land INSIDE the grid.
    const plan = resolvePlacementPlan(page, 'cht', 'g', 'chart')
    expect(plan).toEqual({ kind: 'reparent', parentId: 'g', index: 0 })
  })

  it('MOVE onto an empty section nests the source as its CHILD too (kind-agnostic)', () => {
    const page = basePage()
    const plan = resolvePlacementPlan(page, 'cht', 'sec', 'chart')
    expect(plan).toEqual({ kind: 'reparent', parentId: 'sec', index: 0 })
  })

  it('the disambiguation is deterministic: dropping on a LEAF sibling reorders, never nests', () => {
    const page = basePage()
    // Move the empty grid to sit by the leaf chart: chart is not a container → sibling
    // reorder within the page root, NOT a nest into the leaf.
    const plan = resolvePlacementPlan(page, 'g', 'cht', 'grid')
    expect(plan.kind === 'reorder' || plan.kind === 'reparent').toBe(true)
    expect(plan).toMatchObject({ parentId: 'p1' })   // the shared container, not the leaf
  })

  it('a POPULATED container is still a nest-target (no regression from the empty change)', () => {
    const page = basePage()
    page.nodes.g.childIds = ['cht']            // grid now holds the chart
    page.nodes.cht = { id: 'cht', type: 'chart', props: {}, childIds: [] }
    const plan = resolvePlacementPlan(page, 'sec', 'g', 'section')
    expect(plan).toEqual({ kind: 'reparent', parentId: 'g', index: 0 })
  })
})
