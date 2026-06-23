// ── GlobalStateProvider — cross-page reactive state (Retool Global State) ──
//
//  Retool analogue: globalState — state shared across all app pages.
//  Use case: user selects a region on Landing → Regional page already filtered.
//
//  Placement: wrap the router root (above <Routes>), not just a single page.
//  Per-page placement (current default) clears state on navigation — adequate
//  for Phase 1. Promote to app root in Phase 2 for true persistence.
//
//  Usage in a shell inner component:
//    const [region, setRegion] = useGlobalVar('selectedRegion')
//
//  Usage for read-only access:
//    const store = useGlobalStore()
//    store.get('selectedRegion')
//

import {
  createContext, useContext, useRef, useState, useEffect, useCallback,
  type ReactNode,
} from 'react'

export interface GlobalStateStore {
  get(key: string): unknown
  set(key: string, val: unknown): void
  subscribe(key: string, fn: () => void): () => void
}

const GlobalStateContext = createContext<GlobalStateStore>({
  get:       ()  => undefined,
  set:       ()  => {},
  subscribe: ()  => () => {},
})

export function GlobalStateProvider({ children }: { children: ReactNode }) {
  const stateRef    = useRef<Record<string, unknown>>({})
  const listenersRef = useRef<Map<string, Set<() => void>>>(new Map())

  const store: GlobalStateStore = {
    get:  (key) => stateRef.current[key],

    set:  (key, val) => {
      stateRef.current = { ...stateRef.current, [key]: val }
      listenersRef.current.get(key)?.forEach(fn => fn())
    },

    subscribe: (key, fn) => {
      if (!listenersRef.current.has(key)) listenersRef.current.set(key, new Set())
      listenersRef.current.get(key)!.add(fn)
      return () => listenersRef.current.get(key)?.delete(fn)
    },
  }

  return <GlobalStateContext.Provider value={store}>{children}</GlobalStateContext.Provider>
}

/** Access the global state store directly (for non-reactive reads or imperative sets). */
export function useGlobalStore(): GlobalStateStore {
  return useContext(GlobalStateContext)
}

/**
 * Reactive global variable hook.
 * Re-renders when the named key changes.
 * Analogous to Retool `globalState.myVar` + onChange handler.
 */
export function useGlobalVar<T = unknown>(key: string): [T | undefined, (val: T) => void] {
  const store       = useContext(GlobalStateContext)
  const [, forceRender] = useState(0)

  useEffect(
    () => store.subscribe(key, () => forceRender(n => n + 1)),
    [store, key],
  )

  const setValue = useCallback((val: T) => store.set(key, val), [store, key])

  return [store.get(key) as T | undefined, setValue]
}