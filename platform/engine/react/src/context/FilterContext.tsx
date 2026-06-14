// ── FilterContext — page-scoped filter state ──────────────────────────
//
//  Architecture (Grafana / Retool / Builder.io pattern):
//    React state = source of truth for filter values.
//    URL = sync target (write-only after mount).
//    On mount:           initialize from URL search params (deep-link support).
//    On filter change:   setState + setSearchParams (atomic, batched by React 18).
//    On back/forward:    useEffect re-syncs state from URL (same-path guard).
//    On navigation:      new FilterProvider mount (keyed by page) → fresh state.
//
//  Why not useSearchParams() as source of truth:
//    useSearchParams() subscribes to ALL URL changes including pathname changes.
//    Navigation (path change) would trigger re-computation of sectionCtx →
//    interpretSpec → ghost queries for the departing page before unmount.
//    Owning state in useState breaks this reactive chain: ctx value is stable
//    across navigation, so context consumers never re-render on path changes.
//

import {
  createContext, useContext, useMemo, useCallback,
  useState, useEffect, useRef, type ReactNode,
} from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'

interface FilterCtx {
  state:   Record<string, string>
  set:     (key: string, value: string) => void
  setMany: (mutations: Record<string, string>) => void
  get:     (key: string, fallback?: string) => string
}

const Ctx = createContext<FilterCtx>(null!)

export function FilterProvider({ children }: { children: ReactNode }) {
  const [, setSearchParams] = useSearchParams()
  const location            = useLocation()
  const mountPath           = useRef(location.pathname)

  // React owns filter state — not derived from URL on every render.
  const [state, setState] = useState<Record<string, string>>(
    () => Object.fromEntries(new URLSearchParams(location.search))
  )

  // Back/forward within the same page: re-sync from URL when search changes.
  // Bail out (return prev) when values are unchanged — no extra render after set/setMany.
  // Path guard: navigation = new FilterProvider mount (keyed by page), not this concern.
  useEffect(() => {
    if (location.pathname !== mountPath.current) return
    const next = Object.fromEntries(new URLSearchParams(location.search))
    setState(prev => {
      const keys = new Set([...Object.keys(prev), ...Object.keys(next)])
      for (const k of keys) if (prev[k] !== next[k]) return next
      return prev
    })
  }, [location.search, location.pathname])

  const set = useCallback((key: string, value: string) => {
    setState(prev => {
      const next = { ...prev }
      if (value) next[key] = value; else delete next[key]
      return next
    })
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value); else next.delete(key)
      return next
    }, { replace: true })
  }, [setSearchParams])

  const setMany = useCallback((mutations: Record<string, string>) => {
    setState(prev => {
      const next = { ...prev }
      for (const [key, value] of Object.entries(mutations)) {
        if (value) next[key] = value; else delete next[key]
      }
      return next
    })
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      for (const [key, value] of Object.entries(mutations)) {
        if (value) next.set(key, value); else next.delete(key)
      }
      return next
    }, { replace: true })
  }, [setSearchParams])

  const get = useCallback(
    (key: string, fallback = '') => state[key] ?? fallback,
    [state],
  )

  const ctx = useMemo(
    () => ({ state, set, setMany, get }),
    [state, set, setMany, get],
  )

  return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useFilter = () => useContext(Ctx)