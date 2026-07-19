// ── Composed-preset insert fitness (ADR-049 P2b · ADR-050 R2) ─────────────────
//
//  The composed-preset primitive lets an author "pick a whole, then tweak": a preset
//  is a partial element declaration (`NodeSeed`) projected into the palette and inserted
//  as a bound + pre-wired whole via `planPresetInserts`. These guards pin the two load-
//  bearing invariants the ADR names, plus the end-to-end projection+insert:
//
//   • FF-PRESET-DEGENERATE-IDENTITY — an all-defaults preset (`{type}`) inserts
//     BYTE-IDENTICAL to a bare tile insert. Proves planPresetInserts overlays makeNode
//     losslessly (the V6 insert invariant extends to presets, not forks it).
//   • FF-PRESET-INSERT-NEVER-CLIFF — a preset insert always resolves through the SHARED
//     `resolveInsertPlan` to a valid tree or an explicit blocked hint — never an invalid
//     tree, never a hidden no-op (extends insertNeverCliff to the preset path).
//   • Registered-preset projection — a real registered preset shows in presetRegistry.list()
//     (the palette's generic source) and inserts its FULL subtree with bound data.
//
import { describe, it, expect, beforeAll } from 'vitest'
import { setupCanvasRegistry } from './setupCanvasRegistry'
import { getPaletteEntries } from './paletteEntries'
import {
  resolveInsertPlan, planInserts, planPresetInserts, nestAccepts,
  type InsertPlan,
} from './insertNode'
import { presetRegistry } from '@statdash/react/engine'
import type { NodeSeed } from '@statdash/react/engine'
import { insertNodesPatch } from '../store/constructor.pages'
import type { CanvasPage } from '../types/constructor'

beforeAll(() => { setupCanvasRegistry() })

// A page with a container (section) and a leaf (filter-bar), both inner-page-legal — the
// same fixture insertNeverCliff uses, so the two guards share a proven-legal base tree.
function basePage(): CanvasPage {
  return {
    id: 'p1', type: 'inner-page', title: { ka: 'გ', en: 'P' }, slug: 'p',
    nodeIds: ['sec', 'fb'],
    nodes: {
      sec: { id: 'sec', type: 'section',    props: {}, childIds: [] },
      fb:  { id: 'fb',  type: 'filter-bar', props: {}, childIds: [] },
    },
  }
}
const state = (page: CanvasPage) => ({ pages: [page], activePageId: page.id })
const ids = () => { let n = 0; return () => `n-${n++}` }

// Every node sits under a parent that legally accepts it (registry accept contract), deep.
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
  check(page.type, page.nodeIds)
}

const droppable = () => getPaletteEntries().map((e) => e.type)

describe('FF-PRESET-DEGENERATE-IDENTITY — an all-defaults preset ≡ a bare tile insert', () => {
  // A degenerate seed carries NO overlay — its node build must be byte-identical to the
  // bare-type makeNode output, for the SAME plan and the SAME id-factory sequence.
  for (const type of ['section', 'chart', 'hero', 'filter-bar']) {
    it(`direct plan: preset {type:'${type}'} === planInserts('${type}')`, () => {
      const plan: InsertPlan = { kind: 'direct', parentId: 'p1' }
      const bare   = planInserts(plan, type, ids())
      const preset = planPresetInserts({ type } as NodeSeed, plan, ids())
      expect(preset).toEqual(bare)
    })

    it(`wrap plan: preset {type:'${type}'} === planInserts('${type}') (wrapper+child, same id order)`, () => {
      const plan: InsertPlan = { kind: 'wrap', wrapperType: 'section', parentId: 'p1' }
      const bare   = planInserts(plan, type, ids())
      const preset = planPresetInserts({ type } as NodeSeed, plan, ids())
      expect(preset).toEqual(bare)
    })
  }

  it('a blocked plan yields no ops (identical to the bare path)', () => {
    const plan: InsertPlan = { kind: 'blocked', reason: 'no-single-wrapper' }
    expect(planPresetInserts({ type: 'chart' } as NodeSeed, plan, ids())).toEqual([])
    expect(planInserts(plan, 'chart', ids())).toEqual([])
  })
})

describe('FF-PRESET-INSERT-NEVER-CLIFF — a preset insert is always valid or an explicit hint', () => {
  const SELECTIONS: Array<[string, string | null]> = [
    ['nothing selected (page/frame)', null],
    ['a container selected (section)', 'sec'],
    ['a leaf selected (filter-bar)',   'fb'],
  ]

  for (const [label, selectedId] of SELECTIONS) {
    it(`${label}: every degenerate preset resolves through resolveInsertPlan to a legal tree`, () => {
      for (const type of droppable()) {
        const page = basePage()
        // The preset ROOT flows through the SHARED resolver — identical placement legality.
        const plan = resolveInsertPlan(page, selectedId, type)
        const ops  = planPresetInserts({ type } as NodeSeed, plan, ids())
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
})

describe('registered-preset projection — a real preset projects into the palette + inserts bound', () => {
  it('presetRegistry.list() (the palette Starters source) carries the registered starters', () => {
    const ids = presetRegistry.list().map((p) => p.id)
    // The generic palette source — no per-type projector; a preset appears by being registered.
    expect(ids).toContain('preset-section-chart')
    expect(ids).toContain('preset-chart-timeseries')
    expect(ids).toContain('preset-kpi-metric')
  })

  it('the section→chart preset inserts its FULL subtree with the chart bound to a query', () => {
    const preset = presetRegistry.get('preset-section-chart')!
    expect(preset).toBeTruthy()

    const page = basePage()
    const plan = resolveInsertPlan(page, null, preset.seed.type)   // shared resolver — 'section' is page-direct
    const ops  = planPresetInserts(preset.seed, plan, ids())
    const patched = insertNodesPatch(state(page), 'p1', ops).pages![0] as CanvasPage

    // The composed whole landed as ONE legal tree.
    assertLegalTree(patched)
    const sectionId = patched.nodeIds[patched.nodeIds.length - 1]  // appended after the fixture's two
    const section = patched.nodes[sectionId]
    expect(section.type).toBe('section')
    // The child chart is nested (childIds wired by the reducer from the ops' parentId).
    expect(section.childIds).toHaveLength(1)
    const chart = patched.nodes[section.childIds[0]]
    expect(chart.type).toBe('chart')
    // ...and it arrived BOUND — the seed's DataSpec landed on the node-body `data` key.
    expect((chart.props.data as { type?: string })?.type).toBe('query')
  })

  it('a bound-metric preset lands its per-item governed measure (not a stray node.data)', () => {
    const preset = presetRegistry.get('preset-kpi-metric')!
    const page = basePage()
    const plan = resolveInsertPlan(page, null, preset.seed.type)
    const ops  = planPresetInserts(preset.seed, plan, ids())
    const patched = insertNodesPatch(state(page), 'p1', ops).pages![0] as CanvasPage
    const kpiId = patched.nodeIds[patched.nodeIds.length - 1]
    const kpi = patched.nodes[kpiId]
    expect(kpi.type).toBe('kpi-strip')
    const items = kpi.props.items as Array<{ value?: { measure?: string }; trend?: unknown }>
    expect(items[0]?.value?.measure).toBe('gdp.current')  // the REAL bind surface (per-item)
    expect(items[0]?.trend).toBeTruthy()                   // pre-wired trend (P2a)
    expect(kpi.props.data).toBeUndefined()                 // NO stray node.data (WORK-0083)
  })
})
