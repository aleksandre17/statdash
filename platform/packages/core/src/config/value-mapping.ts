// ── value-mapping.ts — declarative value → {text, token, icon} (Grafana) [EXP-06] ─
//
//  A reusable, SERIALIZABLE rule list that maps a cell/KPI value to a presentation:
//  display TEXT, a semantic-TOKEN colour, and an ICON. Grafana's value mappings,
//  but raised: Grafana binds a LITERAL colour per rule; ours binds a semantic-token
//  KEY (DATA_COLOR_TOKENS) — so a mapping re-themes per tenant for free and can never
//  smuggle a hardcoded hex into config (Law: no hardcoded values; the authoring field
//  is an `enum-ref` over the token palette — pick, don't type).
//
//  WHY core (the arrow): this is pure config + a pure resolver — no React, no styles,
//  no colour resolution (the `token` is a KEY; the react/charts consumer resolves it
//  through the token spine via cssVar, keeping Law 3). Mirrors `$cl`/`$d` (codelist.ts)
//  generalised from code→label to value→{text,token,icon}.
//
//  OCP — the match kinds are a discriminated union dispatched by a Strategy map; a new
//  match kind is a new case + a new matcher, the resolver interface unchanged.
//
import type { LocaleString } from '../i18n/types'

// ── ValueMappingMatch — the discriminated match condition ─────────────────────
//
//  'exact' — value equals (string-compared, so '0'/0/'GE' all work)
//  'range' — numeric value within [from, to] (either bound optional/open)
//  'regex' — string value matches the pattern
//  'empty' — value is null / undefined / '' (Grafana "Special: Null")
//
export type ValueMappingMatch =
  | { kind: 'exact'; value: string | number }
  | { kind: 'range'; from?: number; to?: number }
  | { kind: 'regex'; pattern: string }
  | { kind: 'empty' }

/** One mapping rule: a condition + the presentation to apply when it matches. */
export interface ValueMapping {
  match:  ValueMappingMatch
  /** Display text shown in place of (or alongside) the raw value. Localized. */
  text?:  LocaleString
  /**
   * Semantic-token KEY from the registered palette (DATA_COLOR_TOKENS), e.g.
   * 'status.positive-fg'. NEVER a literal colour — the consumer resolves it through
   * the token spine, so the colour is tenant-overridable and contrast-governed.
   */
  token?: string
  /** Icon key (icon-picker). */
  icon?:  string
}

/** The resolved presentation produced by the first matching rule. */
export interface ValueMappingResult {
  text?:  LocaleString
  token?: string
  icon?:  string
}

// ── Strategy: per-kind matcher (OCP open point) ───────────────────────────────

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function matches(match: ValueMappingMatch, value: unknown): boolean {
  switch (match.kind) {
    case 'empty':
      return value === null || value === undefined || value === ''
    case 'exact':
      // String-compare so numeric/string codes unify ('0' === 0, 'GE' === 'GE').
      return String(value) === String(match.value)
    case 'range': {
      const n = toNumber(value)
      if (n === null) return false
      if (match.from !== undefined && n < match.from) return false
      if (match.to   !== undefined && n > match.to)   return false
      return true
    }
    case 'regex': {
      if (typeof value !== 'string' && typeof value !== 'number') return false
      try { return new RegExp(match.pattern).test(String(value)) }
      catch { return false }   // an invalid pattern matches nothing (fail-soft)
    }
    default: {
      // Exhaustiveness guard — a new kind without a matcher fails compilation here.
      const _never: never = match
      return _never as unknown as boolean
    }
  }
}

/**
 * applyValueMap — resolve a value to its presentation via the FIRST matching rule
 * (Grafana first-match-wins). Returns null when no rule matches (the consumer then
 * falls back to the raw formatted value). Pure + deterministic — no I/O, no locale,
 * no colour resolution (the `token` is carried through as a key).
 */
export function applyValueMap(
  value:    unknown,
  mappings: readonly ValueMapping[] | undefined,
): ValueMappingResult | null {
  if (!mappings || mappings.length === 0) return null
  for (const m of mappings) {
    if (matches(m.match, value)) return { text: m.text, token: m.token, icon: m.icon }
  }
  return null
}

// The authoring PropSchema (VALUE_MAPPING_SCHEMA) is intentionally NOT here: it is
// bilingual Constructor-editor metadata whose sole consumer is the panel Inspector,
// so it lives co-located with its FieldControl in apps/panel
// (inspector/controls/value-mapping/valueMappingSchema.ts) — the runtime contract
// (type + resolver) stays here in the engine; the authoring face lives in the
// authoring app. core carries no locale strings (Law 4).
