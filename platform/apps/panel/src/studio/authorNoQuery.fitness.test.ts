// ── FF-AUTHOR-NO-QUERY — the query cliff is off the author's path (AR-49 M2.1) ────
//
//  The vision's promise, now enforced (SPEC-authoring-reconception-M2 §9, §12): no
//  DataSpec / query / pivot / transform / cube editor — nor the DataModelingPanel
//  that hosts them — is reachable from ANY author-lens surface. The raw modeler has
//  relocated behind the Steward role (Model mode / ModelSurface); the author's Data
//  surface is the governed Metric Palette only. This guard goes RED if any author
//  surface re-grows a reference to the modeling machinery (a relocation regression).
//
//  The single Steward-scope surface (ModelSurface) is the legitimate home of the
//  modeler and is excluded — its exclusion is anchored (below) to it being the SOLE
//  surface that references the machinery: every OTHER surface, INCLUDING the author's
//  read-only Data Dictionary (AR-50 M5b), is machinery-free. So the guard cannot
//  silently exempt an author surface. The Data-model destination is reachable in any
//  lens (AR-50 M5b), but ModelSurface is mounted ONLY behind the steward branch of the
//  content split (DataModelBody, focusViewRegistry) — proven by roleIsLens + the
//  FF-MODEL-IS-FOCUSVIEW "ModelSurface imported only via the registry" guard.
//
import { describe, it, expect } from 'vitest'

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

  it('ModelSurface is the SOLE surface that references the modeler — the exclusion is anchored', () => {
    // The exclusion of ModelSurface from the author scan is legitimate ONLY because it
    // is the SINGLE surface that touches the machinery. Assert exactly that: among ALL
    // surfaces, the only one whose (comment-stripped) source references the query
    // machinery is ModelSurface. So every OTHER surface — including the new read-only
    // Data Dictionary (the author's data-model view) — is provably machinery-free, and
    // the guard cannot silently exempt an author surface by a stale path filter.
    const hosting = Object.entries(SURFACE_SOURCES)
      .filter(([path]) => !path.includes('.test.') && !path.includes('.fitness.'))
      .filter(([, src]) => QUERY_MACHINERY.test(stripComments(src)))
      .map(([path]) => path)
    expect(hosting).toEqual(['./surfaces/ModelSurface.tsx'])
    // And the author's read-only data-model view exists and is one of the scanned
    // (machinery-free) author surfaces.
    expect(SURFACE_SOURCES['./surfaces/DataDictionarySurface.tsx']).toBeDefined()
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
