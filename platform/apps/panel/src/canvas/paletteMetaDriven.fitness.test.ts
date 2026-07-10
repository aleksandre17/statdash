// ── FF-PALETTE-META-DRIVEN — the palette is a pure projection of registry meta ──
//
//  AR-49 M4 Wave 1 (§2.3). The Insert palette elevation must stay REGISTRY-DERIVED
//  (OCP): every tile's icon / label / description / group is a projection of
//  NodeSliceMeta — a new slice = a new tile with zero palette code — and NO palette
//  label or group-heading string is hardcoded in the palette components. This guard
//  bites on regression (a hand-authored tile, a re-baked English heading literal).
//
import { describe, it, expect, beforeAll } from 'vitest'
import { resolveLocaleString } from '@statdash/engine'
import { nodeRegistry }        from '@statdash/react/engine'
import { setupCanvasRegistry }  from './setupCanvasRegistry'
import { getPaletteEntries, getGroupedPaletteEntries } from './paletteEntries'
import { PALETTE_GROUP_LABELS, paletteGroupHeading }    from './paletteGroupLabels'
import { resolvePaletteIcon, FALLBACK_PALETTE_ICON }    from './paletteIcons'

beforeAll(() => { setupCanvasRegistry() })

// The palette + heading component sources — scanned for hardcoded label literals.
const PALETTE_SOURCES = import.meta.glob(
  ['./NodePalette.tsx', './paletteEntries.ts'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

// Strip // line + /* block */ comments so the literal scan sees CODE only (a
// heading word in a doc-comment is prose, not a hardcoded UI string).
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

// First non-root registry meta per type (the palette's derivation source).
function metaByType() {
  const m = new Map<string, Record<string, unknown>>()
  for (const entry of nodeRegistry.list()) {
    if (entry.rootOnly) continue
    if (!m.has(entry.type)) m.set(entry.type, entry as Record<string, unknown>)
  }
  return m
}

describe('FF-PALETTE-META-DRIVEN', () => {
  it('every tile label + icon + description is the registry meta value (a pure projection)', () => {
    const metas = metaByType()
    for (const entry of getPaletteEntries()) {
      const meta = metas.get(entry.type)
      expect(meta, `no registry meta for palette type ${entry.type}`).toBeDefined()

      // icon token is the meta's icon token verbatim (or absent → both absent).
      expect(entry.icon).toBe(meta!.icon as string | undefined)

      // label resolves to the meta's label (or the type as the last-resort fallback).
      const metaLabel = (meta!.label ?? entry.type) as Parameters<typeof resolveLocaleString>[0]
      expect(resolveLocaleString(entry.label, 'en', 'ka'))
        .toBe(resolveLocaleString(metaLabel, 'en', 'ka'))

      // description, when present, is the meta's description (never invented).
      if (entry.description !== undefined) {
        expect(entry.description).toEqual((meta as { description?: unknown }).description)
      }
    }
  })

  it('every entry resolves to a renderable glyph (unknown/absent token → neutral fallback)', () => {
    for (const entry of getPaletteEntries()) {
      // MUI icons are memo/forwardRef components (typeof 'object') — assert a
      // valid, renderable component object, never null/undefined.
      expect(resolvePaletteIcon(entry.icon)).toBeTruthy()
    }
    expect(resolvePaletteIcon(undefined)).toBe(FALLBACK_PALETTE_ICON)
    expect(resolvePaletteIcon('___no_such_token___')).toBe(FALLBACK_PALETTE_ICON)
  })

  it('every produced group key has a localized heading in the group-labels table', () => {
    for (const group of getGroupedPaletteEntries()) {
      expect(PALETTE_GROUP_LABELS[group.key], `no group-label row for "${group.key}"`).toBeDefined()
      // headings are localized (ka differs from the English default for our seeds).
      expect(paletteGroupHeading(group.key, 'ka').length).toBeGreaterThan(0)
      expect(paletteGroupHeading(group.key, 'en').length).toBeGreaterThan(0)
    }
    // the recommended section heading is table-driven too.
    expect(PALETTE_GROUP_LABELS.recommended).toBeDefined()
  })

  it('the palette components hardcode NO English group-heading literal (table is the SSOT)', () => {
    const sources = Object.values(PALETTE_SOURCES)
    expect(sources.length).toBeGreaterThan(0)   // the glob actually resolved files
    const retired = ['Recommended', 'Data panels', 'Layout', 'Content']
    for (const [path, raw] of Object.entries(PALETTE_SOURCES)) {
      const src = stripComments(raw)
      for (const literal of retired) {
        // allow the identifier PALETTE_GROUP_LABELS.<key>.en references (no quoted literal)
        expect(src.includes(`'${literal}'`), `${path} hardcodes '${literal}'`).toBe(false)
        expect(src.includes(`"${literal}"`), `${path} hardcodes "${literal}"`).toBe(false)
        expect(src.includes(`>${literal}<`), `${path} inlines >${literal}< as JSX text`).toBe(false)
      }
    }
  })
})
