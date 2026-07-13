// ── placeNode.fitness — ADR-042 D2 Slice 0 · the Placement seam invariants ────────
//
//  Manipulate is the third projection of the ONE Part model (ADR-042 D1). Slice 0 lifts
//  structural mutation onto the port (`placePart`, `writePart`'s structural sibling),
//  unifying the two forked structural paths — palette/command insert AND outline move —
//  behind ONE port + ONE plan. These fitness functions pin that unification so it cannot
//  silently re-fork:
//
//    FF-ONE-PLACEMENT-GRAMMAR      — every structural node edit flows through `placePart`;
//                                    the tree reducers (`moveNode`/`insertNodes`) are
//                                    invoked from EXACTLY ONE commit site (placeNode.ts).
//    FF-PLACEMENT-RESIDENCE-ROUTED — placement adapters are keyed by RESIDENCE (`getPartSource`);
//                                    no `placePart` adapter names a concrete node type.
//    FF-PLACEMENT-PLAN-TOTAL       — every residence implements `placePart` (returns a
//                                    mutation for its structural verb); every resolved
//                                    placement is a valid plan or an explicit `blocked` hint.
//
//  Source-scanning uses Vite's `import.meta.glob(?raw)` (the browser module graph, NO
//  `fs`/`__dirname`) — the Vitest-4 workspace-root injection hazard does not apply
//  ([[vitest-workspace-dirname]]), matching the sibling app fitness tests.
//
import { describe, it, expect } from 'vitest'
import { valueParts, slotParts } from '@statdash/react/engine'
import type { PlacementOp, PartSourceContext } from '@statdash/react/engine'
import type { FilterSchemaInput } from '@statdash/engine'
import { getPartSource, sourcedParts, chromeParts } from './bandSource'
import { resolvePlacementPlan, planPlacement, type PlacementPlan } from './insertNode'
import type { CanvasPage } from '../types/constructor'

const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

// ── FF-ONE-PLACEMENT-GRAMMAR ──────────────────────────────────────────────────────
describe('FF-ONE-PLACEMENT-GRAMMAR — structural mutation flows through the ONE port', () => {
  // The tree reducers own the childId algebra; a surface must never call them directly —
  // it resolves a plan, compiles a PlacementOp, and commits through `placeSlotPart`. So a
  // direct `moveNode(` / `insertNodes(` invocation may appear in EXACTLY ONE file: the
  // commit site. (Store action DEFINITIONS `moveNode:`/`insertNodes:` and the reducers
  // `*Patch(` do not match this call pattern.)
  const CALL = /\b(?:moveNode|insertNodes)\s*\(/
  const COMMIT_SITE_ALLOWLIST = ['placeNode.ts']

  // The whole app source tree, as raw text (test/fitness files excluded).
  const APP_SOURCES = import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

  const callSites = (): string[] =>
    Object.entries(APP_SOURCES)
      .filter(([path]) => !path.includes('.test.') && !path.includes('.fitness.'))
      .filter(([, src]) => CALL.test(stripComments(src)))
      .map(([path]) => path.split('/').pop()!)
      .sort()

  it('the tree reducers are invoked from exactly the ONE allowlisted commit site', () => {
    expect(callSites()).toEqual([...COMMIT_SITE_ALLOWLIST].sort())
  })

  it('BITES: a planted direct reducer call (a second structural path) IS caught', () => {
    const plantedSecondPath = `function badDrop() { moveNode(pageId, a, b, 0) }`
    expect(CALL.test(stripComments(plantedSecondPath))).toBe(true)
    // …and a store action DEFINITION / reducer name does NOT trip it:
    expect(CALL.test('moveNode: (pageId, nodeId) => {}')).toBe(false)
    expect(CALL.test('...insertNodesPatch(s, pageId, ops)')).toBe(false)
  })
})

// ── FF-PLACEMENT-RESIDENCE-ROUTED ──────────────────────────────────────────────────
describe('FF-PLACEMENT-RESIDENCE-ROUTED — adapters keyed by residence, never by node type', () => {
  const ctx: PartSourceContext = {}

  it('the slot adapter routes structural verbs to the node-children mutation', () => {
    const move: PlacementOp = { kind: 'move', nodeId: 'x', parentId: 'y', index: 0 }
    expect(slotParts.placePart({}, move, ctx)).toEqual({ target: 'node-children', op: move })
    const insert: PlacementOp = { kind: 'insert', ops: [{ node: { id: 'n' }, parentId: 'p' }] }
    expect(slotParts.placePart({}, insert, ctx)).toEqual({ target: 'node-children', op: insert })
    // a value-band verb is NOT the slot residence's → null (routed, not mis-handled).
    expect(slotParts.placePart({}, { kind: 'reorder', field: 'items', from: 0, index: 1 }, ctx)).toBeNull()
  })

  it('the value adapter routes a reorder to a node-props array splice', () => {
    const el = { items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }
    const mut = valueParts.placePart(el, { kind: 'reorder', field: 'items', from: 0, index: 2 }, ctx)
    expect(mut).toEqual({ target: 'node-props', props: { items: [{ id: 'b' }, { id: 'c' }, { id: 'a' }] } })
    // a slot verb is NOT the value residence's → null.
    expect(valueParts.placePart(el, { kind: 'move', nodeId: 'x', parentId: 'y' }, ctx)).toBeNull()
  })

  it('the sourced (page-filters) adapter routes a control reorder to a filter-schema mutation', () => {
    const schema = {
      bars: { bar0: { filters: { a: { type: 'select' }, b: { type: 'select' }, c: { type: 'select' } } } },
    } as unknown as FilterSchemaInput
    const mut = sourcedParts.placePart({}, { kind: 'reorder', field: 'bar0', from: 0, index: 2 }, { filterSchema: schema })
    expect(mut?.target).toBe('filter-schema')
    const reordered = (mut as { target: 'filter-schema'; schema: FilterSchemaInput }).schema
    expect(Object.keys(reordered.bars.bar0.filters)).toEqual(['b', 'c', 'a'])
  })

  it('the sourced (site-chrome) adapter routes a region reorder to a site-chrome mutation', () => {
    const mut = chromeParts.placePart({}, { kind: 'reorder', field: 'footer', from: 0, index: 3 }, ctx)
    expect(mut).toEqual({ target: 'site-chrome', slot: 'footer', field: 'order', value: 3 })
  })

  it('dispatch is by residence: getPartSource(residence) resolves the placing adapter', () => {
    expect(getPartSource('slot')?.placePart).toBe(slotParts.placePart)
    expect(getPartSource('value')?.placePart).toBe(valueParts.placePart)
    expect(getPartSource('sourced', 'page-filters')?.placePart).toBe(sourcedParts.placePart)
    expect(getPartSource('sourced', 'site-chrome')?.placePart).toBe(chromeParts.placePart)
  })

  it('the placement adapters name no concrete node type (residence/op.kind dispatch only)', () => {
    // The adapter homes: engine (partSources.ts) + app (bandSource.ts). A node-type branch
    // (`.type ===`) or a registry reach (`nodeRegistry.`) inside a placement adapter is the
    // per-type special-case Law 1 bans — dispatch is by residence + op.kind, nothing else.
    const ADAPTER_SOURCES = import.meta.glob(
      ['./bandSource.ts', '../../../../packages/react/src/engine/partSources.ts'],
      { query: '?raw', import: 'default', eager: true },
    ) as Record<string, string>
    const sources = Object.values(ADAPTER_SOURCES)
    expect(sources.length).toBe(2)                    // both adapter homes were resolved
    for (const src of sources.map(stripComments)) {
      expect(src).not.toMatch(/\.type\s*===/)
      expect(src).not.toMatch(/nodeRegistry\./)
    }
  })
})

// ── FF-PLACEMENT-PLAN-TOTAL ─────────────────────────────────────────────────────────
describe('FF-PLACEMENT-PLAN-TOTAL — every residence handled, every drop resolves to a plan', () => {
  it('every registered residence adapter implements placePart', () => {
    for (const src of [
      getPartSource('slot'), getPartSource('value'),
      getPartSource('sourced', 'page-filters'), getPartSource('sourced', 'site-chrome'),
    ]) {
      expect(typeof src?.placePart).toBe('function')
    }
  })

  const page: CanvasPage = {
    id: 'p1', type: 'inner-page', title: { ka: 'გ', en: 'P' }, slug: 'p',
    nodeIds: ['a', 'b'],
    nodes: {
      a: { id: 'a', type: 'section', props: {}, childIds: ['a1'] },
      a1: { id: 'a1', type: 'chart', props: {}, childIds: [] },
      b: { id: 'b', type: 'section', props: {}, childIds: [] },
    },
  }
  const KNOWN: PlacementPlan['kind'][] = ['direct', 'wrap', 'reorder', 'reparent', 'blocked']

  it('every insert AND move gesture resolves to a KNOWN plan kind (no undefined / silent no-op)', () => {
    const gestures: Array<[string | null, string, string]> = [
      [null, 'p1', 'section'],       // insert at page root
      [null, 'a', 'chart'],          // insert into a selected container
      [null, 'p1', 'chart'],         // insert (may wrap or block)
      ['b', 'a', 'section'],         // move b relative to a
      ['b', 'a1', 'chart'],          // move b relative to a nested node
      ['a', 'b', 'section'],         // move a to sit by b
    ]
    for (const [source, target, type] of gestures) {
      const plan = resolvePlacementPlan(page, source, target, type)
      expect(KNOWN).toContain(plan.kind)
    }
  })

  it('a blocked plan compiles to null (an explicit hint, never an invalid tree)', () => {
    const blocked: PlacementPlan = { kind: 'blocked', reason: 'nest-rejected' }
    expect(planPlacement(blocked, { type: 'chart', makeId: () => 'x' })).toBeNull()
    expect(planPlacement(blocked, { source: 'a' })).toBeNull()
  })

  it('a move plan compiles to a move op over the existing source; an insert plan to an insert op', () => {
    const move = planPlacement({ kind: 'reparent', parentId: 'a', index: 0 }, { source: 'b' })
    expect(move).toEqual({ kind: 'move', nodeId: 'b', parentId: 'a', index: 0 })
    const insert = planPlacement({ kind: 'direct', parentId: 'p1' }, { type: 'section', makeId: () => 'nid' })
    expect(insert?.kind).toBe('insert')
  })
})
