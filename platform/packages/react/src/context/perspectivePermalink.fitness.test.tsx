// @vitest-environment jsdom
//
// ── FF-PERSPECTIVE-PERMALINK — URL = permalink for the perspective axis (Law 9) ──
//
//  The active perspective is a DEEP-LINKABLE, registry-DERIVED URL param with a
//  clean default. Three guarantees, all proven against the real FilterProvider +
//  usePerspectiveContext (no mock of the URL boundary):
//
//    1. DEEP-LINK round-trip — a URL carrying `?<param>=<non-default>` restores that
//       perspective on mount (FilterProvider seeds state from location.search →
//       usePerspectiveContext.current reads it). A shared URL restores the view.
//    2. DERIVED param — the param name is whatever the axis declares (the caller
//       passes the axis's URL-param key); nothing is hardcoded to 'mode'. Adding an
//       axis under a different param auto-follows.
//    3. DEFAULT-ELISION — set(default) CLEARS the param (the permalink omits it); only
//       a NON-default id is written. current folds an absent param back to the default
//       (available[0].id), so the elided default round-trips byte-identically.
//
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter, useSearchParams } from 'react-router-dom'
import { createElement, type ReactNode } from 'react'
import type { PerspectiveOption } from '@statdash/engine'
import { FilterProvider } from './FilterContext'
import { usePerspectiveContext } from './PerspectiveContext'

// year = the default (available[0], the registry SSOT); range = a non-default.
const AVAILABLE: PerspectiveOption[] = [
  { id: 'year',  label: 'Year' },
  { id: 'range', label: 'Range' },
]

// Render usePerspectiveContext under the real FilterProvider, seeding the URL with
// `initialEntries` so the deep-link path (FilterProvider reads location.search) is
// exercised end-to-end. The companion useSearchParams lets a test observe the URL
// the toggle WRITES (the elision proof).
function renderPerspective(param: string, available: PerspectiveOption[], initialUrl = '/') {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(MemoryRouter, { initialEntries: [initialUrl] },
      createElement(FilterProvider, null, children))
  return renderHook(
    () => ({
      perspective: usePerspectiveContext(param, available),
      search:      useSearchParams()[0].toString(),
    }),
    { wrapper },
  )
}

describe('FF-PERSPECTIVE-PERMALINK — usePerspectiveContext', () => {
  it('1. deep-link: a non-default param in the URL restores that perspective on mount', () => {
    const { result } = renderPerspective('mode', AVAILABLE, '/?mode=range')
    // The shared URL restored the non-default view — no toggle interaction needed.
    expect(result.current.perspective.current).toBe('range')
  })

  it('1b. an absent param folds to the axis default (available[0].id)', () => {
    const { result } = renderPerspective('mode', AVAILABLE, '/')
    expect(result.current.perspective.current).toBe('year')   // perspectives[0]
  })

  it('2. the param name is DERIVED (the axis key), never hardcoded to "mode"', () => {
    // A second axis declared under a different param key deep-links under THAT key.
    const { result } = renderPerspective('view', AVAILABLE, '/?view=range')
    expect(result.current.perspective.current).toBe('range')
    // The conventional 'mode' key is NOT consulted for a 'view' axis.
    const other = renderPerspective('view', AVAILABLE, '/?mode=range')
    expect(other.result.current.perspective.current).toBe('year')
  })

  it('3. default-elision: selecting the default CLEARS the param (clean permalink)', () => {
    // Start on the non-default (param present), then switch back to the default.
    const { result } = renderPerspective('mode', AVAILABLE, '/?mode=range')
    expect(result.current.search).toBe('mode=range')

    act(() => result.current.perspective.set('year'))   // the default

    // The param is elided — the permalink is clean (no `mode=` in the URL).
    expect(result.current.search).toBe('')
    // …and the rendered state still reads the default (round-trips via the fallback).
    expect(result.current.perspective.current).toBe('year')
  })

  it('3b. a NON-default selection IS written to the URL (deep-linkable)', () => {
    const { result } = renderPerspective('mode', AVAILABLE, '/')
    expect(result.current.search).toBe('')               // default elided at rest

    act(() => result.current.perspective.set('range'))   // non-default

    expect(result.current.search).toBe('mode=range')     // appears in the permalink
    expect(result.current.perspective.current).toBe('range')
  })

  it('3c. round-trip: non-default → URL → default elides (the full permalink cycle)', () => {
    const { result } = renderPerspective('mode', AVAILABLE, '/')

    act(() => result.current.perspective.set('range'))
    expect(result.current.search).toBe('mode=range')

    act(() => result.current.perspective.set('year'))
    expect(result.current.search).toBe('')               // back to a clean permalink
  })
})
