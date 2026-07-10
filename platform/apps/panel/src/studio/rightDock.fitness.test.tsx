// ── FF-RIGHTDOCK-* — the canonical tri-context dock invariants (AR-49 M4 Wave 7) ─
//
//  Three red-on-regression gates for the right dock's canonical model (SPEC §2.11):
//
//  FF-RIGHTDOCK-SINGLE-EMPTYSTATE — the dock renders AT MOST one empty-state in any
//    state (extends FF-ONE-EMPTYSTATE): the old dock stacked a fixed island + three
//    always-mounted page panes, each printing its own "nothing here". Now there is
//    exactly one guided state per region, or none.
//
//  FF-RIGHTDOCK-CONTEXTUAL — the page-scoped panes (page config / perspectives /
//    filters) render ONLY in the Page selection context, never stacked beneath a node
//    Inspector. A node selected → only that node's schema-driven config.
//
//  FF-RIGHTDOCK-FILLS — the dock content region is flex-fill (flex:1 + min-height:0)
//    with NO fixed-height dead island — the layout contract that kills the reported
//    right-side void by construction.
//
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RightDock } from './RightDock'
import { setupCanvasRegistry } from '../canvas/setupCanvasRegistry'
import { useConstructorStore } from '../store/constructor.store'
import type { CanvasController } from './useCanvasController'
import type { CanvasNode, CanvasPage } from '../types/constructor'

// RightDock source for the layout-contract leg — via the proven FF-CHROME glob idiom.
// NOTE: `.css?raw` resolves to '' in this vitest config (CSS is not processed), so the
// fill contract is asserted on the dock's own source + structure, never the stylesheet.
const RAW = import.meta.glob(['./RightDock.tsx'], {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>
const rightDockSrc = Object.values(RAW)[0] ?? ''

// A RightDock controller stub — the dock reads a small subset; the rest is inert.
function stubController(over: Partial<CanvasController>): CanvasController {
  return {
    page: null, pageId: null, selected: null, selectedId: null, chromeSel: null,
    nodeConfig: null, selectedBindable: false,
    dragging: false, setDragging: () => {},
    previewPerspectiveId: undefined, setPreviewPerspectiveId: () => {},
    selectNode: () => {}, bindMetric: () => {}, handleDrop: () => {},
    patchProp: () => {}, setVisibleWhen: () => {}, deleteSelected: () => {},
    ...over,
  } as unknown as CanvasController
}

function renderDock(over: Partial<CanvasController>) {
  return render(
    <RightDock
      controller={stubController(over)}
      locale="en"
      collapsed={false}
      onToggleCollapsed={() => {}}
      width={320}
      onResize={() => {}}
    />,
  )
}

const HERO: CanvasNode = { id: 'n1', type: 'hero', props: {}, childIds: [] }

function seedPage() {
  const page: CanvasPage = { id: 'p1', type: 'inner-page', title: { ka: 'გვ', en: 'Pg' }, slug: 'pg', nodeIds: [], nodes: {} }
  useConstructorStore.setState({ pages: [page], activePageId: 'p1' })
}

beforeEach(() => {
  setupCanvasRegistry() // idempotent — palettes + presentation projectors for pageSchemaSource
  useConstructorStore.getState().updateSite({ defaultLocale: 'en', activeLocales: ['en'] })
  useConstructorStore.setState({ pages: [], activePageId: null, selectedNodeId: null, chromeSelection: null })
})

// ── FF-RIGHTDOCK-SINGLE-EMPTYSTATE ────────────────────────────────────────────
describe('FF-RIGHTDOCK-SINGLE-EMPTYSTATE — at most one empty-state', () => {
  it('no pages → exactly ONE empty-state (no-pages)', () => {
    const { container } = renderDock({ pageId: null, selected: null })
    const states = container.querySelectorAll('[data-empty-state-kind]')
    expect(states).toHaveLength(1)
    expect(states[0].getAttribute('data-empty-state-kind')).toBe('no-pages')
  })

  it('a node is selected → ZERO empty-states (its schema fills the dock)', () => {
    seedPage()
    const { container } = renderDock({ pageId: 'p1', selected: HERO })
    expect(container.querySelectorAll('[data-empty-state-kind]')).toHaveLength(0)
  })

  it('Element context with nothing selected → exactly ONE (no-selection), never stacked', () => {
    seedPage()
    renderDock({ pageId: 'p1', selected: null }) // idle → Page context
    // Peek the Element tab while nothing is selected → the single quiet hint.
    fireEvent.click(screen.getByRole('tab', { name: 'Element' }))
    const states = document.querySelectorAll('[data-empty-state-kind]')
    expect(states).toHaveLength(1)
    expect(states[0].getAttribute('data-empty-state-kind')).toBe('no-selection')
  })
})

// ── FF-RIGHTDOCK-CONTEXTUAL ───────────────────────────────────────────────────
describe('FF-RIGHTDOCK-CONTEXTUAL — page panes only in the Page context', () => {
  it('a node selected → node config only; the page panes are ABSENT', () => {
    seedPage()
    renderDock({ pageId: 'p1', selected: HERO })
    // The node Inspector + its delete affordance are present…
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    // …and the page-scoped panes are NOT stacked beneath it.
    expect(screen.queryByTestId('page-inspector')).toBeNull()
  })

  it('nothing selected → the Page context surfaces the page-scoped panes', () => {
    seedPage()
    renderDock({ pageId: 'p1', selected: null }) // idle → Page context
    expect(screen.getByTestId('page-inspector')).toBeInTheDocument()
    // No node delete affordance in the Page context.
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
  })

  it('the Page tab keeps page authoring one gesture away while a node is selected', () => {
    seedPage()
    renderDock({ pageId: 'p1', selected: HERO }) // element context
    expect(screen.queryByTestId('page-inspector')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Page' }))
    expect(screen.getByTestId('page-inspector')).toBeInTheDocument()
  })
})

// ── FF-RIGHTDOCK-FILLS ────────────────────────────────────────────────────────
describe('FF-RIGHTDOCK-FILLS — flex-fill content region, no fixed-height island', () => {
  it('renders exactly ONE content region (all content flows through it)', () => {
    const { container } = renderDock({ pageId: null, selected: null })
    expect(container.querySelectorAll('[data-testid="dock-content"]')).toHaveLength(1)
  })

  it('every empty-state the dock renders fills the region (fill-by-construction)', () => {
    // Each <StudioEmptyState> is passed `fill`, so it occupies the whole content
    // region instead of a short island above a void — the reported defect's cure.
    const tags = rightDockSrc.match(/<StudioEmptyState[^>]*\/>/g) ?? []
    expect(tags.length).toBeGreaterThan(0)
    for (const tag of tags) expect(tag).toMatch(/\bfill\b/)
  })

  it('the dock source carries no fixed-height dead island (the reported void)', () => {
    // The old defect was a ~160px fixed-height empty island. No 3-digit px height on
    // any container may return (control heights like the 36px tab bar are < 100 → ok).
    expect(rightDockSrc).not.toMatch(/(min-?[Hh]eight|height):\s*['"]?[1-9]\d\d/)
  })
})
