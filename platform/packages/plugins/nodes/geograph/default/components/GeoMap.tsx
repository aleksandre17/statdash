// ── GeoMap — agnostic Leaflet choropleth component ────────────────────
//
//  Retool Map / Grafana Geomap panel equivalent — fully agnostic.
//  Reads DataRow[] for tooltip values.
//  geoCodeMap bridges ISO feature codes to store geo dim values.
//  Calls onSelect(geoId) on region click; selectedGeos drives highlight.
//  Multi-select: selected region names shown as text overlay (top-right).
//
//  Height is owned by CSS (chart-wrap class — same pattern as charts).
//  No height prop — parent CSS chain determines the size.
//

import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { GeoJSON, MapContainer, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { DataRow } from '@statdash/engine'
import { fmtNum } from '@statdash/engine'
import { useContainerVisible } from '@statdash/react/engine'
import {
  accentFill,
  choroplethColors,
  choroplethLayerKey,
  featureStyle,
  hoverStyle,
  resolveFeatureStyle,
} from './choropleth'

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
   * Initial map viewport before FitBounds adjusts to the geoJson extent.
   * Optional — defaults to a neutral world view; FitBounds immediately
   * reframes to the actual data, so this only affects the first paint frame.
   */
  initialCenter?:  [number, number]
  initialZoom?:    number
}

const WORLD_CENTER: [number, number] = [0, 0]
const WORLD_ZOOM = 1

interface GeoFeatureProps {
  [key: string]: string | number | boolean | null
}

// The per-feature choropleth style function is the SSOT `featureStyle` /
// `resolveFeatureStyle` in ./choropleth — shared by the <GeoJSON> mount `style`
// prop and the imperative selection `setStyle` effect so the two never drift.

// ── FitBounds — adjusts map viewport to data extent ──────────────────

function FitBounds({ geoJson }: { geoJson: GeoJSON.FeatureCollection }) {
  const map = useMap()
  useEffect(() => {
    const bounds = L.geoJSON(geoJson).getBounds()
    if (bounds.isValid()) {
      map.invalidateSize()
      map.fitBounds(bounds, { padding: [12, 12], animate: false })
    }
  }, [map, geoJson])
  return null
}

// ── RepairOnShow — re-project after a hidden→shown transition (defect A) ──────
//
//  Root cause (pre-existing, independent of any recent chart-height regression):
//  a chart↔table view toggle keeps the inactive map view MOUNTED but
//  `display:none`. A cross-filter row-select changes `selectedGeos` WHILE the map
//  is hidden → `<GeoJSON key={choroplethLayerKey(...)}>` (below) remounts the
//  layer, and react-leaflet/Leaflet projects every path against the container's
//  CURRENT box — 0×0 while hidden — so every path degenerates to `d="M0 0"`
//  (blank map, unrecoverable on toggle-back; FitBounds above only re-fits on
//  `[map, geoJson]`, neither of which changes on a re-show).
//
//  Fix: re-project whenever the container transitions NOT-laid-out → laid-out,
//  regardless of WHY it was hidden or what changed while it was. Reuses the
//  app-agnostic `useContainerVisible` gate (its docstring already names a map as
//  an intended consumer) attached to the SAME chart-wrap box CSS sizes — no new
//  DOM, no touch to the choropleth colour/selection model (occupied-red +
//  selected-amber stay byte-identical; only the projection is repaired).
//
//  Deeper root-fix (NOW DONE — see the `layerRef` + selection `setStyle` effect in
//  GeoMap below): the <GeoJSON> layer is no longer keyed on selection, so a
//  row-pick while hidden restyles the existing paths in place instead of remounting
//  and re-projecting against a 0×0 box. The remount window that produced
//  `LatLng(NaN, NaN)` is gone. RepairOnShow stays as DEFENSE-IN-DEPTH: it re-fits
//  on a hidden→shown transition, and is now hardened to NEVER throw — every guard
//  below must hold before fitBounds runs, and the whole body is wrapped so a future
//  regression can degrade to a stale viewport rather than crash the panel shell.
//
function boundsAreFinite(bounds: L.LatLngBounds): boolean {
  if (!bounds.isValid()) return false
  const ne = bounds.getNorthEast()
  const sw = bounds.getSouthWest()
  return [ne.lat, ne.lng, sw.lat, sw.lng].every(Number.isFinite)
}

export function RepairOnShow({ geoJson, visible }: { geoJson: GeoJSON.FeatureCollection; visible: boolean }) {
  const map = useMap()
  const wasVisible = useRef(visible)
  useEffect(() => {
    if (visible && !wasVisible.current) {
      try {
        // Only project against a REAL laid-out box: a 0×0 container is exactly
        // what corrupts the projection to NaN, so measuring/fitting against it is
        // the very thing to avoid.
        const el = map.getContainer()
        if (el && el.clientWidth > 0 && el.clientHeight > 0) {
          map.invalidateSize()
          const bounds = L.geoJSON(geoJson).getBounds()
          // isValid() alone is not enough — a NaN corner can still report "valid";
          // require finite LatLngs before fitBounds (which throws on NaN input).
          if (boundsAreFinite(bounds)) {
            map.fitBounds(bounds, { padding: [12, 12], animate: false })
          }
        }
      } catch {
        // Defense-in-depth: a re-projection failure must never escape to the
        // error boundary (the crash this fix removes). Worst case = stale viewport.
      }
    }
    wasVisible.current = visible
  }, [visible, map, geoJson])
  return null
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
  initialCenter = WORLD_CENTER,
  initialZoom = WORLD_ZOOM,
}: GeoMapProps) {
  const [geoJson, setGeoJson] = useState<GeoJSON.FeatureCollection | null>(null)

  // Hidden→shown re-projection gate (defect A — see RepairOnShow below). Attached
  // to the SAME chart-wrap box the view-toggle CSS shows/hides; must be called
  // unconditionally (before the `!geoJson` early return) — hook order.
  const { ref: wrapRef, visible: mapVisible } = useContainerVisible<HTMLDivElement>()

  const selectedRef = useRef(selectedGeos)
  const onSelectRef = useRef(onSelect)
  // Ref to the underlying Leaflet GeoJSON layer (react-leaflet exposes the L.GeoJSON
  // instance via ref). Selection is repainted through this imperatively — see the
  // setStyle effect below — so a row-pick NEVER remounts/re-projects the layer.
  const layerRef = useRef<L.GeoJSON | null>(null)

  useEffect(() => { selectedRef.current = selectedGeos }, [selectedGeos])
  useEffect(() => { onSelectRef.current = onSelect },     [onSelect])

  // Value → color: assign each region a fill by quantile rank against the theme
  // ramp. This is the choropleth encoding — without it every region paints the
  // same accent and the map reads flat. Keyed by row.id (the geo dim value), which
  // onEachFeature/style resolve from the feature ISO. See ./choropleth (SSOT).
  const colorByGeo = useMemo(() => choroplethColors(rows), [rows])
  const colorFor = (geoId: string) => colorByGeo.get(geoId) ?? accentFill()
  // OCCUPIED is keyed by the feature ISO (pre geoCodeMap) so it flags territories with
  // no data row too. Config-declared set — the engine stays agnostic (Law 1).
  const occupiedSet = useMemo(() => new Set(occupiedIso ?? []), [occupiedIso])

  // Selection highlight = a STYLE-only change, applied IN PLACE on the mounted
  // layer — the map's own documented root-fix. Because the <GeoJSON> is no longer
  // keyed on selection, this restyle is the entire selection-repaint path: it runs
  // whether the map is visible or `display:none`, and setStyle only rewrites path
  // attributes (fill/opacity/weight) — it does NOT re-project geometry, so it is
  // safe against a 0×0 hidden container (no NaN). Resolves through the SAME
  // resolveFeatureStyle SSOT as the mount `style` prop, so occupied→red /
  // selected→amber / base-ramp stay byte-identical between mount and restyle.
  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    layer.setStyle((feature) =>
      resolveFeatureStyle(feature as GeoJSON.Feature | undefined, {
        isoField,
        geoCodeMap,
        colorFor,
        selectedGeos,
        occupiedSet,
      }),
    )
    // colorFor is derived from colorByGeo (its only closure dep); listing colorByGeo
    // keeps the restyle correct when warm rows change the ramp without an extra dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGeos, occupiedSet, colorByGeo, isoField, geoCodeMap])

  useEffect(() => {
    const worker = new Worker(
        new URL('./worker.js', import.meta.url)
    );

    worker.postMessage({
      url: geoJsonUrl
    });

    worker.onmessage = (e) => {
      if (e.data.success) {
        setGeoJson(e.data.data);
      }
    };

    return () => {
      worker.terminate();
    };
  }, [geoJsonUrl]);

  // wrapRef attaches on BOTH branches (loading + loaded): useContainerVisible's
  // observer is set up once on first mount ([] deps) — if the ref only attached
  // after geoJson resolved, the loading-phase mount would leave ref.current null
  // forever and the observer would never be established.
  if (!geoJson) return <div ref={wrapRef} className="chart-wrap geo-map-loading" />

  const onEachFeature = (
    feature: GeoJSON.Feature<GeoJSON.Geometry, GeoFeatureProps>,
    layer:   L.Layer,
  ) => {
    const iso   = String(feature.properties?.[isoField] ?? '')
    const geoId = geoCodeMap[iso]
    const row   = rows.find(r => r.id === geoId)

    if (row) {
      const unitSuffix = unit ? ` ${unit}` : ''
      layer.bindTooltip(
        `<strong>${row.label}</strong><br/>${fmtNum(row.value, 0)}${unitSuffix} · ${fmtNum(row.pct ?? 0, 1)}%`,
        { sticky: true },
      )
    } else {
      const override = labelOverrides?.[iso]
      if (override) {
        layer.bindTooltip(`<strong>${override}</strong>`, { sticky: true })
      }
    }

    layer.on({
      mouseover(e) {
        if (!selectedRef.current.includes(geoId)) {
          ;(e.target as L.Path).setStyle(hoverStyle())
        }
      },
      mouseout(e) {
        ;(e.target as L.Path).setStyle(featureStyle(colorFor(geoId), selectedRef.current.includes(geoId), occupiedSet.has(iso)))
      },
      click() {
        if (!geoId) return
        onSelectRef.current(geoId)
      },
    })
  }

  return (
    <div ref={wrapRef} className="chart-wrap" style={{ position: 'relative' }}>
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        zoomSnap={0}
        zoomDelta={0.25}
        style={{ height: '100%', width: '100%', background: 'transparent' }}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        dragging={false}
        zoomControl={false}
        attributionControl={false}
      >
        <GeoJSON
          // Key ONLY on the choropleth SCALE (structural) — NOT selection. A
          // selection change repaints via the setStyle effect above, so it can no
          // longer remount the layer while hidden and collapse the projection to
          // NaN. Warm-row colour changes still change the key → remount+repaint,
          // preserving the async flat-map fix.
          key={choroplethLayerKey(colorByGeo)}
          ref={layerRef}
          data={geoJson}
          style={(feature) =>
            resolveFeatureStyle(feature as GeoJSON.Feature | undefined, {
              isoField,
              geoCodeMap,
              colorFor,
              selectedGeos,
              occupiedSet,
            })
          }
          onEachFeature={onEachFeature}
        />
        <FitBounds geoJson={geoJson} />
        <RepairOnShow geoJson={geoJson} visible={mapVisible} />
      </MapContainer>
    </div>
  )
}