// ── partAnchor — the ONE generic authoring anchor for ALL parts (ADR-041 · Phase 4) ─
//
//  ADR-041 Phase 4: the anchor merge. Value/sourced band items AND slot children (and
//  the canvas node-anchor middleware) now share ONE anchor CONTRACT and ONE queryable
//  `data-part-*` attribute family — the generalization of BE-1's `BandItemBoundary`.
//
//  The Bounded Element Law: an element that DECLARES parts (a value/sourced band, or a
//  slot of child nodes) exposes each part as a SELECTABLE element. For the WYSIWYG
//  canvas to frame each part, every rendered part needs a queryable, layout-INERT DOM
//  anchor (`display:contents`, so the wrapper contributes no box and runtime layout is
//  byte-identical). This is the SAME technique the canvas node-anchor middleware uses
//  for whole nodes — Phase 4 unifies them into ONE `data-part-*` family the overlay
//  measures through a single query path.
//
//  ONE `<PartAnchor>`, two residence forms of the same wrapper:
//    • value / sourced band item → keyed by its `(field, index)` coordinate
//      (`data-part-field` / `data-part-index`) — the form every band-owning shell
//      (KpiStripShell, FilterBarShell) stamps around each rendered item.
//    • slot child / whole node   → keyed by the child's `nodeId`
//      (`data-part-node-id` / `data-part-node-type`) — the SAME attributes the canvas
//      node-anchor middleware stamps, so a slot part and a node anchor are ONE family.
//
//  It is GENERIC (names NO concrete element type), so every part-owning shell uses the
//  identical primitive and the canvas selection / overlay / inspector machinery stays a
//  pure projection over the declaration — no per-type branch anywhere
//  (FF-NO-EXTERNAL-SPECIAL-CASE · FF-DERIVED-CONTAINMENT).
//
//  INERT OFF THE CANVAS: absent an authoring context (the live site, and every unit /
//  render test) it emits a Fragment — ZERO wrapper DOM — so the runtime output stays
//  byte-identical. ONLY the authoring canvas (CanvasView) provides
//  `AuthoringAnchorContext`, turning the anchor on.
//
import { createContext, useContext, createElement, Fragment, type ReactNode } from 'react'

/**
 * True only inside an authoring canvas. CanvasView provides `true`; everywhere
 * else the default `false` keeps `PartAnchor` a zero-DOM passthrough.
 */
export const AuthoringAnchorContext = createContext<boolean>(false)

// ── The ONE `data-part-*` attribute family (SSOT for producer + overlay reader) ─────
//  Value/sourced band item coordinate:
export const PART_FIELD_ATTR   = 'data-part-field'
export const PART_INDEX_ATTR   = 'data-part-index'
//  Slot child / whole node coordinate (the merged node-anchor family):
export const PART_NODE_ID_ATTR   = 'data-part-node-id'
export const PART_NODE_TYPE_ATTR = 'data-part-node-type'

// ── Interim chrome anchor (SPEC S4) — canvas-selectable chrome regions ──────────────
//  Chrome (header / sidebar / footer) is not yet a page-node part (that is S6 —
//  chrome-as-part of the `site-frame`, riding ADR-041 Ph.6). Until then, the authoring
//  canvas still needs to SELECT chrome on the canvas (owner P3), so `ChromeSlot` stamps
//  a layout-inert `display:contents` anchor carrying its (slot, key) — the coordinate
//  the EXISTING chrome-selection arm (`selectChrome`/`ChromeInspectorPanel`) reads. This
//  is a SEPARATE, clearly-interim family (NOT the `data-part-*` family) that folds into
//  the one part anchor when chrome becomes a declared part at S6. Off the canvas
//  (`AuthoringAnchorContext` false) `ChromeSlot` stamps nothing — byte-identical runtime.
export const CHROME_SLOT_ATTR = 'data-canvas-chrome-slot'
export const CHROME_KEY_ATTR  = 'data-canvas-chrome-key'

// ── Back-compat aliases (BE-1 names) — byte-identical to the value/sourced attrs ────
//  Every consumer reads the attribute through these constants (never a literal), so
//  the Phase-4 rename is a value swap behind the same names — the shell one-line swap
//  `BandItemBoundary → PartAnchor` stays byte-identical.
export const BAND_ITEM_FIELD_ATTR = PART_FIELD_ATTR
export const BAND_ITEM_INDEX_ATTR = PART_INDEX_ATTR

export interface PartAnchorProps {
  /** value/sourced residence: the declaring band field on the owning node (e.g. `'items'`). */
  field?:    string
  /** value/sourced residence: the item's index within `node[field]` — the store path segment. */
  index?:    number
  /** slot / whole-node residence: the child's own node id (the merged node-anchor coordinate). */
  nodeId?:   string
  /** slot / whole-node residence: the child's node type (companion to `nodeId`). */
  nodeType?: string
  children:  ReactNode
}

/**
 * Wrap ONE declared part so the authoring canvas can position a selection frame over
 * it. Layout-inert (`display:contents`) when active; a bare Fragment (no DOM) when not
 * — invisible to the runtime and every render test. The residence form is chosen by
 * which coordinate is supplied: a `nodeId` stamps the slot/node family, otherwise the
 * `(field, index)` band-item family.
 */
export function PartAnchor({ field, index, nodeId, nodeType, children }: PartAnchorProps): ReactNode {
  const authoring = useContext(AuthoringAnchorContext)
  if (!authoring) return createElement(Fragment, null, children)
  const attrs: Record<string, string> =
    nodeId != null
      ? { [PART_NODE_ID_ATTR]: nodeId, ...(nodeType != null ? { [PART_NODE_TYPE_ATTR]: nodeType } : {}) }
      : { [PART_FIELD_ATTR]: field ?? '', [PART_INDEX_ATTR]: String(index ?? 0) }
  return createElement('div', { ...attrs, style: { display: 'contents' } }, children)
}

// ── BandItemBoundary — the BE-1 name, KEPT as a byte-identical alias of PartAnchor ──
//  So a band-owning shell can migrate its import at its own pace; the emitted wrapper
//  is identical. New shells use `<PartAnchor field index>`.
export const BandItemBoundary = PartAnchor
export type BandItemBoundaryProps = PartAnchorProps
