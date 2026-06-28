// ── resolveTemplate — generic context template resolver ───────────────
//
//  Resolves a template string against SectionContext dims. Used by many
//  shells (badges, captions, labels) — generic platform vocabulary.
//

import type { SectionContext } from '../core/context'
import type { LocaleString }   from '../i18n/types'
import { resolveLocaleString } from '../i18n/types'
import { activePerspective }   from './perspective-state'

// ── resolveTemplate ───────────────────────────────────────────────────
//
//  Resolve a template against SectionContext, in TWO declarative steps:
//    1. carrier → string   — collapse the i18n / perspective carrier to a single
//                            concrete string for the active locale / perspective.
//    2. string  → string   — expand `{key}` against ctx.dims (+ extras).
//  '{time} · მლნ ₾' + ctx.dims.time=2024 → '2024 · მლნ ₾'
//
//  The carrier (step 1) is one of:
//    • plain `string`                — passes through unchanged.
//    • `{ year, range }` union       — PageDef.badge compatibility; the branch is
//      chosen by the ACTIVE PERSPECTIVE id (ctx.perspectiveState, the SSOT), not the
//      retired privileged `ctx.timeMode` field (System A, VISION #3 / P6). `year`/
//      `range` are ENGINE vocabulary (not locales) — this is the union discriminant.
//    • `LocaleString` `{ ka, en }`   — resolved to `ctx.locale` (generic, Law 1 — no
//      hardcoded locale literal; first-value fallback when the active locale is
//      absent). This is the localize-at-boundary discipline: resolveTemplate is the
//      ONE primitive every display template funnels through (section title/subtitle,
//      page-header badge, KPI label/unit/trendSub, geograph label …), so resolving the
//      i18n carrier HERE makes a raw bilingual bag reaching a React child impossible by
//      construction. Resolution is a PASS-THROUGH for an already-resolved string, so a
//      caller that pre-resolved (e.g. resolveLabel) is unaffected (idempotent).
//
//  XSS safety: returns a plain string — never HTML.  Callers render it as
//  React text content (JSX auto-escapes) or as a DOM attribute value.
//  No `dangerouslySetInnerHTML` path exists in the engine.  If a future
//  caller renders this as HTML it MUST call encodeHTML() first.
//
export function resolveTemplate(
  tpl:    LocaleString | { year: string; range: string },
  ctx:    SectionContext,
  extras?: Record<string, unknown>,
): string {
  const locale = ctx.locale ?? ''
  const str = resolveCarrier(tpl, ctx, locale)
  return str.replace(/\{(\w+)\}/g, (_, key) => {
    const raw = extras && key in extras ? extras[key] : ctx.dims[key]
    if (raw === undefined || raw === null) return `{${key}}`
    // A substituted var value may ITSELF be a LocaleString (a bilingual repeat var,
    // e.g. `account_label` injected by RepeatShell) — resolve it to the active locale,
    // never String()-flatten it to "[object Object]". A plain object that isn't a
    // LocaleString falls through resolveLocaleString's first-value path (no worse than
    // the old String()); scalars stringify byte-identically.
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      return resolveLocaleString(raw as LocaleString, locale, locale)
    }
    return String(raw)
  })
}

// ── resolveCarrier — collapse the i18n / perspective carrier to one string ─────
//
//  string → itself; `{year,range}` perspective union → active branch; any other
//  object → LocaleString resolved to the active locale. The union test uses the
//  ENGINE keys (year/range), never locale literals, so a LocaleString (locale-keyed)
//  is never mistaken for a perspective bag and vice-versa.
function resolveCarrier(
  tpl:    LocaleString | { year: string; range: string },
  ctx:    SectionContext,
  locale: string,
): string {
  if (typeof tpl === 'string') return tpl
  if ('year' in tpl && 'range' in tpl) {
    return activePerspective(ctx.perspectiveState) === 'year' ? tpl.year : tpl.range
  }
  return resolveLocaleString(tpl, locale, locale)
}
