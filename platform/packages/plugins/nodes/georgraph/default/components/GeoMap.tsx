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
import { useEffect, useRef, useState } from 'react'
import { GeoJSON, MapContainer, useMap } from 'react-leaflet'
import L, { type PathOptions } from 'leaflet'
import type { DataRow } from '@statdash/engine'
import { fmtNum } from '@statdash/engine'

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

const FILL_COLOR    = '#0080BE'
const FILL_DEFAULT  = 0.45
const FILL_SELECTED = 0.85

// ── Style helpers ──────────────────────────────────────────────────────

function baseStyle(selected: boolean): PathOptions {
  return {
    fillColor:   FILL_COLOR,
    fillOpacity: selected ? FILL_SELECTED : FILL_DEFAULT,
    color:       '#fff',
    weight:      1,
  }
}

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

// ── GeoMap ─────────────────────────────────────────────────────────────

export function GeoMap({
  rows,
  selectedGeos,
  onSelect,
  geoJsonUrl,
  isoField,
  geoCodeMap,
  labelOverrides,
  unit,
  initialCenter = WORLD_CENTER,
  initialZoom = WORLD_ZOOM,
}: GeoMapProps) {
  const [geoJson, setGeoJson] = useState<GeoJSON.FeatureCollection | null>(null)

  const selectedRef = useRef(selectedGeos)
  const onSelectRef = useRef(onSelect)

  useEffect(() => { selectedRef.current = selectedGeos }, [selectedGeos])
  useEffect(() => { onSelectRef.current = onSelect },     [onSelect])

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

  if (!geoJson) return <div className="chart-wrap geo-map-loading" />

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
          ;(e.target as L.Path).setStyle({ fillOpacity: FILL_SELECTED, color: '#fff', weight: 1 })
        }
      },
      mouseout(e) {
        ;(e.target as L.Path).setStyle(baseStyle(selectedRef.current.includes(geoId)))
      },
      click() {
        if (!geoId) return
        onSelectRef.current(geoId)
      },
    })
  }

  return (
    <div className="chart-wrap" style={{ position: 'relative' }}>
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
          key={selectedGeos.join(',')}
          data={geoJson}
          style={(feature) => {
            const iso   = String(feature?.properties?.[isoField] ?? '')
            const geoId = geoCodeMap[iso]
            return baseStyle(selectedGeos.includes(geoId))
          }}
          onEachFeature={onEachFeature}
        />
        <FitBounds geoJson={geoJson} />
      </MapContainer>
    </div>
  )
}