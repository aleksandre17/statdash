// ── lifecyclePlacement.fitness — ONE band, BOTH zooms, placement DERIVED (C3) ──────
//
//  DESIGN-0104 §2·C3 / brief item 5: the Authoring Lifecycle band is ONE component
//  placed by the Placement Law in both zooms of a stored config document — NOT hand-
//  mounted per host. This fitness proves:
//    (1) the band's container is DERIVED from resolveSurface (no per-host literal), and
//    (2) BOTH zooms — the Model-floor workbench head (full) + the browser row (compact) —
//        mount the SAME <AuthoringLifecycleBand>, one dense and one not.
//
//  NOTE (SURFACED): the design names the "DATA facet" as the compact zoom, but that facet
//  edits an element's INLINE data spec (element.data — no config.data_spec docId), so the
//  config-REVISION lifecycle cannot apply there (an inline spec is published with its PAGE,
//  a separate lifecycle). The faithful compact zoom of a STORED spec's lifecycle is the
//  Model-floor browser row — both zooms here carry a real config docId.
//
import { describe, it, expect } from 'vitest'
import { resolveSurface } from '../../../studio/placement/resolveSurface'
import { deriveWeight } from '../../../studio/placement/weight'
import {
  resolveLifecycleBandContainer, LIFECYCLE_BAND_SCOPE, LIFECYCLE_BAND_SHAPE,
} from './lifecycleBandPlacement'

// The Model-floor host source (Vite ?raw) — scanned to prove BOTH zooms mount the ONE band.
const PANEL_SRC = import.meta.glob(['../DataModelingPanel.tsx'], {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>
/** Strip line + block comments so a symbol-scan can't be fooled by prose/JSDoc. */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const code = strip(Object.values(PANEL_SRC)[0] ?? '')

describe('lifecycle band placement — DERIVED, not a per-host literal', () => {
  it('resolves its container through resolveSurface (the Placement Law SSOT)', () => {
    // Placement is a pure projection of scope × weight — the SAME derivation every editor
    // uses. If this ever hard-coded a container, the two would diverge.
    expect(resolveLifecycleBandContainer())
      .toBe(resolveSurface(LIFECYCLE_BAND_SCOPE, deriveWeight(LIFECYCLE_BAND_SHAPE)))
  })
})

describe('lifecycle band — ONE component in BOTH zooms of a stored spec', () => {
  it('the Model-floor host imports the ONE band component', () => {
    expect(code).toMatch(/import\s*\{\s*AuthoringLifecycleBand\s*\}\s*from\s*'\.\/lifecycle\/AuthoringLifecycleBand'/)
  })

  it('mounts the FULL band in the workbench head (docId = the selected stored spec)', () => {
    expect(code).toMatch(/<AuthoringLifecycleBand\s+docId=\{selectedSpec\.id\}/)
  })

  it('mounts the COMPACT (dense) band in the browser row — the second zoom, same component', () => {
    // The row wrapper renders the dense variant of the SAME band (not a fork).
    expect(code).toMatch(/<AuthoringLifecycleBand[^>]*\bdense\b/)
  })
})
