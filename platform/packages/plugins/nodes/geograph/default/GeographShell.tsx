import './geograph.css'
import { Fragment }                            from 'react'
import { resolveViewState }                    from '@statdash/styles'
import { defineShell, resolvePreliminary, useNodeTemplate, useViewToggle } from '@statdash/react/engine'
import type { ShellProps, NodeDef }            from '@statdash/react/engine'
import { useT, useInject, useResolveLocale, PANEL_LAYOUT, useExtensions, PANEL_TITLE_BADGE } from '@statdash/react'
import type { PanelViewToggle }                from '@statdash/react'
import type { GeographNode }                   from './GeographNode'
import { GeoMap }                              from './components/GeoMap'

// The role the geograph's inline <GeoMap/> participates as in the ONE view-toggle
// mechanism (useViewToggle). The map is NOT a child node (the table is), so the
// shell mints a ViewCarrier for it and interleaves it with children.defs — no
// bespoke second toggle (AX6: retire PanelLayout's index toggle → view.role).
const MAP_ROLE = 'map'

export const GeographShell = defineShell<GeographNode>({
  render({ def, ctx, children, vs }) {
    return <GeographControl def={def} ctx={ctx} vs={vs} children={children} />
  },
})

function GeographControl({ def, ctx, vs, children }: Pick<ShellProps<GeographNode>, 'def' | 'ctx' | 'vs' | 'children'>) {
  const PanelLayout   = useInject(ctx.ui, PANEL_LAYOUT)
  const t             = useT('geograph')
  const resolveLocale = useResolveLocale()

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
  // resolvedId MUST be computed before useViewToggle so the persisted view key is
  // unique per Repeat iteration (parity with the section shell).
  const resolvedId = resolve(def.id)
  // title + label are both i18n carriers — resolve at this boundary (PanelLayout
  // renders them as React children; a raw { ka, en } bag would crash).
  const title = resolve(def.title)
  const label = resolve(def.label)
  // labelOverrides values are i18n carriers too (per-region tooltip labels for regions
  // with no data). Resolve each at THIS boundary so the locale-agnostic GeoMap only ever
  // receives concrete strings — no raw { ka, en } bag reaches Leaflet's tooltip HTML.
  const labelOverrides = def.labelOverrides
    ? Object.fromEntries(Object.entries(def.labelOverrides).map(([iso, v]) => [iso, resolve(v)]))
    : undefined

  // ── ONE view-toggle mechanism (AX6) ────────────────────────────────
  //  The inline map is view-role 'map' (declaration-first ⇒ the default view);
  //  the table child already carries view.role:'table' in config. We interleave
  //  a minted map carrier with children.defs and drive the SAME useViewToggle
  //  the section shell uses — no bespoke map/table toggle remains. Map + table
  //  re-encode the section-owned `rows` (I-6): neither issues its own store read.
  // Synthetic view participant for the inline map (it is NOT a child node — the
  // table is). Only its `view.role`/`view.label` are read by useViewToggle.
  const mapCarrier = { view: { role: MAP_ROLE, label: t('view-map') } } as unknown as NodeDef
  const carriers   = [mapCarrier, ...children.defs]
  const viewToggle = useViewToggle(carriers, 'geograph', resolvedId, true)

  // PanelLayout is i18n-free: pre-resolve the per-role labels to concrete strings.
  const panelToggle: PanelViewToggle | undefined = viewToggle.showToggle
    ? {
        roles:     viewToggle.roles,
        labels:    Object.fromEntries(
          viewToggle.roles.map((r) => [r, resolveLocale(viewToggle.roleLabels[r])]),
        ),
        active:    viewToggle.activeRole,
        onSelect:  viewToggle.setActiveRole,
        ariaLabel: t('view-toggle'),
      }
    : undefined

  return (
    <div {...vs.panel}>
      <PanelLayout
        id={def.anchor ?? resolvedId}
        title={title}
        label={label}
        color={def.color}
        defaultOpen
        viewToggle={panelToggle}
        titleBadge={titleBadge}
        bodyProps={{ ...vs.body, 'data-content': 'geo' }}
      >
        {/* Map view — hidden (not unmounted) when the table role is active. */}
        <div {...resolveViewState(viewToggle.isRoleHidden(MAP_ROLE))}>
          <GeoMap
            rows={rows}
            selectedGeos={selectedGeos}
            onSelect={handleSelect}
            geoJsonUrl={def.geoJsonUrl}
            isoField={def.isoField}
            geoCodeMap={def.geoCodeMap}
            labelOverrides={labelOverrides}
            unit={resolve(def.unit)}
            initialCenter={def.initialCenter}
            initialZoom={def.initialZoom}
          />
        </div>
        {/* Table view(s) — the section-owned rows re-encoded; hidden per role. */}
        {children.defs.map((d: NodeDef, i: number) => (
          <div key={i} {...resolveViewState(viewToggle.isHidden(d))}>
            {children.rendered[i]}
          </div>
        ))}
      </PanelLayout>
    </div>
  )
}
