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
import type { BarNode }               from '@statdash/engine'
import { LEGACY_MODE_PARAM }          from '@statdash/engine'

export interface FiltersCtx {
  bars:        BarNode[]
  perspectiveKey: string
}

// No-axis fallback key: the conventional perspective-axis param name (SSOT, never a
// raw 'mode' literal — Law 1). Inert when no `page.perspectives` is declared; the
// key is a Record slot, never branched on.
const EMPTY: FiltersCtx = { bars: [], perspectiveKey: LEGACY_MODE_PARAM }

const Ctx = createContext<FiltersCtx>(EMPTY)

export function FiltersProvider({
  value,
  children,
}: {
  value:     FiltersCtx
  children?: ReactNode
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFiltersContext(): FiltersCtx {
  return useContext(Ctx)
}