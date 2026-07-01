// @vitest-environment jsdom
//
// ── RouteScrollManager — scroll-parity fitness ────────────────────────
//
//  Locks the root-cause fix for the soft-nav ≠ hard-load divergence: a
//  client-side route change must reset scroll to the top (hard-load parity),
//  a cross-page #anchor must scroll that section into view, and a search-param
//  (filter/perspective) change must NOT move the scroll at all.
//
import { render, act, cleanup } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RouteScrollManager } from './RouteScrollManager'

let scrollSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  scrollSpy = vi.fn()
  // jsdom does not implement scrollTo — install a spy.
  window.scrollTo = scrollSpy as unknown as typeof window.scrollTo
  // rAF → run the callback synchronously so the anchor path is observable.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1 })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function Harness({ onReady }: { onReady: (nav: ReturnType<typeof useNavigate>) => void }) {
  const nav = useNavigate()
  onReady(nav)
  return <RouteScrollManager />
}

function mount() {
  let navigate!: ReturnType<typeof useNavigate>
  render(
    <MemoryRouter initialEntries={['/en/gdp']}>
      <Harness onReady={(n) => { navigate = n }} />
    </MemoryRouter>,
  )
  // clear the initial mount scroll call so assertions read the navigation only
  scrollSpy.mockClear()
  return { go: (to: string) => act(() => { navigate(to) }) }
}

describe('RouteScrollManager — scroll parity across nav paths', () => {
  it('scrolls to top on a plain cross-page navigation', () => {
    const { go } = mount()
    go('/en/regional')
    expect(scrollSpy).toHaveBeenCalledWith(expect.objectContaining({ top: 0, left: 0 }))
  })

  it('does NOT scroll on a search-param-only change (filter/perspective)', () => {
    const { go } = mount()
    go('/en/gdp?year=2022')
    expect(scrollSpy).not.toHaveBeenCalled()
  })

  it('scrolls a cross-page #anchor into view once it is in the DOM', () => {
    const el = document.createElement('div')
    el.id = 'sec-trade'
    Object.defineProperty(el, 'getBoundingClientRect', { value: () => ({ top: 500 }) })
    document.body.appendChild(el)

    const { go } = mount()
    go('/en/regional#sec-trade')

    expect(scrollSpy).toHaveBeenCalledTimes(1)
    const arg = scrollSpy.mock.calls[0][0] as { top: number }
    expect(arg.top).toBeGreaterThan(0)   // 500 + scrollY − stickyOffset

    document.body.removeChild(el)
  })
})
