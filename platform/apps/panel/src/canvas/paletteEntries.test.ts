// ── paletteEntries — unit + integration tests ─────────────────────────────
//
//  Tests for both the flat (getPaletteEntries) and capability-driven grouped
//  (getGroupedPaletteEntries) palette derivations.
//
//  getGroupedPaletteEntries is the real consumer that wires
//  nodeRegistry.getByCapability(CAPS.*) into the Constructor palette — the test
//  here pins that the dead-seam is truly closed: CAPS tokens produce correct
//  grouping when registered slices declare the matching caps.
//
import { describe, it, expect, beforeAll } from 'vitest'
import { setupCanvasRegistry }              from './setupCanvasRegistry'
import { getPaletteEntries, getGroupedPaletteEntries } from './paletteEntries'

// Slices must be registered before any palette function is called.
beforeAll(() => { setupCanvasRegistry() })

// ── getPaletteEntries (flat) ──────────────────────────────────────────────────

describe('getPaletteEntries', () => {
  it('returns at least one entry', () => {
    expect(getPaletteEntries().length).toBeGreaterThan(0)
  })

  it('excludes rootOnly page templates', () => {
    const types = getPaletteEntries().map((e) => e.type)
    expect(types).not.toContain('inner-page')
    expect(types).not.toContain('tab-page')
    expect(types).not.toContain('container-page')
  })

  it('includes a known leaf type (section)', () => {
    expect(getPaletteEntries().map((e) => e.type)).toContain('section')
  })

  it('entries carry a caps array (never undefined)', () => {
    for (const entry of getPaletteEntries()) {
      expect(Array.isArray(entry.caps)).toBe(true)
    }
  })

  it('chart entry has export + filterable caps declared', () => {
    const chart = getPaletteEntries().find((e) => e.type === 'chart')
    expect(chart).toBeDefined()
    expect(chart!.caps).toContain('export')
    expect(chart!.caps).toContain('filterable')
  })
})

// ── getGroupedPaletteEntries — getByCapability(CAPS.*) consumer ──────────────
//
//  This block is the direct integration test for the CAPS + getByCapability
//  wiring in paletteEntries.ts. It pins:
//    - CAPS.FILTERABLE → "Data panels" group (chart, table, kpi-strip, map…)
//    - CAPS.COLLAPSIBLE (non-filterable) → "Layout" group (section…)
//    - Neither cap → "Content" group (hero, links, page-header…)

describe('getGroupedPaletteEntries — capability-driven grouping', () => {
  it('returns at least one group', () => {
    expect(getGroupedPaletteEntries().length).toBeGreaterThan(0)
  })

  it('produces a "data" group containing filterable node types', () => {
    const groups = getGroupedPaletteEntries()
    const dataGroup = groups.find((g) => g.key === 'data')
    expect(dataGroup).toBeDefined()
    const types = dataGroup!.entries.map((e) => e.type)
    // chart, table, kpi-strip declare CAPS.FILTERABLE
    expect(types).toContain('chart')
    expect(types).toContain('table')
    expect(types).toContain('kpi-strip')
  })

  it('produces a "layout" group containing collapsible-but-not-filterable types', () => {
    const groups = getGroupedPaletteEntries()
    const layoutGroup = groups.find((g) => g.key === 'layout')
    expect(layoutGroup).toBeDefined()
    const types = layoutGroup!.entries.map((e) => e.type)
    // section declares CAPS.COLLAPSIBLE but NOT CAPS.FILTERABLE
    expect(types).toContain('section')
  })

  it('data group does NOT include pure structural layout types (row, wrap)', () => {
    const groups = getGroupedPaletteEntries()
    const dataGroup = groups.find((g) => g.key === 'data')
    const types = dataGroup?.entries.map((e) => e.type) ?? []
    // row and wrap declare no caps at all
    expect(types).not.toContain('row')
    expect(types).not.toContain('wrap')
  })

  it('layout group does NOT include filterable types', () => {
    const groups = getGroupedPaletteEntries()
    const layoutGroup = groups.find((g) => g.key === 'layout')
    const types = layoutGroup?.entries.map((e) => e.type) ?? []
    // chart has filterable — must NOT appear in layout
    expect(types).not.toContain('chart')
    expect(types).not.toContain('table')
  })

  it('no type appears in more than one group', () => {
    const groups  = getGroupedPaletteEntries()
    const seen    = new Set<string>()
    const dupes: string[] = []
    for (const group of groups) {
      for (const entry of group.entries) {
        if (seen.has(entry.type)) dupes.push(entry.type)
        seen.add(entry.type)
      }
    }
    expect(dupes).toEqual([])
  })

  it('every entry in every group has a non-empty type and label', () => {
    for (const group of getGroupedPaletteEntries()) {
      for (const entry of group.entries) {
        expect(entry.type.length).toBeGreaterThan(0)
        expect(entry.label.length).toBeGreaterThan(0)
      }
    }
  })

  it('no rootOnly types appear in any group', () => {
    const types = getGroupedPaletteEntries().flatMap((g) => g.entries.map((e) => e.type))
    expect(types).not.toContain('inner-page')
    expect(types).not.toContain('tab-page')
    expect(types).not.toContain('container-page')
  })

  it('group headings are non-empty strings', () => {
    for (const group of getGroupedPaletteEntries()) {
      expect(typeof group.heading).toBe('string')
      expect(group.heading.length).toBeGreaterThan(0)
    }
  })
})
