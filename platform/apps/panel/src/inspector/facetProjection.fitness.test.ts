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
import { facetRegistry, nodeRegistry, chromeRegistry } from '@statdash/react/engine'
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

  // ── EVENTS facet (Gap 2) — per-element `on[]` interaction authoring falls out ──────
  it('the EVENTS facet is registered with a contract over `on` (falls out generically)', () => {
    expect(facetRegistry.has('events')).toBe(true)
    const events = facetRegistry.list().find((f) => f.id === 'events')!
    expect(events.readPath).toBe('on')
    // The contract is a PropSchema fragment carrying a `type:'events'` field (dispatched
    // to EventsField by FieldControlRegistry: the trigger/action list editor over the
    // declared NodeAction grammar) — genericity in the DISPATCH, not a per-type form.
    const schema = events.contract({} as ObjectMeta)
    expect(schema).toHaveLength(1)
    expect(schema[0]).toMatchObject({ field: 'on', type: 'events' })
  })

  it('the EVENTS facet appliesWhen reads the `interactive` cap, never a concrete type (Law 1)', () => {
    const events = facetRegistry.list().find((f) => f.id === 'events')!
    expect(events.appliesWhen({ caps: ['interactive'] } as ObjectMeta)).toBe(true)
    // A DIFFERENT declared cap (even the behavioural `filterable`) does NOT opt in — the
    // predicate is over the dedicated AUTHORING cap, not overloaded onto behaviour caps.
    expect(events.appliesWhen({ caps: ['filterable'] } as ObjectMeta)).toBe(false)
    expect(events.appliesWhen({ caps: ['data-bindable'] } as ObjectMeta)).toBe(false)
    expect(events.appliesWhen({} as ObjectMeta)).toBe(false)
    // Naming a concrete type but NOT the cap is not special-cased to true.
    expect(events.appliesWhen({ type: 'chart', caps: [] } as unknown as ObjectMeta)).toBe(false)
  })

  it('an interactive element gets element.facet.events; a non-interactive one does not', () => {
    expect(dockSectionRegistry.has('element.facet.events')).toBe(true)

    // A chart declares `interactive` → the Events section applies.
    const chart = { id: 'c1', type: 'chart', props: {} }
    const chartIds = dockSectionRegistry
      .list(elementCtx({ selected: chart as never }))
      .map((s) => s.id)
    expect(chartIds).toContain('element.facet.events')

    // A filter-bar is NOT interactive → no Events section (the Figma law: only the
    // selection's OWN declared contract). Proves it is not type-blind-universal.
    const filterBar = { id: 'f1', type: 'filter-bar', props: {} }
    const fbIds = dockSectionRegistry
      .list(elementCtx({ selected: filterBar as never }))
      .map((s) => s.id)
    expect(fbIds).not.toContain('element.facet.events')
  })

  it('the real registered interaction-capable metas carry the interactive opt-in', () => {
    // The CONSUMER proof: the declaration the generic EVENTS facet reads is present on the
    // real interaction-capable elements (chart/table/kpi-strip/geograph — those whose
    // shells EMIT gestures), so the Events section falls out for each.
    for (const type of ['chart', 'table', 'kpi-strip', 'geograph']) {
      const meta = nodeRegistry.getMeta(type) as unknown as ObjectMeta
      expect(meta?.caps, type).toContain('interactive')
    }
  })

  // ── VISIBILITY facet (Gap 2, interaction half) — the UNIVERSAL show-when facet ──────
  it('the VISIBILITY facet is registered with a contract over `view.visibleWhen` (falls out generically)', () => {
    expect(facetRegistry.has('visibility')).toBe(true)
    const vis = facetRegistry.list().find((f) => f.id === 'visibility')!
    expect(vis.readPath).toBe('view.visibleWhen')
    // The contract is a PropSchema fragment carrying a `type:'visibility'` field (dispatched
    // to VisibilityField by FieldControlRegistry: the recursive show-when condition builder) —
    // genericity in the DISPATCH, not a per-type visibility form.
    const schema = vis.contract({} as ObjectMeta)
    expect(schema).toHaveLength(1)
    expect(schema[0]).toMatchObject({ field: 'view.visibleWhen', type: 'visibility' })
  })

  it('the VISIBILITY facet is UNIVERSAL — applies to any renderable element, never a chrome slot (Law 1)', () => {
    const vis = facetRegistry.list().find((f) => f.id === 'visibility')!
    // Unlike the opt-in caps, visibility is universal: ANY renderable page node opts in by
    // DECLARATION absence-of-slot (the INVERSE of the chrome facet's `slot` predicate) — never
    // a concrete type read. A bare meta, a styleable meta, a data meta → all applicable.
    expect(vis.appliesWhen({} as ObjectMeta)).toBe(true)
    expect(vis.appliesWhen({ caps: ['styleable'] } as ObjectMeta)).toBe(true)
    expect(vis.appliesWhen({ caps: ['data-bindable'] } as ObjectMeta)).toBe(true)
    expect(vis.appliesWhen({ type: 'chart', caps: [] } as unknown as ObjectMeta)).toBe(true)
    // …but NOT a chrome-slot part meta (its write lane is structural, not `view.visibleWhen`).
    expect(vis.appliesWhen({ slot: 'AppHeader' } as unknown as ObjectMeta)).toBe(false)
  })

  it('any whole node gets element.facet.visibility; a chrome region does not', () => {
    expect(dockSectionRegistry.has('element.facet.visibility')).toBe(true)

    // A chart (whole page node, no `slot`) → the Visibility section applies.
    const chart = { id: 'c1', type: 'chart', props: {} }
    const chartIds = dockSectionRegistry
      .list(elementCtx({ selected: chart as never }))
      .map((s) => s.id)
    expect(chartIds).toContain('element.facet.visibility')

    // A filter-bar (also a whole node, no `slot`) → visibility applies too (universal — it is
    // NOT gated on an opt-in cap, unlike style/data/events, which a filter-bar lacks).
    const filterBar = { id: 'f1', type: 'filter-bar', props: {} }
    const fbIds = dockSectionRegistry
      .list(elementCtx({ selected: filterBar as never }))
      .map((s) => s.id)
    expect(fbIds).toContain('element.facet.visibility')

    // A chrome region PART (its meta declares `slot`) → visibility does NOT bleed onto it.
    const partMeta = chromeRegistry.getMeta('AppHeader', 'default') as unknown as ObjectMeta
    const chromeBand = { path: 'chrome.AppHeader', ownerId: 'site-frame', source: 'site-chrome', field: 'AppHeader', partMeta }
    const chromeIds = dockSectionRegistry
      .list(elementCtx({ selectedBand: chromeBand as never }))
      .map((s) => s.id)
    expect(chromeIds).not.toContain('element.facet.visibility')
  })

  it('all SIX facet dimensions are covered — style·data·events·visibility·chrome project; content is the schema axis', () => {
    // The five FACET-axis descriptors (content is the CONSTITUENT axis — `element.schema`).
    for (const id of ['style', 'data', 'events', 'visibility', 'chrome']) {
      expect(facetRegistry.has(id), id).toBe(true)
      expect(dockSectionRegistry.has(`element.facet.${id}`), id).toBe(true)
    }
    // Content = the part/schema projection (not a FacetDescriptor) — the sixth dimension.
    expect(dockSectionRegistry.has('element.schema')).toBe(true)
  })

  it('a value/filter PART with NO element meta gets no node-facet section (facets hidden during drill)', () => {
    // A positional band item carries an itemSchema, not an ObjectMeta (partMeta undefined),
    // so the STYLE/DATA facets stay hidden during a value-band drill — unchanged behaviour.
    const selectedBand = { path: 'items.0', ownerId: 'kpi-1', ownerSelectable: true }
    const ids = dockSectionRegistry
      .list(elementCtx({ selectedBand: selectedBand as never }))
      .map((s) => s.id)
    expect(ids).not.toContain('element.facet.style')
    expect(ids).not.toContain('element.facet.data')
    expect(ids).not.toContain('element.facet.events')
    expect(ids).not.toContain('element.facet.chrome')
    // …and visibility too: a positional item exposes no element meta, so the universal
    // visibility facet also stays hidden during a value-band drill (meta undefined).
    expect(ids).not.toContain('element.facet.visibility')
  })

  // ── CHROME facet (Gap 1) — the full chrome contract falls out generically ──────
  it('the CHROME facet is registered; its contract projects variant/region/order (structural)', () => {
    expect(facetRegistry.has('chrome')).toBe(true)
    const chrome = facetRegistry.list().find((f) => f.id === 'chrome')!
    expect(chrome.readPath).toBe('')   // the structural fields live at the ChromeSlotConfig top level
    // The contract is resolved from the DECLARED slot (AppHeader), listing the slot's
    // registered variants as options — genericity in the DISPATCH (select/number controls).
    const schema = chrome.contract({ slot: 'AppHeader' } as unknown as ObjectMeta)
    expect(schema.map((f) => f.field)).toEqual(['variant', 'region', 'order'])
    const variantField = schema.find((f) => f.field === 'variant')!
    expect((variantField.options?.length ?? 0)).toBeGreaterThan(0)   // resolved from chromeRegistry.listVariants
  })

  it('the CHROME facet appliesWhen reads the DECLARED `slot` field, never a concrete type (Law 1)', () => {
    const chrome = facetRegistry.list().find((f) => f.id === 'chrome')!
    // A ChromeSliceMeta declares `slot` → applies. A node/panel meta does not → does not.
    expect(chrome.appliesWhen({ slot: 'AppHeader' } as unknown as ObjectMeta)).toBe(true)
    expect(chrome.appliesWhen({ caps: ['styleable'] } as ObjectMeta)).toBe(false)
    expect(chrome.appliesWhen({} as ObjectMeta)).toBe(false)
    // Naming a concrete type but declaring no `slot` is not special-cased to true.
    expect(chrome.appliesWhen({ type: 'chart', caps: ['data-bindable'] } as unknown as ObjectMeta)).toBe(false)
  })

  it('a selected chrome REGION part gets element.facet.chrome; a whole node does not', () => {
    expect(dockSectionRegistry.has('element.facet.chrome')).toBe(true)

    // A chrome region PART carries its own element META (the ChromeSliceMeta) on
    // `selectedBand.partMeta` → the chrome facet section applies (variant/region/order).
    const partMeta = chromeRegistry.getMeta('AppHeader', 'default') as unknown as ObjectMeta
    expect(partMeta).toBeTruthy()
    const chromeBand = { path: 'chrome.AppHeader', ownerId: 'site-frame', source: 'site-chrome', field: 'AppHeader', partMeta }
    const chromeIds = dockSectionRegistry
      .list(elementCtx({ selectedBand: chromeBand as never }))
      .map((s) => s.id)
    expect(chromeIds).toContain('element.facet.chrome')
    // …and the STYLE/DATA node facets do NOT bleed onto a chrome region (its meta lacks
    // those caps) — the Figma law: only the selection's OWN declared contract.
    expect(chromeIds).not.toContain('element.facet.style')
    expect(chromeIds).not.toContain('element.facet.data')

    // A whole chart node does NOT get the chrome facet (its meta declares no `slot`).
    const chart = { id: 'c1', type: 'chart', props: {} }
    const chartIds = dockSectionRegistry
      .list(elementCtx({ selected: chart as never }))
      .map((s) => s.id)
    expect(chartIds).not.toContain('element.facet.chrome')
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
