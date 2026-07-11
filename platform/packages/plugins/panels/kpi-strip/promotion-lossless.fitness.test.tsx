// @vitest-environment jsdom
//
// ── promotion-lossless.fitness.test.tsx — FF-PROMOTION-LOSSLESS (ADR-023 · R2) ──
//
//  THE ONE-WAY-DOOR AUTHORIZER. The kpi-card promotion (ADR-023 §3.3) is built
//  Strangler-style: the promoted `kpi-card` NODE renders ALONGSIDE the legacy
//  `KpiStripNode.items[]` value-band path, and `isPromotionEnabled('kpi-card')`
//  selects the residence. The legacy path may be RETIRED (the R2-contract one-way
//  door) ONLY once this gate proves the two residences emit BYTE-IDENTICAL output
//  over EVERY stored config. This test is that proof — it is deliberately REAL and
//  NON-VACUOUS:
//
//    • it renders the ACTUAL geostat.provisioning.json corpus (every kpi-strip),
//    • through the REAL renderNode pipeline, BOTH ways (flag off vs on),
//    • across BOTH perspectives (year/range — so the `when`→`view.visibleWhen`
//      visibility lift is exercised in its visible AND hidden regimes), and
//    • asserts the rendered DOM is IDENTICAL — while a control proves the DOM
//      comparator BITES (a one-field mutation is detected, so the green equality
//      is meaningful, never vacuously-equal-because-both-empty).
//
//  Lives PLUGINS-side (the arrow forbids react/core from importing plugin shells);
//  it registers the real kpi-strip + kpi-card slices and drives them end-to-end.
//
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { render, cleanup }                            from '@testing-library/react'
import { readFileSync }                               from 'node:fs'
import { fileURLToPath }                              from 'node:url'
import { dirname, resolve }                           from 'node:path'
import type { ReactElement, ReactNode }               from 'react'
import { MemoryRouter }                               from 'react-router-dom'

import { SiteProvider, ExtensionRegistry, FilterProvider, PageStoreProvider } from '@statdash/react'
import {
  registerSlice, renderNode, FiltersProvider,
  enablePromotion, disablePromotion, withPromotion, isPromotionEnabled,
}                                                     from '@statdash/react/engine'
import { createDefaultUI }                            from '@statdash/react/engine/createDefaultUI'
import { DefaultCommandBus }                          from '@statdash/react/engine/commands/CommandBus'
import type {
  RenderContext, NodeBase, NodeDef,
}                                                     from '@statdash/react/engine'
import { staticStore }                                from '@statdash/engine'
import type { DataStore, KpiSpec, SectionContext, PerspectiveContext } from '@statdash/engine'

import * as KpiStripSlice from './default'
import * as KpiCardSlice  from './card'
import { kpiSpecToCardNode, cardNodeToKpiSpec } from './card'

// ── Register the two residences (legacy strip + promoted card) once ─────────────
beforeAll(() => {
  registerSlice(KpiStripSlice as unknown as Parameters<typeof registerSlice>[0])
  registerSlice(KpiCardSlice  as unknown as Parameters<typeof registerSlice>[0])
})
afterEach(() => cleanup())

// ── The stored corpus — the REAL provisioning config (the exemplar corpus) ──────
interface KpiStripNodeShape extends NodeBase { type: 'kpi-strip'; items: KpiSpec[] }

const here         = dirname(fileURLToPath(import.meta.url))            // …/panels/kpi-strip
const provisioning = resolve(here, '../../../../apps/api/provisioning/geostat.provisioning.json')
const CORPUS       = JSON.parse(readFileSync(provisioning, 'utf8')) as unknown

/** Deep-walk the corpus collecting every kpi-strip node (any depth, any page). */
function collectKpiStrips(root: unknown): KpiStripNodeShape[] {
  const out: KpiStripNodeShape[] = []
  const walk = (o: unknown): void => {
    if (Array.isArray(o)) { o.forEach(walk); return }
    if (o && typeof o === 'object') {
      const n = o as Record<string, unknown>
      if (n.type === 'kpi-strip' && Array.isArray(n.items)) out.push(n as unknown as KpiStripNodeShape)
      Object.values(n).forEach(walk)
    }
  }
  walk(root)
  return out
}

const STRIPS = collectKpiStrips(CORPUS)
const CARDS  = STRIPS.flatMap(s => s.items)

// Both perspectives, so year-only AND range-only cards each hit their visible and
// their hidden regime — the `when`→`view.visibleWhen` lift is proven in both.
const PERSPECTIVES = ['year', 'range'] as const

// ── Minimal RenderContext (mirrors the shellAxe harness) ────────────────────────
function makeCtx(mode: string): RenderContext {
  const sectionCtx: SectionContext = { dims: { time: 2024 }, perspectiveState: { mode } }
  const perspective: PerspectiveContext = {
    current:   mode,
    available: [
      { id: 'year',  label: 'Annual',   icon: 'calendar' },
      { id: 'range', label: 'Dynamics', icon: 'calendar-range' },
    ] as PerspectiveContext['available'],
    set: () => {},
  }
  const holder = { ctx: null as unknown as RenderContext }
  holder.ctx = {
    sectionCtx,
    stores:         { main: { ...staticStore } as DataStore },
    pageStoreKey:   'main',
    rows:           [],
    filterParams:   {},
    vars:           {},
    locale:         'en',
    fallbackLocale: 'en',
    perspectiveKey: 'mode',
    perspective,
    extensions:     new ExtensionRegistry(),
    ui:             createDefaultUI(),
    eventBus:       { publish: () => {}, subscribe: () => () => {} } as unknown as RenderContext['eventBus'],
    bus:            new DefaultCommandBus(),
    set:            () => {},
    resolveLinks:   () => [],
    // The recursive seam the PROMOTED strip uses to render each kpi-card node.
    renderNode:     (n: NodeDef, o?: Partial<RenderContext>): ReactNode =>
      renderNode(n as NodeBase, o ? { ...holder.ctx, ...o } : holder.ctx),
  } as RenderContext
  return holder.ctx
}

function Providers({ children }: { children: ReactNode }): ReactElement {
  return (
    <MemoryRouter initialEntries={['/en']}>
      <SiteProvider
        stores={{ main: { ...staticStore } as DataStore }}
        nav={[]}
        i18n={{ locales: ['en', 'ka'], defaultLocale: 'en', fallbackLocale: 'en' }}
      >
        <PageStoreProvider store={{ ...staticStore } as DataStore}>
          <FilterProvider>
            <FiltersProvider value={{ bars: [], perspectiveKey: 'mode' }}>
              {children}
            </FiltersProvider>
          </FilterProvider>
        </PageStoreProvider>
      </SiteProvider>
    </MemoryRouter>
  )
}

/** Render a node through the real pipeline under the runtime providers → its DOM. */
function markup(node: NodeBase, ctx: RenderContext): string {
  const { container } = render(<Providers>{renderNode(node, ctx)}</Providers>)
  const html = container.innerHTML
  cleanup()
  return html
}

// ── FF-PROMOTION-LOSSLESS — the byte-identical residence gate ───────────────────
describe('FF-PROMOTION-LOSSLESS — kpi-card promoted residence is DOM-identical to the legacy path', () => {
  it('the corpus is non-trivial (a vacuous gate over 0 strips proves nothing)', () => {
    expect(STRIPS.length).toBeGreaterThanOrEqual(3)          // 3 kpi-strips in geostat provisioning
    expect(CARDS.length).toBeGreaterThanOrEqual(20)          // 23 cards across the corpus
    // Value-type coverage: the gate must exercise the WHOLE KpiValueSpec algebra,
    // not just the trivial 'point' case — else a lossy 'share'/'metric' promotion
    // could slip through green.
    const kinds = new Set(CARDS.map(c => (c.value as { type: string }).type))
    for (const k of ['point', 'yoy', 'cagr', 'share', 'metric']) expect(kinds.has(k)).toBe(true)
  })

  it('renders a real card (non-vacuous): the legacy DOM carries kpi-card structure', () => {
    const ctx = makeCtx('year')
    const html = markup(STRIPS[0]! as unknown as NodeBase, ctx)
    expect(html).toContain('kpi-strip__grid')
    expect(html).toContain('class="kpi-card"')
    expect(html).toContain('kpi-value')                      // a card actually rendered, not an empty state
  })

  it.each(PERSPECTIVES)('every stored kpi-strip renders byte-identically in BOTH residences [perspective=%s]', (mode) => {
    for (const strip of STRIPS) {
      const node = strip as unknown as NodeBase

      disablePromotion('kpi-card')
      const legacyHtml = markup(node, makeCtx(mode))

      const promotedHtml = withPromotion('kpi-card', () => markup(node, makeCtx(mode)))

      expect(promotedHtml).toBe(legacyHtml)
    }
  })

  it('the DOM comparator BITES — a one-field mutation is detected (the gate is not vacuous)', () => {
    // Control: prove the equality above is meaningful. Mutate ONE field of ONE card
    // (its accent colour) and confirm the rendered DOM DIFFERS. If this failed, the
    // green equality could be a false-green (e.g. both rendering an empty state).
    const ctx    = makeCtx('year')
    const strip  = STRIPS[0]! as unknown as KpiStripNodeShape
    const base   = markup(strip as unknown as NodeBase, ctx)

    const mutated: KpiStripNodeShape = {
      ...strip,
      items: strip.items.map((it, i) => (i === 0 ? { ...it, color: '#ff0000ff-DIFFERENT' } : it)),
    }
    const changed = markup(mutated as unknown as NodeBase, ctx)

    expect(changed).not.toBe(base)                           // the comparator distinguishes a single field
  })
})

// ── ROUND-TRIP — the promotion relocates facets losslessly (no data loss) ───────
describe('FF-PROMOTION-LOSSLESS · round-trip — the lowering loses no config data', () => {
  it('every stored card lowers to a kpi-card node and back with zero payload loss', () => {
    for (const spec of CARDS) {
      const node = kpiSpecToCardNode(spec)

      // Identity + visibility are relocated to NODE facets, not lost:
      expect(node.id).toBe(spec.id)
      if (spec.when) expect(node.view?.visibleWhen).toEqual(spec.when)
      else           expect(node.view?.visibleWhen).toBeUndefined()

      // Every other field round-trips byte-for-byte (spec → node → spec), with
      // `when` intentionally residing on the node facet (not the value band):
      const back = cardNodeToKpiSpec(node)
      const { when: _when, ...specNoWhen } = spec
      expect(back).toEqual(specNoWhen)
    }
  })

  it('the stored corpus shape is untouched — the lowering is render-time only', () => {
    // The promotion adds NO migration and mutates NO stored field: the config still
    // carries kpi cards as `kpi-strip.items[]` (Law 2 — stored configs load
    // unchanged; the existing roundtrip-pages.fitness.test stays green because no
    // codec/migration changed). Assert the corpus still parses to that shape.
    for (const strip of STRIPS) {
      expect(Array.isArray(strip.items)).toBe(true)
      expect(strip.items.length).toBeGreaterThan(0)
      for (const it of strip.items) expect(typeof it.value).toBe('object')
    }
  })
})

// ── The flag itself, proven both ways ───────────────────────────────────────────
describe('FF-PROMOTION-LOSSLESS · flag — the residence flag selects, default OFF', () => {
  it('default is OFF and enable/disable/withPromotion toggle exactly the named type', () => {
    disablePromotion('kpi-card')
    expect(isPromotionEnabled('kpi-card')).toBe(false)        // ships dark
    enablePromotion('kpi-card')
    expect(isPromotionEnabled('kpi-card')).toBe(true)
    disablePromotion('kpi-card')
    expect(isPromotionEnabled('kpi-card')).toBe(false)
    // named-scope: withPromotion touches ONLY its type (hero-card, R3, stays OFF)
    withPromotion('kpi-card', () => {
      expect(isPromotionEnabled('kpi-card')).toBe(true)
      expect(isPromotionEnabled('hero-card')).toBe(false)
    })
    expect(isPromotionEnabled('kpi-card')).toBe(false)        // restored
  })
})
