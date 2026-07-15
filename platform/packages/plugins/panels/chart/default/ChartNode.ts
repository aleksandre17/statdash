import type { PropertyGroup, DataLinkDef } from '@statdash/react/engine'
import type { ChartType, LocaleString, CtxScopeRef } from '@statdash/engine'
import type { ChartDef, LegendConfig, TooltipConfig } from '@statdash/charts'
import type { NodeBase }                   from '@statdash/react/engine'
import type { LocaleFieldConfig, LocaleAxes, LocaleAxisConfig } from './utils/localeChartDef'
import { DATA_INTEGRITY_SCHEMA, DATA_INTEGRITY_FIELDS } from '../../dataIntegritySchema'
import { defineSchema, type AssertSchemaCovers, type Expect } from '../../../schema-contract'

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

// ── AxisItemSchema — one axis's editable surface (x / y / y2) ─────────────────
//  1:1 with the config-facing `LocaleAxisConfig` (engine `AxisConfig` whose `unit`
//  may be bilingual). Declared BEFORE the schemas that reference it (const init
//  order), the axis-nesting analogue of gauge's `ThresholdItemSchema`. `unit` is
//  `coverage:'localized'` — the provisioning authors '%'/'მლნ ₾' as `{ ka, en }`,
//  resolved at the render boundary (localeChartDef.ts); the Inspector authors it
//  per-locale. The rest are locale-agnostic scalars.
export const AxisItemSchema = defineSchema([
  { field: 'unit',     type: 'LocaleString', coverage: 'localized',
    label: { ka: 'ერთეული',    en: 'Unit' } },
  { field: 'decimals', type: 'number', label: { ka: 'ათწილადები', en: 'Decimals' } },
  { field: 'min',      type: 'number', label: { ka: 'მინიმუმი',   en: 'Min' } },
  { field: 'max',      type: 'number', label: { ka: 'მაქსიმუმი',  en: 'Max' } },
  { field: 'hidden',   type: 'boolean', label: { ka: 'ღერძის დამალვა', en: 'Hide axis' } },
])
// FF-SCHEMA-COMPLETE depth (tier c): 1:1 with LocaleAxisConfig's editable keys.
export type _AxisItemCovers = Expect<AssertSchemaCovers<LocaleAxisConfig, typeof AxisItemSchema>>

// ── AxesItemSchema — the {x, y, y2} axis map ─────────────────────────────────
//  Each axis is itself a structured OBJECT (its own AxisItemSchema) — so the
//  nested editor drills `Axes › X axis › Unit/Decimals/…` to arbitrary depth, no
//  opaque leaf (the depth gate in schema-completeness.fitness recurses through it).
export const AxesItemSchema = defineSchema([
  { field: 'x',  type: 'object', itemSchema: AxisItemSchema,
    label: { ka: 'X ღერძი',        en: 'X axis' } },
  { field: 'y',  type: 'object', itemSchema: AxisItemSchema,
    label: { ka: 'Y ღერძი',        en: 'Y axis' } },
  { field: 'y2', type: 'object', itemSchema: AxisItemSchema,
    label: { ka: 'მეორე Y ღერძი',  en: 'Second Y axis' } },
])
// 1:1 with LocaleAxes's editable keys (x / y / y2).
export type _AxesCovers = Expect<AssertSchemaCovers<LocaleAxes, typeof AxesItemSchema>>

// ── LegendItemSchema / TooltipItemSchema — the legend + tooltip sub-objects ───
export const LegendItemSchema = defineSchema([
  { field: 'show',     type: 'boolean', label: { ka: 'ლეგენდის ჩვენება', en: 'Show legend' } },
  { field: 'position', type: 'string',  label: { ka: 'პოზიცია', en: 'Position' },
    options: [
      { value: 'top',    label: { ka: 'ზემოთ',  en: 'Top' } },
      { value: 'bottom', label: { ka: 'ქვემოთ', en: 'Bottom' } },
      { value: 'right',  label: { ka: 'მარჯვნივ', en: 'Right' } },
      { value: 'left',   label: { ka: 'მარცხნივ', en: 'Left' } },
    ] },
])
export type _LegendCovers = Expect<AssertSchemaCovers<LegendConfig, typeof LegendItemSchema>>

export const TooltipItemSchema = defineSchema([
  { field: 'mode', type: 'string', label: { ka: 'რეჟიმი', en: 'Mode' },
    options: [
      { value: 'multi',  label: { ka: 'ერთობლივი', en: 'Shared' } },
      { value: 'single', label: { ka: 'ცალკეული', en: 'Per-series' } },
      { value: 'none',   label: { ka: 'გამორთული', en: 'Off' } },
    ] },
])
export type _TooltipCovers = Expect<AssertSchemaCovers<TooltipConfig, typeof TooltipItemSchema>>

export const ChartSchema = defineSchema([
  {
    field:    'chartType',
    type:     'string',
    concern:  'style',
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
    field:   'data.query.measure',
    type:    'enum-ref',
    source:  'metrics',
    concern: 'data',
    label:   { ka: 'მეტრიკა', en: 'Metric' },
  },
  // ── Labels (config-bilingual) — CONTENT (what the chart says) ──────────────
  { field: 'label',       type: 'LocaleString', coverage: 'localized', concern: 'content',
    label: { ka: 'სათაური', en: 'Label' } },
  //  Donut/pie centre caption — shown only when the mark is a donut (showWhen is the
  //  engine's `lhs === rhs` visibility SSOT; a `{$ctx}` mark ref degrades to hidden).
  { field: 'centerLabel', type: 'LocaleString', coverage: 'localized', concern: 'content',
    showWhen: "chartType === 'donut'",
    label: { ka: 'ცენტრის წარწერა', en: 'Centre label' } },
  // ── Visualisation-refinement scalars — STYLE (how it looks); height = LAYOUT ─
  { field: 'height',      type: 'number', validation: { min: 40 }, concern: 'layout',
    label: { ka: 'სიმაღლე (px)', en: 'Height (px)' } },
  { field: 'stacked',     type: 'boolean', concern: 'style', label: { ka: 'დაწყობილი', en: 'Stacked' } },
  { field: 'distributed', type: 'boolean', concern: 'style', label: { ka: 'კატეგორიის ფერები', en: 'Colour by category' } },
  { field: 'dataLabels',  type: 'boolean', concern: 'style', label: { ka: 'მნიშვნელობის წარწერები', en: 'Value labels' } },
  { field: 'compact',     type: 'boolean', concern: 'style', label: { ka: 'კომპაქტური', en: 'Compact' } },
  // ── Nested viz objects (authored item-by-item via the generic nested editor) ─
  { field: 'axes',    type: 'object', itemSchema: AxesItemSchema, concern: 'style',
    label: { ka: 'ღერძები', en: 'Axes' } },
  { field: 'legend',  type: 'object', itemSchema: LegendItemSchema, concern: 'style',
    label: { ka: 'ლეგენდა', en: 'Legend' } },
  { field: 'tooltip', type: 'object', itemSchema: TooltipItemSchema, concern: 'style',
    label: { ka: 'მინიშნება', en: 'Tooltip' } },
  ...DATA_INTEGRITY_SCHEMA,
])

// FF-SCHEMA-COMPLETE (tier b): ChartNode INTERSECTS the engine render-spec
// `ChartDef` (Vega-Lite mark+encoding analogue), so its editable surface carries
// ChartDef's visualisation-refinement fields. The SCHEMA_TODO backlog is now
// DRAINED: every editable ChartDef-derived key is a declared inspector field —
// scalars (chartType, label, centerLabel, height, stacked, distributed, dataLabels,
// compact), the governed metric-ref (`data.query.measure`), `preliminary`, and the
// nested objects (axes / legend / tooltip) each carrying a structured `itemSchema`
// authored via the generic recursive nested editor (D7.1). `fieldConfig`/`dataLinks`
// are NodeBase system keys → excluded (authored via the field-config / data-links
// paths, not a chart prop). An EMPTY Todo means: a new ChartDef render input that is
// not also declared here fails `tsc` — the chart's authorable contract is now
// self-declaring in full (ADR-038 · FF-ELEMENT-DECLARES-CONTRACT).
export type _ChartCovers = Expect<AssertSchemaCovers<ChartNode, typeof ChartSchema>>

export const ChartGroups: PropertyGroup[] = [
  { label: { ka: 'მონაცემები',   en: 'Data'          }, fields: ['data.query.measure'] },
  { label: { ka: 'ვიზუალიზაცია', en: 'Visualisation' },
    fields: ['chartType', 'height', 'stacked', 'distributed', 'dataLabels', 'compact'] },
  { label: { ka: 'წარწერები',    en: 'Labels'        }, fields: ['label', 'centerLabel'] },
  { label: { ka: 'ღერძები',      en: 'Axes'          }, fields: ['axes'] },
  { label: { ka: 'ლეგენდა',      en: 'Legend'        }, fields: ['legend', 'tooltip'] },
  { label: { ka: 'მონაცემთა მთლიანობა', en: 'Data integrity' }, fields: [...DATA_INTEGRITY_FIELDS] },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'chart': ChartNode }
}