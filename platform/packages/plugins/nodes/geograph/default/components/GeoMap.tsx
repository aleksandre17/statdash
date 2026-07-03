// ── GeoMap — agnostic DECLARATIVE d3-geo SVG choropleth ───────────────────────
//
//  A static thematic choropleth of the configured regions, rendered as an inline
//  SVG: every region is a <path> whose geometry is PROJECTED FROM THE GEOJSON DATA
//  with a fixed Mercator projection fitted to a nominal box (see ./projection) —
//  never from a measured DOM container. Fully agnostic (Retool Map / Grafana
//  Geomap equivalent): reads DataRow[] for tooltip values; geoCodeMap bridges ISO
//  feature codes to store geo dim values; onSelect(geoId) fires on region click;
//  selectedGeos drives the highlight.
//
//  Why declarative SVG (not Leaflet): Leaflet computes pixel geometry by MEASURING
//  its DOM container. This map lives inside a chart↔table toggle (display:none when
//  the table is active); a selection change while hidden re-projected against a 0×0
//  box → every path degenerated to d="M0 0" → blank map. Five imperative Leaflet
//  patches (invalidateSize / fitBounds / visibility-gate / setStyle / one-frame
//  defer) failed on real prod. Deriving geometry from DATA + a fixed projection
//  removes ALL DOM measurement, so `display:none` is irrelevant and the entire bug
//  class is structurally impossible: the same paths render whether the wrapper is
//  visible or hidden, because nothing here reads the box.
//
//  Height is owned by CSS (chart-wrap class — same pattern as charts). The SVG is
//  width:100% + a data-fitted viewBox with preserveAspectRatio, so it scales
//  responsively; strokes are non-scaling (screen-px) so selection weights read at
//  every size. Choropleth fill/stroke resolve through the ./choropleth SSOT.

import { useEffect, useMemo, useState } from 'react'
import type { DataRow } from '@statdash/engine'
import { fmtNum } from '@statdash/engine'
import {
  accentFill,
  choroplethColors,
  hoverStyle,
  resolveFeatureStyle,
} from './choropleth'
import { projectChoropleth } from './projection'

// ── Types ──────────────────────────────────────────────────────────────

export interface GeoMapProps {
  rows:            DataRow[]
  selectedGeos:    string[]
  onSelect:        (geo: string) => void
  geoJsonUrl:      string
  isoField:        string
  geoCodeMap:      Record<string, string>
  labelOverrides?: Record<string, string>
  /**
   * ISO codes of OCCUPIED territories — painted the semantic occupied red (config-
   * declared, agnostic: the engine never hardcodes which regions are occupied). Keyed
   * by the feature ISO (pre geoCodeMap), so it matches even regions with no data row.
   */
  occupiedIso?:    string[]
  /**
   * Unit suffix appended to the value in the region tooltip (e.g. the measure's
   * resolved unit). Tenant content — supplied by config/data, never hardcoded.
   * Absent → the value renders bare. The pct suffix '%' is a generic format token.
   */
  unit?:           string
  /**
   * Accessible name for the whole map region (the SVG `role="group"`). The shell
   * passes the already-resolved panel title, so no locale literal reaches this
   * agnostic component. Optional — omitted → the group is unnamed but each region
   * still carries its own aria-label.
   */
  ariaLabel?:      string
  /**
   * Vestigial map-viewport hints from the Leaflet era. The declarative projection
   * fits the viewBox from the geojson data, so these are ACCEPTED (drop-in node
   * contract) but ignored — no DOM viewport exists to seed.
   */
  initialCenter?:  [number, number]
  initialZoom?:    number
}

// ── tooltip / a11y content — pure, agnostic (values + config labels only) ─────

interface RegionText {
  /** Primary label (region name, or the override for a no-data territory). */
  name:    string
  /** Secondary line (formatted value · pct), when the region has a data row. */
  detail?: string
}

function regionText(
  row:            DataRow | undefined,
  labelOverrides: Record<string, string> | undefined,
  iso:            string,
  unit:           string | undefined,
): RegionText {
  if (row) {
    const unitSuffix = unit ? ` ${unit}` : ''
    return {
      name:   String(row.label),
      detail: `${fmtNum(row.value, 0)}${unitSuffix} · ${fmtNum(row.pct ?? 0, 1)}%`,
    }
  }
  return { name: labelOverrides?.[iso] ?? iso }
}

/** Flatten RegionText into a single accessible-name / <title> string. */
const ariaText = (t: RegionText): string => (t.detail ? `${t.name}, ${t.detail}` : t.name)

interface HoverState { iso: string; x: number; y: number }

// ── worker load (one-shot per URL) ────────────────────────────────────────────
//
//  The worker fetches + parses the geojson off the main thread (heavy parse). The
//  parsed FeatureCollection is the ONLY input to the projection, so nothing about
//  the container box ever reaches the geometry. Same source the map has always used.

function useGeoJsonLoad(
  geoJsonUrl: string,
  setGeoJson: (fc: GeoJSON.FeatureCollection) => void,
) {
  useEffect(() => {
    const worker = new Worker(new URL('./worker.js', import.meta.url))
    worker.postMessage({ url: geoJsonUrl })
    worker.onmessage = (e) => {
      if (e.data.success) setGeoJson(e.data.data)
    }
    return () => { worker.terminate() }
  }, [geoJsonUrl, setGeoJson])
}

// ── GeoMap ─────────────────────────────────────────────────────────────

export function GeoMap({
  rows,
  selectedGeos,
  onSelect,
  geoJsonUrl,
  isoField,
  geoCodeMap,
  labelOverrides,
  occupiedIso,
  unit,
  ariaLabel,
}: GeoMapProps) {
  const [geoJson, setGeoJson] = useState<GeoJSON.FeatureCollection | null>(null)
  const [hovered, setHovered] = useState<HoverState | null>(null)

  useGeoJsonLoad(geoJsonUrl, setGeoJson)

  // Value → color: assign each region a fill by quantile rank against the theme
  // ramp (the choropleth encoding; without it every region paints one flat accent).
  // Keyed by row.id (the geo dim value) which resolveFeatureStyle looks up from the
  // feature ISO via geoCodeMap. See ./choropleth (SSOT).
  const colorByGeo = useMemo(() => choroplethColors(rows), [rows])
  const colorFor   = (geoId: string) => colorByGeo.get(geoId) ?? accentFill()
  // OCCUPIED is keyed by the feature ISO (pre geoCodeMap) so it flags territories with
  // no data row too. Config-declared set — the engine stays agnostic (Law 1).
  const occupiedSet = useMemo(() => new Set(occupiedIso ?? []), [occupiedIso])
  const rowById     = useMemo(() => new Map(rows.map(r => [String(r.id), r])), [rows])

  // Project ALL regions from the data — pure, deterministic, DOM-free. Recomputed
  // only when the geometry itself changes (not on selection/hover/visibility).
  const projected = useMemo(() => (geoJson ? projectChoropleth(geoJson) : null), [geoJson])

  if (!geoJson || !projected) return <div className="chart-wrap geo-map geo-map--loading" />

  // Tooltip anchoring: convert a viewport point to wrapper-local coords. Reading the
  // wrapper rect positions the OVERLAY only — the map geometry never depends on it,
  // so this cannot reintroduce the hidden-container defect.
  const moveTooltip = (iso: string, clientX: number, clientY: number, target: Element) => {
    const box = target.closest('.geo-map')?.getBoundingClientRect()
    if (!box) return
    setHovered({ iso, x: clientX - box.left, y: clientY - box.top })
  }

  const tip = hovered
    ? regionText(rowById.get(geoCodeMap[hovered.iso]), labelOverrides, hovered.iso, unit)
    : null

  return (
    <div className="chart-wrap geo-map">
      <svg
        className="geo-map__svg"
        viewBox={projected.viewBox}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label={ariaLabel}
      >
        {projected.features.map(({ feature, d }) => {
          const iso      = String(feature.properties?.[isoField] ?? '')
          const geoId    = geoCodeMap[iso]
          const selected = selectedGeos.includes(geoId)
          const occupied = occupiedSet.has(iso)
          const base     = resolveFeatureStyle(feature, { isoField, geoCodeMap, colorFor, selectedGeos, occupiedSet })
          // Hover/focus bump reuses the SSOT hoverStyle (opacity + weight only), and
          // only for a non-selected region (a selected region already reads its
          // distinct highlight — matching the old mouseover-skip-if-selected).
          const active   = hovered?.iso === iso && !selected
          const hv       = active ? hoverStyle() : null
          const text     = regionText(rowById.get(geoId), labelOverrides, iso, unit)
          const label    = ariaText(text)
          const interactive = Boolean(geoId)

          return (
            <path
              key={iso}
              d={d}
              className="geo-map__region"
              vectorEffect="non-scaling-stroke"
              fill={base.fillColor}
              fillOpacity={hv?.fillOpacity ?? base.fillOpacity}
              stroke={base.color}
              strokeWidth={hv?.weight ?? base.weight}
              data-selected={selected || undefined}
              data-occupied={occupied || undefined}
              tabIndex={interactive ? 0 : undefined}
              role={interactive ? 'button' : 'img'}
              aria-pressed={interactive ? selected : undefined}
              aria-label={label}
              onClick={interactive ? () => onSelect(geoId) : undefined}
              onKeyDown={interactive ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(geoId) }
              } : undefined}
              onMouseEnter={(e) => moveTooltip(iso, e.clientX, e.clientY, e.currentTarget)}
              onMouseMove={(e) => moveTooltip(iso, e.clientX, e.clientY, e.currentTarget)}
              onMouseLeave={() => setHovered(null)}
              onFocus={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                moveTooltip(iso, r.left + r.width / 2, r.top + r.height / 2, e.currentTarget)
              }}
              onBlur={() => setHovered(null)}
            >
              <title>{label}</title>
            </path>
          )
        })}
      </svg>

      {hovered && tip && (
        <div className="geo-map__tooltip" role="tooltip" style={{ left: hovered.x, top: hovered.y }}>
          <strong>{tip.name}</strong>
          {tip.detail && <><br />{tip.detail}</>}
        </div>
      )}
    </div>
  )
}
