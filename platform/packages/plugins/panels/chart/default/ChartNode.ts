import type { PropertyGroup, DataLinkDef, PropSchema } from '@statdash/react/engine'
import type { ChartType, LocaleString, CtxScopeRef } from '@statdash/engine'
import type { ChartDef }         from '@statdash/charts'
import type { NodeBase }                   from '@statdash/react/engine'
import type { LocaleFieldConfig, LocaleAxes } from './utils/localeChartDef'
import { DATA_INTEGRITY_SCHEMA, DATA_INTEGRITY_FIELDS } from '../../dataIntegritySchema'

// ── ChartNode — the config-facing chart shape ────────────────────────────
//
//  The bilingual text fields are re-typed off the engine `ChartDef` as
//  `LocaleString` (label, centerLabel, axis units, fieldConfig text). This is the
//  TYPE-HONESTY half of the LocaleString render-boundary fix: the provisioning
//  authors these as `{ ka, en }`, so the compiler must SEE them as LocaleString and
//  force a resolve (resolveChartDefLocale) before they reach the engine `ChartDef`
//  (string units). Leaving them `string` is the scalar lie that let a raw `{ ka, en }`
//  bag flow unflagged into ApexCharts / a JSX child. See ./utils/localeChartDef.ts.
//
export type ChartNode =
  Omit<NodeBase, 'type'>
  // `chartType` may be a `{ $ctx: key }` STATE ref (AR-36) — the MARK binds to state,
  // so a panel rotates donut ⇄ bar with the selection (resolved in useChartOutput
  // before interpretChart, the plugin sibling of the P0 encoding-ref pass).
  & { type: 'chart'; chartType: ChartType | CtxScopeRef }
  & Omit<ChartDef, 'type' | 'label' | 'centerLabel' | 'axes' | 'fieldConfig'>
  & {
      /** Chart header / series-name fallback — config-bilingual. */
      label?:       LocaleString
      /** Donut centre caption — config-bilingual. */
      centerLabel?: LocaleString
      /** Axis overrides whose `unit` may be config-bilingual. */
      axes?:        LocaleAxes
      /** Per-field display settings whose text (unit / noValue / labels) may be config-bilingual. */
      fieldConfig?: LocaleFieldConfig
    }
  & { dataLinks?: DataLinkDef[] }
  /** Explicit "preliminary data" override (Law 9) — signal #1 of resolvePreliminary. */
  & { preliminary?: boolean }

export const ChartSchema: PropSchema = [
  {
    field:    'chartType',
    type:     'string',
    label:    { ka: 'დიაგრამის ტიპი', en: 'Chart type' },
    required: true,
    options:  [
      { value: 'bar',     label: { ka: 'სვეტოვანი', en: 'Bar' } },
      { value: 'line',    label: { ka: 'წრფივი',    en: 'Line' } },
      { value: 'area',    label: { ka: 'ფართობი',   en: 'Area' } },
      { value: 'donut',   label: { ka: 'რგოლი',     en: 'Donut' } },
      { value: 'pie',     label: { ka: 'წრიული',    en: 'Pie' } },
      { value: 'scatter', label: { ka: 'წერტილოვანი', en: 'Scatter' } },
      { value: 'heatmap', label: { ka: 'სითბური რუკა', en: 'Heatmap' } },
    ],
  },
  // ── Governed metric-ref (AR-49 / M0 build-item 10) ────────────────────────
  //  The GOVERNED bind target: a metric-ref is just an `enum-ref` whose options
  //  come from the semantic-layer catalog (source:'metrics', backed by
  //  describeApp().metrics) — the author picks a governed noun, never types a raw
  //  SDMX code (Law 2). `field` is the chart's OWN measure dot-path: a `query`
  //  DataSpec keeps its measure at `data.query.measure` (the universal DataSpec
  //  branch; confirmed against geostat.provisioning — its charts/sections already
  //  hold metric-ids like 'gdp.current'/'regional.gva' here). This is the exact
  //  dot-path the Metric-Palette bind affordance (item 9) writes to, so a bind
  //  produces config byte-identical to hand-authoring; resolveMeasureRef (AR-40)
  //  lowers the metric-id → underlying code with NO new runtime path (SPEC §3).
  //  Law 1: the picker resolves generically by id — no dimension name here.
  //  NOT `required`: a chart may INHERIT its rows from the parent section's
  //  `data`, so its own measure is legitimately absent — marking it required
  //  would flag every section-fed chart in validateNodeConfig (additive floor).
  {
    field:  'data.query.measure',
    type:   'enum-ref',
    source: 'metrics',
    label:  { ka: 'მეტრიკა', en: 'Metric' },
  },
  ...DATA_INTEGRITY_SCHEMA,
]

export const ChartGroups: PropertyGroup[] = [
  { label: { ka: 'მონაცემები',   en: 'Data'          }, fields: ['data.query.measure'] },
  { label: { ka: 'ვიზუალიზაცია', en: 'Visualisation' }, fields: ['chartType'] },
  { label: { ka: 'ლეგენდა',      en: 'Legend'          }, fields: ['view.legend', 'view.tooltip'] },
  { label: { ka: 'მონაცემთა მთლიანობა', en: 'Data integrity' }, fields: [...DATA_INTEGRITY_FIELDS] },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'chart': ChartNode }
}