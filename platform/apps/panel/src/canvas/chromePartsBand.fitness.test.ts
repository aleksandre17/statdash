// ── FF-CHROME-PARTS-BAND — chrome is a `sourced` Part of the site-frame (S6) ──────
//
//  ADR-041 R4 / SPEC-studio-ia-canonical S6: chrome regions (header / sidebar / footer)
//  are the CONSTITUENT PARTS of ONE bounded element — the SITE FRAME — declared as a
//  `sourced` band (`SITE_FRAME_META.band = { source: 'site-chrome' }`), the SECOND
//  consumer of the `sourced` residence after the filter band. This gate locks the
//  REVERSIBLE EXPAND (the mechanism), independent of the one-way selection fold:
//
//    (a) DECLARED as `sourced` (NOT slot) — `partFieldsOf(SITE_FRAME_META)` emits ONE
//        sourced PartField with `source: 'site-chrome'`; ZERO engine change to enumerate
//        (the SAME projection filter-bar's `band:{source:'page-filters'}` rides).
//    (b) REGISTRY-BY-SOURCE (the collision fix) — the MULTI-consumer `sourced` residence
//        resolves by SOURCE id, so filters ('page-filters') and chrome ('site-chrome')
//        no longer collide on one adapter slot. Filters stay BYTE-IDENTICAL.
//    (c) KEYED PROJECTION + SSOT WRITE — `chromeParts` projects `site.chrome × chrome-
//        Registry` (only AUTHORABLE, schema-bearing regions), addressed by the STABLE
//        slot key (`chrome.<slot>`), and writes a `site-chrome` mutation (the site SSOT
//        reducer, NO denormalised node copy) — mirroring the filter band exactly.
//
import { describe, it, expect, beforeAll } from 'vitest'
import {
  chromeRegistry, partFieldsOf, SITE_FRAME_ID, SITE_FRAME_META, valueParts,
} from '@statdash/react/engine'
import type { ChromeSlotConfig, ObjectMeta } from '@statdash/react/engine'
import type { FilterSchemaInput } from '@statdash/engine'
import { getParamSchema } from '@statdash/engine'
import { setupCanvasRegistry } from './setupCanvasRegistry'
import {
  enumerateParts, getPartSource, chromeParts, sourcedParts,
} from './bandSource'

beforeAll(() => { setupCanvasRegistry() })

// The FIRST authorable chrome (slot, key) — DERIVED from the registry exactly as the
// overlay/palette derive their list (schema-bearing). Registry-driven, never hardcoded.
function firstAuthorableChrome(): { slot: string; key: string } | null {
  for (const slot of chromeRegistry.list()) {
    for (const key of chromeRegistry.listVariants(slot)) {
      if ((chromeRegistry.getMeta(slot, key)?.schema?.length ?? 0) > 0) return { slot, key }
    }
  }
  return null
}

describe('FF-CHROME-PARTS-BAND — chrome is a declared `sourced` Part (ADR-041 R4 · S6)', () => {
  it('(a) the site-frame DECLARES ONE sourced band, source `site-chrome` (NOT a slot part)', () => {
    const fields = partFieldsOf(SITE_FRAME_META)
    expect(fields).toHaveLength(1)
    expect(fields[0]).toMatchObject({ residence: 'sourced', source: 'site-chrome' })
    // Residence is `sourced`, never `slot` — chrome is a keyed external projection, not a
    // node-children container (no `slot` part ⇒ chrome is NOT a node-tree drop target).
    expect(fields.some((f) => f.residence === 'slot')).toBe(false)
  })

  it('(b) registry-by-source: filters and chrome resolve DISTINCT adapters — no collision', () => {
    expect(getPartSource('sourced', 'site-chrome')).toBe(chromeParts)
    expect(getPartSource('sourced', 'page-filters')).toBe(sourcedParts)
    // Filters BYTE-IDENTICAL: the filter source id still resolves the SAME adapter object.
    expect(getPartSource('sourced', 'site-chrome')).not.toBe(getPartSource('sourced', 'page-filters'))
    // A positional residence ignores source; a sourced lookup with NO source is undefined.
    expect(getPartSource('value')).toBe(valueParts)
    expect(getPartSource('sourced')).toBeUndefined()
  })

  it('(a guard) at least one authorable chrome region exists (the projection is meaningful)', () => {
    expect(firstAuthorableChrome()).not.toBeNull()
  })

  it('(c) enumerate through the ONE port — STABLE slot-key address, registry-resolved contract', () => {
    const chrome = firstAuthorableChrome()!
    // The site chrome SSOT (the shape `site.chrome` / `SiteManifest.chrome` take).
    const chromeMap: Record<string, ChromeSlotConfig> = {
      [chrome.slot]: { variant: chrome.key, config: { existing: 'value' } },
    }
    const parts = enumerateParts({}, SITE_FRAME_META, { chrome: chromeMap }, SITE_FRAME_ID)
    const part  = parts.find((p) => p.address.partPath === `chrome.${chrome.slot}`)
    expect(part).toBeTruthy()

    // Addressed by the STABLE slot key (Delta 1), owned by the site-frame element.
    expect(part!.address).toEqual({ nodeId: SITE_FRAME_ID, partPath: `chrome.${chrome.slot}` })
    expect(part!.key).toBe(chrome.slot)
    // The anchor coordinate is (field=slot, index=0) — the coordinate the ChromeSlot anchor
    // stamps (the ONE `data-part-*` family, matching FilterBarShell's (barId, position)).
    expect(part!.field).toBe(chrome.slot)
    expect(part!.index).toBe(0)
    // The contract is the chrome slice's OWN registered per-slot schema — discriminated,
    // resolved by the adapter (mirrors `getParamSchema` for filters). Never a node schema.
    expect(part!.contract).toBe(chromeRegistry.getMeta(chrome.slot, chrome.key)!.schema)
    // The bounded subject is the slot's live per-slot config (what the Inspector edits).
    expect(part!.subject).toEqual({ existing: 'value' })
    // The adapter id is carried for the WRITE (re-resolved by the host).
    expect(part!.source).toBe('site-chrome')
  })

  it('(c) a slot with NO authored entry still enumerates on its default variant (fail-soft)', () => {
    const chrome = firstAuthorableChrome()!
    // Empty site chrome — the adapter still projects registered authorable slots, resolving
    // the DEFAULT variant, so a default-rendered region is selectable (subject is `{}`).
    const parts = enumerateParts({}, SITE_FRAME_META, { chrome: {} }, SITE_FRAME_ID)
    const part  = parts.find((p) => p.address.partPath === `chrome.${chrome.slot}`)
    // Present only if the DEFAULT variant is itself authorable; guard on that to stay robust.
    if ((chromeRegistry.getMeta(chrome.slot, 'default')?.schema?.length ?? 0) > 0) {
      expect(part).toBeTruthy()
      expect(part!.subject).toEqual({})
    }
  })

  it('(c) the write is a `site-chrome` mutation resolved by the STABLE slot key — no node copy', () => {
    const chrome = firstAuthorableChrome()!
    const mut = chromeParts.writePart(
      {}, { nodeId: SITE_FRAME_ID, partPath: `chrome.${chrome.slot}` }, 'title', 'Hello', {},
    )
    expect(mut).toEqual({ target: 'site-chrome', slot: chrome.slot, field: 'title', value: 'Hello' })
    // A pathless address resolves to nothing (never a silent write).
    expect(chromeParts.writePart({}, { nodeId: SITE_FRAME_ID }, 'title', 'X', {})).toBeNull()
  })

  it('(b) filters stay BYTE-IDENTICAL — the filter band enumerates unchanged through the port', () => {
    const filterSchema: FilterSchemaInput = {
      bars: { main: { filters: { year: { type: 'year-select', default: 2024 } } } },
    }
    const meta  = { band: { source: 'page-filters' } } as ObjectMeta
    const items = enumerateParts({ barIds: ['main'] }, meta, { filterSchema }, 'fb')
    expect(items.map((i) => i.address)).toEqual([{ nodeId: 'fb', partPath: 'main.year' }])
    expect(items[0]!.contract).toBe(getParamSchema('year-select'))
    expect(items[0]!.source).toBe('page-filters')
  })
})
