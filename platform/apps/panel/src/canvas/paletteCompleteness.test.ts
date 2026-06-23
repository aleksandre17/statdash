// ── paletteCompleteness.test — the palette lists ALL registered placeable types ─
//
//  Palette completeness is an OCP invariant, not a curated list: getPaletteEntries
//  is derived entirely from nodeRegistry.list(), so EVERY registered, non-root
//  type appears with zero palette code change. This test pins that invariant —
//  in particular that text + gauge (panels added to the @statdash/plugins barrel)
//  reach the palette automatically once registered, and that NO registered
//  placeable type is silently missing.
//
import { describe, it, expect, beforeAll } from 'vitest'
import { setupCanvasRegistry } from './setupCanvasRegistry'
import { nodeRegistry } from '@statdash/react/engine'
import { getPaletteEntries } from './paletteEntries'

beforeAll(() => { setupCanvasRegistry() })

describe('palette completeness (registry-driven, OCP)', () => {
  it('every registered non-root type appears in the palette exactly once', () => {
    const paletteTypes = new Set(getPaletteEntries().map((e) => e.type))

    // The authoritative set: all registered, non-root types (one per type).
    const registeredPlaceable = new Set(
      nodeRegistry.list().filter((e) => !e.rootOnly).map((e) => e.type),
    )

    for (const type of registeredPlaceable) {
      expect(paletteTypes.has(type), `palette is missing registered type "${type}"`).toBe(true)
    }
    // No phantom entries either — the palette is exactly the placeable registry.
    expect(paletteTypes.size).toBe(registeredPlaceable.size)
  })

  it('text and gauge panels (now registered) appear in the palette', () => {
    const types = getPaletteEntries().map((e) => e.type)
    expect(types).toContain('text')
    expect(types).toContain('gauge')
  })

  it('root-only page templates are excluded (they are tree roots, not droppable)', () => {
    const rootOnly = nodeRegistry.list().filter((e) => e.rootOnly).map((e) => e.type)
    const paletteTypes = new Set(getPaletteEntries().map((e) => e.type))
    for (const type of rootOnly) {
      // A type that is ONLY ever root must not be draggable.
      const alsoPlaceable = nodeRegistry.list().some((e) => e.type === type && !e.rootOnly)
      if (!alsoPlaceable) expect(paletteTypes.has(type)).toBe(false)
    }
  })
})
