import type { NodeBase, PropertyGroup, PropSchema } from '@statdash/react/engine'
import type { DataSpec }                            from '@statdash/engine'

// ── MapNode — choropleth map panel ────────────────────────────────────
//
//  Law 1 (no privileged dimensions): geoDim and valueField are plain
//  field-name strings — the node has zero knowledge of geographic
//  semantics. Topology coupling lives in topologyRegistry.ts.
//
//  Topology identifier (topology?) is resolved via topologyRegistry at
//  render time. No hardcoded geo data in this plugin.
//
export interface MapNode extends NodeBase {
  type: 'map'
  /**
   * Row-list or query — must yield rows with at least geoDim + valueField.
   * DataSpec is declarative (Law 2 — no functions).
   */
  data?: DataSpec
  /**
   * Display configuration — extends ViewParams with map-specific fields.
   * geoDim and valueField follow Law 1: these are just field name strings,
   * not special-cased geographic concepts.
   */
  view?: import('@statdash/react/engine').ViewParams & {
    /** Field in data rows that holds the geographic dimension code. */
    geoDim:      string
    /** Field in data rows that holds the numeric value to choropleth-color. */
    valueField:  string
    /** Color scale algorithm. Default: 'quantile'. */
    scale?:      'linear' | 'quantile' | 'threshold'
    /** Topology registry identifier — resolved via topologyRegistry at render time. */
    topology?:   string
    /** Override color array. Falls back to DEFAULT_PALETTE when absent. */
    palette?:    string[]
  }
}

export const MapSchema: PropSchema = [
  {
    field:    'view.geoDim',
    type:     'string',
    label:    { ka: 'გეო-განზომილება', en: 'Geo dimension field' },
    required: true,
  },
  {
    field:    'view.valueField',
    type:     'string',
    label:    { ka: 'მნიშვნელობის ველი', en: 'Value field' },
    required: true,
  },
  {
    field:   'view.scale',
    type:    'string',
    label:   { ka: 'შკალის ტიპი', en: 'Color scale' },
    options: [
      { value: 'quantile',  label: { ka: 'კვანტილი',     en: 'Quantile'  } },
      { value: 'linear',    label: { ka: 'წრფივი',        en: 'Linear'    } },
      { value: 'threshold', label: { ka: 'ზღვარი',        en: 'Threshold' } },
    ],
    default: 'quantile',
  },
  {
    field: 'view.topology',
    type:  'string',
    label: { ka: 'ტოპოლოგია', en: 'Topology ID' },
  },
  {
    field: 'view.palette',
    type:  'array',
    label: { ka: 'ფერთა პალიტრა', en: 'Color palette' },
  },
]

export const MapGroups: PropertyGroup[] = [
  {
    label:  { ka: 'მონაცემები', en: 'Data' },
    fields: ['view.geoDim', 'view.valueField'],
  },
  {
    label:  { ka: 'ვიზუალიზაცია', en: 'Display' },
    fields: ['view.scale', 'view.topology', 'view.palette'],
  },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'map': MapNode }
}
