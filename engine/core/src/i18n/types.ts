// ── LocaleString — inline bilingual content (Sanity structured content pattern) ─
//
//  Backward compat: plain string ∈ LocaleString — existing configs untouched.
//  JSON.parse(JSON.stringify({ ka: 'მშპ', en: 'GDP' })) === same ✅
//  Constructor reads/writes directly — no code needed per locale.
//

export type LocaleString =
  | string                    // 'მშპ' — single-locale legacy (backward compat)
  | Record<string, string>    // { ka: 'მშპ', en: 'GDP' } — multi-locale

// ── resolveLocaleString — LocaleString → concrete string ─────────────────────

export function resolveLocaleString(
  s:        LocaleString,
  locale:   string,
  fallback: string,
): string {
  if (typeof s === 'string') return s
  return s[locale] ?? s[fallback] ?? Object.values(s)[0] ?? ''
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