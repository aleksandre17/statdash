// ── Locale-aware collation [N22] ──────────────────────────────────────
//
//  Wraps Intl.Collator for locale-aware string comparison and sort.
//  Handles Georgian (ka), English (en), and any BCP 47 locale.
//
//  Usage:
//    sortLocale(['ბ', 'ა', 'გ'], v => v, 'ka')   → ['ა', 'ბ', 'გ']
//    createCollator('ka').compare('ბ', 'ა')        → 1
//

/**
 * Create an `Intl.Collator` for the given locale.
 * Sensitivity 'base' ignores case and diacritics (good for labels/codes).
 */
export function createCollator(
  locale:   string,
  options?: Intl.CollatorOptions,
): Intl.Collator {
  return new Intl.Collator(locale, { sensitivity: 'base', ...options })
}

/**
 * Sort an array in locale-aware order.
 * Does NOT mutate the original array.
 *
 * @param items   - array to sort
 * @param keyFn   - extract the string key to compare (identity for string[])
 * @param locale  - BCP 47 locale tag
 * @param options - Intl.CollatorOptions overrides
 */
export function sortLocale<T>(
  items:   readonly T[],
  keyFn:   (item: T) => string,
  locale:  string,
  options?: Intl.CollatorOptions,
): T[] {
  const coll = createCollator(locale, options)
  return [...items].sort((a, b) => coll.compare(keyFn(a), keyFn(b)))
}
