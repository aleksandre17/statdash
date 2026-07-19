// ── templates.fitness — starters + data-first generate are VALID configs (V7) ─
//
//  The V7 additive invariant: a starter template AND a data-first generated page
//  are VALID NodePageConfigs — they must pass the SAME gates a hand-built page
//  does, so picking/generating can never produce a config that would be rejected
//  at save/publish. This file pins, for every committed starter and for a
//  generated page:
//
//    1. validateConfig (engine structural floor) returns no errors.
//    2. the adapter round-trip is lossless:
//         fromNodePageConfig(toNodePageConfig(hydrated)) ≡ hydrated.
//    3. the C5 save-guard (validate + round-trip + per-node-valid +
//       locale-complete) passes — the exact gate createPage runs.
//
//  Registering the real canvas registry (setupCanvasRegistry) populates
//  knownNodeTypes() + the per-node PropSchemas, so validateConfig enforces the
//  type set and the guard enforces required fields (not fail-open).
//
import { describe, it, expect, beforeAll } from 'vitest'
import { validateConfig } from '@statdash/engine'
import { setupCanvasRegistry } from '../../canvas/setupCanvasRegistry'
import { toNodePageConfig, fromNodePageConfig } from '../../canvas/canvasPageAdapter'
import { validatePageForSave } from '../../save/saveGuard'
import { PAGE_STARTERS, seedToPageConfig } from './pageStarters'
import { generatePageFromProfile } from './generatePage'
import { hydrateTemplate } from './loadTemplate'
import type { NodePageConfig } from '@statdash/react/engine'
import type { CubeProfile, CubeProfileMeasure, CubeProfileDimension } from '../../lib/cubeApi'

beforeAll(() => { setupCanvasRegistry() })

// The active-locales context the guard checks completeness against. Single
// locale 'ka' (the platform default for the panel) — node titles are plain
// strings, so single-locale completeness is satisfied by a non-empty value.
const ctx = { activeLocales: ['ka' as const] }

const TITLE = { ka: 'ტესტი', en: 'Test' }

/** A page config picked/generated, then hydrated to the store model + slug. */
function hydrate(config: NodePageConfig) {
  return hydrateTemplate(config, TITLE, 'test-page')
}

describe('page starters (registered declarations) are valid NodePageConfigs', () => {
  for (const starter of PAGE_STARTERS) {
    describe(starter.id, () => {
      // Each starter's page-root seed expands into the create-path config (ADR-050 R3).
      const page = () => hydrate(seedToPageConfig(starter.seed))

      it('passes validateConfig (engine structural floor)', () => {
        const cfg = toNodePageConfig(page())
        expect(validateConfig(cfg)).toEqual([])
      })

      it('round-trips losslessly through the adapter', () => {
        const p = page()
        const restored = fromNodePageConfig(toNodePageConfig(p), p.title)
        expect(restored).toEqual(p)
      })

      it('passes the C5 save-guard (the createPage gate)', () => {
        const report = validatePageForSave(page(), ctx)
        expect(report.issues).toEqual([])
        expect(report.ok).toBe(true)
      })
    })
  }
})

// ── Data-first generate ───────────────────────────────────────────────────────

const measure = (code: string): CubeProfileMeasure => ({
  code, label: { en: code }, unit: {
    unit_code: null, symbol: null, label: null, unit_type: null,
    unit_mult: null, decimals: null, base_period: null, source: 'none',
  },
})
const dim = (code: string, over: Partial<CubeProfileDimension> = {}): CubeProfileDimension => ({
  code, conceptRole: null, isTime: false, members: [], ...over,
})
const profile = (over: Partial<CubeProfile>): CubeProfile => ({
  datasetCode: 'DS', dimensions: [], measures: [],
  actualRegion: { available: false, combinations: null }, ...over,
})

describe('generatePageFromProfile (data-first)', () => {
  // A realistic profile: a time axis + a categorical dim + two measures →
  // suggestPanels yields timeseries + bar + kpi-strip; each binds a measure.
  const richProfile = profile({
    dimensions: [dim('TIME', { isTime: true }), dim('SECTOR')],
    measures:   [measure('GDP'), measure('GVA')],
  })

  it('produces a populated page (sections with data-bound charts)', () => {
    const cfg = generatePageFromProfile(richProfile)
    expect(cfg).not.toBeNull()
    const root = cfg as unknown as { children: Array<{ type: string; children?: Array<{ type: string; data?: unknown }> }> }
    // First child is the header; the rest are sections each holding a chart.
    expect(root.children[0].type).toBe('page-header')
    const sections = root.children.filter((c) => c.type === 'section')
    expect(sections.length).toBeGreaterThan(0)
    for (const s of sections) {
      expect(s.children?.[0].type).toBe('chart')
      expect(s.children?.[0].data).toBeTruthy()        // the bound DataSpec (V5)
    }
  })

  it('binds codes from the profile, never typed (Law 2)', () => {
    const cfg = generatePageFromProfile(richProfile)!
    const json = JSON.stringify(cfg)
    // Every bound measure/dim code is a profile code; no invented code appears.
    expect(json).toContain('GDP')          // the first measure (buildSuggestedSpec)
    expect(json).toContain('TIME')         // the time-axis basis label
  })

  it('the generated page passes validateConfig + the save-guard', () => {
    const cfg = generatePageFromProfile(richProfile)!
    const page = hydrate(cfg)
    expect(validateConfig(toNodePageConfig(page))).toEqual([])
    const report = validatePageForSave(page, ctx)
    expect(report.issues).toEqual([])
    expect(report.ok).toBe(true)
  })

  it('round-trips losslessly', () => {
    const page = hydrate(generatePageFromProfile(richProfile)!)
    expect(fromNodePageConfig(toNodePageConfig(page), page.title)).toEqual(page)
  })

  it('returns null when no measure is bindable (falls back to a starter)', () => {
    expect(generatePageFromProfile(profile({ dimensions: [dim('SECTOR')] }))).toBeNull()
  })

  it('reuses suggestPanels — a time axis yields a line chart, else a bar', () => {
    const cfg = generatePageFromProfile(richProfile)!
    const root = cfg as unknown as { children: Array<{ type: string; children?: Array<{ chartType?: string }> }> }
    const charts = root.children
      .filter((c) => c.type === 'section')
      .map((s) => s.children?.[0].chartType)
    expect(charts).toContain('line')   // the timeseries suggestion → line
    expect(charts).toContain('bar')    // the categorical compare → bar
  })
})
