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
import { tagLocaleString } from '../i18n/types'

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

// ── Hierarchy reification — member depth / children FROM the parent edges ─────
//
//  The SDMX HierarchicalCodelist is the SSOT for a dimension's tree (Law 5); these
//  helpers REIFY it in CODE space so a governed DimensionHierarchy (data/dimension.ts)
//  never re-authors member relations. Both classifier forms are unified: array form
//  carries `parent` as a CODE, record form as a surrogate ID — both resolve to a code.

/** parent-edge graph in CODE space — parentByCode + childrenByCode (both forms). */
function codeGraph(c: Classifier): {
  parentByCode:   Map<string, DimVal>
  childrenByCode: Map<string, DimVal[]>
} {
  const codeById = new Map<string, DimVal>()
  for (const [id, e] of toIdEntries(c)) codeById.set(id, e.code)

  const parentByCode   = new Map<string, DimVal>()
  const childrenByCode = new Map<string, DimVal[]>()
  for (const [, e] of toIdEntries(c)) {
    if (e.parent === undefined) continue
    // `parent` is a surrogate id (record form) or a code (array form) — resolve to a code.
    const parentCode = codeById.get(String(e.parent)) ?? e.parent
    parentByCode.set(String(e.code), parentCode)
    const arr = childrenByCode.get(String(parentCode)) ?? []
    arr.push(e.code)
    childrenByCode.set(String(parentCode), arr)
  }
  return { parentByCode, childrenByCode }
}

/**
 * childrenOf — the direct children of a member (one drill step down), reified from
 * the classifier parent edges. Empty for a leaf / unknown code. The self-nested drill
 * narrowing: descend from a parent to its children.
 */
export function childrenOf(c: Classifier, code: DimVal): DimVal[] {
  return codeGraph(c).childrenByCode.get(String(code)) ?? []
}

/**
 * depthOf — a member's LEVEL = its distance from a root (parentless) ancestor
 * (root = 0), reified from the parent chain. A cycle guard caps traversal. This is
 * the tier a self-nested hierarchy level maps onto (level index = codelist depth).
 */
export function depthOf(c: Classifier, code: DimVal): number {
  const { parentByCode } = codeGraph(c)
  let depth = 0
  let cur   = String(code)
  const seen = new Set<string>()
  while (parentByCode.has(cur) && !seen.has(cur)) {
    seen.add(cur)
    cur = String(parentByCode.get(cur))
    depth++
  }
  return depth
}

/**
 * membersAtDepth — every member code at a given tree DEPTH (0 = roots), reified from
 * the parent edges. The reified coordinate SET a self-nested drill enumerates at a
 * level; a flat codelist (no parent edges) reports every code at depth 0.
 */
export function membersAtDepth(c: Classifier, depth: number): DimVal[] {
  const { parentByCode } = codeGraph(c)
  const depthOfCode = (code: DimVal): number => {
    let d = 0, cur = String(code)
    const seen = new Set<string>()
    while (parentByCode.has(cur) && !seen.has(cur)) { seen.add(cur); cur = String(parentByCode.get(cur)); d++ }
    return d
  }
  return toEntries(c).map((e) => e.code).filter((code) => depthOfCode(code) === depth)
}

// ── constrainClassifier — SDMX CubeRegion scoping of a codelist ─────────
//
//  A per-dataset store must expose only the members that belong to ITS cube
//  (SDMX ContentConstraint / CubeRegion semantics, ADR-0027) — a dim-code is a
//  SHARED vocabulary axis, so the global codelist for a dim may hold members
//  from several datasets' vocabularies. This constrains a classifier to a
//  member subset while preserving:
//    • the classifier FORM (array in → array out, record in → record out),
//    • the original member ORDER,
//    • hierarchy INTEGRITY — every ANCESTOR of a kept member is kept, so
//      parent edges never dangle and roll-up reads (childrenOf/depthOf) stay
//      coherent.
//  Generic over dim codes and both classifier forms (Law 1). Pure.

export function constrainClassifier(
  c:       Classifier,
  members: ReadonlySet<string>,
): Classifier {
  const { parentByCode } = codeGraph(c)

  // Transitive keep-set: the members plus every ancestor on their parent chains.
  const keep = new Set<string>()
  for (const code of members) {
    let cur: string | undefined = String(code)
    const seen = new Set<string>()
    while (cur !== undefined && !seen.has(cur)) {
      seen.add(cur)
      keep.add(cur)
      const parent = parentByCode.get(cur)
      cur = parent === undefined ? undefined : String(parent)
    }
  }

  if (Array.isArray(c)) return c.filter((e) => keep.has(String(e.code)))
  return Object.fromEntries(
    Object.entries(c).filter(([, e]) => keep.has(String(e.code))),
  )
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
  // boundary, never flattened here where no user locale is known). This is the
  // ORIGIN where a display LocaleString becomes a row-cell candidate, so it is
  // where we POSITIVELY TAG it (tagLocaleString): an object-valued attr is branded
  // as a genuine i18n carrier. resolveRowLocales (react boundary) then localizes
  // ONLY tagged cells — never structure-guessing a provenance object into a label.
  // A scalar attr passes through untouched (tagLocaleString is a no-op on strings).
  const buildEntry = (id: string, entry: ClassifierEntry): Record<string, AttrVal> => {
    const overlay = d[id]
    const out: Record<string, AttrVal> = { code: entry.code }
    if (overlay) {
      for (const [k, v] of Object.entries(overlay)) {
        if (v === undefined || k === 'code') continue
        out[k] = typeof v === 'object' && v !== null ? tagLocaleString(v) : v
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