// @vitest-environment jsdom
//
// ── SectionShell — composed DOM + ARIA guard ──────────────────────────────────
//
//  This suite pins the section shell's own composed header/methodology/body DOM
//  + ARIA. The generic units it consumes (useViewToggle, useCollapsible, the
//  key/accent helpers) are now shared @statdash/react hooks and are unit-tested
//  there (engine/hooks/shellHooks.test.tsx); this suite asserts the section's
//  composition of them.
//
//  @statdash/react (useT/useExtensions/icons) is mocked — those are the SUT's
//  collaborators, not the unit under test; mocking them lets us assert the
//  shell's own DOM without standing up SiteProvider + i18next. The real
//  GlobalStateProvider is used so view-toggle persistence is exercised for real.
//

import { describe, it, expect, vi, afterEach } from 'vitest'

// useT → identity-ish translator; useExtensions → no contributions; icons → stubs.
vi.mock('@statdash/react', () => ({
  useT:          () => (key: string) => key,
  useExtensions: () => [] as unknown[],
  SECTION_HEADER_ACTIONS: { id: 'section.header.actions' },
  InfoIcon:    () => <svg data-icon="info" />,
  ChevronIcon: ({ className }: { className?: string }) => <svg data-icon="chevron" className={className} />,
}))

import { render, fireEvent, cleanup }             from '@testing-library/react'
import { GlobalStateProvider }                     from '@statdash/react/engine'
import type { ShellProps, NodeDef }                from '@statdash/react/engine'
import { SectionShell }                            from './SectionShell'
import type { SectionNode }                        from './SectionNode'

afterEach(cleanup)

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** Minimal RenderContext touching only what SectionControl reads. */
function makeCtx(): ShellProps<SectionNode>['ctx'] {
  return {
    sectionCtx:   { dims: {} },
    filterParams: {},
    vars:         {},
    extensions:   {} as never,
  } as unknown as ShellProps<SectionNode>['ctx']
}

function chartTableChildren(): ShellProps<SectionNode>['children'] {
  const defs: NodeDef[] = [
    { type: 'chart', view: { role: 'chart', label: 'Chart' } } as unknown as NodeDef,
    { type: 'table', view: { role: 'table', label: 'Table' } } as unknown as NodeDef,
  ]
  return {
    defs,
    rendered: [<div key="0">chart-body</div>, <div key="1">table-body</div>],
  } as unknown as ShellProps<SectionNode>['children']
}

function renderShell(def: Partial<SectionNode>, children = chartTableChildren()) {
  const fullDef = { type: 'section', id: 's1', title: 'Title', ...def } as SectionNode
  // defineShell returns (def, ctx, children) => ReactNode
  const node = SectionShell(fullDef, makeCtx() as never, children as never)
  return render(<GlobalStateProvider>{node}</GlobalStateProvider>)
}

// ── SectionShell — composed DOM + ARIA ───────────────────────────────────────

describe('SectionShell render', () => {
  it('renders header, body, and applies the --sc accent override', () => {
    const { container } = renderShell({ color: '#0080BE' })
    const section = container.querySelector('section.section') as HTMLElement
    expect(section).toBeTruthy()
    expect(section.style.getPropertyValue('--sc')).toBe('#0080BE')
    expect(container.querySelector('.section__title')!.textContent).toBe('Title')

    const head = container.querySelector('.section__head')!
    expect(head.getAttribute('role')).toBe('button')
    expect(head.getAttribute('aria-expanded')).toBe('true')

    // both child bodies are mounted; the inactive one is hidden via data-view
    const views = container.querySelectorAll('.section__view')
    expect(views.length).toBe(2)
    expect(views[0].getAttribute('data-view')).toBe('visible')
    expect(views[1].getAttribute('data-view')).toBe('hidden')
  })

  it('renders the view-toggle group with aria-pressed reflecting the active role', () => {
    const { container } = renderShell({})
    const group = container.querySelector('.section__view-toggle[role="group"]')!
    const btns  = group.querySelectorAll('button')
    expect(btns.length).toBe(2)
    expect(btns[0].getAttribute('aria-pressed')).toBe('true')
    expect(btns[1].getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(btns[1])
    expect(btns[0].getAttribute('aria-pressed')).toBe('false')
    expect(btns[1].getAttribute('aria-pressed')).toBe('true')
    // body visibility follows the toggle
    const views = container.querySelectorAll('.section__view')
    expect(views[0].getAttribute('data-view')).toBe('hidden')
    expect(views[1].getAttribute('data-view')).toBe('visible')
  })

  it('toggles the methodology region from the info button', () => {
    const { container } = renderShell({
      methodology: { note: 'Note', source: 'GeoStat', lastUpdated: '2024-03' },
    })
    expect(container.querySelector('.section__methodology')).toBeNull()

    const infoBtn = container.querySelector('.section__icon-btn') as HTMLElement
    expect(infoBtn.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(infoBtn)

    const panel = container.querySelector('.section__methodology[role="region"]')!
    expect(panel).toBeTruthy()
    expect(panel.querySelector('.section__methodology-note')!.textContent).toBe('Note')
    const metas = panel.querySelectorAll('.section__methodology-meta')
    expect(metas.length).toBe(2)
    expect(metas[0].textContent).toContain('GeoStat')
    expect(metas[1].textContent).toContain('2024-03')

    fireEvent.click(panel.querySelector('.section__methodology-close')!)
    expect(container.querySelector('.section__methodology')).toBeNull()
  })

  it('collapses the body on header click', () => {
    const { container } = renderShell({})
    expect(container.querySelector('.section__body')).toBeTruthy()
    fireEvent.click(container.querySelector('.section__head')!)
    expect(container.querySelector('.section__body')).toBeNull()
  })

  it('renders a hero section as non-collapsible (no chevron / no button role)', () => {
    // Emphasis is now a DECLARED variant (variants.emphasis) projected to the
    // `data-emphasis` attribute — NOT a `section--hero` modifier class (the
    // variant-style spine reconception). noCollapse still drives collapse state.
    const { container } = renderShell({ variants: { emphasis: 'hero' }, view: { noCollapse: true } })
    const head = container.querySelector('.section__head')!
    expect(head.getAttribute('role')).toBeNull()
    expect(container.querySelector('.section__chevron')).toBeNull()
    // The visual/behavioral contract holds: the section carries data-emphasis="hero"
    // (the byte-identical move from class modifier → data attribute).
    const section = container.querySelector('section.section')!
    expect(section.getAttribute('data-emphasis')).toBe('hero')
    // And the legacy modifier class is gone (no dual-class regression).
    expect(container.querySelector('.section--hero')).toBeNull()
  })
})
