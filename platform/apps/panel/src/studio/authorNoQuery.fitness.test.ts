// ── FF-AUTHOR-NO-QUERY — the governance LENS (author=pipe-over-governed) (D-DA1) ──
//
//  SPEC-deep-authorability-completion, Gap 3. This gate USED to be a WALL: no DataSpec /
//  query / transform / pivot editor was reachable from ANY author surface — the whole
//  modeler lived behind the Steward role. Deep-authorability slice 2 refines it into a
//  LENS (owner decision D-DA1): an AUTHOR may author a transform / derive / calc / query
//  PIPELINE over an ALREADY-GOVERNED source — the DataSpec pipe editor, un-buried into
//  the DATA facet (element.facet.data) that projects on any `data-bindable` element.
//  What stays STEWARD-gated is defining a RAW BASE SOURCE — a brand-new dataset from
//  scratch (SourceAuthoringPanel / Excel upload, hosted by DataModelingPanel). That is
//  the boundary that keeps published numbers trustworthy (Law 9), and it is what this
//  gate now guards — NOT the pipe editors (which are now author-safe).
//
//  So the invariant is TWO-sided:
//    • WALL — the RAW-SOURCE machinery (DataModelingPanel / SourceAuthoringPanel /
//      ExcelUpload / source create·delete) is reachable ONLY from the Steward's
//      ModelSurface, never from an author-lens surface (a relocation regression goes RED).
//    • LENS OPEN — the DATA facet control (DataFacetField, the author's in-place pipe)
//      DOES reach the pipe editor (DataSpecEditor) and does NOT reach the raw-source
//      machinery: author = pipe-over-governed, steward = raw-source, provably.
//
import { describe, it, expect } from 'vitest'

// All Studio surface sources as raw text (Vite ?raw) — browser-graph typed, no fs dep.
const SURFACE_SOURCES = import.meta.glob(['./surfaces/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// The DATA facet control source — the author's in-place pipe surface. Read to prove the
// lens is OPEN (reaches the pipe editor) yet still governed (no raw-source machinery).
const CONTROL_SOURCES = import.meta.glob(['../inspector/controls/DataFacetField.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>
const dataFacetSrc = Object.values(CONTROL_SOURCES)[0] ?? ''

// The AUTHOR-lens surfaces: every surface except the single Steward-only one
// (ModelSurface — the raw modeler's legitimate home) and test files.
const AUTHOR_SURFACES = Object.entries(SURFACE_SOURCES).filter(
  ([path]) =>
    !path.includes('/ModelSurface.') &&
    !path.includes('.test.') &&
    !path.includes('.fitness.'),
)

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

// The RAW-SOURCE machinery — defining a NEW dataset from scratch. This is the wall that
// stays Steward-only. Deliberately EXCLUDES the DataSpec pipe editors (DataSpecEditor /
// QuerySpecEditor / TransformEditor …) — those are pipe-over-governed and now author-safe
// (the lens). `DataModelingPanel` is the source browser that HOSTS raw-source creation.
const RAW_SOURCE_MACHINERY =
  /\bDataModelingPanel\b|\bSourceAuthoringPanel\b|\bExcelUpload\b|\bcreateDataSource\b|\bdeleteDataSource\b/

// The pipe editor — the author-safe surface the lens OPENS (mounted in the DATA facet).
const PIPE_EDITOR = /\bDataSpecEditor\b/

describe('FF-AUTHOR-NO-QUERY — the governance lens (author=pipe-over-governed, steward=raw-source)', () => {
  it('scans the author-lens surfaces (guard is actually running)', () => {
    expect(AUTHOR_SURFACES.length).toBeGreaterThanOrEqual(4)
  })

  it('ModelSurface is the SOLE surface that references the RAW-SOURCE machinery — the wall', () => {
    // The raw-source machinery (new-dataset definition) is reachable ONLY from the
    // Steward's ModelSurface. Every OTHER surface — including the author's read-only Data
    // Dictionary — is provably raw-source-free, so the guard can't silently exempt an
    // author surface by a stale path filter.
    const hosting = Object.entries(SURFACE_SOURCES)
      .filter(([path]) => !path.includes('.test.') && !path.includes('.fitness.'))
      .filter(([, src]) => RAW_SOURCE_MACHINERY.test(stripComments(src)))
      .map(([path]) => path)
    expect(hosting).toEqual(['./surfaces/ModelSurface.tsx'])
    // And the author's read-only data-model view exists and is one of the scanned surfaces.
    expect(SURFACE_SOURCES['./surfaces/DataDictionarySurface.tsx']).toBeDefined()
  })

  it('no author-lens surface reaches the raw-source machinery (comments stripped first)', () => {
    const offenders = AUTHOR_SURFACES.filter(([, src]) =>
      RAW_SOURCE_MACHINERY.test(stripComments(src)),
    ).map(([path]) => path)
    expect(offenders).toEqual([])
  })

  it('LENS OPEN — the DATA facet reaches the PIPE editor (author = pipe-over-governed)', () => {
    // The author CAN author a transform/derive/calc/query pipeline over a governed source:
    // the DATA facet control mounts the DataSpec pipe editor in place.
    expect(PIPE_EDITOR.test(stripComments(dataFacetSrc))).toBe(true)
  })

  it('LENS GOVERNED — the DATA facet does NOT reach the raw-source machinery (steward=raw-source)', () => {
    // …but the same control never reaches raw-source definition — a new dataset stays
    // Steward-gated in ModelSurface. This is the D-DA1 boundary, encoded not dissolved.
    expect(RAW_SOURCE_MACHINERY.test(stripComments(dataFacetSrc))).toBe(false)
  })

  it('the guard actually bites — a planted raw-source import IS detected in code (not comments)', () => {
    expect(RAW_SOURCE_MACHINERY.test(stripComments("import { DataModelingPanel } from '../../features/data-layer'"))).toBe(true)
    expect(RAW_SOURCE_MACHINERY.test(stripComments("import { SourceAuthoringPanel } from '../datasources/SourceAuthoringPanel'"))).toBe(true)
    // …and a mere PROSE mention in a comment does NOT trip it (DataDictionary documents
    // the relocation in its header — the strip must let that pass).
    expect(RAW_SOURCE_MACHINERY.test(stripComments('// the DataModelingPanel relocated to Model mode'))).toBe(false)
    // …and the pipe editor is NOT raw-source machinery (the lens boundary is precise).
    expect(RAW_SOURCE_MACHINERY.test(stripComments("import { DataSpecEditor } from '../../features/data-layer/DataSpecEditor'"))).toBe(false)
  })
})
