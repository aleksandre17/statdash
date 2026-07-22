// ── FF-DATA-OWNERSHIP-PROJECTION — the Data facet follows containment (0112 S2) ──────
//
//  The containment/projection defect (card 0112 · S2): data-ownership is an INSTANCE +
//  CONTAINMENT property (resolveNodeRows: `node.data` present → own; absent → inherit the
//  parent cascade), NOT a static type-cap. In the ONS/Eurostat section grammar a SECTION
//  owns one inline `query` and its chart/table children are DATA-LESS views. The old facet
//  model projected the Data facet + door onto the data-LESS child (cap-driven) and NOT onto
//  the data-OWNING section (no cap) — the door on the wrong element.
//
//  This guard pins BOTH halves of the fix:
//    (1) resolveDataOwnership walks the containment tree — owner / inheriting (→ owner id +
//        spec) / unbound — the truth the door and summary read.
//    (2) the data-OWNING section EXPOSES element.facet.data (instance-level projection),
//        while a bare section (no data) does not — so the facet follows the data, generically.
//
import { describe, it, expect, beforeAll } from 'vitest'
import type { DataSpec } from '@statdash/engine'
import { resolveDataOwnership } from './dataOwnership'
import type { CanvasNode, CanvasPage } from '../types/constructor'
import type { CanvasController } from '../studio/useCanvasController'
import type { Role } from '../studio/useRole'
import { dockSectionRegistry, type DockRenderCtx } from './sections/dockSection'
import { registerBuiltinDockSections } from './sections/builtins'
import { registerBuiltinFacets } from './facets/builtinFacets'
import { setupCanvasRegistry } from '../canvas/setupCanvasRegistry'

beforeAll(() => {
  setupCanvasRegistry()
  registerBuiltinFacets()
  registerBuiltinDockSections()
})

const SECTION_SPEC: DataSpec = {
  type: 'query', query: { measure: 'm.gdp' }, encoding: { label: 'label' },
} as DataSpec

const node = (over: Partial<CanvasNode> & { id: string }): CanvasNode =>
  ({ type: 'section', variant: 'default', props: {}, childIds: [], ...over } as CanvasNode)

/** section(owns data) → wrap(data-less) → chart(data-less) — the real GDP composition. */
function ownershipPage(): CanvasPage {
  return {
    id: 'p1', type: 'inner-page', title: { ka: '', en: '' }, slug: 'p', nodeIds: ['sec-1'],
    nodes: {
      'sec-1':   node({ id: 'sec-1', type: 'section', props: { data: SECTION_SPEC, title: 'Production' }, childIds: ['wrap-1'] }),
      'wrap-1':  node({ id: 'wrap-1', type: 'wrap', childIds: ['chart-1'] }),
      'chart-1': node({ id: 'chart-1', type: 'chart', childIds: [] }),
    },
  } as CanvasPage
}

describe('resolveDataOwnership — data role through the containment tree (0112 S2)', () => {
  const page = ownershipPage()

  it('the element that carries `props.data` is the OWNER', () => {
    expect(resolveDataOwnership(page, 'sec-1', 'en')).toEqual({ role: 'owner' })
  })

  it('a data-LESS descendant is INHERITING — resolves to the nearest data-owning ancestor + its spec', () => {
    // The chart nests section → wrap → chart; the walk skips the data-less wrap up to the
    // section, returning the OWNER's id + spec (the door target) + its honest label.
    expect(resolveDataOwnership(page, 'chart-1', 'en')).toEqual({
      role: 'inheriting', ownerId: 'sec-1', ownerLabel: 'Production', ownerSpec: SECTION_SPEC,
    })
    // …and the intermediate wrap inherits from the same owner.
    expect(resolveDataOwnership(page, 'wrap-1', 'en')).toMatchObject({ role: 'inheriting', ownerId: 'sec-1' })
  })

  it('an element with no own data and no data-owning ancestor is genuinely UNBOUND', () => {
    const bare: CanvasPage = {
      id: 'p2', type: 'inner-page', title: { ka: '', en: '' }, slug: 'p', nodeIds: ['sec-x'],
      nodes: {
        'sec-x':   node({ id: 'sec-x', type: 'section', childIds: ['chart-x'] }),
        'chart-x': node({ id: 'chart-x', type: 'chart', childIds: [] }),
      },
    } as CanvasPage
    expect(resolveDataOwnership(bare, 'chart-x', 'en')).toEqual({ role: 'unbound' })
  })
})

// ── The facet follows the data (instance-level projection) ───────────────────────────
const controller = (over: Partial<CanvasController>): CanvasController =>
  ({ selected: null, selectedBand: null, ...over } as unknown as CanvasController)

const elementCtx = (over: Partial<CanvasController>, role: Role = 'author'): DockRenderCtx =>
  ({ scope: 'element', locale: 'en', controller: controller(over), role } as DockRenderCtx)

describe('FF-DATA-OWNERSHIP-PROJECTION — the data-OWNING element exposes element.facet.data (0112 S2)', () => {
  it('a SECTION that OWNS data gets the Data facet, even though its TYPE carries no data-bindable cap', () => {
    // The section meta declares no `data-bindable` cap, yet it OWNS an inline query — the
    // instance-level projection surfaces the Data facet + door onto ITS spec (the fix's
    // owner half). Generic: applicability off the readPath VALUE, no type literal.
    const owningSection = { id: 'sec-1', type: 'section', props: { data: SECTION_SPEC } }
    const ids = dockSectionRegistry
      .list(elementCtx({ selected: owningSection as never }))
      .map((s) => s.id)
    expect(ids).toContain('element.facet.data')
  })

  it('a BARE section (no data, no cap) does NOT get the Data facet — the facet follows the data', () => {
    const bareSection = { id: 'sec-0', type: 'section', props: {} }
    const ids = dockSectionRegistry
      .list(elementCtx({ selected: bareSection as never }))
      .map((s) => s.id)
    expect(ids).not.toContain('element.facet.data')
  })
})
