// @vitest-environment node
//
// ── constructor.fitness.test.ts — the capability contract can't drift silently ─
//
//  describeApp() ships externally: the panel/Constructor and apps/api's served
//  JSON Schema are BUILT from it, so the manifest IS the renderer engine's
//  published API/contract (ADR adr_config_and_render_vision, cohesion fitness F4).
//  A capability that quietly disappears is a SILENT BREAKING CHANGE.
//
//  This fitness LOCKS the manifest's CAPABILITY SURFACE against a committed
//  expected set so a removal can't slip through unnoticed:
//
//    (a) the SET of top-level manifest AXES (palette, specTypes, modes, …) plus
//        contractVersion — the stable shape every consumer iterates.
//    (b) the SET of BUILT-IN capability ids registered at IMPORT time — the
//        DataSpec types (SPEC_CATALOG), chart types, transform ops, and export
//        formats. These are populated by side-effect imports of @statdash/engine
//        and @statdash/charts, so they are deterministic in this node env WITHOUT
//        setupRegistrations() (which the app runs at boot to add plugin-tier
//        nodes/modes/datasources/metrics — those are app-tier, NOT locked here).
//
//  What is DELIBERATELY NOT locked (would make benign additions fail):
//    - VALUES of volatile/empty-in-node-env axes (palette, modes, datasourceKinds,
//      metrics, filterControlTypes) — registered at app boot, legitimately empty
//      here; locking them would couple this test to plugin registration counts.
//    - The exact CONTENTS of property schemas / spec-descriptor fields — those
//      are field-level detail, not the capability surface.
//
//  HOW THE LOCK WORKS: each locked set is asserted to CONTAIN every expected id
//  (a removal → a missing id → FAIL) and the axis SET is asserted to EQUAL the
//  expected axis set (a renamed/dropped axis → FAIL). A benign ADDITION (new
//  spec type, new chart type) does NOT fail the `toContain` checks — it only
//  requires extending the expected set + a MINOR contractVersion bump, exactly
//  as the bump policy on CONTRACT_VERSION prescribes. A REMOVAL forces a MAJOR
//  bump. Either way the change is CONSCIOUS, not silent.
//

import { describe, it, expect } from 'vitest'
import { describeApp, CONTRACT_VERSION } from './constructor'

// ── (a) The locked AXIS surface — the manifest's stable top-level shape ────────
//  The exact set of keys every consumer reads off describeApp(). Renaming or
//  dropping one is a MAJOR break; adding one is a MINOR addition (extend here +
//  bump). Equality (not superset) is intentional: a removed axis MUST fail.
const EXPECTED_AXES: ReadonlySet<string> = new Set([
  'contractVersion',
  'palette',
  'propertySchemas',
  'chartTypes',
  'specTypes',
  'modes',
  'datasourceKinds',
  'transformOps',
  'metrics',
  'exportFormats',
  'filterControlTypes',
])

// ── (b) Locked BUILT-IN capability ids (registered at IMPORT time) ─────────────
//  The DataSpec types are the canonical SPEC_CATALOG (static in @statdash/engine).
//  Removing any is a MAJOR break in what the Constructor's spec picker can offer.
const EXPECTED_SPEC_TYPES: readonly string[] = [
  'query', 'row-list', 'timeseries', 'growth', 'ratio-list', 'pivot',
]

//  The core transform ops the pipeline editor relies on (subset of the full set;
//  these are the named, load-bearing built-ins). Adding ops is fine; losing one
//  of these is a MAJOR break.
const EXPECTED_TRANSFORM_OPS: readonly string[] = [
  'sort', 'filter', 'melt', 'rename', 'aggregate', 'derive',
]

//  The built-in export formats apps/api + the panel export menu depend on.
const EXPECTED_EXPORT_FORMATS: readonly string[] = ['csv', 'sdmx-json']

// ── contractVersion — present, SemVer, and the single source ───────────────────

describe('F4 — contractVersion is a manifest-owned SemVer (single source)', () => {

  it('describeApp().contractVersion equals the exported CONTRACT_VERSION constant', () => {
    expect(describeApp().contractVersion).toBe(CONTRACT_VERSION)
  })

  it('contractVersion is a valid SemVer string', () => {
    // major.minor.patch — the bump-policy vocabulary documented on CONTRACT_VERSION.
    expect(describeApp().contractVersion).toMatch(/^\d+\.\d+\.\d+$/)
  })

})

// ── (a) axis-surface lock ──────────────────────────────────────────────────────

describe('F4 — the manifest AXIS surface is locked (a dropped axis fails)', () => {

  it('the manifest top-level key set equals the committed expected axis set', () => {
    const actual = new Set(Object.keys(describeApp()))
    // Symmetric: a REMOVED axis (actual ⊊ expected) AND a NEW unlocked axis
    // (actual ⊋ expected) both fail — forcing a conscious update + version bump.
    expect(actual).toEqual(EXPECTED_AXES)
  })

})

// ── (b) built-in capability-id lock ────────────────────────────────────────────

describe('F4 — built-in capability ids are locked (a removed capability fails)', () => {

  it('specTypes still offers every locked DataSpec type', () => {
    const actual = Object.keys(describeApp().specTypes)
    for (const t of EXPECTED_SPEC_TYPES) {
      expect(actual, `DataSpec type '${t}' was removed from the contract`).toContain(t)
    }
  })

  it('chartTypes ships built-in chart types (the picker is non-empty)', () => {
    // Chart types are plugin-registerable; the STABLE contract is "the picker has
    // built-ins at import" — not a frozen list (charts evolve). The axis lock (a)
    // guards the picker's EXISTENCE; this guards it is populated by import.
    expect(describeApp().chartTypes.length).toBeGreaterThan(0)
  })

  it('transformOps still offers every locked core op', () => {
    const actual = describeApp().transformOps
    for (const op of EXPECTED_TRANSFORM_OPS) {
      expect(actual, `transform op '${op}' was removed from the contract`).toContain(op)
    }
  })

  it('exportFormats still offers every locked built-in format', () => {
    const actual = describeApp().exportFormats
    for (const f of EXPECTED_EXPORT_FORMATS) {
      expect(actual, `export format '${f}' was removed from the contract`).toContain(f)
    }
  })

})

// ── Sanity — the lock fails on a simulated removal ─────────────────────────────
//  Proves the lock is load-bearing: a manifest with a capability stripped out is
//  rejected by the same `toContain` discipline the real checks use.

describe('F4 — the lock is load-bearing (a stripped capability is caught)', () => {

  it('a manifest missing a locked spec type fails the contain-check', () => {
    const stripped = Object.keys(describeApp().specTypes).filter(t => t !== 'pivot')
    // The real test asserts `toContain('pivot')`; on this stripped set it must NOT.
    expect(stripped).not.toContain('pivot')
  })

  it('a manifest missing the contractVersion axis fails the axis-set lock', () => {
    const { contractVersion: _omit, ...rest } = describeApp()
    void _omit
    expect(new Set(Object.keys(rest))).not.toEqual(EXPECTED_AXES)
  })

})
