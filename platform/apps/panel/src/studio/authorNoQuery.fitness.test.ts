// ── FF-AUTHOR-NO-QUERY — the query cliff is off the author's path (AR-49 M2.1) ────
//
//  The vision's promise, now enforced (SPEC-authoring-reconception-M2 §9, §12): no
//  DataSpec / query / pivot / transform / cube editor — nor the DataModelingPanel
//  that hosts them — is reachable from ANY author-lens surface. The raw modeler has
//  relocated behind the Steward role (Model mode / ModelSurface); the author's Data
//  surface is the governed Metric Palette only. This guard goes RED if any author
//  surface re-grows a reference to the modeling machinery (a relocation regression).
//
//  The single Steward-only surface (ModelSurface) is the legitimate home of the
//  modeler and is excluded — its exclusion is anchored to the single `stewardOnly`
//  rail entry (asserted below), so the guard cannot silently exempt an author surface.
//
import { describe, it, expect } from 'vitest'
import { RAIL_ENTRIES } from './rail'

// All Studio surface sources as raw text (Vite ?raw) — browser-graph typed, no fs dep.
const SURFACE_SOURCES = import.meta.glob(['./surfaces/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// The AUTHOR-lens surfaces: every surface except the single Steward-only one
// (ModelSurface — the modeler's legitimate new home) and test files.
const AUTHOR_SURFACES = Object.entries(SURFACE_SOURCES).filter(
  ([path]) =>
    !path.includes('/ModelSurface.') &&
    !path.includes('.test.') &&
    !path.includes('.fitness.'),
)

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

// The raw-modeling machinery an author lens must never reach: the modeling body, the
// DataSpec editor suite, and the data-layer barrel that exports them.
const QUERY_MACHINERY =
  /\bDataModelingPanel\b|\bDataSpecEditor\b|\bQuerySpecEditor\b|\bPivotEditor\b|\bTransformEditor\b|\bGrowthEditor\b|features\/data-layer/

describe('FF-AUTHOR-NO-QUERY — no query/pivot editor reachable from an author surface', () => {
  it('scans the author-lens surfaces (guard is actually running)', () => {
    expect(AUTHOR_SURFACES.length).toBeGreaterThanOrEqual(4)
  })

  it('exactly one Steward-only surface hosts the modeler — the exclusion is anchored', () => {
    const gated = RAIL_ENTRIES.filter((e) => e.stewardOnly)
    expect(gated).toHaveLength(1)
    expect(gated[0].id).toBe('model')
    // The exclusion above (ModelSurface) IS that single steward surface.
    expect(SURFACE_SOURCES['./surfaces/ModelSurface.tsx']).toBeDefined()
  })

  it('no author-lens surface references the raw modeling machinery (comments stripped first)', () => {
    const offenders = AUTHOR_SURFACES.filter(([, src]) =>
      QUERY_MACHINERY.test(stripComments(src)),
    ).map(([path]) => path)
    expect(offenders).toEqual([])
  })

  it('the guard actually bites — a planted modeler import IS detected in code (not comments)', () => {
    expect(QUERY_MACHINERY.test(stripComments("import { DataModelingPanel } from '../../features/data-layer'"))).toBe(true)
    // …and a mere PROSE mention in a comment does NOT trip it (DataSurface documents
    // the relocation in its header — the strip must let that pass).
    expect(QUERY_MACHINERY.test(stripComments('// the DataModelingPanel relocated to Model mode'))).toBe(false)
  })
})
