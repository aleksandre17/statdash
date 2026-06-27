// ── filterSchemaModel — pure flat⇄node adapters for the Filters surface [V0] ───
//
//  The page stores its filters in the engine's canonical MAP form:
//    FilterSchemaInput { bars: { barId: { …, filters: { key: ParamDef } } } }
//  The author edits each control as a self-contained ParamNode ({ type, key, … })
//  through the generic Inspector (ParamDefEditor). These pure adapters bridge the
//  two — flat MAP ⇄ ordered ParamNode[] — at the editor boundary ONLY, so the
//  STORED shape never changes: an unedited page round-trips BYTE-IDENTICAL (the
//  map ⇄ node ⇄ map cycle is the identity on untouched controls).
//
//  Why a node[] view at the surface: a map has no order and no self-contained
//  member identity, but the editor must list, REORDER, add, and remove controls.
//  ParamNode carries `key` explicitly (the former map key), so it is portable and
//  orderable. Insertion order of the rebuilt map preserves the author's order.
//
//  Kept pure (no React, no store) so it is trivially testable (the add/edit/
//  reorder + round-trip fitness).
//
import type { FilterSchemaInput, BarDef, ParamDef, ParamNode } from '@statdash/engine'

/** One bar with its controls projected to an ordered ParamNode[] (editor view). */
export interface BarView {
  /** The bar's map key (its stable identity in the schema). */
  id:     string
  bar:    BarDef
  params: ParamNode[]
}

/** A ParamDef (map value) + its map key → a self-contained ParamNode. */
export function toParamNode(key: string, def: ParamDef): ParamNode {
  return { ...def, key } as ParamNode
}

/** A ParamNode → its map key + the ParamDef map value (drops `key`). */
export function fromParamNode(node: ParamNode): { key: string; def: ParamDef } {
  const { key, ...def } = node
  return { key, def: def as ParamDef }
}

/** Project a bar's `filters` map to an ordered ParamNode[] (insertion order). */
export function barParams(bar: BarDef): ParamNode[] {
  return Object.entries(bar.filters).map(([key, def]) => toParamNode(key, def))
}

/** Rebuild a bar's `filters` map from an ordered ParamNode[] (order preserved). */
export function paramsToFilters(params: ParamNode[]): Record<string, ParamDef> {
  const out: Record<string, ParamDef> = {}
  for (const node of params) {
    const { key, def } = fromParamNode(node)
    out[key] = def
  }
  return out
}

/** Project a whole FilterSchemaInput to the ordered editor view (bars + nodes). */
export function toBarViews(schema: FilterSchemaInput | undefined): BarView[] {
  if (!schema?.bars) return []
  return Object.entries(schema.bars).map(([id, bar]) => ({ id, bar, params: barParams(bar) }))
}

/**
 * Write an edited bar's controls back into a FilterSchemaInput, preserving every
 * OTHER bar, the bar's own non-filter config, and all advanced top-level keys
 * (crossValidate / context / computed) verbatim — additive, lossless.
 */
export function setBarParams(
  schema: FilterSchemaInput | undefined,
  barId:  string,
  params: ParamNode[],
): FilterSchemaInput {
  const base: FilterSchemaInput = schema ?? { bars: {} }
  const bar = base.bars[barId]
  if (!bar) return base
  return {
    ...base,
    bars: {
      ...base.bars,
      [barId]: { ...bar, filters: paramsToFilters(params) },
    },
  }
}
