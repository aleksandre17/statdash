// ── PerspectiveContext — React layer for the perspective axis ─────────
//
//  usePerspectiveContext: derives the active-perspective triad from the axis +
//    FilterContext.state (the URL param IS the active id — stable on navigation).
//    Reading from FilterContext (not useSearchParams directly) means navigation
//    URL changes don't trigger re-renders in components using this hook.
//
//  PerspectiveProvider: exposes the triad to deep consumers (the perspective-bar).
//  usePerspective:      reads the nearest PerspectiveProvider — zero prop-drilling.
//
//  Grafana equivalent: useTimeRange() + TimeRangeProvider, generalised to any axis.
//  The perspective system has no React deps in engine — this file is its only React
//  surface. The active id + available options come from the parsed PerspectiveAxis
//  (the axis OWNS its presentation, decision B) — NO separate registry lookup.
//

import {
  createContext, useContext, useMemo, useCallback,
  type ReactNode,
}                                          from 'react'
import type { PerspectiveContext, PerspectiveOption, PerspectiveId } from '@statdash/engine'
import { useFilter }                       from './FilterContext'

// ── usePerspectiveContext ─────────────────────────────────────────────
//
//  Reads the active id from FilterContext.state — no useSearchParams subscription.
//  Writes via FilterContext.set — updates state + URL atomically.
//  Zero direct router hook calls: navigation never triggers re-renders here.
//
//  param:     URL param name of the axis (matches PerspectiveBarNode.key, default 'mode').
//  available: the axis's resolved PerspectiveOption[] (id + label + icon, in order).
//             The active-id FALLBACK is available[0].id (the axis default — LOW-1).
//
//  Permalink (Law 9, URL=permalink): the active id deep-links via the URL param, and
//  the DEFAULT perspective (available[0].id, the registry-derived SSOT) is ELIDED from
//  the URL — `set(default)` clears the param rather than writing it, so a permalink is
//  clean (`?` omitted when the default is active) and only a NON-default perspective
//  appears in the URL. `current` already folds an absent param back to available[0].id,
//  so the elided default round-trips byte-identically (deep-link restores it).
//
export function usePerspectiveContext(
  param:     string,
  available: PerspectiveOption[],
): PerspectiveContext {
  const { state, set: filterSet } = useFilter()

  // The axis default = the first declared perspective (perspectives[0], LOW-1). The
  // registry/axis OWNS this — never hardcoded. Elision + the active-id fallback both
  // key off it, so the URL and the rendered state agree on what "default" means.
  const defaultId = available[0]?.id ?? ''

  const current = useMemo((): PerspectiveId => {
    const fromState = state[param] as PerspectiveId | undefined
    const known     = fromState && available.some((o) => o.id === fromState)
    return known ? fromState! : defaultId
  }, [state, param, available, defaultId])

  const set = useCallback((id: PerspectiveId): void => {
    // Default-elision: writing the default clears the param (FilterContext.set deletes
    // on an empty value) → a clean permalink. Any non-default id is written verbatim.
    filterSet(param, id === defaultId ? '' : id)
  }, [param, filterSet, defaultId])

  return useMemo(() => ({ current, available, set }), [current, available, set])
}

// ── PerspectiveReactCtx — React context for deep consumers ─────────────

const PerspectiveReactCtx = createContext<PerspectiveContext>({
  current:   '',
  available: [],
  set:       () => undefined,
})

export function PerspectiveProvider({
  value,
  children,
}: {
  value:     PerspectiveContext
  children?: ReactNode
}): ReactNode {
  return <PerspectiveReactCtx.Provider value={value}>{children}</PerspectiveReactCtx.Provider>
}

export const usePerspective = (): PerspectiveContext => useContext(PerspectiveReactCtx)
