// ── resolveDrill — the render Consumer of the `drill` NodeAction (AR-42 P2) ─────
//
//  The READ peer of a node's `drill` write (drillParamKey ⇒ the drill-state param), the
//  drill-down sibling of resolveEmphasis (which reads a `highlight` write) and the
//  cross-filter query pins (which read a `filter` write). Same param = SSOT (Law 1); the
//  ONLY difference is what the read does with it — here it RE-RENDERS a governed metric
//  at the drilled hierarchy level.
//
//  THE MOVE (why the metric spec is UNCHANGED — M-SQ contract stable):
//    A metric-spec node (`data.type === 'metric'`) that declares a `drill` action produces
//    its rows at the DRILLED grain when the drill param is active. It does NOT touch the
//    MetricSpec — it COMPOSES the core `evalMetricDrill` seam on top: for each metric ref,
//    the seam reifies the target level's members FROM the SDMX codelist parent edges (Law 5,
//    never hand-authored) and point-reads each as a governed cell via the M2 grain SSOT
//    (`evalMeasureAtGrain`). Additivity-correct by construction: a base measure sums its
//    descendant leaves (OLAP rollup), a ratio / calc metric RE-DERIVES at each drilled
//    coordinate (FF-NO-SUM-OF-RATIO) — the M2 guarantee, unchanged.
//
//  Byte-identical when NOT drilled: no drill action, no active drill param, a non-metric
//  spec, or an un-hierarchied dimension ⇒ `undefined` (the caller keeps the base path).
//
//  Arrow-clean: react binding layer (holds the store manifest + ctx), composing core
//  seams (evalMetricDrill / getDimension / getMetric). Reshapes the seam's uniform
//  `{ [axis]: member, value, id, label }` rows into the SAME `{ …, series, metric }` shape
//  MetricResolver emits, so a drilled series renders identically to a grain-enumerated one.
//

import {
  evalMetricDrill,
  getDimension,
  getMetric,
  tagLocaleString,
} from '@statdash/engine'
import type { DataRow, DimVal, EngineRow, SectionContext, DrillTarget } from '@statdash/engine'
import type { NodeBase, RenderContext } from './types'
import type { DrillAction } from './node-events'
import { drillParamKey } from './node-events'
import { resolveStore } from './resolveNodeRows'

/** Structural narrow of a `metric` DataSpec (MetricSpec is not part of the public engine API). */
interface MetricSpecShape {
  type:    'metric'
  metrics: string[]
  by?:     string[]
  where?:  Partial<Record<string, DimVal>>
}

function asMetricSpec(data: unknown): MetricSpecShape | undefined {
  const d = data as { type?: string; metrics?: unknown } | undefined
  return d && d.type === 'metric' && Array.isArray(d.metrics) ? (d as MetricSpecShape) : undefined
}

/** The node's declared drill action (the first one), if any. */
function drillActionOf(node: NodeBase): DrillAction | undefined {
  return node.on?.flatMap((h) => h.actions).find((a): a is DrillAction => a.type === 'drill')
}

/**
 * The GOVERNED series label for a metric ref — tagged so the React resolveRowLocales
 * boundary localizes it (Law 1: the engine never picks a locale). Mirrors MetricResolver.
 */
function seriesLabel(ref: string): DimVal {
  const label = getMetric(ref)?.label
  return (label ? tagLocaleString(label) : ref) as DimVal
}

/**
 * resolveDrill — produce a metric-spec node's rows at the ACTIVE drilled level, or
 * `undefined` to leave the base (non-drilled) row path untouched (byte-identical).
 */
export function resolveDrill(node: NodeBase, ctx: RenderContext): DataRow[] | undefined {
  const spec = asMetricSpec(node.data)
  if (!spec) return undefined

  const drill = drillActionOf(node)
  if (!drill) return undefined

  // Read the drill-state param through the SAME key the writer derived (drillParamKey SSOT).
  // A `{ $ctx }` param ref is rare here (the demo uses a literal); a literal string key is
  // the common path — resolve it as a plain string when present.
  const paramKey = typeof drill.param === 'string' ? drill.param : drillParamKey(drill.dimension)
  const raw = ctx.filterParams[paramKey]
  if (raw == null || raw === '') return undefined            // not drilled → base path
  const level = Number(raw)
  if (Number.isNaN(level)) return undefined

  const def = getDimension(drill.dimension)
  if (!def?.hierarchy?.levels?.length) return undefined      // un-hierarchied dim → base path

  const store = resolveStore(ctx)
  const classifier = store.classifiers?.[drill.dimension]

  // `where` narrows the read coordinate — merged OVER ctx.dims (Law 1, any dim), mirroring
  // MetricResolver, so a drilled read scopes to the same coordinate the base spec would.
  const scoped: SectionContext =
    spec.where && Object.keys(spec.where).length > 0
      ? { ...ctx.sectionCtx, dims: { ...ctx.sectionCtx.dims, ...spec.where } as Record<string, DimVal> }
      : ctx.sectionCtx

  const target: DrillTarget = { dimension: drill.dimension, level }

  const out: DataRow[] = []
  for (const ref of spec.metrics) {
    const rows: EngineRow[] = evalMetricDrill(ref, def, target, scoped, store, classifier)
    const series = seriesLabel(ref)
    for (const r of rows) out.push({ ...r, series, metric: ref } as unknown as DataRow)
  }
  return out
}
