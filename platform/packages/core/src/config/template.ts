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
//    • `PerspectiveCarrier`          — a `Record<perspectiveId, string>` collapsed to
//      the ACTIVE perspective's arm (activePerspective(ctx.perspectiveState), the SSOT).
//      GENERIC over N perspectives: the active id is looked up as a KEY — no `'year'`
//      literal, no two-arm count (the orthogonal-axis law, DESIGN R3 / FF-NO-MODE-LITERAL;
//      it retired the old `{year,range}` fused-mode `=== 'year'` branch). Distinguished
//      from an i18n LocaleString by whether the active perspective id is a key of the
//      carrier (a `{ ka, en }` bag has no perspective-id key ⇒ it falls through to locale
//      resolution). Perspective ids are ENGINE vocabulary, not locales.
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

/**
 * A perspective-keyed display carrier: `Record<perspectiveId, string>` collapsed to
 * the ACTIVE perspective's arm. Generic over N perspectives (no mode literal, no arm
 * count). Structurally a subset of the multi-locale `LocaleString`; disambiguated at
 * resolve time by whether the active perspective id is a key (a genuine i18n bag has
 * none). NOTE: a perspective id must not collide with a locale code (year/range vs
 * ka/en — they never do); a collision would resolve the carrier arm, which for a
 * matching locale is the same string anyway.
 */
export type PerspectiveCarrier = Record<string, string>

export function resolveTemplate(
  tpl:    LocaleString | PerspectiveCarrier,
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
//  string → itself; a perspective-keyed carrier → the ACTIVE perspective's arm; any
//  other object → LocaleString resolved to the active locale. The perspective branch is
//  taken ONLY when the active perspective id is a KEY of the carrier — generic over N
//  perspectives, NO `'year'`/`'range'` literal and no arm count (FF-NO-MODE-LITERAL). A
//  locale-keyed LocaleString (ka/en) carries no perspective-id key, so it is never
//  mistaken for a perspective carrier and vice-versa.
function resolveCarrier(
  tpl:    LocaleString | PerspectiveCarrier,
  ctx:    SectionContext,
  locale: string,
): string {
  if (typeof tpl === 'string') return tpl
  const activeId = activePerspective(ctx.perspectiveState)
  if (activeId !== undefined && Object.prototype.hasOwnProperty.call(tpl, activeId)) {
    return String((tpl as PerspectiveCarrier)[activeId])
  }
  return resolveLocaleString(tpl, locale, locale)
}
