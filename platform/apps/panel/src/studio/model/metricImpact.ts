// ── metricImpact — the blast-radius reverse index for a governed metric (M2.2) ──
//
//  Governance integrity, surfaced-not-silent (spec §6.3): editing or deleting a
//  metric shows "N blocks across M pages reference this metric" BEFORE the steward
//  commits. A pure read over the loaded page trees — no network, computable in the
//  panel from what is already in the store.
//
//  Correctness (not a naive string scan): a block references a metric through its
//  SCHEMA-discovered measure field (the same `enum-ref`/`source:'metrics'` field the
//  bind writes to, metricBinding.ts). We resolve each node's metric-ref fields via
//  the injected `getSchema` port (nodeSchemaSource in the app; a stub in tests) and
//  read the value at that field path — so a metric-id that merely appears in a text
//  prop is NOT a false positive. This reuses the ONE bind-target discovery seam
//  (metricRefFields), so impact and bind can never disagree about "what is a ref".
//
import type { PropSchema } from '@statdash/react/engine'
import type { CanvasPage, CanvasNode } from '../../types/constructor'
import { metricRefFields } from '../../discovery/metricBinding'
import { getAtPath } from '../../inspector/showWhen'

/** The blast radius of a metric across the loaded pages. */
export interface MetricImpact {
  /** Total blocks whose measure field references the metric-id. */
  blocks: number
  /** Distinct pages containing at least one such block (id + title for the message). */
  pages:  { id: string; title: string }[]
}

/** True when `node`'s schema-declared measure field(s) reference `metricId`. Pure. */
function nodeRefsMetric(
  node:      CanvasNode,
  metricId:  string,
  getSchema: (node: CanvasNode) => PropSchema,
): boolean {
  const fields = metricRefFields(getSchema(node))
  if (fields.length === 0) return false
  return fields.some((f) => {
    const v = getAtPath(node.props, f.field)
    if (v === metricId) return true
    // A multi-measure field may carry an array of refs.
    return Array.isArray(v) && v.includes(metricId)
  })
}

/**
 * Compute the blast radius of `metricId` across `pages`. `getSchema` is injected (the
 * schema-resolution port) so this stays pure/testable and reuses the app's ONE schema
 * source at the call site. `locale` picks the page title for the surfaced message.
 */
export function computeMetricImpact(
  pages:     CanvasPage[],
  metricId:  string,
  getSchema: (node: CanvasNode) => PropSchema,
  locale:    'ka' | 'en' = 'ka',
): MetricImpact {
  if (!metricId) return { blocks: 0, pages: [] }
  let blocks = 0
  const pageHits: { id: string; title: string }[] = []

  for (const page of pages) {
    let pageBlocks = 0
    for (const node of Object.values(page.nodes)) {
      if (nodeRefsMetric(node, metricId, getSchema)) pageBlocks += 1
    }
    if (pageBlocks > 0) {
      blocks += pageBlocks
      pageHits.push({ id: page.id, title: page.title[locale] || page.title.ka || page.id })
    }
  }

  return { blocks, pages: pageHits }
}
