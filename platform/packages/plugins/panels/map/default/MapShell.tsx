import './map.css'

import { defineShell }              from '@statdash/react/engine'
import type { RenderContext }        from '@statdash/react/engine'
import { useInject, EMPTY_STATE }    from '@statdash/react'
import type { EngineRow }            from '@statdash/engine'
import type { MapNode }              from './MapNode'
import { buildColorScale, DEFAULT_PALETTE } from './mapColorUtils'
import { getTopology }               from './topologyRegistry'

// ── MapShell — choropleth map panel shell ─────────────────────────────
//
//  Data pipeline (always fully executed, regardless of topology):
//    ctx.rows → buildColorScale(rows, geoDim, valueField, palette, scale)
//             → Map<dimCode, cssColor>
//
//  Render path:
//    topology registered? → topology present (SVG choropleth — future)
//    topology absent?     → placeholder table fallback
//
//  The data contract is complete even in placeholder mode.
//  apps/geostat provides topology via registerTopology(); the shell
//  resolves it at render time (OCP — zero plugin change for new geos).
//
//  Law 1: geoDim and valueField are plain field-name strings.
//  Dependency arrow: plugins → engine/react → engine/core (never reversed).
//

export const MapShell = defineShell<MapNode>({
  render({ def, ctx }) {
    return <MapControl def={def} ctx={ctx} />
  },
})

function MapControl({ def, ctx }: { def: MapNode; ctx: RenderContext }) {
  const EmptyState = useInject(ctx.ui, EMPTY_STATE)
  // Map reads rows as generic records keyed by geoDim/valueField (dimension-
  // agnostic, Law 1) — the EngineRow record form, not the structured DataRow.
  const rows       = (ctx.rows ?? []) as unknown as EngineRow[]
  const view       = def.view ?? { geoDim: 'geo', valueField: 'value' }
  const geoDim     = view.geoDim     ?? 'geo'
  const valueField = view.valueField ?? 'value'
  const scale      = view.scale      ?? 'quantile'
  const palette    = view.palette ?? DEFAULT_PALETTE

  // ── No-data short-circuit — consistent panel-level empty state ────
  // Matches chart/table shells (panel owns its empty state; Grafana model).
  // Returns before color-scale + topology work, which are meaningless on [].
  if (rows.length === 0) return <EmptyState />

  // ── Data pipeline — always executed ──────────────────────────────
  const colorMap = buildColorScale(rows, geoDim, valueField, palette, scale)

  // ── Topology resolution ───────────────────────────────────────────
  const topologyId   = view.topology
  const topologyDesc = topologyId ? getTopology(topologyId) : undefined

  // ── Render: placeholder when topology not registered ─────────────
  if (!topologyDesc) {
    return (
      <MapPlaceholder
        rows={rows}
        geoDim={geoDim}
        valueField={valueField}
        colorMap={colorMap}
        topologyId={topologyId}
      />
    )
  }

  // ── Render: topology registered — choropleth SVG (future) ─────────
  // When a topology descriptor is available, a full SVG choropleth is
  // rendered by projecting featureCollection features against colorMap.
  // Phase 2: implement SVG projection here (D3 or TopoJSON-client).
  // For now: render the data-complete placeholder even with topology.
  return (
    <MapPlaceholder
      rows={rows}
      geoDim={geoDim}
      valueField={valueField}
      colorMap={colorMap}
      topologyId={topologyId}
      topologyLabel={topologyDesc.label}
    />
  )
}

// ── MapPlaceholder — accessible table fallback ────────────────────────
//
//  Renders the full data pipeline result (color map + values) as a table.
//  This is a valid accessibility fallback (WCAG 2.1 AA: non-visual access).
//  The Constructor reads 'visual map requires topology registration' to
//  know this node is data-complete but visually awaiting topology.
//

interface PlaceholderProps {
  rows:          import('@statdash/engine').EngineRow[]
  geoDim:        string
  valueField:    string
  colorMap:      Map<string | number, string>
  topologyId?:   string
  topologyLabel?: string
}

function MapPlaceholder({
  rows,
  geoDim,
  valueField,
  colorMap,
  topologyId,
  topologyLabel,
}: PlaceholderProps) {
  // Invariant: MapControl short-circuits to <EmptyState /> on rows.length === 0,
  // so the placeholder is only ever reached with data — no empty branch here.
  return (
    <div className="map-panel map-panel--placeholder" role="region" aria-label="Choropleth map data">
      <p className="map-panel__notice">
        {topologyId && !topologyLabel
          ? `Visual map requires topology registration: topology id "${topologyId}" is not registered. Showing data table fallback.`
          : topologyLabel
            ? `Topology loaded: ${topologyLabel}. SVG choropleth rendering coming in Phase 2. Showing data table fallback.`
            : 'Visual map requires topology registration. Showing data table fallback.'
        }
      </p>

      <table
        className="map-panel__table"
        aria-label={`Choropleth data: ${geoDim} by ${valueField}`}
      >
        <thead>
          <tr>
            <th scope="col">{geoDim}</th>
            <th scope="col">{valueField}</th>
            <th scope="col" aria-label="Color bucket">Color</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const code  = row[geoDim]
            const val   = row[valueField]
            const color = code !== undefined ? colorMap.get(code as string | number) : undefined
            const key   = code !== undefined ? String(code) : String(idx)

            return (
              <tr key={key}>
                <td>{code !== undefined ? String(code) : '—'}</td>
                <td>{val  !== undefined ? String(val)  : '—'}</td>
                <td>
                  {color ? (
                    <span
                      className="map-panel__color-swatch"
                      style={{ backgroundColor: color }}
                      aria-label={`Color: ${color}`}
                    />
                  ) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
