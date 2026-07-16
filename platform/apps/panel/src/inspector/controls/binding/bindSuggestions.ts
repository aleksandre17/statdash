// ── bindSuggestions — the PURE vocabulary + ranking for the expr autocomplete ──
//
//  The schema-aware brain behind the Retool-class binding editor (mission #4). A
//  bound prop's expr is a FORMULA STRING (parseFormula), so the author writes bare
//  identifiers that lower to `$ctx`/`$derived` reads + infix operators. This module
//  turns "what can I reference here?" into a ranked, GOVERNED suggestion list —
//  and stays PURE (vocabulary in → suggestions out, no store / network / React), so
//  the governance invariant is trivially fitness-tested (FF-BIND-AUTOCOMPLETE-GOVERNED).
//
//  THREE families, all sourced from the ENGINE'S OWN catalogs (never a second one):
//    • governed nouns  — describeApp().metrics / .dimensions (bilingual label, Law 1)
//    • in-scope refs   — the active page's filter params (dims) + vars (derived)
//    • operators       — the formula grammar's infix ops, LABELLED from OPS_CATALOG
//
//  Law 2 (declarative): a picked suggestion inserts a serializable REF token (a bare
//  identifier / operator symbol) — never a function, never a raw indicator code. The
//  author picks a GOVERNED noun; the token that lands is the one the resolver already
//  reads (byte-identical to hand-authoring it).
//
import { OPS_CATALOG } from '@statdash/expr'
import type { MetricDef } from '@statdash/engine'
import { readCatalogLabel, type CatalogDimension } from '../../../discovery/semanticCatalogOptions'
import type { Locale } from '../../../types/constructor'

// ── The suggestion shape ───────────────────────────────────────────────────────

export type BindSuggestionKind = 'metric' | 'dimension' | 'param' | 'var' | 'op'

export interface BindSuggestion {
  kind:   BindSuggestionKind
  /** The token inserted at the caret — a bare identifier (ref) or an operator symbol. */
  insert: string
  /** Primary display label — the governed bilingual noun / operator name. */
  label:  string
  /** Secondary detail chip — the kind badge, a unit hint, or the operator symbol. */
  detail: string
  /** Extra match tokens (e.g. an operator's catalog op-key `eq`) — never displayed. */
  keywords?: string
}

// ── Kind badges (bilingual) — the human word for each family ────────────────────

const KIND_LABEL: Record<BindSuggestionKind, { ka: string; en: string }> = {
  metric:    { ka: 'მეტრიკა',      en: 'metric'    },
  dimension: { ka: 'განზომილება', en: 'dimension' },
  param:     { ka: 'ფილტრი',       en: 'filter'    },
  var:       { ka: 'ცვლადი',       en: 'variable'  },
  op:        { ka: 'ოპერატორი',    en: 'operator'  },
}

function kindLabel(kind: BindSuggestionKind, locale: Locale): string {
  return KIND_LABEL[kind][locale] ?? KIND_LABEL[kind].en
}

// ── Family builders (pure) ──────────────────────────────────────────────────────

/**
 * The GOVERNED nouns — metrics + dimensions from `describeApp()`, the semantic layer.
 * A metric inserts its GOVERNED id (never its underlying code — the same id
 * resolveMeasureRef lowers, Law 2). A dimension inserts its `code` (the scope.dims
 * key a `$ctx` read resolves against). The author always SEES the governed bilingual
 * label, never a raw SDMX code (Law 1: generic over every noun, none privileged).
 */
export function governedSuggestions(
  metrics:    Record<string, MetricDef>,
  dimensions: Record<string, CatalogDimension>,
  locale:     Locale,
): BindSuggestion[] {
  const out: BindSuggestion[] = []
  for (const [, def] of Object.entries(dimensions).sort(([a], [b]) => a.localeCompare(b))) {
    out.push({
      kind:   'dimension',
      insert: def.code,
      label:  readCatalogLabel(def.label, locale, def.code),
      detail: kindLabel('dimension', locale),
    })
  }
  for (const [id, def] of Object.entries(metrics).sort(([a], [b]) => a.localeCompare(b))) {
    const unit = def.unit ? readCatalogLabel(def.unit, locale, '') : ''
    out.push({
      kind:   'metric',
      insert: id,
      label:  readCatalogLabel(def.label, locale, id),
      detail: unit ? `${kindLabel('metric', locale)} · ${unit}` : kindLabel('metric', locale),
    })
  }
  return out
}

/**
 * The IN-SCOPE refs — the active page's filter params (→ `scope.dims`) and vars
 * (→ `scope.derived`). These are guaranteed-resolvable bare identifiers: the exact
 * keys the render seam reads. `label` shows any authored bilingual label alongside
 * the key so the author recognises the noun, but `insert` is always the raw key
 * (the resolvable identifier).
 */
export function scopeRefSuggestions(
  params: Array<{ key: string; label?: string }>,
  vars:   string[],
  locale: Locale,
): BindSuggestion[] {
  const out: BindSuggestion[] = []
  for (const p of params) {
    out.push({
      kind:   'param',
      insert: p.key,
      label:  p.label ? `${p.key} · ${p.label}` : p.key,
      detail: kindLabel('param', locale),
    })
  }
  for (const v of vars) {
    out.push({ kind: 'var', insert: v, label: v, detail: kindLabel('var', locale) })
  }
  return out
}

// ── Operators — the formula grammar's infix set, LABELLED from OPS_CATALOG ───────
//
//  The formula surface (parseFormula) is an INFIX grammar, not named function calls —
//  so the insertable "ops" are operator SYMBOLS, not the JSON op names. Each symbol
//  maps to its OPS_CATALOG entry purely for the human label/keyword (the SSOT for op
//  semantics), so there is NO second op catalog — only a projection of the grammar's
//  operator set onto the existing descriptors.
//
const FORMULA_OPERATORS: Array<{ symbol: string; opKey: string }> = [
  { symbol: '==', opKey: 'eq'  },
  { symbol: '!=', opKey: 'ne'  },
  { symbol: '>',  opKey: 'gt'  },
  { symbol: '<',  opKey: 'lt'  },
  { symbol: '>=', opKey: 'gte' },
  { symbol: '<=', opKey: 'lte' },
  { symbol: '&&', opKey: 'and' },
  { symbol: '||', opKey: 'or'  },
  { symbol: '!',  opKey: 'not' },
  { symbol: '+',  opKey: 'add' },
  { symbol: '-',  opKey: 'sub' },
  { symbol: '*',  opKey: 'mul' },
  { symbol: '/',  opKey: 'div' },
]

export function operatorSuggestions(locale: Locale): BindSuggestion[] {
  return FORMULA_OPERATORS.map(({ symbol, opKey }) => {
    const desc = OPS_CATALOG[opKey]
    const name = desc ? (desc.label[locale] ?? desc.label.en) : opKey
    return {
      kind:     'op' as const,
      insert:   symbol,
      label:    `${symbol}  ${name}`,
      detail:   kindLabel('op', locale),
      keywords: opKey,
    }
  })
}

// ── Caret / token helpers ────────────────────────────────────────────────────────

/**
 * The identifier token immediately BEFORE the caret (what the author is typing).
 * Matches the formula tokenizer's identifier rule `[A-Za-z_]\w*`. An empty token
 * (caret after an operator / space / start) means "show the discovery list".
 */
export function tokenAtCaret(input: string, caret: number): { token: string; start: number } {
  const before = input.slice(0, Math.max(0, caret))
  const m = before.match(/[A-Za-z_]\w*$/)
  return m ? { token: m[0], start: caret - m[0].length } : { token: '', start: caret }
}

/**
 * Replace the token-before-caret with `insert`, returning the next string + caret.
 * Pure — the combobox applies the result to the controlled value + selection.
 */
export function applySuggestion(
  input:  string,
  caret:  number,
  insert: string,
): { next: string; caret: number } {
  const { start } = tokenAtCaret(input, caret)
  const next = input.slice(0, start) + insert + input.slice(caret)
  return { next, caret: start + insert.length }
}

// ── Ranking ──────────────────────────────────────────────────────────────────────

/**
 * Rank `vocabulary` against the token the author is typing. Empty token ⇒ the
 * discovery list (vocabulary order preserved — refs first, ops last). Otherwise a
 * case-insensitive prefix/substring match over insert · label · keywords, best
 * matches first (prefix > substring), with vocabulary order stable within a tier.
 */
export function rankSuggestions(
  vocabulary: BindSuggestion[],
  token:      string,
  limit = 40,
): BindSuggestion[] {
  const t = token.trim().toLowerCase()
  if (!t) return vocabulary.slice(0, limit)
  const scored: Array<{ s: BindSuggestion; score: number }> = []
  for (const s of vocabulary) {
    const ins = s.insert.toLowerCase()
    const lab = s.label.toLowerCase()
    const kw  = (s.keywords ?? '').toLowerCase()
    let score = -1
    if (ins.startsWith(t) || kw.startsWith(t)) score = 0
    else if (lab.startsWith(t))                score = 1
    else if (ins.includes(t) || kw.includes(t)) score = 2
    else if (lab.includes(t))                  score = 3
    if (score >= 0) scored.push({ s, score })
  }
  scored.sort((a, b) => a.score - b.score) // stable — vocabulary order kept within a tier
  return scored.slice(0, limit).map((x) => x.s)
}

// ── Unknown-ref detection (friendly validation) ─────────────────────────────────

// Reserved formula keywords that are NOT references (must not be flagged unknown).
const RESERVED = new Set(['true', 'false', 'null'])

/**
 * The bare identifiers referenced by a formula string (via the formula tokenizer's
 * identifier rule), excluding reserved keywords. Pure — used to flag identifiers the
 * author typed that are NOT in the known vocabulary (a gentle pre-save warning).
 */
export function referencedIdentifiers(input: string): string[] {
  const ids = input.match(/[A-Za-z_]\w*/g) ?? []
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (RESERVED.has(id.toLowerCase()) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/**
 * Identifiers referenced by `input` that are NOT in `known` — the soft "unknown
 * reference" set surfaced before save. Non-blocking (Postel's Law: the author may
 * reference a param not yet created — the honest live-preview covers resolution).
 */
export function unknownRefs(input: string, known: ReadonlySet<string>): string[] {
  return referencedIdentifiers(input).filter((id) => !known.has(id))
}
