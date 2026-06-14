import { useMemo }                              from 'react'
import { interpretKpis }                        from '@geostat/engine'
import { defineShell, resolveStore }           from '@geostat/react/engine'
import type { RenderContext }                  from '@geostat/react/engine'
import type { KpiStripNode }                   from './KpiStripNode'
import KpiCard                                  from './components/KpiCard'

export const KpiStripShell = defineShell<KpiStripNode>({
  render({ def, ctx }) {
    return <KpiStripControl def={def} ctx={ctx} />
  },
})

function KpiStripControl({ def, ctx }: { def: KpiStripNode; ctx: RenderContext }) {
  const { stores, pageStoreKey, sectionCtx } = ctx

  const store = useMemo(
    () => resolveStore({ stores, pageStoreKey }),
    [stores, pageStoreKey],
  )

  const kpis = useMemo(
    () => interpretKpis(def.items, sectionCtx, store),
    [def.items, sectionCtx, store],
  )

  if (kpis.length === 0) return null

  return (
    <div className="kpi-strip">
      {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
    </div>
  )
}