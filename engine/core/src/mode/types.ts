// ── Mode System — pure types (zero React, zero Geostat) ──────────────
//
//  Grafana time-range pattern: mode is first-class, not a filter variable.
//  ModeId is open (string) — new mode = one register() call, zero code change.
//  See architecture/19-mode-system.md for decisions.
//

/** Open string — new mode = registration, not a code change. Constructor-ready. */
export type ModeId = string

/**
 * ModeDef — one registered rendering mode.
 * dataKey: matches DataSpec.by-mode key. Defaults to id if not set.
 * icon:    agnostic string key — resolved by icon registry at render time, never hardcoded SVG.
 */
export interface ModeDef {
  id:       ModeId
  label:    string
  icon?:    string
  dataKey?: string
}

/**
 * ModeContext — injected into RenderContext.mode.
 * current:   the active mode id ('year' | 'range' | 'compare' | any registered)
 * available: resolved ModeDef[] for this page's declared modes
 * set:       writes to URL param (via FilterContext — same URL, no race)
 */
export interface ModeContext {
  current:   ModeId
  available: ModeDef[]
  set:       (id: ModeId) => void
}