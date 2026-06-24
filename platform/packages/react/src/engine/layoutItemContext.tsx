import { Fragment, createContext, useContext, useMemo, type CSSProperties, type ReactNode } from 'react'
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

// Folds a resolved panel `style` object together with the layout-item
// `placement` (gridColumn / gridRow / alignSelf / justifySelf / order) into a
// single React style object — placement wins, matching the layout-item
// contract (a parent container's placement overrides the node's own style).
//
// This is the typed home for a merge that would otherwise force a cast: panel
// styles are `Record<string,string>` while placement carries `order` as a
// `number` (`Record<string,string|number>`). Returning `CSSProperties` (whose
// values are legitimately `string | number`) makes the union honest — no shell
// hand-merges or casts placement onto its root element.
//
// Returns undefined when neither source has anything → no `style` attr written
// (byte-identical to omitting the prop).
export function mergePlacement(
  panelStyle: Record<string, string> | undefined,
  placement:  LayoutItem | null,
): CSSProperties | undefined {
  if (!panelStyle && !placement) return undefined
  return { ...panelStyle, ...placement } as CSSProperties
}