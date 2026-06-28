// @vitest-environment jsdom
//
// ── Perspective-bar APG Tabs keyboard interaction (RX-21) ─────────────────────
//
//  axe CANNOT detect missing roving-tabindex or arrow-key handlers — they are a
//  behavioural contract, so this gate exercises the real shell with fireEvent and
//  asserts the W3C APG Tabs keyboard model: roving tabindex, Left/Right + Up/Down
//  move-and-activate, Home/End, wrap-around. Closes the blanket WCAG 2.1.1 gap.
//
//  The shell pulls `useT` from @statdash/react (which needs SiteProvider for the
//  locale); we mock that ONE seam to a passthrough so the test stays a focused
//  unit on the keyboard behaviour, not the i18n stack.
//

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
vi.mock('@statdash/react', () => ({ useT: () => (k: string) => k }))

import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { ReactElement } from 'react'
import { PerspectiveBarShell } from './PerspectiveBarShell'
import type { RenderContext } from '@statdash/react/engine'
import type { PerspectiveBarNode } from './PerspectiveBarNode'

interface PerspectiveTriad {
  current:   string
  available: { id: string; label: string; icon?: string }[]
  set:       (id: string) => void
}

const AVAILABLE = [
  { id: 'year',  label: 'Annual',   icon: 'calendar' },
  { id: 'range', label: 'Dynamics', icon: 'calendar-range' },
]

let setSpy: ReturnType<typeof vi.fn>

function renderBar(current: string) {
  setSpy = vi.fn()
  const perspective: PerspectiveTriad = { current, available: AVAILABLE, set: setSpy as unknown as (id: string) => void }
  const ctx = { perspective } as unknown as RenderContext
  const def = { type: 'perspective-bar', id: 'pb' } as PerspectiveBarNode
  return render(
    PerspectiveBarShell(def, ctx, { rendered: [], byName: {} } as never) as ReactElement,
  )
}

beforeEach(() => { setSpy = vi.fn() })
afterEach(() => cleanup())

describe('PerspectiveBar — roving tabindex (APG Tabs)', () => {
  it('only the selected tab is in the Tab order (tabIndex 0); the rest are -1', () => {
    renderBar('year')
    const [t0, t1] = screen.getAllByRole('tab')
    expect(t0).toHaveAttribute('tabindex', '0')
    expect(t1).toHaveAttribute('tabindex', '-1')
    expect(t0).toHaveAttribute('aria-selected', 'true')
    expect(t1).toHaveAttribute('aria-selected', 'false')
  })

  it('roving index follows selection (range selected → range tab is tabbable)', () => {
    renderBar('range')
    const [t0, t1] = screen.getAllByRole('tab')
    expect(t0).toHaveAttribute('tabindex', '-1')
    expect(t1).toHaveAttribute('tabindex', '0')
  })

  it('hides entirely with fewer than two perspectives (nothing to toggle)', () => {
    setSpy = vi.fn()
    const ctx = { perspective: { current: 'year', available: [AVAILABLE[0]], set: setSpy } } as unknown as RenderContext
    const { container } = render(
      PerspectiveBarShell({ type: 'perspective-bar', id: 'pb' } as PerspectiveBarNode, ctx, { rendered: [], byName: {} } as never) as ReactElement,
    )
    expect(container.querySelector('[role="tablist"]')).toBeNull()
  })
})

describe('PerspectiveBar — APG arrow/Home/End (automatic activation)', () => {
  it('ArrowRight activates the next tab and moves focus to it', () => {
    renderBar('year')
    const tablist = screen.getByRole('tablist')
    const [, t1] = screen.getAllByRole('tab')
    fireEvent.keyDown(tablist, { key: 'ArrowRight' })
    expect(setSpy).toHaveBeenCalledWith('range')
    expect(document.activeElement).toBe(t1)
  })

  it('ArrowDown behaves like ArrowRight (vertical-or-horizontal tablist)', () => {
    renderBar('year')
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowDown' })
    expect(setSpy).toHaveBeenCalledWith('range')
  })

  it('ArrowLeft wraps from the first tab to the last', () => {
    renderBar('year')
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowLeft' })
    expect(setSpy).toHaveBeenCalledWith('range')
  })

  it('ArrowRight wraps from the last tab back to the first', () => {
    renderBar('range')
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' })
    expect(setSpy).toHaveBeenCalledWith('year')
  })

  it('Home jumps to the first tab, End jumps to the last', () => {
    renderBar('range')
    const tablist = screen.getByRole('tablist')
    fireEvent.keyDown(tablist, { key: 'Home' })
    expect(setSpy).toHaveBeenCalledWith('year')
    cleanup()
    renderBar('year')
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'End' })
    expect(setSpy).toHaveBeenCalledWith('range')
  })

  it('a non-navigation key is ignored (no activation)', () => {
    renderBar('year')
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'a' })
    expect(setSpy).not.toHaveBeenCalled()
  })

  it('click still activates a tab (pointer parity)', () => {
    renderBar('year')
    fireEvent.click(screen.getAllByRole('tab')[1])
    expect(setSpy).toHaveBeenCalledWith('range')
  })
})
