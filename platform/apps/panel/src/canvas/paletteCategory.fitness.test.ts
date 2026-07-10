// ── FF-PALETTE-CATEGORY-DRIVEN — the palette groups by declared meta.category ──
//
//  AR-49 M4.1 (taxonomy fix). The Insert palette's grouping is a PURE PROJECTION of
//  each slice's declared semantic `meta.category` (layout | data | content) — NOT a
//  capability-derived guess. The prior partition (COLLAPSIBLE⇒layout / FILTERABLE⇒
//  data) put the only collapsible type (section) alone in "Layout" and dumped the
//  real layout primitives (grid/columns/divider/spacer/stack/wrap/card — none of
//  which declare a capability) into "Content". This guard pins:
//    (1) every registered placeable declares a category (full coverage);
//    (2) every tile's group is exactly its declared category (a pure projection);
//    (3) the grouping code consults NO capability query (no getByCapability / CAPS).
//
import { describe, it, expect, beforeAll } from 'vitest'
import { nodeRegistry }        from '@statdash/react/engine'
import { setupCanvasRegistry }  from './setupCanvasRegistry'
import { getPaletteEntries, getGroupedPaletteEntries } from './paletteEntries'

beforeAll(() => { setupCanvasRegistry() })

// The grouping source — scanned to prove no capability-based partition survives.
const GROUPING_SOURCE = import.meta.glob(
  ['./paletteEntries.ts'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

// First non-root registry meta per type (the palette's derivation source).
function categoryByType(): Map<string, string | undefined> {
  const m = new Map<string, string | undefined>()
  for (const entry of nodeRegistry.list()) {
    if (entry.rootOnly) continue
    if (!m.has(entry.type)) m.set(entry.type, (entry as { category?: string }).category)
  }
  return m
}

describe('FF-PALETTE-CATEGORY-DRIVEN', () => {
  it('(1) every registered placeable type declares a semantic category', () => {
    const missing: string[] = []
    for (const [type, category] of categoryByType()) {
      if (!category) missing.push(type)
    }
    expect(missing, `placeable types without a meta.category: ${missing.join(', ')}`).toEqual([])
  })

  it('(2) every tile lands in the group named by its declared meta.category', () => {
    const categories = categoryByType()
    for (const group of getGroupedPaletteEntries()) {
      for (const entry of group.entries) {
        const declared = categories.get(entry.type)
        expect(
          group.key,
          `tile "${entry.type}" is in group "${group.key}" but declares category "${declared}"`,
        ).toBe(declared)
      }
    }
  })

  it('(2b) every placeable tile appears in exactly one category group (no drop, no dupe)', () => {
    const grouped = getGroupedPaletteEntries().flatMap((g) => g.entries.map((e) => e.type))
    const flat = getPaletteEntries().map((e) => e.type)
    expect(grouped.slice().sort()).toEqual(flat.slice().sort())
    expect(new Set(grouped).size).toBe(grouped.length)   // no type in two groups
  })

  it('(2c) the layout group contains the real layout primitives, not just section', () => {
    const layout = getGroupedPaletteEntries().find((g) => g.key === 'layout')
    expect(layout).toBeDefined()
    const types = new Set(layout!.entries.map((e) => e.type))
    for (const primitive of ['section', 'grid', 'columns', 'divider', 'spacer']) {
      expect(types.has(primitive), `layout group is missing "${primitive}"`).toBe(true)
    }
  })

  it('(3) the grouping code consults NO capability query (no getByCapability / CAPS)', () => {
    const sources = Object.values(GROUPING_SOURCE)
    expect(sources.length).toBeGreaterThan(0)
    for (const [path, raw] of Object.entries(GROUPING_SOURCE)) {
      const src = stripComments(raw)
      expect(src.includes('getByCapability'), `${path} still partitions by getByCapability`).toBe(false)
      expect(/\bCAPS\./.test(src), `${path} still references CAPS.* for grouping`).toBe(false)
    }
  })
})
