// ── Perspective System — pure types (zero React, zero tenant) ─────────
//
//  A perspective is a named OLAP query-view of a page (VISION #3): the active
//  perspective scopes the page's data + visibility. The Grafana time-range
//  pattern, generalised — a perspective is first-class, not a filter variable.
//  PerspectiveId is open (string): a new perspective = one register() call,
//  zero code change (Constructor-ready, Law 8).
//

/** Open string — a new perspective = registration, not a code change. */
export type PerspectiveId = string

/**
 * PerspectiveOption — one registered/derived perspective's toggle presentation.
 * The shape the perspective-bar toggle's `available` list carries.
 * icon:  agnostic string key — resolved by an icon registry at render time,
 *        never hardcoded SVG.
 */
export interface PerspectiveOption {
  id:       PerspectiveId
  label:    string
  icon?:    string
  dataKey?: string
}

/**
 * PerspectiveContext — injected into RenderContext.perspective.
 * current:   the active perspective id ('year' | 'range' | any registered)
 * available: resolved PerspectiveOption[] for this page's axis (id + label + icon)
 * set:       writes the active id to the axis URL param (via FilterContext)
 */
export interface PerspectiveContext {
  current:   PerspectiveId
  available: PerspectiveOption[]
  set:       (id: PerspectiveId) => void
}
