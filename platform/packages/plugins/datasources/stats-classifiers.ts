// ── stats-classifiers — the classifier-codelist ACL (one concern) ─────────────
//
//  Pure wire→engine mapping for GET /classifiers/:dim_code rows. Split out of
//  stats-api.ts (which owns the HTTP boundary + observation mapping) so each file
//  carries ONE concern (05/09 hygiene). stats-api.ts's fetchDimClassifiers does the
//  HTTP read and delegates the shape mapping HERE.
//
//  No fetch, no app coupling — a pure function over the wire row, testable in
//  isolation. The engine stays app-agnostic (Law 3); this is the single ACL seam
//  (Law 5) where the stats wire shape becomes an engine Classifier.
//

import type { AttrVal, Classifier, ClassifierEntry, LocaleString } from '@statdash/engine'

/**
 * Row of GET /classifiers/:dim_code — one codelist member.
 *
 * WIRE CONTRACT (GAP 5b): the live route SELECTs `label`, `parent_code` and
 * `metadata` straight from `stats.classifier`. The adapter normalizes them at THIS
 * single seam (Postel):
 *   • `label` is a LocaleString object `{ en, ka }` (V-i18n), no longer a flat
 *     string — stored as-is so i18n is preserved end-to-end (resolved at the React
 *     boundary). A legacy flat `string` still parses (LocaleString ⊇ string).
 *   • the hierarchy edge is `parent_code` (the stable business key, ADR-0023), NOT
 *     the dropped surrogate `parent_id` — maps DIRECTLY to the array-form `parent`.
 *   • `metadata` is an open bag of extra attrs ({ account, isClosing, … }) lifted
 *     to first-class entry attrs so `$cl` / `$d` joins can read them.
 */
export interface StatsClassifierRow {
  id:          number
  code:        string
  /** LocaleString `{ en, ka }` (or a legacy flat string). */
  label:       Record<string, string> | string | null
  color:       string | null
  /** Parent's business CODE (ADR-0023 code-chain edge); null = root. */
  parent_code: string | null
  ord:         number
  metadata:    unknown
}

/**
 * StatsClassifierRow[] → Classifier (array form). Code IS the key, matching the
 * codes observations carry.
 *
 * GAP 5b fixes at this single ACL seam:
 *   • `label` is carried INTACT as a LocaleString `{ en, ka }` (or flat string),
 *     not stringified to `[object Object]`. A null/empty label degrades to `code`.
 *   • `parent` maps DIRECTLY from `parent_code` (already a business code).
 *   • `metadata` fields are lifted to entry attrs (see liftClassifierMetadata).
 */
export function fromStatsClassifiers(rows: StatsClassifierRow[]): Classifier {
  return rows.map((r): ClassifierEntry => ({
    // metadata fields FIRST so the explicit columns below win on any key clash
    // (code/label/color/parent are authoritative over a same-named metadata key).
    ...liftClassifierMetadata(r.metadata),
    code:   r.code,
    label:  normalizeClassifierLabel(r.label, r.code),
    color:  r.color ?? undefined,
    parent: r.parent_code ?? undefined,
  }))
}

/**
 * Surface a classifier row's `metadata` bag as first-class entry attrs so a `$cl`
 * (structural join) / `$d` (display lookup) ref can read them. The accounts SNA
 * charts join `{ $cl:'aggregates' }` for `isClosing` — which lives in
 * `metadata:{ account, isClosing }` on the wire. The old ACL mapped only
 * code/label/color/parent and DROPPED metadata, so the join injected nothing and
 * the diverging chart lost its closing-balance markers (the `_isTotal` encoding).
 *
 * Generic (Law 1 — no privileged dim/field names): every scalar metadata key is
 * lifted verbatim; a nested object value is preserved (a LocaleString flows through
 * the entry's AttrVal bag and resolves at the React boundary). Absent/non-object
 * metadata ⇒ {} (byte-identical to the pre-fix entry for dims with no metadata).
 */
export function liftClassifierMetadata(metadata: unknown): Record<string, AttrVal> {
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) return {}
  const out: Record<string, AttrVal> = {}
  for (const [k, v] of Object.entries(metadata as Record<string, unknown>)) {
    if (v === undefined || v === null) continue
    // Scalars (string/number/boolean) and LocaleString objects are valid AttrVals;
    // anything else (nested array, function) is skipped — the bag stays renderable.
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v
    } else if (typeof v === 'object' && !Array.isArray(v)) {
      out[k] = v as AttrVal
    }
  }
  return out
}

/**
 * A wire `label` is either a LocaleString object `{ en, ka }`, a legacy flat
 * string, or null. Keep the object/string intact (i18n preserved); fall back to
 * the code only when there is genuinely nothing to show. An empty object (no
 * locales) also degrades to the code so a consumer never renders `{}`.
 */
export function normalizeClassifierLabel(
  label: Record<string, string> | string | null,
  code:  string,
): LocaleString {
  if (label === null) return code
  if (typeof label === 'string') return label === '' ? code : label
  return Object.keys(label).length > 0 ? label : code
}
