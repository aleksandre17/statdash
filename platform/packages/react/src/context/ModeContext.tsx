// ── ModeContext — React layer for ModeSystem ──────────────────────────
//
//  useModeContext: reads mode from FilterContext.state (stable on navigation).
//    FilterContext owns all URL-param state — mode IS a filter param.
//    Reading from FilterContext (not useSearchParams directly) means navigation
//    URL changes don't trigger re-renders in components using useModeContext.
//
//  ModeProvider:   exposes ModeContext to deep consumers (e.g. ModeBarShell).
//  useMode:        reads nearest ModeProvider — zero prop-drilling.
//
//  Grafana equivalent: useTimeRange() + TimeRangeProvider.
//  Mode has no React deps in engine — this file is the only React surface.
//

import {
  createContext, useContext, useMemo, useCallback,
  type ReactNode,
}                               from 'react'
import type { ModeContext, ModeId } from '@statdash/engine'
import { modeRegistry }         from '@statdash/engine'
import { useFilter }            from './FilterContext'

// ── useModeContext ────────────────────────────────────────────────────
//
//  Reads mode from FilterContext.state — no useSearchParams subscription.
//  Writes mode via FilterContext.set — updates state + URL atomically.
//  Zero direct router hook calls: navigation never triggers re-renders here.
//
//  modeKey:   URL param name — matches ModeBarNode.key (default: 'mode')
//  available: ModeId[] declared in page.modeOrder
//
export function useModeContext(modeKey: string, available: ModeId[]): ModeContext {
  const { state, set: filterSet } = useFilter()

  const defs = useMemo(() => modeRegistry.resolve(available), [available])

  const current = useMemo((): ModeId => {
    const fromState = state[modeKey] as ModeId | undefined
    return (fromState && available.includes(fromState)) ? fromState : (available[0] ?? 'year')
  }, [state, modeKey, available])

  const set = useCallback((id: ModeId): void => {
    filterSet(modeKey, id)
  }, [modeKey, filterSet])

  return useMemo(() => ({ current, available: defs, set }), [current, defs, set])
}

// ── ModeReactCtx — React context for deep consumers ────────────────────

const ModeReactCtx = createContext<ModeContext>({
  current:   'year',
  available: [],
  set:       () => undefined,
})

export function ModeProvider({
  value,
  children,
}: {
  value:     ModeContext
  children?: ReactNode
}): ReactNode {
  return <ModeReactCtx.Provider value={value}>{children}</ModeReactCtx.Provider>
}

export const useMode = (): ModeContext => useContext(ModeReactCtx)