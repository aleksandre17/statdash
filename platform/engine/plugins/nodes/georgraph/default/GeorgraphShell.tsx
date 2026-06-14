import type { ReactNode }                      from 'react'
import { useSearchParams }                     from 'react-router-dom'
import { resolveTemplate }                     from '@geostat/engine'
import { defineShell }                         from '@geostat/react/engine'
import type { ShellProps }                     from '@geostat/react/engine'
import type { GeorgraphNode }                  from './GeorgraphNode'
import { GeoMap }                              from './components/GeoMap'
import { SectionBlock }                        from '../../section'

export const GeorgraphShell = defineShell<GeorgraphNode>({
  render({ def, ctx, children, vs }) {
    return <GeorgraphControl def={def} ctx={ctx} vs={vs} table={children.rendered[0] ?? null} />
  },
})

function GeorgraphControl({ def, ctx, vs, table }: Pick<ShellProps<GeorgraphNode>, 'def' | 'ctx' | 'vs'> & { table: ReactNode }) {
  const [, setParams] = useSearchParams()
  const maxSelect = def.maxSelect ?? 2
  const rawParam  = (ctx.filterParams[def.paramKey] as string) ?? ''

  const selectedGeos: string[] = def.multiSelect
    ? rawParam.split(',').filter(Boolean)
    : rawParam ? [rawParam] : []

  const handleSelect = (geo: string) => {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      if (def.multiSelect) {
        const current = (next.get(def.paramKey) ?? '').split(',').filter(Boolean)
        const idx = current.indexOf(geo)
        let updated: string[]
        if (idx >= 0) {
          updated = current.filter(g => g !== geo)
        } else if (current.length < maxSelect) {
          updated = [...current, geo]
        } else {
          updated = [...current.slice(1), geo]
        }
        if (updated.length > 0) next.set(def.paramKey, updated.join(','))
        else next.delete(def.paramKey)
      } else {
        if (next.get(def.paramKey) === geo) next.delete(def.paramKey)
        else next.set(def.paramKey, geo)
      }
      return next
    }, { replace: true })
  }

  const rows  = ctx.rows ?? []
  const color = def.color ?? ctx.color
  const label = def.label ? resolveTemplate(def.label, ctx.sectionCtx, ctx.filterParams) : undefined

  return (
    <div {...vs.panel}>
      <SectionBlock
        id={def.anchor ?? def.id}
        title={def.title}
        label={label}
        color={color}
        defaultOpen
        showToggle={table != null}
        defaultViewIndex={0}
      >
        <GeoMap
          rows={rows}
          selectedGeos={selectedGeos}
          onSelect={handleSelect}
          geoJsonUrl={def.geoJsonUrl}
          isoField={def.isoField}
          geoCodeMap={def.geoCodeMap}
          labelOverrides={def.labelOverrides}
        />
        {table}
      </SectionBlock>
    </div>
  )
}