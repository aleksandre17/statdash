// ── metricDrag — the typed drag payload for binding a metric onto a block ─────
//
//  The Metric Palette's drag gesture uses NATIVE HTML5 drag-and-drop (the same
//  mechanism NodePalette uses for node-type inserts — `dataTransfer.setData`), not
//  @dnd-kit, so a metric tile drags onto a canvas node frame with no new DnD
//  context. We carry the metric-id under a NAMED custom format so the canvas drop
//  handler can (a) recognise a metric drag distinctly from a node-type drag during
//  `dragover` (via `dataTransfer.types`, where the payload value is unreadable for
//  security) and (b) recover the id on `drop`. A `text/plain` mirror is set for
//  interop, but the custom format is the contract.
//
//  Format names are lowercased by the DataTransfer API; we declare the constant
//  already-lowercase so `types.includes()` comparisons are exact.
//
/** The custom DataTransfer format carrying a governed metric-id (already lowercase). */
export const METRIC_DND_FORMAT = 'application/x-statdash-metric'

/** Write a metric-id onto a drag event's dataTransfer (copy effect). */
export function writeMetricDrag(dt: DataTransfer, metricId: string): void {
  dt.setData(METRIC_DND_FORMAT, metricId)
  dt.setData('text/plain', metricId) // interop mirror; the custom format is the contract
  dt.effectAllowed = 'copy'
}

/** True when a drag carries a metric payload — safe to call during `dragover`. */
export function hasMetricDrag(dt: DataTransfer): boolean {
  return Array.from(dt.types).includes(METRIC_DND_FORMAT)
}

/** Recover the metric-id from a drop's dataTransfer, or null when absent. */
export function readMetricDrag(dt: DataTransfer): string | null {
  return dt.getData(METRIC_DND_FORMAT) || null
}
