// ── FF-CONCERN-GROUPED — the REFINE canon's projection is locked (root Law 11) ────
//
//  The machine half of the Authoring Canon's REFINE moment. The inspector organizes
//  EVERY authorable thing for a selected element into the canonical concern taxonomy —
//  CONTENT · DATA · STYLE · LAYOUT · BEHAVIOR — one collapsible group per concern, in
//  ONE order, empties dropped. This gate asserts the invariants the exhausted owner
//  judges by eye on :3013:
//    • the taxonomy is the five canonical concerns, in canonical order;
//    • EVERY declared field lands in EXACTLY ONE concern in that taxonomy — no ungrouped
//      orphan (the "flat, tangled dump" is unrepresentable);
//    • a field/facet's concern is DECLARED, projected generically (Law 1 — no type read):
//      a new field lands in its concern automatically;
//    • the reference element types (kpi / chart / table / geograph) DISTRIBUTE across
//      multiple concerns (proof the surface is organized, not mushed into one bucket);
//    • an empty concern self-drops (never a blank labelled box).
//
import { describe, it, expect, beforeAll } from 'vitest'
import { nodeRegistry, facetRegistry } from '@statdash/react/engine'
import type { ObjectMeta, PropField, PropSchema } from '@statdash/react/engine'
import { setupCanvasRegistry } from '../canvas/setupCanvasRegistry'
import { registerBuiltinFacets } from './facets/builtinFacets'
import { planesForRole, filterSchemaByPlanes } from './plane'
import {
  CONCERN_ORDER, CONCERN_LABELS, CONCERN_OPEN_BY_DEFAULT, DEFAULT_CONCERN,
  concernOfField, concernOfFacet, bucketByConcern, applicableFacets, type FieldConcern,
} from './concern'

beforeAll(() => {
  setupCanvasRegistry()      // real plugin metas (kpi / chart / table / geograph)
  registerBuiltinFacets()    // the 5 universal facets
})

const CONCERNS = new Set<FieldConcern>(CONCERN_ORDER)
const meta = (type: string) => nodeRegistry.getMeta(type) as ObjectMeta | undefined
const authorSchema = (type: string): PropSchema =>
  filterSchemaByPlanes(nodeRegistry.getSchema(type) ?? [], planesForRole('author'))

describe('FF-CONCERN-GROUPED — the concern taxonomy', () => {
  it('is exactly the five canonical concerns, in canonical order', () => {
    expect(CONCERN_ORDER).toEqual(['content', 'data', 'style', 'layout', 'behavior'])
    // Every concern carries a bilingual label + a defined open-default membership.
    for (const c of CONCERN_ORDER) {
      const l = CONCERN_LABELS[c] as Record<string, string>
      expect(l.en, `${c} label`).toBeTruthy()
      expect(l.ka, `${c} ka label`).toBeTruthy()
    }
    // Progressive disclosure: the primary concerns (what it says + means) open by default.
    expect(CONCERN_OPEN_BY_DEFAULT.has('content')).toBe(true)
    expect(CONCERN_OPEN_BY_DEFAULT.has('data')).toBe(true)
    expect(CONCERN_OPEN_BY_DEFAULT.has('style')).toBe(false)
  })

  it('concernOfField: an untagged field defaults to CONTENT (never lost/orphaned)', () => {
    expect(concernOfField({ field: 'x', type: 'string', label: { en: 'X' } })).toBe('content')
    expect(DEFAULT_CONCERN).toBe('content')
    expect(concernOfField({ field: 'y', type: 'number', label: { en: 'Y' }, concern: 'layout' }))
      .toBe('layout')
  })
})

describe('FF-CONCERN-GROUPED — every field lands in exactly one concern (no orphan)', () => {
  // The invariant sweep — over EVERY real registered node schema, not just the reference
  // four: every author-plane field resolves to a concern IN the canonical taxonomy. With
  // the CONTENT default this can never orphan, which is the point — the flat dump is gone.
  it('no author-plane field of any registered node escapes the taxonomy', () => {
    const types = nodeRegistry.types()
    for (const type of types) {
      for (const f of authorSchema(type)) {
        expect(CONCERNS.has(concernOfField(f)), `${type}.${f.field} → ${concernOfField(f)}`).toBe(true)
      }
    }
  })

  it('the reference types distribute across MULTIPLE concerns (organized, not mushed)', () => {
    // chart is the richest reference — it must span CONTENT + DATA + STYLE + LAYOUT.
    const chartConcerns = new Set(authorSchema('chart').map(concernOfField))
    for (const expected of ['content', 'data', 'style', 'layout'] as FieldConcern[]) {
      expect(chartConcerns.has(expected), `chart missing ${expected}`).toBe(true)
    }
    // geograph carries a BEHAVIOR field (multiSelect/maxSelect) + DATA cartography.
    const geoConcerns = new Set(authorSchema('geograph').map(concernOfField))
    expect(geoConcerns.has('behavior')).toBe(true)
    expect(geoConcerns.has('data')).toBe(true)
  })

  it('the reference field assignment is the canon (a spot-check of the mapping)', () => {
    const findAcross = (type: string, name: string): PropField | undefined =>
      (nodeRegistry.getSchema(type) ?? []).find((f) => f.field === name)
    expect(findAcross('chart', 'data.query.measure')?.concern).toBe('data')
    expect(findAcross('chart', 'chartType')?.concern).toBe('style')
    expect(findAcross('chart', 'label')?.concern).toBe('content')
    expect(findAcross('chart', 'height')?.concern).toBe('layout')
    expect(findAcross('geograph', 'multiSelect')?.concern).toBe('behavior')
    expect(findAcross('geograph', 'geoJsonUrl')?.concern).toBe('data')
  })
})

describe('FF-CONCERN-GROUPED — facets bucket by their declared concern', () => {
  it('each universal facet maps to a concern in the taxonomy (none defaults by accident)', () => {
    const expected: Record<string, FieldConcern> = {
      data: 'data', style: 'style', chrome: 'layout', visibility: 'behavior', events: 'behavior',
    }
    for (const facet of facetRegistry.list()) {
      expect(CONCERNS.has(concernOfFacet(facet.id)), facet.id).toBe(true)
      if (expected[facet.id]) expect(concernOfFacet(facet.id), facet.id).toBe(expected[facet.id])
    }
  })

  it('a chart buckets its DATA/STYLE facets into DATA/STYLE, EVENTS into BEHAVIOR (author lens)', () => {
    const m = meta('chart')!
    const facets = applicableFacets(m, 'author')      // author lens (no steward visibility facet)
    const buckets = bucketByConcern(authorSchema('chart'), facets)
    // STYLE concern holds the style facet + the chart's style fields (chartType, …).
    expect(buckets.get('style')?.facets.some((f) => f.id === 'style')).toBe(true)
    // DATA concern holds the data facet + the metric field.
    expect(buckets.get('data')?.facets.some((f) => f.id === 'data')).toBe(true)
    // EVENTS → BEHAVIOR.
    expect(buckets.get('behavior')?.facets.some((f) => f.id === 'events')).toBe(true)
    // The steward-plane VISIBILITY facet is NOT on the author surface (plane lens intact).
    expect(buckets.get('behavior')?.facets.some((f) => f.id === 'visibility')).toBe(false)
  })
})

describe('FF-CONCERN-GROUPED — an empty concern self-drops', () => {
  it('a node with no field/facet in a concern produces no bucket for it', () => {
    // kpi-strip's whole-node schema is `items` (content) only; its data/style/events come
    // from facets. With NO layout field and NO layout facet, LAYOUT must be absent.
    const m = meta('kpi-strip')!
    const buckets = bucketByConcern(authorSchema('kpi-strip'), applicableFacets(m, 'author'))
    const layout = buckets.get('layout')
    expect(!layout || (layout.fields.length === 0 && layout.facets.length === 0)).toBe(true)
  })
})
