// ── perspectiveModel — pure record⇄list adapters for the Perspectives pane [P-final] ──
//
//  The page stores its perspective axes in the engine's canonical RECORD form
//  (PerspectivesByParam = Record<urlParam, PerspectiveAxis>); each axis is an
//  ORDERED PerspectiveDef[]. The author edits the axes through a dockable pane
//  (Power BI bookmark-pane IA) that must list, REORDER, add, and remove both the
//  axes (by param) and each axis's perspectives. These pure adapters bridge the
//  STORED record ⇄ the ordered editor view — the SAME lossless map⇄node move the
//  Filters surface uses (filterSchemaModel), so an unedited page round-trips
//  BYTE-IDENTICAL (the record⇄view⇄record cycle is the identity on untouched axes).
//
//  Why a list view at the surface: a Record has no order and no self-contained
//  member identity, but the editor surfaces ordered axes (the URL param is the
//  Record key) whose perspectives are an ordered array (perspectives[0] = default,
//  the array order = nav-sort + permalink-elision SSOT). The view carries `param`
//  explicitly (the former Record key) so it is portable and orderable; rebuilding
//  the Record in the view's order preserves the author's axis order. The
//  perspectives array is carried through as-is (it is already ordered).
//
//  Kept pure (no React, no store) so it is trivially testable (the add/edit/
//  reorder + round-trip fitness, mirroring filterSchemaModel.test).
//
import type { PerspectiveAxis, PerspectiveDef, PerspectivesByParam } from '@statdash/engine'

/** One axis projected to the editor view: its URL param key + its ordered perspectives. */
export interface PerspectiveAxisView {
  /** The axis's URL param (its stable identity in the Record — the former map key). */
  param:        string
  /** The ordered perspectives (perspectives[0] is the default). */
  perspectives: PerspectiveDef[]
}

/** Project a PerspectivesByParam Record to the ordered editor view (insertion order). */
export function toAxisViews(by: PerspectivesByParam | undefined): PerspectiveAxisView[] {
  if (!by) return []
  return Object.entries(by).map(([param, axis]) => ({
    param,
    perspectives: axis.perspectives ?? [],
  }))
}

/** Rebuild a single axis's PerspectiveAxis from an ordered PerspectiveDef[] (order preserved). */
export function toAxis(perspectives: PerspectiveDef[]): PerspectiveAxis {
  return { perspectives }
}

/**
 * Write an edited axis's perspectives back into a PerspectivesByParam, preserving
 * every OTHER axis verbatim and the axis's own order — additive, lossless. Used by
 * the pane to commit an add/edit/reorder/remove on one axis without touching the
 * rest of the Record.
 */
export function setAxisPerspectives(
  by:           PerspectivesByParam | undefined,
  param:        string,
  perspectives: PerspectiveDef[],
): PerspectivesByParam {
  const base = by ?? {}
  return { ...base, [param]: toAxis(perspectives) }
}

/**
 * Move the perspective at `from` to `to` in a fresh array (bounds-safe; no-op if
 * out of range). The pane's drag/▲▼ reorder — perspectives[0] is the default, so
 * reordering also changes which perspective is the default (one SSOT, LOW-1).
 */
export function movePerspective(arr: PerspectiveDef[], from: number, to: number): PerspectiveDef[] {
  if (to < 0 || to >= arr.length) return arr
  const next = [...arr]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
