// ── PageStoreContext — current page's DataStore ───────────────────────
//
//  Set by SiteRenderer (which knows page.storeKey).
//  Read by filter control shells (SelectShell, YearSelectShell, …) so
//  they resolve options from the correct store instead of Object.values()[0].
//
//  Grafana pattern: panel renders inside a datasource scope; every query
//  within the panel implicitly targets that datasource.
//

import { createContext, useContext, type ReactNode } from 'react'
import type { DataStore }                            from '@geostat/engine'

const PageStoreContext = createContext<DataStore | null>(null)

export function PageStoreProvider({
  store,
  children,
}: {
  store:     DataStore | null
  children:  ReactNode
}) {
  return <PageStoreContext.Provider value={store}>{children}</PageStoreContext.Provider>
}

/** Returns the current page's DataStore, or null if not inside a page. */
export function useCurrentStore(): DataStore | null {
  return useContext(PageStoreContext)
}