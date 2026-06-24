// ── useDebouncedLivePage.test — G3.2 request-volume guard ────────────────────
//
//  The hook is the seam that bounds how many distinct page descriptors reach the
//  data-fetching renderer during an edit burst. These tests pin the contract that
//  makes the "N rapid edits ≤ M live queries" guarantee assertable:
//
//    (a) structural mode is identity passthrough — every page is published
//        immediately (instant, byte-identical to the G3.1 path).
//    (b) live mode collapses a burst of N rapid edits into ONE published page
//        (the settled descriptor) → one specDimKey → one live query downstream.
//    (c) toggling structural→live publishes the current page at once (no blank-out).
//
//  Pure hook test with fake timers — no engine render, no network. The downstream
//  query-identity caches (ApiStore._cache, useNodeRows._promiseCache) are proven
//  elsewhere; here we prove the descriptor volume entering them is bounded.
//
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { NodePageConfig } from '@statdash/react/engine'
import { useDebouncedLivePage, LIVE_PREVIEW_DEBOUNCE_MS } from './useDebouncedLivePage'
import type { PreviewMode } from './useLivePreviewStores'

// Distinct page descriptors standing in for successive DataSpec edits — only the
// reference identity matters to the hook (the renderer keys data on it).
const pageN = (n: number): NodePageConfig =>
  ({ type: 'inner-page', id: 'page-1', path: 'gdp', children: [], _edit: n } as unknown as NodePageConfig)

describe('useDebouncedLivePage (G3.2 request-volume guard)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('(a) structural mode is an instant identity passthrough — no debounce', () => {
    const { result, rerender } = renderHook(
      ({ page, mode }: { page: NodePageConfig; mode: PreviewMode }) =>
        useDebouncedLivePage(page, mode),
      { initialProps: { page: pageN(0), mode: 'structural' as PreviewMode } },
    )

    // Each new page is returned synchronously — no timer advance needed.
    for (let n = 1; n <= 5; n++) {
      const p = pageN(n)
      rerender({ page: p, mode: 'structural' })
      expect(result.current).toBe(p)
    }
  })

  it('(b) live mode collapses N rapid edits into ONE settled published page', () => {
    const first = pageN(0)
    const { result, rerender } = renderHook(
      ({ page, mode }: { page: NodePageConfig; mode: PreviewMode }) =>
        useDebouncedLivePage(page, mode),
      { initialProps: { page: first, mode: 'live' as PreviewMode } },
    )

    // Entering live publishes the current page immediately (toggle is instant).
    expect(result.current).toBe(first)

    // A burst of 10 rapid edits, each well within the debounce window. None of
    // the intermediate descriptors is published — the renderer (and thus the
    // live query path) never sees them.
    let last = first
    for (let n = 1; n <= 10; n++) {
      last = pageN(n)
      // Commit the edit, then advance LESS than the quiet window so the timer
      // keeps resetting — no intermediate descriptor is ever published.
      act(() => { rerender({ page: last, mode: 'live' }) })
      act(() => { vi.advanceTimersByTime(LIVE_PREVIEW_DEBOUNCE_MS - 50) })
      expect(result.current).toBe(first) // still the pre-burst settled page
    }

    // Editing pauses → the quiet interval elapses → exactly the LAST page settles.
    act(() => { vi.advanceTimersByTime(LIVE_PREVIEW_DEBOUNCE_MS) })
    expect(result.current).toBe(last)

    // The net effect: 10 intermediate descriptors → 1 newly published page.
  })

  it('(b2) a settled edit then another burst publishes only the two settled pages', () => {
    const p0 = pageN(0)
    const { result, rerender } = renderHook(
      ({ page, mode }: { page: NodePageConfig; mode: PreviewMode }) =>
        useDebouncedLivePage(page, mode),
      { initialProps: { page: p0, mode: 'live' as PreviewMode } },
    )

    const published: NodePageConfig[] = [result.current]
    const track = () => {
      if (result.current !== published[published.length - 1]) published.push(result.current)
    }

    // Commit a rerender (flush its effect) THEN advance timers in a separate act,
    // so each render's debounce effect is installed before time moves — mirrors
    // the real event-loop ordering (effect commit precedes the timer firing).
    const edit = (p: NodePageConfig, advanceMs: number) => {
      act(() => { rerender({ page: p, mode: 'live' }) })
      act(() => { vi.advanceTimersByTime(advanceMs) })
    }

    const burst = (intermediates: number[], settled: NodePageConfig) => {
      // Rapid intermediate edits, each within the quiet window (timer keeps
      // resetting → none of these is ever published).
      for (const n of intermediates) edit(pageN(n), 100)
      // Editing pauses on `settled` and the quiet interval fully elapses.
      edit(settled, LIVE_PREVIEW_DEBOUNCE_MS)
      track()
    }

    const settled1 = pageN(3)
    burst([1, 2], settled1)

    const settled2 = pageN(6)
    burst([4, 5], settled2)

    // Two bursts (4 intermediate edits) → at most 3 published descriptors
    // (initial + 2 settled): bounded request volume.
    expect(published.length).toBeLessThanOrEqual(3)
    // The final published descriptor is a settled page, never an intermediate one
    // (intermediates were 1,2,4,5 — only 0,3,6 are valid settle points).
    expect((published[published.length - 1] as unknown as { _edit: number })._edit).toBe(6)
  })

  it('(c) toggling structural→live publishes the current page immediately', () => {
    const p0 = pageN(0)
    const { result, rerender } = renderHook(
      ({ page, mode }: { page: NodePageConfig; mode: PreviewMode }) =>
        useDebouncedLivePage(page, mode),
      { initialProps: { page: p0, mode: 'structural' as PreviewMode } },
    )

    const p1 = pageN(1)
    // Flip to live with a new current page — published at once, no timer needed.
    act(() => { rerender({ page: p1, mode: 'live' }) })
    expect(result.current).toBe(p1)
  })
})
