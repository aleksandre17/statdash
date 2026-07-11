// ── dataFlow — the Data-Flow Spine projection (AR-49 M4.3 · Move 3) ─────────────
//
//  The owner's standing grievance: "pipelines STILL not visible" — the modeling
//  machinery is rich but BURIED, so a non-modeler can never SEE how a number reaches
//  a panel. This module is the READ-MODEL behind the fix: it PROJECTS the pipeline
//  (source → dataset/spec → metric → used-by) from registries we ALREADY own —
//  never a second, hand-drawn stored graph (Law 2: the map is a projection of config,
//  and `FF-FLOWMAP-IS-PROJECTION` — no new persisted state; SPEC §3.3, §7 rejected-5).
//
//  The four columns and where each is projected FROM:
//    • source   — the metric's `dataSource` storeKey (the Cube.dev dataSource-on-
//                 measure pattern), joined to the Layer-1 DataSource registry for a
//                 kind + connection-status badge when the storeKey matches an
//                 authored source; un-sourced metrics fall into one honest bucket.
//    • dataset/ — the metric's underlying SDMX measure `code`(s) for a BASE metric,
//      spec       or the named input measure refs for a DERIVED (`calc`) metric.
//    • metric   — the governed metric itself (label + provenance badges: unit,
//                 methodology/agency, calc, additivity — Law 9, statistics-grade).
//    • used-by  — the blast radius from `computeMetricImpact` (the SAME schema-driven
//                 reverse index the metric editor's governance banner uses — one
//                 truth, never a parallel scan). A metric with zero blocks is a
//                 legible dead-end candidate, surfaced, never hidden.
//
//  Pure + injectable (`getSchema` port, explicit inputs) so it is testable with no
//  network and reuses the app's ONE schema source at the call site. Law 1: every
//  dimension/axis is generic here — nothing branches on a hardcoded dimension name.
//
import type { MetricDef } from '@statdash/engine'
import type { PropSchema } from '@statdash/react/engine'
import type { CanvasPage, CanvasNode, DataSourceDef, Locale } from '../../types/constructor'
import { readCatalogLabel } from '../../discovery/semanticCatalogOptions'
import { computeMetricImpact } from './metricImpact'

/** Where a governed metric is consumed across the loaded pages (the blast radius). */
export interface FlowUsedBy {
  /** Total blocks whose measure field references the metric. */
  blocks: number
  /** Distinct pages containing at least one such block. */
  pages:  { id: string; title: string }[]
}

/** One governed metric, projected as a flow node with its provenance + consumers. */
export interface FlowMetricNode {
  id:           string
  label:        string
  unit?:        string
  format?:      string
  methodology?: string
  description?: string
  /** True ⟺ a DERIVED (calc) metric — its value comes from `calcInputs`, not `codes`. */
  calc:         boolean
  additivity?:  string
  /** Data/spec column for a BASE metric: the underlying SDMX measure code(s). */
  codes:        string[]
  /** Data/spec column for a DERIVED metric: the named input measure refs. */
  calcInputs:   string[]
  usedBy:       FlowUsedBy
}

/** A source origin (a `dataSource` storeKey) and the metrics that flow from it. */
export interface FlowSourceGroup {
  /** The `dataSource` storeKey, or the shared bucket id for un-sourced metrics. */
  id:           string
  /** True ⟺ the synthetic "no explicit source declared" bucket. */
  unsourced:    boolean
  /** Joined from the Layer-1 DataSource registry when the storeKey matches (else absent). */
  kind?:        string
  status?:      string
  metrics:      FlowMetricNode[]
  /** Total used-by blocks across the group's metrics (header glance). */
  usedByBlocks: number
}

/** The whole flow map — a pure projection, no stored state. */
export interface DataFlowModel {
  sources:       FlowSourceGroup[]
  totalMetrics:  number
  totalSources:  number
  /** Governed metrics referenced by NO loaded page block (dead-end candidates). */
  unusedMetrics: number
}

/** The bucket id for metrics that declare no explicit `dataSource`. */
export const UNSOURCED_ID = '—'

function measureCodes(def: MetricDef): string[] {
  if (def.code == null) return []
  return Array.isArray(def.code) ? def.code : [def.code]
}

function calcInputRefs(def: MetricDef): string[] {
  if (!def.calc) return []
  // De-duplicate the input measure refs, preserving first-seen order (legible chain).
  const seen = new Set<string>()
  const out: string[] = []
  for (const input of Object.values(def.calc.inputs)) {
    if (!seen.has(input.measure)) { seen.add(input.measure); out.push(input.measure) }
  }
  return out
}

/**
 * Project the Data-Flow map from the governed catalog + the loaded pages. Pure:
 * `getSchema` is injected (the app passes `nodeSchemaSource.getSchema`; tests a stub),
 * so the used-by reverse index reuses the ONE bind-target discovery seam and can never
 * disagree with the metric editor's impact banner. `query` (optional) filters metrics
 * by a lowercase haystack so a shared search can drive both the map and a detail list.
 */
export function projectDataFlow(input: {
  metrics:     Record<string, MetricDef>
  pages:       CanvasPage[]
  getSchema:   (node: CanvasNode) => PropSchema
  dataSources: DataSourceDef[]
  locale:      Locale
  query?:      string
}): DataFlowModel {
  const { metrics, pages, getSchema, dataSources, locale } = input
  const q = (input.query ?? '').trim().toLowerCase()

  // Layer-1 source registry, indexed by storeKey (id) for the kind/status join.
  const sourceById = new Map(dataSources.map((s) => [s.id, s]))

  let unusedMetrics = 0
  const nodes: { group: string; node: FlowMetricNode }[] = []

  for (const [id, def] of Object.entries(metrics)) {
    const label = readCatalogLabel(def.label, locale, id)
    const unit  = def.unit ? readCatalogLabel(def.unit, locale, '') : undefined
    const codes = measureCodes(def)
    const calcInputs = calcInputRefs(def)
    const usedBy = computeMetricImpact(pages, id, getSchema, locale)
    if (usedBy.blocks === 0) unusedMetrics += 1

    const group = def.dataSource ?? UNSOURCED_ID
    const haystack = `${label} ${unit ?? ''} ${id} ${codes.join(' ')} ${calcInputs.join(' ')} ${group}`.toLowerCase()
    if (q && !haystack.includes(q)) continue

    nodes.push({
      group,
      node: {
        id,
        label,
        unit,
        format:      def.format,
        methodology: def.methodology,
        description: def.description ? readCatalogLabel(def.description, locale, '') : undefined,
        calc:        Boolean(def.calc),
        additivity:  def.additivity,
        codes,
        calcInputs,
        usedBy,
      },
    })
  }

  // Group by source, then order: real sources (alpha) first, the un-sourced bucket last.
  const byGroup = new Map<string, FlowMetricNode[]>()
  for (const { group, node } of nodes) {
    const bucket = byGroup.get(group) ?? []
    bucket.push(node)
    byGroup.set(group, bucket)
  }

  const sources: FlowSourceGroup[] = [...byGroup.entries()]
    .map(([groupId, groupMetrics]): FlowSourceGroup => {
      const src = sourceById.get(groupId)
      return {
        id:           groupId,
        unsourced:    groupId === UNSOURCED_ID,
        kind:         src?.type,
        status:       src?.status,
        metrics:      groupMetrics.sort((a, b) => a.id.localeCompare(b.id)),
        usedByBlocks: groupMetrics.reduce((sum, m) => sum + m.usedBy.blocks, 0),
      }
    })
    .sort((a, b) => {
      if (a.unsourced !== b.unsourced) return a.unsourced ? 1 : -1
      return a.id.localeCompare(b.id)
    })

  return {
    sources,
    totalMetrics:  nodes.length,
    totalSources:  sources.filter((s) => !s.unsourced).length,
    unusedMetrics,
  }
}
