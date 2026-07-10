// ── FF-INSERT-NEVER-CLIFF — every offered type always resolves to a valid insert ─
//
//  AR-49 M4.1 (auto-wrap insert ergonomics). The canonical document-editor rule
//  (Notion/Gutenberg "insert anything; the tool builds the structure"): every
//  palette-offered type, in EVERY selection context, resolves to a VALID insert —
//    • direct nest into a selected container that accepts it, OR
//    • direct top-level insert when the page frame accepts it, OR
//    • auto-wrap into the canonical container (page → section → type), OR
//    • an explicit guided hint (blocked) when no single unambiguous wrapper fits.
//  NEVER a hidden no-op and NEVER an invalid tree (a type nested in a parent that
//  rejects it). This guard bites the old cliff where a page-level insert of a
//  non-accepted type was silently redirected to page-top, producing an invalid tree.
//
import { describe, it, expect, beforeAll } from 'vitest'
import { setupCanvasRegistry } from './setupCanvasRegistry'
import { getPaletteEntries } from './paletteEntries'
import {
  resolveInsertPlan, planInserts, nestAccepts,
  PAGE_ROOT_TYPE, AUTOWRAP_CONTAINER,
} from './insertNode'
import { insertNodesPatch } from '../store/constructor.pages'
import type { CanvasPage } from '../types/constructor'

beforeAll(() => { setupCanvasRegistry() })

// A page with a container (section) and a leaf (filter-bar) selectable at top level.
// Both are types the inner-page frame legally accepts, so the fixture itself is a
// valid tree (a hero would NOT be — the frame rejects it — which is exactly why
// hero is a 'blocked' insert below).
function basePage(): CanvasPage {
  return {
    id: 'p1', title: { ka: 'გ', en: 'P' }, slug: 'p',
    nodeIds: ['sec', 'fb'],
    nodes: {
      sec: { id: 'sec', type: 'section',    props: {}, childIds: [] },
      fb:  { id: 'fb',  type: 'filter-bar', props: {}, childIds: [] },
    },
  }
}
const state = (page: CanvasPage) => ({ pages: [page], activePageId: page.id })
const ids = () => { let n = 0; return () => `n-${n++}` }

// The type of a container id within a page (page root id → PAGE_ROOT_TYPE frame).
function parentTypeOf(page: CanvasPage, parentId: string): string {
  return parentId === page.id ? PAGE_ROOT_TYPE : page.nodes[parentId].type
}

// Assert a produced page-config is a legal tree: every node sits in a parent that
// accepts it (registry accept contract), recursively.
function assertLegalTree(page: CanvasPage): void {
  const check = (parentType: string, childIds: string[]) => {
    for (const id of childIds) {
      const child = page.nodes[id]
      expect(
        nestAccepts(parentType, child.type),
        `illegal nest: "${child.type}" under "${parentType}"`,
      ).toBe(true)
      check(child.type, child.childIds)
    }
  }
  check(PAGE_ROOT_TYPE, page.nodeIds)
}

const droppable = () => getPaletteEntries().map((e) => e.type)

describe('FF-INSERT-NEVER-CLIFF — the plan is always valid or an explicit hint', () => {
  const SELECTIONS: Array<[string, string | null]> = [
    ['nothing selected (page/frame)', null],
    ['a container selected (section)',    'sec'],
    ['a leaf selected (filter-bar)',      'fb'],
  ]

  for (const [label, selectedId] of SELECTIONS) {
    it(`${label}: every offered type resolves to a valid plan (never invalid, never hidden no-op)`, () => {
      for (const type of droppable()) {
        const page = basePage()
        const plan = resolveInsertPlan(page, selectedId, type)

        if (plan.kind === 'direct') {
          // The chosen parent must legally accept the type.
          expect(
            nestAccepts(parentTypeOf(page, plan.parentId), type),
            `direct plan for "${type}" targets a parent that rejects it`,
          ).toBe(true)
        } else if (plan.kind === 'wrap') {
          // Both hops must be registry-legal (page → wrapper → type).
          expect(nestAccepts(parentTypeOf(page, plan.parentId), plan.wrapperType)).toBe(true)
          expect(nestAccepts(plan.wrapperType, type)).toBe(true)
        } else {
          // Blocked is an ALLOWED terminal state — a guided hint, not a no-op.
          expect(plan.kind).toBe('blocked')
        }

        // Compiling + applying a non-blocked plan yields a legal tree; a blocked
        // plan yields NO ops (the caller surfaces the hint) — never a partial/invalid write.
        const ops = planInserts(plan, type, ids())
        if (plan.kind === 'blocked') {
          expect(ops).toHaveLength(0)
        } else {
          expect(ops.length).toBeGreaterThan(0)
          const patched = insertNodesPatch(state(page), 'p1', ops)
          assertLegalTree(patched.pages![0] as CanvasPage)
        }
      }
    })
  }

  it('the canonical page-level auto-wrap is page → section → type for a data panel', () => {
    const page = basePage()
    const plan = resolveInsertPlan(page, null, 'chart')
    expect(plan).toEqual({ kind: 'wrap', wrapperType: AUTOWRAP_CONTAINER, parentId: 'p1' })
  })

  it('a directly page-acceptable type is a flat top-level insert (no needless wrap)', () => {
    const page = basePage()
    expect(resolveInsertPlan(page, null, 'section')).toEqual({ kind: 'direct', parentId: 'p1' })
  })

  it('a selected container that accepts the type nests directly (Wave-1 contextual, preserved)', () => {
    const page = basePage()
    expect(resolveInsertPlan(page, 'sec', 'chart')).toEqual({ kind: 'direct', parentId: 'sec' })
  })

  it('a blocked type (no single wrapper) exists and is surfaced as a hint, not a silent drop', () => {
    // hero: not page-acceptable, and section does not accept it either → blocked.
    const page = basePage()
    const plan = resolveInsertPlan(page, null, 'hero')
    expect(plan.kind).toBe('blocked')
    expect(planInserts(plan, 'hero', ids())).toHaveLength(0)
  })
})
