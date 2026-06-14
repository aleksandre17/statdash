// ── Generic layout utilities ───────────────────────────────────────────
//
//  Parametric algorithms — operate on T via extractor functions.
//  No knowledge of SectionDef, panels, widgets, or any concrete type.
//
//  "Program to an interface, not an implementation." (GoF)
//  "Depend on abstractions, not concretions." (SOLID D)
//
//  Commercial platform equivalents:
//    Grafana   — gridPos row-packing works on any panel shape via w/h fields
//    Builder.io — column layout algorithm works on any block type
//    CSS Grid   — browser packs items by span regardless of content type
//

// ── TabsMap ────────────────────────────────────────────────────────────
//
//  Generic param-driven view selector: Record<string, T>.
//  Algorithm-agnostic — T can be SectionView, KpiDef, ChartDef, anything.
//
//  Commercial platform equivalents:
//    Grafana   — template variable → panel repeat (any panel shape)
//    Builder.io — tabs as array of typed content slots (any component)
//    Retool     — tab container with named slots (any widget tree)
//
//  Usage:
//    tabs: { param: 'mode', views: TabsMap<SectionView> }
//    active view → views[filterParams[param]]
//
export type TabsMap<T> = Record<string, T>

// ── groupBySpan ────────────────────────────────────────────────────────
//
//  Packs items into rows where spans (extracted by caller) sum to maxCols.
//  When a row would overflow, the current row is flushed and a new one starts.
//  A partial final row (items whose spans don't fill maxCols) is always flushed.
//
//  Caller supplies getSpan — engine never knows the concrete item type.
//  maxCols defaults to 12 (industry standard: Bootstrap, Grafana-like grids).
//
//  Usage:
//    groupBySpan(sections, (s) => SECTION_COLS[s.width ?? 'full'])
//    groupBySpan(panels,   (p) => p.gridPos.w, 24)   // Grafana 24-col grid
//    groupBySpan(widgets,  (w) => w.colSpan ?? 1,  3) // 3-col widget strip
//
export function groupBySpan<T>(
  items:   T[],
  getSpan: (item: T) => number,
  maxCols: number = 12,
): T[][] {
  const rows: T[][] = []
  let row:    T[]   = []
  let filled        = 0

  for (const item of items) {
    const w = getSpan(item)
    if (filled + w > maxCols) { rows.push(row); row = []; filled = 0 }
    row.push(item); filled += w
    if (filled >= maxCols)    { rows.push(row); row = []; filled = 0 }
  }
  if (row.length) rows.push(row)
  return rows
}