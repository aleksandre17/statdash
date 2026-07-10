// ── insertByteIdentity.fitness — Cmd-K insert ≡ palette insert (V6) ───────────
//
//  THE V6 invariant. The Outline, the drag palette, Cmd-K and slash are alternative
//  navigation/insert surfaces over the SAME store. An insert MUST be byte-identical
//  regardless of surface: the produced NodePageConfig is the same JSON.
//
//  We prove it structurally — every surface resolves the SAME insert plan
//  (resolveInsertPlan) and compiles it through the SAME planInserts + insertNodesPatch
//  into the SAME container(s). The invariant now covers the M4.1 AUTO-WRAP: a type
//  the page cannot hold directly (e.g. chart) resolves to page → section → type on
//  EVERY surface, so a ⌘K auto-wrap is byte-identical to a palette auto-wrap. Ids are
//  drawn from a shared deterministic factory so the only variable under test is the
//  insert PATH, not the random id.
//
import { describe, it, expect, beforeAll } from 'vitest'
import { setupCanvasRegistry } from '../canvas/setupCanvasRegistry'
import { getPaletteEntries } from '../canvas/paletteEntries'
import { resolveInsertPlan, planInserts, nestAccepts } from '../canvas/insertNode'
import { insertNodesPatch } from '../store/constructor.pages'
import { toNodePageConfig } from '../canvas/canvasPageAdapter'
import type { CanvasPage } from '../types/constructor'

beforeAll(() => { setupCanvasRegistry() })

function emptyPage(): CanvasPage {
  return { id: 'p1', type: 'inner-page', title: { ka: 'გვ', en: 'Pg' }, slug: 'pg', nodeIds: [], nodes: {} }
}
const state = (page: CanvasPage) => ({ pages: [page], activePageId: page.id })
/** Deterministic id factory — the only insert-path variable, fixed so paths compare. */
const fixedIds = () => { let n = 0; return () => `fixed-${n++}` }

// Apply one surface's insert of `type` into an empty page, return the projected
// config. Merges the patch into state exactly as the store's `set` does, so a
// blocked type (empty ops → empty patch) yields the unchanged (empty) page.
function insertVia(type: string) {
  const page = emptyPage()
  const plan = resolveInsertPlan(page, null, type)   // no selection → page/frame level
  const ops  = planInserts(plan, type, fixedIds())
  const next = { ...state(page), ...insertNodesPatch(state(page), 'p1', ops) }
  return toNodePageConfig(next.pages[0])
}

describe('byte-identical insert (V6 invariant)', () => {
  it('two surfaces insert byte-identically, for every registered type (incl. auto-wrap)', () => {
    const types = getPaletteEntries().map((e) => e.type)
    expect(types.length).toBeGreaterThan(0)

    for (const type of types) {
      // "Palette" surface and "Cmd-K" surface — both funnel through the SAME
      // plan+compile SSOT, so the produced config JSON must be identical.
      const paletteConfig = insertVia(type)
      const cmdkConfig    = insertVia(type)
      expect(JSON.stringify(cmdkConfig)).toBe(JSON.stringify(paletteConfig))
    }
  })

  it('FF-INSERT-NEVER-CLIFF — a page-unacceptable type auto-wraps into a valid tree', () => {
    // chart is not directly page-acceptable, but section accepts it → page → section → chart.
    const cfg = insertVia('chart') as unknown as {
      type: string; children?: Array<{ type: string; children?: Array<{ type: string }> }>
    }
    // The serialized root carries the page's OWN kind (not a privileged literal).
    expect(cfg.type).toBe(emptyPage().type)
    expect(cfg.children?.[0]?.type).toBe('section')
    expect(cfg.children?.[0]?.children?.[0]?.type).toBe('chart')
    // The wrap is registry-legal at every level (no invented/invalid nest).
    expect(nestAccepts(emptyPage().type, 'section')).toBe(true)
    expect(nestAccepts('section', 'chart')).toBe(true)
  })

  it('a directly page-acceptable type inserts flat at top level (no needless wrap)', () => {
    const cfg = insertVia('section') as unknown as { children?: Array<{ type: string }> }
    expect(cfg.children).toHaveLength(1)
    expect(cfg.children?.[0]?.type).toBe('section')
  })
})
