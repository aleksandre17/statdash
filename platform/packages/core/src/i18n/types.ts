// ── LocaleString — inline bilingual content (Sanity structured content pattern) ─
//
//  Backward compat: plain string ∈ LocaleString — existing configs untouched.
//  JSON.parse(JSON.stringify({ ka: 'მშპ', en: 'GDP' })) === same ✅
//  Constructor reads/writes directly — no code needed per locale.
//

export type LocaleString =
  | string                    // 'მშპ' — single-locale legacy (backward compat)
  | Record<string, string>    // { ka: 'მშპ', en: 'GDP' } — multi-locale

// ── LocaleString brand — POSITIVE identification at the i18n origin ───────────
//
//  An object-valued DataRow cell is structurally ambiguous: a LocaleString
//  `{ en, ka }`, a `ProvenanceRecord`, and a `seriesFormat` map are ALL plain
//  objects. The React boundary (resolveRowLocales) must localize ONLY genuine
//  LocaleStrings and never structure-guess — a denylist of "known non-locale
//  fields" is a Protected-Variations leak (a NEW object metadata key surfaced by
//  a future `$cl`/`$d` join would be silently locale-flattened).
//
//  So we TAG a LocaleString at the one place the engine PRODUCES one as a row-cell
//  candidate: the `$d` display-attr join (resolveDisplayRef → tagLocaleString).
//  The tag is a non-enumerable Symbol property — invisible to Object.keys, JSON,
//  spread-copy survives it, and a chart/table that String()s the cell never sees
//  it. resolveRowLocales then resolves ONLY tagged cells (isTaggedLocaleString),
//  leaving every other object cell — provenance included — structurally intact.
//
//  Branding is opt-in at the join, not at the wire: the engine stays locale-
//  agnostic (it tags an i18n carrier, it does not resolve it).
//
const LOCALE_BRAND: unique symbol = Symbol('statdash.LocaleString')

/**
 * tagLocaleString — brand an OBJECT-valued LocaleString as a genuine i18n carrier
 * (non-enumerable, non-mutating: returns a fresh branded shallow copy so the
 * shared wire object is never mutated). A plain `string` LocaleString needs no tag
 * (it is already a concrete scalar, never confused with provenance) and is returned
 * untouched. Idempotent: an already-tagged object is returned as-is.
 */
export function tagLocaleString(s: LocaleString): LocaleString {
  if (typeof s !== 'object' || s === null) return s
  if ((s as Record<symbol, unknown>)[LOCALE_BRAND] === true) return s
  const copy = { ...s }
  Object.defineProperty(copy, LOCALE_BRAND, { value: true, enumerable: false })
  return copy
}

/**
 * isTaggedLocaleString — true ONLY for an object branded by tagLocaleString. This
 * is the positive discriminant resolveRowLocales uses, replacing the structural
 * denylist. A plain object (provenance / seriesFormat / any future metadata) is
 * NEVER mistaken for a LocaleString.
 */
export function isTaggedLocaleString(v: unknown): v is Record<string, string> {
  return typeof v === 'object' && v !== null && (v as Record<symbol, unknown>)[LOCALE_BRAND] === true
}

// ── resolveLocaleString — LocaleString → concrete string ─────────────────────

export function resolveLocaleString(
  s:        LocaleString,
  locale:   string,
  fallback: string,
): string {
  if (typeof s === 'string') return s
  return s[locale] ?? s[fallback] ?? Object.values(s)[0] ?? ''
}

// ── localeKeysOf / composeLocale — locale-preserving STRING COMPOSITION ───────
//
//  A pipeline step that COMBINES cell values into a new string (template `{x}`,
//  concat) must NOT `String()` a tagged LocaleString — that bakes "[object Object]"
//  into the value BEFORE the React i18n boundary can resolve it (the engine has no
//  user locale here). Instead it composes the new value PER LOCALE and re-tags the
//  result, so a `{label} ({code})` over a bilingual `label` yields a bilingual
//  result `{ en:'GDP (B1)', ka:'მშპ (B1)' }` carried intact to resolveRowLocales.
//
//  This keeps the engine locale-AGNOSTIC (it never picks a locale) while staying
//  locale-CORRECT (no premature flatten). Mirrors tagLocaleString at the $d origin.

/** The union of concrete locale keys carried by any tagged-LocaleString operand. */
export function localeKeysOf(values: readonly unknown[]): string[] {
  const keys = new Set<string>()
  for (const v of values) {
    if (isTaggedLocaleString(v)) for (const k of Object.keys(v)) keys.add(k)
  }
  return [...keys]
}

/**
 * composeLocale — build a composed cell value, locale-aware.
 *
 *  `render(pick)` produces the composed STRING for one locale, where `pick(v)`
 *  resolves a single operand to that locale (a scalar passes through; a tagged
 *  LocaleString is read for that locale, falling back to its first value).
 *
 *  - No operand is a multi-locale LocaleString ⇒ returns a plain `string`
 *    (byte-identical to the old `String()` path — zero-allocation common case).
 *  - At least one operand is bilingual ⇒ returns a TAGGED LocaleString spanning
 *    every locale present, resolved at the React boundary like any `$d` label.
 */
export function composeLocale(
  operands: readonly unknown[],
  render:   (pick: (v: unknown) => string) => string,
): string | LocaleString {
  const locales = localeKeysOf(operands)
  const scalarPick = (v: unknown): string =>
    isTaggedLocaleString(v) ? (Object.values(v)[0] ?? '') : (v == null ? '' : String(v))

  if (locales.length === 0) return render(scalarPick)

  const out: Record<string, string> = {}
  for (const loc of locales) {
    out[loc] = render((v) =>
      isTaggedLocaleString(v) ? (v[loc] ?? Object.values(v)[0] ?? '') : scalarPick(v),
    )
  }
  return tagLocaleString(out)
}

// ── resolveLabel — code + classifier → locale-aware label ────────────────────

export function resolveLabel(
  code:       string,
  classifier: Record<string, LocaleString> | undefined,
  locale:     string,
  fallback:   string,
): string {
  const entry = classifier?.[code]
  if (!entry) return code
  return resolveLocaleString(entry, locale, fallback)
}