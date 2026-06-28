// ── Chart config LocaleString resolution — the render boundary ─────────
//
//  THE BUG CLASS this closes: a chart-config text field typed `string` (scalar)
//  that the provisioning bilingualization turned into a `{ ka, en }` LocaleString.
//  The scalar type tells TypeScript the value is already resolved, so the missing
//  resolve at the render boundary is NEVER compiler-flagged — the raw bag flows
//  through interpretChart into ChartOutput and out via toApexOptions, where it
//  reaches ApexCharts as text and renders "[object Object]" (axis unit, tooltip,
//  data label, legend / series name) or — in a custom chart component (donut
//  centerLabel, hbar-diverging group label) — throws React #31 as a JSX child.
//
//  jsdom CANNOT catch this for the ApexCharts path (it never executes ApexCharts),
//  and the page render-guard never even builds a chart body (no data ⇒ EmptyState).
//  So the engine MUST receive already-resolved strings: this module is the single
//  React boundary that resolves every bilingual ChartNode field to the active
//  locale BEFORE interpretChart, keeping @statdash/charts locale-agnostic (Law 1).
//
//  Type honesty: the CONFIG-facing types below carry `LocaleString` on every field
//  the provisioning may bilingualize. interpretChart consumes the engine `ChartDef`
//  (string units). Passing an unresolved Locale* value where the engine wants a
//  `string` is therefore a COMPILE error — the compiler coverage the scalar lie
//  had silently removed is restored. We do NOT widen the shared engine FieldConfig /
//  ChartDef (ISP — a table / KPI consumer of FieldConfig must not inherit a chart
//  boundary's resolve obligation); the LocaleString capability lives only on the
//  config-facing mirror the shell reads.
//
import type { LocaleString, FieldConfig, Threshold, FieldOverride } from '@statdash/engine'
import type { ChartDef, AxisConfig }                                from '@statdash/charts'
import type { ChartNode }                                           from '../ChartNode'

/** A `Threshold` whose legend/tooltip `label` may be authored bilingually. */
export type LocaleThreshold = Omit<Threshold, 'label'> & { label?: LocaleString }

/** A `FieldConfig` whose author-visible text (unit / noValue / threshold labels)
 *  may be a `LocaleString`. Per-series overrides nest the same shape. */
export type LocaleFieldConfig =
  Omit<FieldConfig, 'unit' | 'noValue' | 'thresholds' | 'overrides'> & {
    unit?:       LocaleString
    noValue?:    LocaleString
    thresholds?: LocaleThreshold[]
    overrides?:  Array<Omit<FieldOverride, 'config'> & { config: Omit<LocaleFieldConfig, 'overrides'> }>
  }

/** An `AxisConfig` whose `unit` may be authored bilingually. */
export type LocaleAxisConfig = Omit<AxisConfig, 'unit'> & { unit?: LocaleString }

export interface LocaleAxes {
  x?:  LocaleAxisConfig
  y?:  LocaleAxisConfig
  y2?: LocaleAxisConfig
}

type Resolve = (s: LocaleString) => string

/**
 * Resolve a LocaleString-capable FieldConfig → engine FieldConfig (string units).
 * Byte-identical passthrough for plain-string configs (resolveLocaleString returns
 * a `string` operand untouched), so non-bilingual configs are unchanged.
 */
export function resolveLocaleFieldConfig(
  fc:      LocaleFieldConfig | undefined,
  resolve: Resolve,
): FieldConfig | undefined {
  if (!fc) return undefined
  // Destructure the LocaleString-typed fields OUT of the base spread — `...rest`
  // (decimals / min / max / colorMode) is already engine-shaped; the locale fields
  // are re-added as resolved `string`s, so the result is honestly a FieldConfig.
  const { unit, noValue, thresholds, overrides, ...rest } = fc
  return {
    ...rest,
    ...(unit    != null ? { unit:    resolve(unit) }    : {}),
    ...(noValue != null ? { noValue: resolve(noValue) } : {}),
    ...(thresholds ? {
      thresholds: thresholds.map((t): Threshold =>
        t.label != null ? { ...t, label: resolve(t.label) } : { ...t, label: undefined }),
    } : {}),
    ...(overrides ? {
      overrides: overrides.map((o) => ({
        ...o,
        config: resolveLocaleFieldConfig(o.config, resolve) as Omit<FieldConfig, 'overrides'>,
      })),
    } : {}),
  }
}

/** Resolve every axis `unit` LocaleString → string. */
function resolveLocaleAxes(axes: LocaleAxes, resolve: Resolve): ChartDef['axes'] {
  const one = (a: LocaleAxisConfig | undefined): AxisConfig | undefined =>
    a == null ? undefined : (a.unit != null ? { ...a, unit: resolve(a.unit) } : (a as AxisConfig))
  return { x: one(axes.x), y: one(axes.y), y2: one(axes.y2) }
}

/**
 * resolveChartDefLocale — the chart render boundary.
 *
 *  Folds the parent's cascaded `fieldConfig` (node wins per key) and resolves
 *  EVERY bilingual ChartNode text field to the active locale, producing the engine
 *  `ChartDef` that interpretChart consumes. After this, no LocaleString object can
 *  reach ChartOutput / toApexOptions — the class is eliminated at its origin.
 *
 *  `ctxFieldConfig` is the parent RenderContext fieldConfig (string-typed today, but
 *  runtime-bilingual via the same provisioning bilingualization — the merge + resolve
 *  here neutralises that cascade lie at runtime regardless of its declared type).
 */
export function resolveChartDefLocale(
  def:            ChartNode,
  ctxFieldConfig: FieldConfig | undefined,
  resolve:        Resolve,
): ChartDef {
  const {
    type: _type, chartType, fieldConfig: defFc, label, centerLabel, axes,
    dataLinks: _dataLinks, preliminary: _preliminary, ...rest
  } = def

  const mergedFc: LocaleFieldConfig | undefined =
    (ctxFieldConfig || defFc) ? { ...ctxFieldConfig, ...defFc } : undefined

  return {
    ...rest,
    type:  chartType,
    label: resolve(label ?? ''),
    ...(centerLabel != null ? { centerLabel: resolve(centerLabel) } : {}),
    ...(axes        != null ? { axes: resolveLocaleAxes(axes, resolve) } : {}),
    ...(mergedFc    != null ? { fieldConfig: resolveLocaleFieldConfig(mergedFc, resolve) } : {}),
  } as ChartDef
}
