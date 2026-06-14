// ── FiltersContext — bridges page-level filterSchema to FilterBarRenderer ──
//
//  SiteRenderer converts FilterSchemaInput → BarNode[] and provides them here.
//  FilterBarRenderer reads via useFiltersContext() — no props needed.
//
//  Grafana: PanelData flows from DataSource → PanelChrome via context.
//  Builder.io: page variables provided to all blocks via context.
//

import { createContext, useContext }  from 'react'
import type { ReactNode }             from 'react'
import type { BarNode, Effect }       from '@geostat/engine'

export interface FiltersCtx {
  bars:        BarNode[]
  timeModeKey: string
  effects:     Effect[]
}

const EMPTY: FiltersCtx = { bars: [], timeModeKey: 'mode', effects: [] }

const Ctx = createContext<FiltersCtx>(EMPTY)

export function FiltersProvider({
  value,
  children,
}: {
  value:    FiltersCtx
  children: ReactNode
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFiltersContext(): FiltersCtx {
  return useContext(Ctx)
}