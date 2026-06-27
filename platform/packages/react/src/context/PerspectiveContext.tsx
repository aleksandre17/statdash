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
export function usePerspectiveContext(
  param:     string,
  available: PerspectiveOption[],
): PerspectiveContext {
  const { state, set: filterSet } = useFilter()

  const current = useMemo((): PerspectiveId => {
    const fromState = state[param] as PerspectiveId | undefined
    const known     = fromState && available.some((o) => o.id === fromState)
    return known ? fromState! : (available[0]?.id ?? '')
  }, [state, param, available])

  const set = useCallback((id: PerspectiveId): void => {
    filterSet(param, id)
  }, [param, filterSet])

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
