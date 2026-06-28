// @vitest-environment jsdom
//
// ── shellAxe.fitness.test.tsx — FF-PLUGIN-SHELLS-AXE-CLEAN [RX-22 / X-4 / EXP-09] ─
//
//  THE INVARIANT: every REAL plugin shell a citizen sees renders WCAG-clean HTML.
//
//  The engine a11y gate (RX-24, packages/react) is excellent but, by the dependency
//  arrow (Law 3), the engine cannot import plugin shells — so it walks its OWN
//  stand-in slices, NOT the chart/kpi/table/filter-bar/perspective-bar/map/gauge/hero
//  shells users actually see. This gate closes that gap: it lives in `packages/plugins`
//  (where importing the real shells IS allowed), registers every real slice, and runs
//  axe-core over the rendered output of EACH shell in the mandated set.
//
//  WHY DIRECT SHELL CALLS (not the full renderNode pipeline): renderNode wraps every
//  node in a NodeErrorBoundary — a crashing shell would render an accessible *fallback*
//  and the axe check would pass VACUOUSLY, masking the very failure we want to catch.
//  Calling the shell directly (the committed PerspectiveBar a11y pattern) makes a shell
//  crash a TEST crash, and lets us inject representative props/rows so the shell renders
//  its real content, not an error card.
//
//  jsdom reality (honest scope): chart · gauge · map render an ApexCharts/Leaflet
//  canvas that cannot mount in jsdom (no layout engine) — the whole codebase tests
//  Apex via its option builders, never a real mount. Those shells are exercised on
//  their EMPTY-STATE path (rows=[] → the shell's own EmptyState), which IS the shell's
//  real output and is the surface a screen-reader hits before data resolves. The
//  content-rich, plain-HTML shells (table, hero, perspective-bar, filter-bar) render
//  WITH content, where the real a11y risk lives (table headers/scope, form labels,
//  tablist roles). The chart/gauge data-viz a11y twin is INNOV-6 (a separate seam).
//
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { render, cleanup }                            from '@testing-library/react'
import axe                                            from 'axe-core'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter }                               from 'react-router-dom'

import { SiteProvider, ExtensionRegistry, FilterProvider, PageStoreProvider } from '@statdash/react'
import {
  nodeRegistry, registerSlice, FiltersProvider,
}                                                     from '@statdash/react/engine'
import { createDefaultUI }                            from '@statdash/react/engine/createDefaultUI'
import { DefaultCommandBus }                          from '@statdash/react/engine/commands/CommandBus'
import type {
  RenderContext, ChildrenArg, NodeBase, NodeDef,
}                                                     from '@statdash/react/engine'
import { staticStore }                                from '@statdash/engine'
import type { DataStore, SectionContext, PerspectiveContext, DataRow, BarNode } from '@statdash/engine'

import * as Panels   from '../panels'
import * as Nodes    from '../nodes'
import * as Controls from '../controls'
import { registerTopology }                           from '../panels/map/default/topologyRegistry'

// ── Register every real slice + a representative topology, once ────────────────
beforeAll(() => {
  ;[
    ...Object.values(Panels),
    ...Object.values(Nodes),
    ...Object.values(Controls),
  ].forEach((s) => registerSlice(s as Parameters<typeof registerSlice>[0]))

  registerTopology({
    id:      'axe-fixture',
    label:   'Axe Fixture',
    data:    { type: 'FeatureCollection', features: [] },
    dimProp: 'iso',
  })
})

afterEach(() => cleanup())

// ── axe runner — promisified callback API (matches the RX-24 engine gate) ──────
async function runAxe(container: HTMLElement): Promise<axe.AxeResults> {
  return new Promise((resolve, reject) => {
    axe.run(container, { resultTypes: ['violations'] }, (err, results) => {
      if (err) reject(err)
      else     resolve(results)
    })
  })
}

// ── Minimal RenderContext — mirrors the RX-24 engine harness ───────────────────
function makeCtx(rows: DataRow[] = []): RenderContext {
  const sectionCtx: SectionContext = { dims: { time: 2024 }, perspectiveState: { mode: 'year' } }
  const perspective: PerspectiveContext = {
    current:   'year',
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
    rows,
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
    renderNode:     (() => null) as RenderContext['renderNode'],
  } as RenderContext
  return holder.ctx
}

const EMPTY_CHILDREN: ChildrenArg = { defs: [], rendered: [], renderChild: () => null, slots: {} }

// Sample rows for the plain-HTML data shells (table) — generic dims (Law 1).
const SAMPLE_ROWS: DataRow[] = [
  { time: 2023, value: 42, label: 'Alpha' } as unknown as DataRow,
  { time: 2024, value: 57, label: 'Beta'  } as unknown as DataRow,
]

// A filter bar with one control of each registered kind we can exercise (year-select).
const FILTER_BARS: BarNode[] = [
  {
    id:       'fb',
    position: 'sticky',
    items:    [
      { type: 'year-select', key: 'year', label: { ka: 'წელი', en: 'Year' },
        years: { type: 'static', items: [2023, 2024] }, default: '2024' } as unknown as BarNode['items'][number],
    ],
  } as unknown as BarNode,
]

// ── Provider wrapper — the real runtime context the shells read from ───────────
function Providers({ children, bars = [] }: { children: ReactNode; bars?: BarNode[] }): ReactElement {
  return (
    <MemoryRouter initialEntries={['/en']}>
      <SiteProvider
        stores={{ main: { ...staticStore } as DataStore }}
        nav={[]}
        i18n={{ locales: ['en', 'ka'], defaultLocale: 'en', fallbackLocale: 'en' }}
      >
        <PageStoreProvider store={{ ...staticStore } as DataStore}>
          <FilterProvider>
            <FiltersProvider value={{ bars, perspectiveKey: 'mode' }}>
              {children}
            </FiltersProvider>
          </FilterProvider>
        </PageStoreProvider>
      </SiteProvider>
    </MemoryRouter>
  )
}

// ── The mandated shell set + a representative def/ctx/children for each ─────────
//
//  `contentful` shells render real HTML content (the high-a11y-risk surface);
//  the Apex/Leaflet shells render their empty-state path (jsdom-safe, see header).
//
interface ShellCase {
  type:     string                 // nodeRegistry type — also the coverage key
  def:      NodeBase
  rows?:    DataRow[]
  bars?:    BarNode[]
}

const CASES: ShellCase[] = [
  { type: 'perspective-bar', def: { type: 'perspective-bar', id: 'pb' } as NodeBase },
  { type: 'filter-bar',      def: { type: 'filter-bar', id: 'fb' } as NodeBase, bars: FILTER_BARS },
  {
    type: 'table',
    def: {
      type: 'table', id: 't',
      colLabel: { ka: 'წელი', en: 'Year' },
      columns:  [{ key: 'value', label: { ka: 'მნიშვნელობა', en: 'Value' } }],
    } as unknown as NodeBase,
    rows: SAMPLE_ROWS,
  },
  {
    type: 'hero',
    def: {
      type: 'hero', id: 'h',
      title: { ka: 'სათაური', en: 'Title' },
      subtitle: { ka: 'ქვესათაური', en: 'Subtitle' },
      cards: [
        { id: 'a', title: { ka: 'ა', en: 'Alpha' }, img: '/a.svg', color: '#123456' },
        { id: 'b', title: { ka: 'ბ', en: 'Beta'  }, img: '/b.svg', color: '#654321' },
      ],
    } as unknown as NodeBase,
  },
  { type: 'chart', def: { type: 'chart', id: 'c', chartType: 'bar', label: { ka: 'დიაგრამა', en: 'Chart' } } as unknown as NodeBase },
  { type: 'kpi-strip', def: { type: 'kpi-strip', id: 'k', items: [] } as unknown as NodeBase },
  { type: 'gauge', def: { type: 'gauge', id: 'g' } as NodeBase },
  { type: 'map', def: { type: 'map', id: 'm', topologyId: 'axe-fixture', dimProp: 'iso' } as unknown as NodeBase },
]

const MANDATED = CASES.map((c) => c.type)

function renderShell(c: ShellCase): HTMLElement {
  const shell = nodeRegistry.get(c.type, 'default')
  if (!shell) throw new Error(`No shell registered for "${c.type}"`)
  const ctx = makeCtx(c.rows ?? [])
  const el  = shell(c.def as NodeDef, ctx, EMPTY_CHILDREN) as ReactNode
  const { container } = render(<Providers bars={c.bars}>{el}</Providers>)
  return container
}

describe('FF-PLUGIN-SHELLS-AXE-CLEAN — every real plugin shell renders WCAG-clean HTML', () => {
  it('every mandated shell type is actually registered (coverage gate)', () => {
    const types = nodeRegistry.types()
    for (const t of MANDATED) expect(types, `shell "${t}" must be registered`).toContain(t)
  })

  it.each(CASES.map((c) => [c.type, c] as const))(
    'shell "%s" has zero axe violations',
    async (_type, c) => {
      const container = renderShell(c)
      // Non-vacuous guard: a shell that rendered `null`/nothing would pass axe
      // trivially, masking a real failure. Require it to have emitted real DOM —
      // its content (table, tablist, hero) OR its own EmptyState/placeholder.
      expect(
        container.querySelectorAll('*').length,
        `shell "${c.type}" rendered no DOM — axe would pass vacuously`,
      ).toBeGreaterThan(0)

      const results = await runAxe(container)
      const summary = results.violations
        .map((v) => `${v.id} (${v.nodes.length}): ${v.help}`)
        .join('\n  ')
      expect(results.violations, `axe violations for "${c.type}":\n  ${summary}`).toHaveLength(0)
    },
  )
})
