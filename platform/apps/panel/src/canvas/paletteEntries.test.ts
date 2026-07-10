// ── paletteEntries — unit + integration tests ─────────────────────────────
//
//  Tests for both the flat (getPaletteEntries) and semantic category-driven
//  grouped (getGroupedPaletteEntries) palette derivations.
//
//  getGroupedPaletteEntries partitions the palette by each slice's declared
//  `meta.category` (layout | data | content) — the test here pins that grouping
//  is a pure projection of that semantic field: data panels group under "data",
//  layout primitives (including grid/columns/divider/spacer that declare no
//  capability) under "layout", and static content under "content".
//
import { describe, it, expect, beforeAll } from 'vitest'
import { resolveLocaleString }             from '@statdash/engine'
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

// ── getGroupedPaletteEntries — semantic meta.category grouping ───────────────
//
//  This block pins that grouping is a pure projection of each slice's declared
//  `meta.category`:
//    - category 'data'    → "Data panels" group (chart, table, kpi-strip, gauge…)
//    - category 'layout'  → "Layout" group (section, grid, columns, divider…)
//    - category 'content' → "Content" group (hero, links, page-header…)

describe('getGroupedPaletteEntries — semantic category grouping', () => {
  it('returns at least one group', () => {
    expect(getGroupedPaletteEntries().length).toBeGreaterThan(0)
  })

  it('produces a "data" group containing the data-category panels', () => {
    const groups = getGroupedPaletteEntries()
    const dataGroup = groups.find((g) => g.key === 'data')
    expect(dataGroup).toBeDefined()
    const types = dataGroup!.entries.map((e) => e.type)
    // chart, table, kpi-strip declare category: 'data'
    expect(types).toContain('chart')
    expect(types).toContain('table')
    expect(types).toContain('kpi-strip')
  })

  it('produces a "layout" group holding EVERY layout primitive (the taxonomy fix)', () => {
    const groups = getGroupedPaletteEntries()
    const layoutGroup = groups.find((g) => g.key === 'layout')
    expect(layoutGroup).toBeDefined()
    const types = layoutGroup!.entries.map((e) => e.type)
    // section is no longer the ONLY layout tile — grid/columns/divider/spacer
    // (which declare NO capability, so the old partition dumped them in "content")
    // are structural layout primitives and now group by their declared category.
    expect(types).toContain('section')
    expect(types).toContain('grid')
    expect(types).toContain('columns')
    expect(types).toContain('divider')
    expect(types).toContain('spacer')
  })

  it('data group does NOT include structural layout types (grid, wrap)', () => {
    const groups = getGroupedPaletteEntries()
    const dataGroup = groups.find((g) => g.key === 'data')
    const types = dataGroup?.entries.map((e) => e.type) ?? []
    // grid and wrap are category: 'layout'
    expect(types).not.toContain('grid')
    expect(types).not.toContain('wrap')
  })

  it('layout group does NOT include the data-category panels', () => {
    const groups = getGroupedPaletteEntries()
    const layoutGroup = groups.find((g) => g.key === 'layout')
    const types = layoutGroup?.entries.map((e) => e.type) ?? []
    // chart/table are category: 'data' — must NOT appear in layout
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

  it('every entry in every group has a non-empty type and a resolvable label', () => {
    for (const group of getGroupedPaletteEntries()) {
      for (const entry of group.entries) {
        expect(entry.type.length).toBeGreaterThan(0)
        // label is now a raw LocaleString (resolved at the render seam) — resolve
        // it to assert it carries non-empty content in either locale.
        const resolved = resolveLocaleString(entry.label, 'en', 'ka')
        expect(resolved.length).toBeGreaterThan(0)
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
