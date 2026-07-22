// ── lifecyclePlacement.fitness — ONE band, placement DERIVED, rows QUIET (C3 · DU6-IA-1) ──
//
//  DESIGN-0104 §2·C3 / brief item 5: the Authoring Lifecycle band is ONE component
//  placed by the Placement Law — NOT hand-mounted per host. DU6-IA-1 (§3d, owner-decided
//  chip-only rows) sharpened the two zooms of a STORED spec's lifecycle:
//    · FULL band — the Specs-floor workbench head (docId = the selected stored spec),
//      the ONE action home (Publish / Discard live here and only here);
//    · ROW zoom — the amber draft CHIP only (`SpecDraftChip`); the old dense row band
//      is GONE from rows (`FF-METRIC-ROW-QUIET`'s sibling for specs — quiet rows, no
//      second action home).
//  This fitness proves:
//    (1) the band's container is DERIVED from resolveSurface (no per-host literal);
//    (2) the Specs-floor host (`SpecsBody`, the retired modeler's spec half) mounts the
//        ONE <AuthoringLifecycleBand> in the workbench head;
//    (3) rows mount the draft chip and NEVER a dense band — the row-level action
//        regression is unrepresentable.
//
//  NOTE (SURFACED, kept from the C3 wave): the design names the "DATA facet" as the
//  compact zoom, but that facet edits an element's INLINE data spec (element.data — no
//  config.data_spec docId), so the config-REVISION lifecycle cannot apply there (an
//  inline spec is published with its PAGE, a separate lifecycle). The faithful compact
//  zoom of a STORED spec's lifecycle is the Specs-floor row — chip-only per DU6-IA-1.
//
import { describe, it, expect } from 'vitest'
import { resolveSurface } from '../../../studio/placement/resolveSurface'
import { deriveWeight } from '../../../studio/placement/weight'
import {
  resolveLifecycleBandContainer, LIFECYCLE_BAND_SCOPE, LIFECYCLE_BAND_SHAPE,
} from './lifecycleBandPlacement'

// The Specs-floor host source (Vite ?raw) — scanned to prove the zoom contract above.
const PANEL_SRC = import.meta.glob(['../../../studio/specs/SpecsBody.tsx'], {
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

describe('lifecycle band — ONE component, one action home, quiet rows (DU6-IA-1 §3d)', () => {
  it('the Specs-floor host exists and imports the ONE band component', () => {
    // Guards the glob itself too: a moved/renamed host yields '' and fails loudly here.
    expect(code).not.toBe('')
    expect(code).toMatch(/import\s*\{\s*AuthoringLifecycleBand\s*\}\s*from\s*'.*\/lifecycle\/AuthoringLifecycleBand'/)
  })

  it('mounts the FULL band in the workbench head (docId = the selected stored spec)', () => {
    expect(code).toMatch(/<AuthoringLifecycleBand\s+docId=\{selectedSpec\.id\}/)
  })

  it('rows carry the draft CHIP only — the dense row band is unrepresentable', () => {
    // The row zoom is the amber chip (quiet rows); Publish/Discard have ONE home.
    expect(code).toMatch(/<SpecDraftChip\s+specId=\{spec\.id\}/)
    expect(code).not.toMatch(/<AuthoringLifecycleBand[^>]*\bdense\b/)
  })
})
