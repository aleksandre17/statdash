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
import { setupCanvasRegistry } from '../../canvas/setupCanvasRegistry'

// Real plugin metas (chart carries data-bindable/interactive; STYLE/VISIBILITY are
// universal off the no-`slot` discriminant) so the FACET sections resolve their
// applicability by the SELECTED element's declared meta.
setupCanvasRegistry()
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
    // SPEC-deep-authorability-completion (Gap 3): metric-bind is no longer the hand-wired
    // `element.data` — it is folded into the generic DATA facet (`element.facet.data`),
    // derived from the `data` FacetDescriptor by registerFacetSections. So the Data
    // section is a FACET projection, the peer of `element.facet.style` (Slice 1).
    // S6: the `element.chrome` section is RETIRED — a chrome region is a bounded PART,
    // projected through the SAME generic `element.schema` section (no chrome-specific dock).
    // SPEC-deep-authorability-completion (Gap 2): the hand-wired `element.visibility` is
    // likewise folded into the generic VISIBILITY facet (`element.facet.visibility`).
    for (const id of [
      'element.schema', 'element.facet.data', 'element.facet.visibility',
      'page.config', 'page.perspectives', 'page.filters',
    ]) {
      expect(dockSectionRegistry.has(id), id).toBe(true)
    }
    // The hand-wired `element.visibility` section is GONE — folded into the facet.
    expect(dockSectionRegistry.has('element.visibility')).toBe(false)
    expect(dockSectionRegistry.has('element.chrome')).toBe(false)
    // The hand-wired `element.data` section is GONE — folded into the facet (no parallel
    // surface, SPEC reconciliation). Its applicability-by-declaration is proven, with real
    // metas, in facetProjection.fitness (FF-FACET-PROJECTED, the DATA-facet leg).
    expect(dockSectionRegistry.has('element.data')).toBe(false)
  })

  it('page scope lists exactly the page sections, in order', () => {
    const ids = dockSectionRegistry.list(ctx({ scope: 'page' })).map((s) => s.id)
    expect(ids).toEqual(['page.config', 'page.perspectives', 'page.filters'])
  })

  it('element scope with a whole node lists schema + the visibility facet (no page panes)', () => {
    const node = { id: 'n1', type: 'chart', props: {} }
    const ids = dockSectionRegistry
      .list(ctx({ scope: 'element', controller: controller({ selected: node as never }) }))
      .map((s) => s.id)
    expect(ids).toContain('element.schema')
    expect(ids).toContain('element.facet.visibility')
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
