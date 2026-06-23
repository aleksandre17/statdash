// ── topologyRegistry — app-tier topology registration ────────────────────
//
//  Apps (e.g. apps/geostat) register their GeoJSON / TopoJSON topology data
//  here. The map panel plugin resolves topology by id at render time.
//
//  OCP: the plugin provides the contract; apps provide the data.
//  No hardcoded geographic data lives in the plugin layer.
//
//  Usage (in apps/geostat):
//    import { registerTopology } from '@statdash/plugins/panels/map/default'
//    registerTopology({
//      id:      'georgia-regions',
//      label:   'Georgia — Regions',
//      data:    georgiaRegionsGeoJson,
//      dimProp: 'code',   // feature.properties.code matches geoDim values
//    })
//

export interface TopologyDescriptor {
  /** Unique registry key — matches MapNode.view.topology. */
  id:      string
  /** Human-readable label for the Constructor topology selector. */
  label?:  string
  /**
   * GeoJSON FeatureCollection or TopoJSON object.
   * Typed as `unknown` to stay dependency-free of @types/geojson in the plugin.
   * Shells narrow this at render time.
   */
  data:    unknown
  /**
   * Which feature property value matches the geoDim field in the data rows.
   * e.g. dimProp: 'code' → feature.properties.code is compared to row[geoDim].
   */
  dimProp: string
}

const _registry = new Map<string, TopologyDescriptor>()

/** Register a topology descriptor. Overwrites any existing entry with the same id. */
export function registerTopology(desc: TopologyDescriptor): void {
  _registry.set(desc.id, desc)
}

/** Look up a topology descriptor by id. Returns undefined when not registered. */
export function getTopology(id: string): TopologyDescriptor | undefined {
  return _registry.get(id)
}

/** List all registered topology ids. */
export function listTopologies(): string[] {
  return [..._registry.keys()]
}
