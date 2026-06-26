// ── Stats DISPLAY overlay — the UI/presentation channel (GAP 5) ──────────────
//
//  The display overlay is the SECOND channel resolveDisplayRef joins at every
//  consumer-facing `{ $d:'<dim>' }` ref (id → label/color/order). It is split
//  from the wire adapter (stats-api.ts) because it is a DISTINCT concern: the
//  adapter owns HTTP + wire→engine row mapping; this owns the projection of a
//  resolved classifier into its presentation overlay.
//
//  SSOT: built from the SAME `Classifier` the runner already fetched — no second
//  endpoint, no duplication. $cl (structural) vs $d (display) separation holds:
//  resolveDisplayRef reads label/color ONLY from this overlay, never off the
//  structural classifier entry.
//

import type { Classifier, ClassifierEntry, DisplayMap, AttrVal } from '@statdash/engine'

/**
 * buildDisplayOverlay — Classifier → DisplayMap (GAP 5).
 *
 * resolveDisplayRef joins each ref against a DisplayMap keyed by the classifier's
 * id. For the array-form classifier `fromStatsClassifiers` produces, the id IS
 * the `code`, so the overlay is code-keyed to match the join. Each entry carries
 * the UI channel:
 *   • `label` — LocaleString {en,ka} (or flat string) carried INTACT for real
 *     i18n; resolved to a concrete string at the React boundary, never flattened
 *     here (the builder runs once at boot, before any user locale exists).
 *   • `color` — series/category color.
 *   • `order` — insertion order = the route's `ORDER BY ord` = display order.
 *
 * Takes a `Classifier` (not raw rows) so it is the SINGLE projection of whatever
 * `fromStatsClassifiers` decided the canonical label/code is.
 */
export function buildDisplayOverlay(classifier: Classifier): DisplayMap {
  const entries: ClassifierEntry[] = Array.isArray(classifier)
    ? classifier
    : Object.values(classifier)

  const out: DisplayMap = {}
  entries.forEach((e, i) => {
    const attrs: Record<string, AttrVal | undefined> = {
      label: e.label,   // LocaleString {en,ka} | string — carried intact
      color: e.color,
      order: i,          // display order (route ORDER BY ord)
    }
    // Drop undefined attrs so resolveDisplayRef never emits an empty/undefined key.
    const clean: Record<string, AttrVal | undefined> = {}
    for (const [k, v] of Object.entries(attrs)) if (v !== undefined) clean[k] = v
    out[String(e.code)] = clean
  })
  return out
}
