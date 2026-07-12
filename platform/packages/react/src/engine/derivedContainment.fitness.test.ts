// @vitest-environment node
//
// ── derivedContainment.fitness.test.ts — ADR-041 · FF-DERIVED-CONTAINMENT ────────
//
//  THE FENCE (Phase 1.5, guard mode from here). ADR-041 ROOT-2 makes wrapper/leaf a
//  DERIVED predicate — WRAPPER ⇔ the contract declares ≥1 part field — so NO mechanism
//  may read the KIND (`sliceType`) or the FLAG (`canHaveChildren`) to answer a
//  containment question. This guard lands in GUARD MODE now (Phase 1.5), BEFORE the
//  Phase 4 anchor work / Phase 6 de-alias it fences: any NEW containment kind/flag
//  read reds the build from day one; the migration only TIGHTENS it to `[]` (Phase 6).
//
//  This ENGINE tooth owns the `canHaveChildren` FLAG (the containment flag) — the
//  reciprocal of FF-KIND-IS-FACET, which already fences the `sliceType` KIND to the
//  registry-view layer. Together they cover both kind AND flag. The SEMANTIC tooth
//  (no stored kind CONTRADICTS the declared part fields; kpi-strip reconciled) lives
//  plugins-side, over the real registered corpus:
//      packages/plugins/__tests__/derivedContainment.fitness.test.ts
//
//  Ratchet form (§0.5a): a shrinking allowlist + a meta-assertion + a BITES test.
//
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { partFieldsOf } from './slice-meta'
import type { NodeSliceMeta, PanelSliceMeta } from './slice-meta'
import type { PartField } from './partPort'

const here = dirname(fileURLToPath(import.meta.url))   // …/packages/react/src/engine
const read = (f: string): string => readFileSync(resolve(here, f), 'utf8')

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = resolve(dir, e.name)
    if (e.isDirectory()) return sourceFiles(full)
    if (e.name.includes('.test.') || e.name.includes('.fitness.')) return []
    if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) return [full]
    return []
  })
}

const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

// ── The detector: a `canHaveChildren` READ used as a containment MECHANISM ────────
//  A dot-access READ (`.canHaveChildren`) — NOT a declaration (`canHaveChildren:`) and
//  NOT the `'canHaveChildren' in m` string-key presence test. Exactly the shape a
//  containment decision takes (`getMeta(t)?.canHaveChildren === true`). Extracted as a
//  pure function so the BITES test can run it on planted source.
const CONTAINMENT_FLAG_READ = /\.canHaveChildren\b/

function containmentFlagReadFiles(): string[] {
  return sourceFiles(here)
    .filter((f) => CONTAINMENT_FLAG_READ.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => f.split(/[\\/]/).pop()!)
    .sort()
}

describe('FF-DERIVED-CONTAINMENT — ENGINE: the `canHaveChildren` flag is never a containment mechanism [§0.5a guard]', () => {
  // PERMITTED home: the registry-view INGESTION layer copies the declared facet into
  // storage (`registerSlice` → StoredMeta) — that is not a containment DECISION, it is
  // carrying a declaration. It stays permanently (Phase 6 keeps the facet as a compile-
  // time refinement; only the runtime containment BRANCH is removed). Everywhere else,
  // a `.canHaveChildren` read answers "does this contain?" — forbidden.
  const REGISTRY_VIEW_INGESTION = ['registerSlice.ts']   // permanent permitted home (carries the facet into storage)

  it('no engine module OUTSIDE the registry-view ingestion reads `canHaveChildren` (zero-tolerance)', () => {
    const offenders = containmentFlagReadFiles().filter((f) => !REGISTRY_VIEW_INGESTION.includes(f))
    expect(offenders).toEqual([])
  })

  it('the ONLY engine `canHaveChildren` read is the permitted registry-view ingestion (scan is non-vacuous)', () => {
    // Proves the guard is actually scanning live source (not silently matching nothing):
    // registerSlice ingests the facet, so the read-set is exactly the permitted home.
    expect(containmentFlagReadFiles()).toEqual([...REGISTRY_VIEW_INGESTION].sort())
  })

  it('BITES: a planted containment flag/kind read IS caught; a DECLARATION is not', () => {
    // The exact regression: a mechanism branching on the flag to decide containment.
    expect(CONTAINMENT_FLAG_READ.test(stripComments(
      "if (nodeRegistry.getMeta(t)?.canHaveChildren === true) accept(child)"))).toBe(true)
    // A DECLARATION (the meta author pinning the facet) must NOT trip it — it is data,
    // not a containment decision:
    expect(CONTAINMENT_FLAG_READ.test(stripComments("canHaveChildren: false"))).toBe(false)
    expect(CONTAINMENT_FLAG_READ.test(stripComments("canHaveChildren?: false"))).toBe(false)
  })
})

// ── Positive: wrapper/leaf is DERIVED — no kind/flag read needed ──────────────────
const slotMeta:  NodeSliceMeta  = { sliceType: 'node',  type: '__dc_slot__',  canHaveChildren: true,
  slots: { children: { field: 'children', label: 'c', multi: true } } }
const valueMeta: PanelSliceMeta = { sliceType: 'panel', type: '__dc_value__', category: 'data',
  schema: [{ field: 'items', type: 'array', label: 'i', itemSchema: [{ field: 'x', type: 'string', label: 'x' }] }] }
const leafMeta:  PanelSliceMeta = { sliceType: 'panel', type: '__dc_leaf__',  category: 'data',
  schema: [{ field: 'title', type: 'string', label: 't' }] }

// The derived predicate ROOT-2 mandates (formalized as the sole containment answer at
// Phase 6): reads ONLY the declared part fields — never a kind or a flag.
const isWrapper = (parts: PartField[]): boolean => parts.length > 0

describe('FF-DERIVED-CONTAINMENT — wrapper/leaf DERIVES from the declared parts, not the kind', () => {
  it('a slot-declaring META is a wrapper; a leaf declaring no parts is a leaf', () => {
    expect(isWrapper(partFieldsOf(slotMeta))).toBe(true)
    expect(isWrapper(partFieldsOf(leafMeta))).toBe(false)
  })

  it('a VALUE-declaring leaf-kind is a wrapper BY CONTRACT — the kind flag does not veto it', () => {
    // valueMeta is a `panel` (leaf kind, `canHaveChildren` absent/false) yet declares a
    // value part → wrapper-by-contract. The predicate never reads the kind, so the
    // "leaf kind" does not contradict the "has a part" contract (the kpi-strip case).
    expect(isWrapper(partFieldsOf(valueMeta))).toBe(true)
  })

  it('the predicate is a pure function of partFieldsOf — its source names no kind/flag', () => {
    const fn = read('slice-meta.ts').slice(read('slice-meta.ts').indexOf('export function partFieldsOf'))
    expect(fn).not.toMatch(/sliceType/)
    expect(fn).not.toMatch(/canHaveChildren/)
  })
})
