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
  ({ selected: null, selectedBand: null, ...over } as unknown as CanvasController)

const ctx = (over: Partial<DockRenderCtx>): DockRenderCtx =>
  ({ scope: 'page', locale: 'en', controller: controller({}), ...over } as DockRenderCtx)

describe('dockSectionRegistry — the hardcoded stack is now registered data', () => {
  it('registers the schema, data, visibility, and page-pane sections', () => {
    // SPEC S3: the per-type `element.context` bridge (nodeContextEditors) is deleted —
    // filter controls project generically through `element.schema` (sourcedParts).
    // SPEC S5: metric binding is a CONTEXTUAL section (`element.data`) — re-homed from
    // the retired Data rail surface into the inspector.
    // S6: the `element.chrome` section is RETIRED — a chrome region is a bounded PART,
    // projected through the SAME generic `element.schema` section (no chrome-specific dock).
    for (const id of [
      'element.schema', 'element.data', 'element.visibility',
      'page.config', 'page.perspectives', 'page.filters',
    ]) {
      expect(dockSectionRegistry.has(id), id).toBe(true)
    }
    expect(dockSectionRegistry.has('element.chrome')).toBe(false)
  })

  it('element.data applies ONLY when the selected element is metric-bindable (S5)', () => {
    const node = { id: 'n1', type: 'chart', props: {} }
    // A non-bindable selection → no Data section (the Figma law: only the selection's
    // own declared contract).
    const notBindable = dockSectionRegistry
      .list(ctx({ scope: 'element', controller: controller({ selected: node as never, selectedBindable: false as never }) }))
      .map((s) => s.id)
    expect(notBindable).not.toContain('element.data')
    // A data-bound selection → the Data section (the governed Metric Palette) appears.
    const bindable = dockSectionRegistry
      .list(ctx({ scope: 'element', controller: controller({ selected: node as never, selectedBindable: true as never }) }))
      .map((s) => s.id)
    expect(bindable).toContain('element.data')
  })

  it('page scope lists exactly the page sections, in order', () => {
    const ids = dockSectionRegistry.list(ctx({ scope: 'page' })).map((s) => s.id)
    expect(ids).toEqual(['page.config', 'page.perspectives', 'page.filters'])
  })

  it('element scope with a whole node lists schema + visibility (no page panes)', () => {
    const node = { id: 'n1', type: 'chart', props: {} }
    const ids = dockSectionRegistry
      .list(ctx({ scope: 'element', controller: controller({ selected: node as never }) }))
      .map((s) => s.id)
    expect(ids).toContain('element.schema')
    expect(ids).toContain('element.visibility')
    expect(ids.some((i) => i.startsWith('page.'))).toBe(false)
  })

  it('element scope with a bounded PART (chrome region) lists ONLY element.schema (S6)', () => {
    // A chrome region is a Part owned by the site-frame — no page `selected`, a resolved
    // `selectedBand`. It projects through the SAME generic `element.schema` section; the
    // whole-node-only sections (data / visibility) do NOT apply (no chrome-specific dock).
    const selectedBand = { path: 'chrome.InnerSidebar', ownerId: 'site-frame', ownerSelectable: false }
    const ids = dockSectionRegistry
      .list(ctx({ scope: 'element', controller: controller({ selectedBand: selectedBand as never }) }))
      .map((s) => s.id)
    expect(ids).toEqual(['element.schema'])
  })
})
