// ── FF-FACET-PROJECTED — the FACET axis projects generically (ADR-041 sibling) ───
//
//  The facet-axis peer of FF-NO-EXTERNAL-SPECIAL-CASE / the Part port's completeness
//  gate. Proves that a DECLARED facet yields a GENERIC dock section with:
//    • APPLICABILITY driven by the element's DECLARATION (a `caps` token), NEVER a
//      concrete `node.type` literal (Law 1) — the STYLE facet applies to a styleable
//      element and NOT to a same-typed element that lacks the cap.
//    • OCP: a SECOND facet = one FacetDescriptor + re-derive; the mechanism (the
//      derivation loop, the dock, RightDock) is unchanged — a new section falls out.
//
import { describe, it, expect, beforeAll } from 'vitest'
import { facetRegistry, nodeRegistry } from '@statdash/react/engine'
import type { ObjectMeta } from '@statdash/react/engine'
import type { CanvasController } from '../studio/useCanvasController'
import { dockSectionRegistry, type DockRenderCtx } from './sections/dockSection'
import { registerBuiltinDockSections, registerFacetSections } from './sections/builtins'
import { registerBuiltinFacets } from './facets/builtinFacets'
import { setupCanvasRegistry } from '../canvas/setupCanvasRegistry'

beforeAll(() => {
  setupCanvasRegistry()      // real plugin metas (chart/section carry the styleable cap)
  registerBuiltinFacets()
  registerBuiltinDockSections()
})

const controller = (over: Partial<CanvasController>): CanvasController =>
  ({ selected: null, selectedBand: null, ...over } as unknown as CanvasController)

const elementCtx = (over: Partial<CanvasController>): DockRenderCtx =>
  ({ scope: 'element', locale: 'en', controller: controller(over) } as DockRenderCtx)

describe('FF-FACET-PROJECTED — a declared facet is a generic dock projection', () => {
  it('the STYLE facet is registered with a contract over view.styles', () => {
    expect(facetRegistry.has('style')).toBe(true)
    const style = facetRegistry.list().find((f) => f.id === 'style')!
    expect(style.readPath).toBe('view.styles')
    // The contract is a PropSchema fragment carrying a `type:'style'` field (dispatched
    // to StyleField by FieldControlRegistry) — genericity in the DISPATCH, not per-type.
    const schema = style.contract({} as ObjectMeta)
    expect(schema).toHaveLength(1)
    expect(schema[0]).toMatchObject({ field: 'view.styles', type: 'style' })
  })

  it('appliesWhen reads a DECLARED cap, never a concrete type (Law 1)', () => {
    const style = facetRegistry.list().find((f) => f.id === 'style')!
    // Opted-in by the cap → applies. Same-shaped meta WITHOUT the cap → does not.
    expect(style.appliesWhen({ caps: ['styleable'] } as ObjectMeta)).toBe(true)
    expect(style.appliesWhen({ caps: ['flow'] } as ObjectMeta)).toBe(false)
    expect(style.appliesWhen({} as ObjectMeta)).toBe(false)
    // A meta that names a concrete TYPE but does NOT declare the cap is NOT special-cased
    // to true — the predicate is over the cap, not the type name.
    expect(style.appliesWhen({ type: 'section', caps: [] } as unknown as ObjectMeta)).toBe(false)
  })

  it('a styleable element gets the element.facet.style dock section; a non-styleable one does not', () => {
    expect(dockSectionRegistry.has('element.facet.style')).toBe(true)

    // A chart declares `styleable` → the Style section applies.
    const chart = { id: 'c1', type: 'chart', props: {} }
    const chartIds = dockSectionRegistry
      .list(elementCtx({ selected: chart as never }))
      .map((s) => s.id)
    expect(chartIds).toContain('element.facet.style')

    // A filter-bar does NOT declare `styleable` → no Style section (the Figma law: only
    // the selection's OWN declared contract). Proves it is not type-blind-universal.
    const filterBar = { id: 'f1', type: 'filter-bar', props: {} }
    const fbIds = dockSectionRegistry
      .list(elementCtx({ selected: filterBar as never }))
      .map((s) => s.id)
    expect(fbIds).not.toContain('element.facet.style')
  })

  it('the DATA facet is registered with a contract over `data` (Gap 3 — falls out generically)', () => {
    expect(facetRegistry.has('data')).toBe(true)
    const data = facetRegistry.list().find((f) => f.id === 'data')!
    expect(data.readPath).toBe('data')
    // The contract is a PropSchema fragment carrying a `type:'data-pipeline'` field
    // (dispatched to DataFacetField by FieldControlRegistry: metric-bind ⊕ pipe editor) —
    // genericity in the DISPATCH, not a per-type Data form.
    const schema = data.contract({} as ObjectMeta)
    expect(schema).toHaveLength(1)
    expect(schema[0]).toMatchObject({ field: 'data', type: 'data-pipeline' })
  })

  it('the DATA facet appliesWhen reads the `data-bindable` cap, never a concrete type (Law 1)', () => {
    const data = facetRegistry.list().find((f) => f.id === 'data')!
    expect(data.appliesWhen({ caps: ['data-bindable'] } as ObjectMeta)).toBe(true)
    // A DIFFERENT declared cap (even the behavioural `data` cap) does NOT opt in — the
    // predicate is over the dedicated AUTHORING cap, not overloaded onto palette caps.
    expect(data.appliesWhen({ caps: ['data'] } as ObjectMeta)).toBe(false)
    expect(data.appliesWhen({ caps: ['styleable'] } as ObjectMeta)).toBe(false)
    expect(data.appliesWhen({} as ObjectMeta)).toBe(false)
    // Naming a concrete type but NOT the cap is not special-cased to true.
    expect(data.appliesWhen({ type: 'chart', caps: [] } as unknown as ObjectMeta)).toBe(false)
  })

  it('a data-bindable element gets element.facet.data; a non-data element does not', () => {
    expect(dockSectionRegistry.has('element.facet.data')).toBe(true)

    // A chart declares `data-bindable` → the Data section applies (any data-bindable
    // element, not just a metric-declaring one — metric-optional).
    const chart = { id: 'c1', type: 'chart', props: {} }
    const chartIds = dockSectionRegistry
      .list(elementCtx({ selected: chart as never }))
      .map((s) => s.id)
    expect(chartIds).toContain('element.facet.data')

    // A filter-bar is NOT data-bindable → no Data section (the Figma law: only the
    // selection's OWN declared contract). Proves it is not type-blind-universal.
    const filterBar = { id: 'f1', type: 'filter-bar', props: {} }
    const fbIds = dockSectionRegistry
      .list(elementCtx({ selected: filterBar as never }))
      .map((s) => s.id)
    expect(fbIds).not.toContain('element.facet.data')
  })

  it('the real registered data-panel metas carry the data-bindable opt-in', () => {
    // The CONSUMER proof: the declaration the generic DATA facet reads is present on the
    // real data panels (chart/table/kpi-strip) — so the Data section falls out for each.
    for (const type of ['chart', 'table', 'kpi-strip']) {
      const meta = nodeRegistry.getMeta(type) as unknown as ObjectMeta
      expect(meta?.caps, type).toContain('data-bindable')
    }
  })

  it('the facet section does NOT apply to a bounded PART (whole-element facet, MVP)', () => {
    const selectedBand = { path: 'chrome.InnerSidebar', ownerId: 'site-frame', ownerSelectable: false }
    const ids = dockSectionRegistry
      .list(elementCtx({ selectedBand: selectedBand as never }))
      .map((s) => s.id)
    expect(ids).not.toContain('element.facet.style')
  })

  it('OCP — a SECOND facet = one descriptor + re-derive; the mechanism is unchanged', () => {
    // A synthetic second facet, opted-in by a DIFFERENT declared cap. Zero mechanism edit.
    facetRegistry.register({
      id:          'demo-facet',
      order:       90,
      readPath:    'view.demo',
      label:       { en: 'Demo' },
      appliesWhen: (meta) => !!meta.caps?.includes('collapsible'),
      contract:    () => [{ field: 'view.demo', type: 'string', label: { en: 'Demo' } }],
    })
    // Re-run the SAME derivation loop — a new section falls out (idempotent by id).
    registerFacetSections()
    expect(dockSectionRegistry.has('element.facet.demo-facet')).toBe(true)

    // A section (declares `collapsible`) now projects the demo facet, generically.
    const section = { id: 's1', type: 'section', props: {} }
    const ids = dockSectionRegistry
      .list(elementCtx({ selected: section as never }))
      .map((s) => s.id)
    expect(ids).toContain('element.facet.demo-facet')
    // …and both facet sections coexist (STYLE + demo) — the axis composes.
    expect(ids).toContain('element.facet.style')
  })

  it('the real registered chart/section metas carry the styleable opt-in', () => {
    // The CONSUMER proof (the one place concrete names appear): the declaration the
    // generic facet axis reads is actually present on the real elements.
    for (const type of ['chart', 'section', 'table', 'kpi-strip']) {
      const meta = nodeRegistry.getMeta(type) as unknown as ObjectMeta
      expect(meta?.caps, type).toContain('styleable')
    }
  })
})
