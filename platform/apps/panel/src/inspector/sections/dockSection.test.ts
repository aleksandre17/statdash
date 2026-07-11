// ── dock-section grammar — the ad-hoc stack is absorbed into ONE registry (§4.3) ─
//
//  Proves the coherence fix: visibility, node-context, and the page panes are no
//  longer hardcoded in RightDock — they are sections in `dockSectionRegistry`,
//  filtered by dock context. (Rendering fidelity is covered by the RightDock/
//  Inspector suites; here we assert the registry SHAPE + filtering law.)
//
import { describe, it, expect } from 'vitest'
import type { CanvasController } from '../../studio/useCanvasController'
import { dockSectionRegistry, type DockRenderCtx } from './dockSection'
import { registerBuiltinDockSections } from './builtins'

registerBuiltinDockSections()

// A minimal controller stub — only the fields the section `appliesTo` guards read.
const controller = (over: Partial<CanvasController>): CanvasController =>
  ({ selected: null, chromeSel: null, ...over } as unknown as CanvasController)

const ctx = (over: Partial<DockRenderCtx>): DockRenderCtx =>
  ({ scope: 'page', locale: 'en', controller: controller({}), ...over } as DockRenderCtx)

describe('dockSectionRegistry — the hardcoded stack is now registered data', () => {
  it('registers the visibility, node-context, and page-pane sections', () => {
    for (const id of [
      'element.schema', 'element.context', 'element.visibility', 'element.chrome',
      'page.config', 'page.perspectives', 'page.filters',
    ]) {
      expect(dockSectionRegistry.has(id), id).toBe(true)
    }
  })

  it('page scope lists exactly the page sections, in order', () => {
    const ids = dockSectionRegistry.list(ctx({ scope: 'page' })).map((s) => s.id)
    expect(ids).toEqual(['page.config', 'page.perspectives', 'page.filters'])
  })

  it('element scope with a node lists schema + visibility (no chrome, no page panes)', () => {
    const node = { id: 'n1', type: 'chart', props: {} }
    const ids = dockSectionRegistry
      .list(ctx({ scope: 'element', controller: controller({ selected: node as never }) }))
      .map((s) => s.id)
    expect(ids).toContain('element.schema')
    expect(ids).toContain('element.visibility')
    expect(ids).not.toContain('element.chrome')
    expect(ids.some((i) => i.startsWith('page.'))).toBe(false)
  })

  it('element scope with chrome selected lists ONLY the chrome section (exclusive)', () => {
    const chromeSel = { slot: 'header', key: 'title' }
    const ids = dockSectionRegistry
      .list(ctx({ scope: 'element', controller: controller({ chromeSel: chromeSel as never }) }))
      .map((s) => s.id)
    expect(ids).toEqual(['element.chrome'])
  })
})
