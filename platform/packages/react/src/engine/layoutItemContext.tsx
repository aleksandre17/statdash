import { Fragment, createContext, useContext, useMemo, type ReactNode } from 'react'
import { resolveLayoutItem }                                             from '@statdash/styles'
import type { NodeStyles }                                               from '@statdash/styles'

// Grid / flex item placement — passed from layout container → child shell.
// resolveLayoutItem decides Fragment (null) vs Context.Provider (values).
// Shell components pass child view.styles and never branch on Fragment vs Provider.

type LayoutItem = Record<string, string | number>

const LayoutItemCtx = createContext<LayoutItem | null>(null)

interface LayoutItemProviderProps {
  styles?:  NodeStyles
  children: ReactNode
}

export function LayoutItemProvider({ styles, children }: LayoutItemProviderProps) {
  const value = useMemo(() => resolveLayoutItem(styles), [styles])
  if (!value) return <Fragment>{children}</Fragment>
  return <LayoutItemCtx.Provider value={value}>{children}</LayoutItemCtx.Provider>
}

// Shells merge this into their root element: style={{ ...useLayoutItem() }}
// Returns null when no layout container is above → no style attribute written.
export function useLayoutItem(): LayoutItem | null {
  return useContext(LayoutItemCtx)
}