// ── insertByteIdentity.fitness — Cmd-K insert ≡ palette insert (V6) ───────────
//
//  THE V6 invariant. The Outline, the drag palette, Cmd-K and slash are alternative
//  navigation/insert surfaces over the SAME store. An insert MUST be byte-identical
//  regardless of surface: the produced NodePageConfig is the same JSON.
//
//  We prove it structurally — every surface builds the node with makeNode and
//  writes it through insertNodePatch into the SAME container. Here we exercise the
//  palette path and the Cmd-K path for EVERY registered insertable type and assert
//  the resulting projected config is identical (ids fixed so the only variable is
//  the insert path, not the random id).
//
import { describe, it, expect, beforeAll } from 'vitest'
import { setupCanvasRegistry } from '../canvas/setupCanvasRegistry'
import { getPaletteEntries } from '../canvas/paletteEntries'
import { makeNode, resolveInsertParent } from '../canvas/insertNode'
import { insertNodePatch } from '../store/constructor.pages'
import { toNodePageConfig } from '../canvas/canvasPageAdapter'
import type { CanvasPage } from '../types/constructor'

beforeAll(() => { setupCanvasRegistry() })

function emptyPage(): CanvasPage {
  return { id: 'p1', title: { ka: 'გვ', en: 'Pg' }, slug: 'pg', nodeIds: [], nodes: {} }
}
const state = (page: CanvasPage) => ({ pages: [page], activePageId: page.id })

describe('byte-identical insert (V6 invariant)', () => {
  it('Cmd-K insert produces config byte-identical to a palette insert, for every registered type', () => {
    const types = getPaletteEntries().map((e) => e.type)
    expect(types.length).toBeGreaterThan(0)

    for (const type of types) {
      const FIXED_ID = 'fixed-node-id'

      // ── Palette path: CanvasOverlay drop → makeNode → insertNode(parent) ──
      const palettePage = emptyPage()
      const paletteNode = makeNode(type, FIXED_ID)
      const palettePatched = insertNodePatch(state(palettePage), 'p1', paletteNode, 'p1')
      const paletteConfig = toNodePageConfig(palettePatched.pages![0])

      // ── Cmd-K path: useCommandRunner → makeNode → resolveInsertParent → insertNode ──
      const cmdkPage = emptyPage()
      const parentId = resolveInsertParent(cmdkPage, null, type)   // no selection → page root
      const cmdkNode = makeNode(type, FIXED_ID)
      const cmdkPatched = insertNodePatch(state(cmdkPage), 'p1', cmdkNode, parentId)
      const cmdkConfig = toNodePageConfig(cmdkPatched.pages![0])

      // Byte-identical: serialize both and compare exact JSON strings.
      expect(JSON.stringify(cmdkConfig)).toBe(JSON.stringify(paletteConfig))
    }
  })

  it('makeNode is deterministic given a fixed id (the only insert-path variable is the id)', () => {
    const a = makeNode('section', 'id-1')
    const b = makeNode('section', 'id-1')
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
