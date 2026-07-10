// ── FF-DOCK-* — the RightDock 3-zone contract (AR-49 SL-1) ──────────────────────
//
//  Hardens Wave 7 into a HEADER / BODY / FOOTER structure with exactly ONE header
//  tier, killing the "header tab-tier collision" (SPEC-studio-shell-layout §6):
//
//  FF-DOCK-ONE-HEADER-TIER — the dock header renders exactly ONE tier at a time: the
//    context switch (Element | Page) at the top level XOR the drill breadcrumb once
//    the author has drilled into a nested item (D7.1b promotes it up). Never both
//    stacked; the schema-group/facet tabs live in the BODY, never the header.
//
//  FF-DOCK-ZONES (extends FF-RIGHTDOCK-FILLS) — the dock is a header/body/footer
//    contract: the body is the SOLE flex-fill scroll region; header + footer are
//    fixed tiers; element actions (Delete) live in the footer, not the scrolling body.
//
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { RightDock } from './RightDock'
import { setupCanvasRegistry } from '../canvas/setupCanvasRegistry'
import { useConstructorStore } from '../store/constructor.store'
import type { CanvasController } from './useCanvasController'
import type { CanvasNode, CanvasPage } from '../types/constructor'

const RAW = import.meta.glob(['./RightDock.tsx'], {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>
const rightDockSrc = Object.values(RAW)[0] ?? ''

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

// A node whose schema carries a drillable array field (D7.1b) — one link item so a
// single "Edit Home" row exists to drill into.
const LINKS: CanvasNode = {
  id: 'n1', type: 'links',
  props: { items: [{ label: { en: 'Home', ka: 'მთავარი' } }] },
  childIds: [],
}
const HERO: CanvasNode = { id: 'n2', type: 'hero', props: {}, childIds: [] }

function seedPage() {
  const page: CanvasPage = { id: 'p1', type: 'inner-page', title: { ka: 'გვ', en: 'Pg' }, slug: 'pg', nodeIds: [], nodes: {} }
  useConstructorStore.setState({ pages: [page], activePageId: 'p1' })
}

const header  = (c: HTMLElement) => c.querySelector('.studio-dock__header') as HTMLElement
const body    = (c: HTMLElement) => c.querySelector('.studio-dock__content') as HTMLElement
const footer  = (c: HTMLElement) => c.querySelector('.studio-dock__footer') as HTMLElement | null

beforeEach(() => {
  setupCanvasRegistry()
  useConstructorStore.getState().updateSite({ defaultLocale: 'en', activeLocales: ['en'] })
  useConstructorStore.setState({ pages: [], activePageId: null, selectedNodeId: null, chromeSelection: null })
})

// ── FF-DOCK-ONE-HEADER-TIER ─────────────────────────────────────────────────────
describe('FF-DOCK-ONE-HEADER-TIER — header is context XOR breadcrumb, never both', () => {
  it('top level: the header shows the context switch and NO breadcrumb', () => {
    seedPage()
    const { container } = renderDock({ pageId: 'p1', selected: HERO })
    const h = header(container)
    // The context tier is present…
    expect(within(h).getByRole('tab', { name: 'Element' })).toBeInTheDocument()
    // …and no drill breadcrumb competes in the header.
    expect(h.querySelector('nav[aria-label="Breadcrumb"]')).toBeNull()
  })

  it('the facet/schema-group presentation lives in the BODY, never the header', () => {
    seedPage()
    const { container } = renderDock({ pageId: 'p1', selected: HERO })
    // The Inspector (host of the group accordion/tabs) is inside the body…
    expect(body(container).querySelector('[data-testid="inspector"]')).not.toBeNull()
    // …never inside the header tier.
    expect(header(container).querySelector('[data-testid="inspector"]')).toBeNull()
  })

  it('drilling a nested item PROMOTES its breadcrumb into the header, replacing the context switch', () => {
    seedPage()
    const { container } = renderDock({ pageId: 'p1', selected: LINKS })
    // Before drill: the context tabs own the header.
    expect(within(header(container)).getByRole('tab', { name: 'Element' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Edit Home' }))

    const h = header(container)
    // The breadcrumb now occupies the single header tier…
    expect(h.querySelector('nav[aria-label="Breadcrumb"]')).not.toBeNull()
    // …the context switch has yielded (mutually exclusive — never stacked)…
    expect(within(h).queryByRole('tab')).toBeNull()
    // …and it is NOT also rendered in the body (promoted, not duplicated).
    expect(body(container).querySelector('nav[aria-label="Breadcrumb"]')).toBeNull()
  })

  it('navigating back out of the drill returns the context switch to the header', () => {
    seedPage()
    const { container } = renderDock({ pageId: 'p1', selected: LINKS })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Home' }))
    expect(header(container).querySelector('nav[aria-label="Breadcrumb"]')).not.toBeNull()
    // Click the root crumb (the field label) to exit the drill.
    fireEvent.click(screen.getByRole('button', { name: 'Links' }))
    const h = header(container)
    expect(h.querySelector('nav[aria-label="Breadcrumb"]')).toBeNull()
    expect(within(h).getByRole('tab', { name: 'Element' })).toBeInTheDocument()
  })

  it('the header is a context-XOR-breadcrumb ternary in source (structural mutual exclusion)', () => {
    expect(rightDockSrc).toMatch(/promoted \?/)
    // The Inspector is composed in the content/body, not the header block.
    expect(rightDockSrc).toMatch(/<Inspector\b/)
  })
})

// ── FF-DOCK-ZONES ─────────────────────────────────────────────────────────────
describe('FF-DOCK-ZONES — header/body/footer, one flex-fill scroll region', () => {
  it('renders the three zones when an element is selected', () => {
    seedPage()
    const { container } = renderDock({ pageId: 'p1', selected: HERO })
    expect(header(container)).not.toBeNull()
    expect(body(container)).not.toBeNull()
    expect(footer(container)).not.toBeNull()
  })

  it('the body is the SOLE content/scroll region (extends FF-RIGHTDOCK-FILLS)', () => {
    const { container } = renderDock({ pageId: null, selected: null })
    expect(container.querySelectorAll('[data-testid="dock-content"]')).toHaveLength(1)
  })

  it('element actions (Delete) live in the FOOTER, not the scrolling body', () => {
    seedPage()
    const { container } = renderDock({ pageId: 'p1', selected: HERO })
    const f = footer(container)!
    expect(within(f).getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    // The body carries the form, not the destructive action.
    expect(within(body(container)).queryByRole('button', { name: 'Delete' })).toBeNull()
  })

  it('no footer when the context has nothing to act on (Page context)', () => {
    seedPage()
    const { container } = renderDock({ pageId: 'p1', selected: null }) // idle → Page
    expect(footer(container)).toBeNull()
  })

  it('the dock source declares the footer zone', () => {
    expect(rightDockSrc).toMatch(/studio-dock__footer/)
  })
})
