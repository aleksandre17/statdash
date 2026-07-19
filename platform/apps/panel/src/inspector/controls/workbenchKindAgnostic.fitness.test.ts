// ── FF-WORKBENCH-KIND-AGNOSTIC — no bind-kind is denied the workbench (ADR-049 P2a) ──
//
//  ADR-049 P2a Lane 1 raises the substrate floor: the DataWorkbench door must be
//  reachable for EVERY bind-kind, not just query/pipeline/unbound. The composer's
//  open-gate (`canWorkbench`) must hold NO per-kind `spec.type === '…'` literal — a
//  row-list / timeseries / growth / ratio-list element reaches the same surface a
//  pipeline does (the buried capability is un-gated).
//
//  TWO oracles:
//    (1) SOURCE guard — the `canWorkbench` gate in DataFacetField carries no per-kind
//        `spec.type ===` literal (the anti-pattern this lane ends). Scanned via Vite's
//        import.meta.glob(?raw) (the browser module graph, no fs/__dirname —
//        [[vitest-workspace-dirname]]), comments stripped first ([[css-fitness-comment-
//        stripping-gotcha]] — the same discipline for .tsx block/line comments).
//    (2) ROUND-TRIP — opening the workbench ADOPTS, never DISCARDS: a bound spec of ANY
//        kind is preserved (adoptOnOpen returns null → no write), only a truly unbound
//        element is seeded fresh. This is the binding-preservation invariant the DoD names.
//
import { describe, it, expect } from 'vitest'
import type { DataSpec } from '@statdash/engine'
import { adoptOnOpen, freshPipelineSpec } from './dataFacetModel'

// The GENERIC data-facet control — the one authoring surface whose open-gate the law
// governs. Only this file is scanned (the workbench internals legitimately branch on the
// canonical `pipeline` shape via toWorkbenchModel — that is the SPINE, not an open-gate).
const FACET_SOURCES = import.meta.glob(
  ['./DataFacetField.tsx'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

// A per-kind open-gate literal: `spec.type === 'query'` / `spec.type === 'pipeline'` (or
// their `!==` inverse) reaching into a kind's identity to decide workbench reachability.
// After the un-gate the door is `!!escalation` alone — zero such literal remains.
const PER_KIND_GATE = /spec\.type\s*[=!]==\s*['"](?:query|pipeline)['"]/

const ALLOWLIST: string[] = []   // ratchet BASELINE struck to [] (was ['DataFacetField.tsx'])
const BASELINE = 0

const offenders = (re: RegExp): string[] =>
  Object.entries(FACET_SOURCES)
    .filter(([, src]) => re.test(stripComments(src)))
    .map(([path]) => path.split('/').pop()!)
    .filter((name) => !ALLOWLIST.includes(name))
    .sort()

// Representative specs across the bind-kind space (the exact kinds the old gate denied).
const rowList:   DataSpec = { type: 'row-list', rows: [] } as DataSpec
const timeseries: DataSpec = { type: 'timeseries', measure: 'm.gdp' } as unknown as DataSpec
const pipeline:  DataSpec = { type: 'pipeline', pipe: [{ op: 'source', metrics: ['m.gdp'] }], encoding: { label: 'label' } } as DataSpec
const query:     DataSpec = { type: 'query', query: { measure: 'm.gdp' }, encoding: { label: 'label' } } as DataSpec

describe('FF-WORKBENCH-KIND-AGNOSTIC — the workbench open-gate holds no per-kind wire (ADR-049 P2a)', () => {
  it('scans a real facet source (guard is running, not vacuous)', () => {
    expect(Object.keys(FACET_SOURCES).length).toBeGreaterThanOrEqual(1)
    expect(Object.values(FACET_SOURCES)[0]!.length).toBeGreaterThan(200)
  })

  it('the DataFacet open-gate holds NO per-kind `spec.type ===` literal (comments stripped)', () => {
    expect(offenders(PER_KIND_GATE)).toEqual([])
  })

  it('META: the ratchet allowlist is emptied and can only stay empty', () => {
    expect(ALLOWLIST.length).toBeLessThanOrEqual(BASELINE)
  })

  it('ROUND-TRIP: a bound spec of ANY kind is ADOPTED intact (no fresh-pipeline wipe)', () => {
    // A bound row-list / timeseries / query / pipeline all preserve their binding: the
    // open decision writes NOTHING (null), so the spec reaches the workbench verbatim.
    for (const spec of [rowList, timeseries, pipeline, query]) {
      expect(adoptOnOpen(spec)).toBeNull()
    }
  })

  it('ROUND-TRIP: only a truly UNBOUND element is seeded a fresh browse-first pipeline', () => {
    expect(adoptOnOpen(undefined)).toEqual(freshPipelineSpec())
  })

  it('BITES: a planted per-kind gate literal IS detected (not vacuous)', () => {
    expect(PER_KIND_GATE.test("const canWorkbench = !!escalation && spec.type === 'query'")).toBe(true)
    expect(PER_KIND_GATE.test("spec.type !== 'pipeline'")).toBe(true)
    // …and a mere comment mention does NOT trip it (prose allowed after stripping).
    expect(PER_KIND_GATE.test("spec.type === 'query'")).toBe(true)                       // raw code trips
    expect(PER_KIND_GATE.test(stripComments("// the door once gated on spec.type === 'query'"))).toBe(false)  // stripped comment does not
  })
})
