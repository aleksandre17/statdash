// @vitest-environment jsdom
//
// ── Shared shell UI hooks — useViewToggle / useCollapsible / key+accent ───────
//
//  These app-agnostic hooks were extracted out of the section slice into the
//  shared @statdash/react engine layer so ANY shell (accordion, panel, drawer,
//  chart/table container) can reuse them. This suite pins their behavior so the
//  move stays byte-identical and the hooks remain reusable with zero new code.
//
//  The real GlobalStateProvider is used so view-toggle persistence is exercised
//  for real (the only collaborator these hooks have).
//

import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import type { ReactNode }           from 'react'
import { GlobalStateProvider }      from '../../context/GlobalState'
import type { NodeDef }             from '../types'
import { useViewToggle }            from './useViewToggle'
import { useCollapsible }           from './useCollapsible'
import { viewStateKey }             from './viewStateKey'
import { accentStyle }              from './accentStyle'

afterEach(cleanup)

const wrapper = ({ children }: { children: ReactNode }) => (
  <GlobalStateProvider>{children}</GlobalStateProvider>
)

function chartTableDefs(): NodeDef[] {
  return [
    { type: 'chart', view: { role: 'chart', label: 'Chart' } } as unknown as NodeDef,
    { type: 'table', view: { role: 'table', label: 'Table' } } as unknown as NodeDef,
  ]
}

// ── viewStateKey + accentStyle helpers ───────────────────────────────────────

describe('viewStateKey', () => {
  it('composes namespace + resolved id', () => {
    expect(viewStateKey('section', 'account-A')).toBe('section:view:account-A')
  })

  it('falls back to anon when id is undefined', () => {
    expect(viewStateKey('section', undefined)).toBe('section:view:anon')
  })

  it('is namespace-parameterized (not section-bound)', () => {
    expect(viewStateKey('panel', 'p1')).toBe('panel:view:p1')
  })
})

describe('accentStyle', () => {
  it('sets --sc only when a color is authored', () => {
    expect(accentStyle('#0080BE')).toEqual({ '--sc': '#0080BE' })
    expect(accentStyle(undefined)).toBeUndefined()
  })
})

// ── useViewToggle — role derivation + hidden predicate ───────────────────────

describe('useViewToggle', () => {
  it('derives distinct, declaration-ordered roles and labels', () => {
    const { result } = renderHook(
      () => useViewToggle(chartTableDefs(), 'section', 's1', true),
      { wrapper },
    )
    expect(result.current.roles).toEqual(['chart', 'table'])
    expect(result.current.roleLabels).toEqual({ chart: 'Chart', table: 'Table' })
    expect(result.current.showToggle).toBe(true)
    expect(result.current.activeRole).toBe('chart')
  })

  it('hides children whose role is not the active role', () => {
    const defs = chartTableDefs()
    const { result } = renderHook(
      () => useViewToggle(defs, 'section', 's1', true),
      { wrapper },
    )
    expect(result.current.isHidden(defs[0])).toBe(false)
    expect(result.current.isHidden(defs[1])).toBe(true)

    act(() => result.current.setActiveRole('table'))
    expect(result.current.isHidden(defs[0])).toBe(true)
    expect(result.current.isHidden(defs[1])).toBe(false)
  })

  it('does not show the toggle for a single role (nothing hidden)', () => {
    const defs = [{ type: 'chart', view: { role: 'chart' } } as unknown as NodeDef]
    const { result } = renderHook(
      () => useViewToggle(defs, 'section', 's1', true),
      { wrapper },
    )
    expect(result.current.showToggle).toBe(false)
    expect(result.current.isHidden(defs[0])).toBe(false)
  })

  it('does not show the toggle when the caller opts out (toggle=false)', () => {
    const { result } = renderHook(
      () => useViewToggle(chartTableDefs(), 'section', 's1', false),
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
