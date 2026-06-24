// @vitest-environment jsdom
//
// ── SectionShell + extracted units — readability-refactor guard ───────────────
//
//  This suite pins the behavior the SectionShell readability refactor must keep
//  byte-identical: the role-based view toggle (useViewToggle), the collapse
//  a11y/keyboard contract (useCollapsible), the key/style helpers (sectionKeys),
//  and the composed header/methodology/body DOM + ARIA of the shell itself.
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

import { render, fireEvent, renderHook, act, cleanup } from '@testing-library/react'
import type { ReactNode }                          from 'react'
import { GlobalStateProvider }                     from '@statdash/react/engine'
import type { ShellProps, NodeDef }                from '@statdash/react/engine'
import { SectionShell }                            from './SectionShell'
import type { SectionNode }                        from './SectionNode'
import { useViewToggle }                           from './useViewToggle'
import { useCollapsible }                          from './useCollapsible'
import { sectionViewStateKey, sectionAccentStyle } from './sectionKeys'

afterEach(cleanup)

// ── Fixtures ─────────────────────────────────────────────────────────────────

const wrapper = ({ children }: { children: ReactNode }) => (
  <GlobalStateProvider>{children}</GlobalStateProvider>
)

/** Minimal RenderContext touching only what SectionControl reads. */
function makeCtx(): ShellProps<SectionNode>['ctx'] {
  return {
    sectionCtx:   { dims: {}, timeMode: 'year' },
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

// ── sectionKeys helpers ──────────────────────────────────────────────────────

describe('sectionKeys', () => {
  it('sectionViewStateKey namespaces by resolved id', () => {
    expect(sectionViewStateKey('account-A')).toBe('section:view:account-A')
  })

  it('sectionViewStateKey falls back to anon when id is undefined', () => {
    expect(sectionViewStateKey(undefined)).toBe('section:view:anon')
  })

  it('sectionAccentStyle sets --sc only when a color is authored', () => {
    expect(sectionAccentStyle('#0080BE')).toEqual({ '--sc': '#0080BE' })
    expect(sectionAccentStyle(undefined)).toBeUndefined()
  })
})

// ── useViewToggle — role derivation + hidden predicate ───────────────────────

describe('useViewToggle', () => {
  it('derives distinct, declaration-ordered roles and labels', () => {
    const { result } = renderHook(
      () => useViewToggle(chartTableChildren().defs, 's1', true),
      { wrapper },
    )
    expect(result.current.roles).toEqual(['chart', 'table'])
    expect(result.current.roleLabels).toEqual({ chart: 'Chart', table: 'Table' })
    expect(result.current.showToggle).toBe(true)
    expect(result.current.activeRole).toBe('chart')
  })

  it('hides children whose role is not the active role', () => {
    const children = chartTableChildren()
    const { result } = renderHook(
      () => useViewToggle(children.defs, 's1', true),
      { wrapper },
    )
    // active = chart → chart visible, table hidden
    expect(result.current.isHidden(children.defs[0])).toBe(false)
    expect(result.current.isHidden(children.defs[1])).toBe(true)

    act(() => result.current.setActiveRole('table'))
    expect(result.current.isHidden(children.defs[0])).toBe(true)
    expect(result.current.isHidden(children.defs[1])).toBe(false)
  })

  it('does not show the toggle for a single role (nothing hidden)', () => {
    const single = {
      defs: [{ type: 'chart', view: { role: 'chart' } } as unknown as NodeDef],
      rendered: [<div key="0" />],
    } as unknown as ShellProps<SectionNode>['children']
    const { result } = renderHook(
      () => useViewToggle(single.defs, 's1', true),
      { wrapper },
    )
    expect(result.current.showToggle).toBe(false)
    expect(result.current.isHidden(single.defs[0])).toBe(false)
  })

  it('does not show the toggle when the section opts out (toggle=false)', () => {
    const { result } = renderHook(
      () => useViewToggle(chartTableChildren().defs, 's1', false),
      { wrapper },
    )
    expect(result.current.showToggle).toBe(false)
  })
})

// ── useCollapsible — open state + keyboard/ARIA contract ─────────────────────

describe('useCollapsible', () => {
  it('defaults open and exposes a button-role head with aria-expanded', () => {
    const { result } = renderHook(() => useCollapsible(undefined, undefined))
    expect(result.current.open).toBe(true)
    expect(result.current.canCollapse).toBe(true)
    expect(result.current.headProps.role).toBe('button')
    expect(result.current.headProps.tabIndex).toBe(0)
    expect(result.current.headProps['aria-expanded']).toBe(true)
    expect(result.current.headProps.style).toEqual({ cursor: 'pointer' })
  })

  it('respects defaultOpen=false', () => {
    const { result } = renderHook(() => useCollapsible(false, undefined))
    expect(result.current.open).toBe(false)
    expect(result.current.headProps['aria-expanded']).toBe(false)
  })

  it('toggles on click', () => {
    const { result } = renderHook(() => useCollapsible(true, undefined))
    act(() => result.current.headProps.onClick())
    expect(result.current.open).toBe(false)
  })

  it('toggles on Enter and Space, ignores other keys', () => {
    const { result } = renderHook(() => useCollapsible(true, undefined))
    const press = (key: string) =>
      act(() => result.current.headProps.onKeyDown({ key, preventDefault: () => {} }))

    press('Enter'); expect(result.current.open).toBe(false)
    press(' ');     expect(result.current.open).toBe(true)
    press('a');     expect(result.current.open).toBe(true)
  })

  it('is inert when collapse is disabled (noCollapse)', () => {
    const { result } = renderHook(() => useCollapsible(true, true))
    expect(result.current.canCollapse).toBe(false)
    expect(result.current.headProps.role).toBeUndefined()
    expect(result.current.headProps.tabIndex).toBeUndefined()
    expect(result.current.headProps['aria-expanded']).toBeUndefined()
    expect(result.current.headProps.style).toEqual({ cursor: 'default' })
    act(() => result.current.headProps.onClick())
    expect(result.current.open).toBe(true) // unchanged
  })
})

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
    const { container } = renderShell({ view: { hero: true, noCollapse: true } })
    const head = container.querySelector('.section__head')!
    expect(head.getAttribute('role')).toBeNull()
    expect(container.querySelector('.section__chevron')).toBeNull()
    expect(container.querySelector('section.section--hero')).toBeTruthy()
  })
})
