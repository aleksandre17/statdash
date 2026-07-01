import './geograph.css'
import { Fragment, type ReactNode }            from 'react'
import { defineShell, resolvePreliminary, useNodeTemplate } from '@statdash/react/engine'
import type { ShellProps }                     from '@statdash/react/engine'
import { useT, useInject, PANEL_LAYOUT, useExtensions, PANEL_TITLE_BADGE } from '@statdash/react'
import type { GeographNode }                   from './GeographNode'
import { GeoMap }                              from './components/GeoMap'

export const GeographShell = defineShell<GeographNode>({
  render({ def, ctx, children, vs }) {
    return <GeographControl def={def} ctx={ctx} vs={vs} table={children.rendered[0] ?? null} />
  },
})

function GeographControl({ def, ctx, vs, table }: Pick<ShellProps<GeographNode>, 'def' | 'ctx' | 'vs'> & { table: ReactNode }) {
  const PanelLayout = useInject(ctx.ui, PANEL_LAYOUT)
  const t = useT('geograph')

  const titleBadges = useExtensions(ctx.extensions, PANEL_TITLE_BADGE, {
    nodeType:    'geograph',
    nodeId:      def.id,
    preliminary: resolvePreliminary(def, ctx),
  })
  const titleBadge = titleBadges.length > 0
    ? <>{titleBadges.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</>
    : undefined

  const maxSelect = def.maxSelect ?? 2
  const rawParam  = (ctx.filterParams[def.paramKey] as string) ?? ''

  const selectedGeos: string[] = def.multiSelect
    ? rawParam.split(',').filter(Boolean)
    : rawParam ? [rawParam] : []

  const handleSelect = (geo: string) => {
    if (def.multiSelect) {
      const current = rawParam.split(',').filter(Boolean)
      const idx     = current.indexOf(geo)
      let updated: string[]
      if (idx >= 0) {
        updated = current.filter(g => g !== geo)
      } else if (current.length < maxSelect) {
        updated = [...current, geo]
      } else {
        updated = [...current.slice(1), geo]
      }
      if (updated.length > 0) {
        ctx.bus.dispatch({ type: 'filter:set', key: def.paramKey, value: updated.join(',') })
      } else {
        ctx.bus.dispatch({ type: 'filter:clear', key: def.paramKey })
      }
    } else {
      if (rawParam === geo) {
        ctx.bus.dispatch({ type: 'filter:clear', key: def.paramKey })
      } else {
        ctx.bus.dispatch({ type: 'filter:set', key: def.paramKey, value: geo })
      }
    }
  }

  const rows    = ctx.rows ?? []
  const resolve = useNodeTemplate(ctx)
  // title + label are both i18n carriers — resolve at this boundary (PanelLayout
  // renders them as React children; a raw { ka, en } bag would crash).
  const title = resolve(def.title)
  const label = resolve(def.label)

  const views = table != null
    ? [
        { label: t('view-map') },
        { label: t('view-table') },
      ]
    : undefined

  return (
    <div {...vs.panel}>
      <PanelLayout
        id={def.anchor ?? def.id}
        title={title}
        label={label}
        color={def.color}
        defaultOpen
        views={views}
        defaultViewIndex={0}
        viewToggleLabel={t('view-toggle')}
        titleBadge={titleBadge}
        bodyProps={{ ...vs.body, 'data-content': 'geo' }}
      >
        <GeoMap
          rows={rows}
          selectedGeos={selectedGeos}
          onSelect={handleSelect}
          geoJsonUrl={def.geoJsonUrl}
          isoField={def.isoField}
          geoCodeMap={def.geoCodeMap}
          labelOverrides={def.labelOverrides}
          unit={resolve(def.unit)}
          initialCenter={def.initialCenter}
          initialZoom={def.initialZoom}
        />
        {table}
      </PanelLayout>
    </div>
  )
}
