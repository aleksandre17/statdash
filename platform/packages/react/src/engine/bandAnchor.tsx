// ── bandAnchor — the generic authoring anchor for value-band items (ADR-038) ────
//
//  The Bounded Element Law: an element that DECLARES a value-band (a `schema`
//  array field carrying `itemSchema`) exposes each item as a SELECTABLE child
//  element. For the WYSIWYG canvas to frame each item, every rendered item needs a
//  queryable, layout-INERT DOM anchor — the SAME technique the canvas node-anchor
//  middleware uses for nodes (`display:contents`, so the wrapper contributes no box
//  and runtime layout is byte-identical).
//
//  This is the ONE render-side contract a band-owning shell opts into — the
//  Builder.io `<Blocks>` / Craft.js `<Element>` pattern: wrap each declared-band
//  item in `<BandItemBoundary field index>`. It is GENERIC (names NO concrete
//  element type), so every band-owning shell uses the identical primitive and the
//  canvas selection / inspector machinery stays a pure projection over the
//  declaration — no per-type branch anywhere (FF-NO-EXTERNAL-SPECIAL-CASE).
//
//  INERT OFF THE CANVAS: absent an authoring context (the live site, and every unit
//  / FF-PROMOTION-LOSSLESS render) it emits a Fragment — ZERO wrapper DOM — so the
//  runtime output stays byte-identical. ONLY the authoring canvas (CanvasView)
//  provides `AuthoringAnchorContext`, turning the anchor on.
//
import { createContext, useContext, createElement, Fragment, type ReactNode } from 'react'

/**
 * True only inside an authoring canvas. CanvasView provides `true`; everywhere
 * else the default `false` keeps `BandItemBoundary` a zero-DOM passthrough.
 */
export const AuthoringAnchorContext = createContext<boolean>(false)

/** DOM attribute names the canvas overlay queries — ONE SSOT for producer+reader. */
export const BAND_ITEM_FIELD_ATTR = 'data-canvas-item-field'
export const BAND_ITEM_INDEX_ATTR = 'data-canvas-item-index'

export interface BandItemBoundaryProps {
  /** The declaring band field on the owning node (e.g. `'items'`). */
  field:    string
  /** The item's index within `node[field]` — the store path segment. */
  index:    number
  children: ReactNode
}

/**
 * Wrap ONE declared-band item so the authoring canvas can position a selection
 * frame over it. Layout-inert (`display:contents`) when active; a bare Fragment
 * (no DOM) when not — so it is invisible to the runtime and every render test.
 */
export function BandItemBoundary({ field, index, children }: BandItemBoundaryProps): ReactNode {
  const authoring = useContext(AuthoringAnchorContext)
  if (!authoring) return createElement(Fragment, null, children)
  return createElement(
    'div',
    {
      [BAND_ITEM_FIELD_ATTR]: field,
      [BAND_ITEM_INDEX_ATTR]: String(index),
      style: { display: 'contents' },
    },
    children,
  )
}
