// ── resolveTemplate — generic context template resolver ───────────────
//
//  Resolves a template string against SectionContext dims. Used by many
//  shells (badges, captions, labels) — generic platform vocabulary.
//

import type { SectionContext } from '../core/context'
import { activePerspective }   from './perspective-state'

// ── resolveTemplate ───────────────────────────────────────────────────
//
//  Resolve a template string against SectionContext.
//  '{time} · მლნ ₾' + ctx.dims.time=2024 → '2024 · მლნ ₾'
//
//  Still accepts { year, range } union for PageDef.badge compatibility — the
//  branch is chosen by the ACTIVE PERSPECTIVE id (ctx.perspectiveState, the SSOT),
//  not the retired privileged `ctx.timeMode` field (System A, VISION #3 / P6).
//  Caller should resolve LocaleString via useResolveLocale() before passing
//  here (string branch passes through unchanged).
//
//  XSS safety: returns a plain string — never HTML.  Callers render it as
//  React text content (JSX auto-escapes) or as a DOM attribute value.
//  No `dangerouslySetInnerHTML` path exists in the engine.  If a future
//  caller renders this as HTML it MUST call encodeHTML() first.
//
export function resolveTemplate(
  tpl:    string | { year: string; range: string },
  ctx:    SectionContext,
  extras?: Record<string, unknown>,
): string {
  const str = typeof tpl === 'string'
    ? tpl
    : (activePerspective(ctx.perspectiveState) === 'year' ? tpl.year : tpl.range)
  return str.replace(/\{(\w+)\}/g, (_, key) => {
    if (extras && key in extras) return String(extras[key] ?? `{${key}}`)
    return String(ctx.dims[key] ?? `{${key}}`)
  })
}
