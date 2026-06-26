// ── Codelist views over a Classifier — generic adapters ──────────────
//
//  A Classifier is id-keyed (Kimball surrogate keys + hierarchy edges).
//  Consumers often need:
//    - a code-keyed dict for JOIN-style lookups (Vega-Lite lookup transform)
//    - an array of entries for list rendering / filter selectors
//
//  These two helpers are the only view-shapes the codebase ever needs.
//  Dataset-agnostic; live in the engine so every dataset can consume.
//
//  Industry parity:
//    - SDMX Codelist.values  (array) / lookup by id
//    - Cube.dev dimensions   (flat schema; values resolved at query)
//    - LookML dimension      (schema + drill_values helper)
//

import type { AttrVal, Classifier, ClassifierEntry, ClassifierRef, ClassifierView, DimRef, DimVal, DisplayMap, DisplayRef } from '../sdmx'

// ── Normalizers — array ↔ record both accepted ────────────────────────

/** Flat array of entries regardless of classifier form. */
function toEntries(c: Classifier): ClassifierEntry[] {
  return Array.isArray(c) ? c : Object.values(c)
}

/** [id, entry] pairs — id is the surrogate key for records, code for arrays. */
function toIdEntries(c: Classifier): Array<[string, ClassifierEntry]> {
  return Array.isArray(c)
    ? c.map(e => [String(e.code), e])
    : Object.entries(c)
}

/**
 * codelistOf — code-keyed index over any classifier form.
 * [{ code: 'P1', … }] or { '1': { code: 'tbilisi', … } }  →  { code: entry }
 *
 * Use as the `from` argument of the `lookup` transform op.
 */
export function codelistOf(c: Classifier): Record<string, ClassifierEntry> {
  const out: Record<string, ClassifierEntry> = {}
  for (const entry of toEntries(c)) out[String(entry.code)] = entry
  return out
}

/**
 * Internal — ids that appear as `parent` on another entry (non-leaf nodes).
 * Works for both array (parent = code) and record (parent = surrogate id) forms.
 */
function nonLeafIds(c: Classifier): Set<string> {
  const out = new Set<string>()
  for (const entry of toEntries(c)) {
    if (entry.parent !== undefined) out.add(String(entry.parent))
  }
  return out
}

/**
 * itemsOf — flat array of classifier entries; rollups (non-leaves) first.
 * Use as a filter-derive `source` (find / breadcrumbs).
 * Consumers match by `idField: 'code'`.
 */
export function itemsOf(c: Classifier): ClassifierEntry[] {
  const nonLeaf = nonLeafIds(c)
  const pairs   = toIdEntries(c)
  const rollups: ClassifierEntry[] = []
  const leaves:  ClassifierEntry[] = []
  for (const [id, entry] of pairs) {
    if (nonLeaf.has(id)) rollups.push(entry)
    else                 leaves.push(entry)
  }
  return [...rollups, ...leaves]
}

/**
 * leavesOf — entries with NO children. True OLAP leaves (only these codes
 * appear in facts). Use for selectors that should show atomic codes only.
 */
export function leavesOf(c: Classifier): ClassifierEntry[] {
  const nonLeaf = nonLeafIds(c)
  return toIdEntries(c).filter(([id]) => !nonLeaf.has(id)).map(([, e]) => e)
}

/**
 * rollupsOf — entries with at least one child (virtual aggregates). Use for
 * selectors that should show totals / groupings only.
 */
export function rollupsOf(c: Classifier): ClassifierEntry[] {
  const nonLeaf = nonLeafIds(c)
  return toIdEntries(c).filter(([id]) => nonLeaf.has(id)).map(([, e]) => e)
}

// ── codesOf — sorted distinct codes (utility for derived ranges) ──────

/**
 * codesOf — all classifier codes in insertion order.
 * Use when a config needs the raw code list (e.g. year range for titles).
 */
export function codesOf(c: Classifier): DimVal[] {
  return toEntries(c).map(e => e.code)
}

// ── Reference resolution — $cl / $d refs → concrete views ─────────────

export function isClassifierRef(v: unknown): v is ClassifierRef {
  return typeof v === 'object' && v !== null && '$cl' in (v as object)
}

export function isDisplayRef(v: unknown): v is DisplayRef {
  return typeof v === 'object' && v !== null && '$d' in (v as object)
}

export function isDimRef(v: unknown): v is DimRef {
  return isClassifierRef(v) || isDisplayRef(v)
}

/**
 * resolveClassifierRef — STRUCTURAL ref. Returns classifier entries (no
 * display merge). Engine internals never call this — only consumer-facing
 * refs that genuinely need structural data (hierarchy traversal, code+parent
 * iteration). UI consumers should use `resolveDisplayRef`.
 *
 * Unknown dims resolve to empty-of-shape so configs don't crash.
 */
export function resolveClassifierRef(
  ref:          ClassifierRef,
  classifiers:  Record<string, Classifier> | undefined,
  defaultView:  ClassifierView,
): Record<string, ClassifierEntry> | ClassifierEntry[] {
  const c    = classifiers?.[ref.$cl]
  const view = ref.view ?? defaultView
  if (!c) return view === 'byCode' ? {} : []

  switch (view) {
    case 'byCode':  return codelistOf(c)
    case 'items':   return itemsOf(c)
    case 'leaves':  return leavesOf(c)
    case 'rollups': return rollupsOf(c)
  }
}

/**
 * Internal — [id, entry] pairs filtered by view. The id is the surrogate key
 * for records and the code for arrays — used to join DisplayMap at consumer refs.
 */
function viewEntries(c: Classifier, view: ClassifierView): Array<[string, ClassifierEntry]> {
  const nonLeaf = nonLeafIds(c)
  const all     = toIdEntries(c)
  if (view === 'leaves')  return all.filter(([id]) => !nonLeaf.has(id))
  if (view === 'rollups') return all.filter(([id]) =>  nonLeaf.has(id))
  if (view === 'items')   return [...all.filter(([id]) => nonLeaf.has(id)), ...all.filter(([id]) => !nonLeaf.has(id))]
  return all  // 'byCode' — order doesn't matter
}

/**
 * resolveDisplayRef — UI ref. Display map is id-keyed (uniform with classifier);
 * resolver joins each scoped classifier entry (id → entry.code) with its display
 * overlay (display[id]) and emits with the classifier `code` injected.
 *
 * Output:
 *   view: 'byCode' → Record<code, { code, …displayAttrs }>   (for `lookup.from`)
 *   view: 'items' | 'leaves' | 'rollups' → Array<{ code, …displayAttrs }>
 *
 * Without a classifier registered for the dim, the resolver falls back to
 * iterating display map keys as opaque ids (rare case, mostly i18n stubs).
 */
export function resolveDisplayRef(
  ref:          DisplayRef,
  classifiers:  Record<string, Classifier> | undefined,
  display:      Record<string, DisplayMap> | undefined,
  defaultView:  ClassifierView,
): Record<string, Record<string, AttrVal>> | Record<string, AttrVal>[] {
  const c    = classifiers?.[ref.$d]
  const d    = display?.[ref.$d] ?? {}
  const view = ref.view ?? defaultView

  type Pair = [string, ClassifierEntry]
  const pairs: Pair[] = c
    ? viewEntries(c, view)
    : Object.keys(d).map((id) => [id, { code: id }] as Pair)   // fallback

  // Attr values may be a scalar DimVal OR a LocaleString {en,ka} (i18n labels
  // carried intact from the wire — resolved to a concrete string at the React
  // boundary, never flattened here where no user locale is known).
  const buildEntry = (id: string, entry: ClassifierEntry): Record<string, AttrVal> => {
    const overlay = d[id]
    const out: Record<string, AttrVal> = { code: entry.code }
    if (overlay) {
      for (const [k, v] of Object.entries(overlay)) {
        if (v !== undefined && k !== 'code') out[k] = v
      }
    }
    return out
  }

  if (view === 'byCode') {
    const out: Record<string, Record<string, AttrVal>> = {}
    for (const [id, entry] of pairs) out[String(entry.code)] = buildEntry(id, entry)
    return out
  }
  return pairs.map(([id, entry]) => buildEntry(id, entry))
}

/** Dispatch helper — picks the right resolver for a `$cl` or `$d` ref. */
export function resolveDimRef(
  ref:          DimRef,
  classifiers:  Record<string, Classifier> | undefined,
  display:      Record<string, DisplayMap> | undefined,
  defaultView:  ClassifierView,
): Record<string, ClassifierEntry> | ClassifierEntry[] | Record<string, Record<string, AttrVal>> | Record<string, AttrVal>[] {
  if (isClassifierRef(ref)) return resolveClassifierRef(ref, classifiers, defaultView)
  return resolveDisplayRef(ref, classifiers, display, defaultView)
}