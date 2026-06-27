// ── perspectiveFactory — seed a fresh PerspectiveDef / axis [P-final] ──────────
//
//  Adding a perspective needs a minimal, VALID seed — the PerspectiveDef analogue
//  of makeParamNode (ParamDefs) / makeVisibilityExpr (conditions) / makeNode
//  (canvas nodes). The seed carries only the required scaffolding (a unique `id` +
//  an empty bilingual `label`); the author fills the rest (icon / scope / when)
//  through the pane. Kept pure + data-only (Law 2: the seed is JSON-serializable,
//  Constructor-ready — no functions in the produced value).
//
//  The default URL param for a page's first axis is the engine SSOT PERSPECTIVE_PARAM
//  ('perspective') — pick-don't-invent. A second axis (D-MULTIAXIS) is a new param
//  key the author names; this factory seeds the common single-axis case.
//
import { PERSPECTIVE_PARAM } from '@statdash/engine'
import type { PerspectiveDef } from '@statdash/engine'
import type { Locale } from '../../types/constructor'

/** A short, collision-resistant perspective id (matches the param/node-id convention). */
function newPerspectiveId(): string {
  return `view-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Seed a fresh PerspectiveDef with a unique `id` and a COMPLETE bilingual label
 * (every active locale present — the LocaleField completeness invariant). `when` is
 * OMITTED on purpose: the default gate is the identity `perspective-is(id)`, applied
 * by the engine; authoring it explicitly is the escape-only path (FF-WHEN-IS-ESCAPE-ONLY).
 * No `scope` until the author binds one (a perspective that changes nothing carries none).
 */
export function makePerspectiveDef(locales: Locale[], id = newPerspectiveId()): PerspectiveDef {
  const label: Record<string, string> = {}
  for (const loc of locales) label[loc] = ''
  return { id, label }
}

/** The default URL param for a page's first perspective axis (the engine SSOT). */
export const DEFAULT_PERSPECTIVE_PARAM = PERSPECTIVE_PARAM
