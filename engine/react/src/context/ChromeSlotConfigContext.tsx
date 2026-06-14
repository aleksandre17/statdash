// ── ChromeSlotConfigContext — per-instance chrome slot config ──────────
//
//  Shells read their per-instance configuration via useSlotConfig().
//  Config is injected by ChromeRegion (top-level slots) and ChromeSlot
//  (nested slots like LocaleSwitcher within AppHeader).
//
//  Pattern: Builder.io slot props · Grafana panel options per panel instance.
//  Zero-prop shells preserved — all data via hooks, no prop drilling.
//
import { createContext, useContext, type ReactNode } from 'react'

const ChromeSlotConfigCtx = createContext<Record<string, unknown>>({})

export function ChromeSlotConfigProvider({
  config,
  children,
}: {
  config:   Record<string, unknown>
  children: ReactNode
}) {
  return (
    <ChromeSlotConfigCtx.Provider value={config}>
      {children}
    </ChromeSlotConfigCtx.Provider>
  )
}

/**
 * Read per-instance config injected from the chrome manifest.
 * Use generic T to type the config shape for your specific slot.
 *
 * @example
 *   const { logoVariant } = useSlotConfig<{ logoVariant?: 'full' | 'icon' }>()
 */
export function useSlotConfig<T = Record<string, unknown>>(): T {
  return useContext(ChromeSlotConfigCtx) as T
}