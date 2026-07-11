// ── FF-NO-EXTERNAL-SPECIAL-CASE — no per-type wire in the generic layers (0057) ──
//
//  ADR-038 The Bounded Element Law: every composer / renderer / authoring surface
//  is a GENERIC mechanism over each element's OWN declaration — it NEVER
//  special-cases a concrete type externally. FF-SCHEMA-COMPLETE already proves the
//  positive ("every element DECLARES its contract"); this is the COMPLEMENTARY gate
//  it lacked (grepped the FF suite — absent): the generic selection / overlay /
//  inspector layers must hold NO concrete-type branch and NO hand-wired value→node
//  projector (the exact reverted anti-pattern `registerNodeProjector('kpi-strip', …)`
//  / `nodeProjection.ts`, work item 0056).
//
//  Two teeth:
//    • NEGATIVE (structural) — the generic-layer sources carry no per-type literal
//      and no projector call; the reverted `nodeProjection` module does not exist.
//    • POSITIVE (behavioural) — value-band selection is DERIVED from the declared
//      `itemSchema` (bandFieldsOf/bandItemsOf), proven both on a synthetic schema
//      (type-agnostic) AND on the REAL registered `kpi-strip` schema.
//
//  Placement note ([[vitest-workspace-dirname]]): source-scanning is done via
//  Vite's `import.meta.glob(?raw)` — the browser module graph, NO `fs`/`__dirname`
//  — so the Vitest-4 workspace-root injection hazard does not apply.
//
import { describe, it, expect, beforeAll } from 'vitest'
import { nodeRegistry } from '@statdash/react/engine'
import type { PropSchema } from '@statdash/react/engine'
import { setupCanvasRegistry } from './setupCanvasRegistry'
import { bandFieldsOf, bandItemsOf } from './bandItems'

beforeAll(() => { setupCanvasRegistry() })

// ── The GENERIC selection / projection layer — must be per-type-free ────────────
//  These files form the machinery the law governs: canvas selection + overlay, the
//  authoring controller, and the schema-driven Inspector + its dock projection.
const GENERIC_SOURCES = import.meta.glob(
  [
    './CanvasOverlay.tsx',
    './CanvasView.tsx',
    './bandItems.ts',
    '../studio/useCanvasController.ts',
    '../inspector/sections/builtins.tsx',
    '../inspector/Inspector.tsx',
    '../inspector/schemaSource.ts',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

// The whole authoring surface — scanned for a hand-wired projector (broader net).
const LAYER_SOURCES = import.meta.glob(
  ['../canvas/**/*.{ts,tsx}', '../studio/**/*.{ts,tsx}', '../inspector/**/*.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

// The reverted anti-pattern module (0056) — must not exist anywhere in the graph.
const PROJECTOR_MODULES = import.meta.glob('../**/nodeProjection*', { eager: true })

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

// A concrete band-owning type as a literal, OR a value→node projector wire. A per-
// type branch (`node.type === 'kpi-strip'`, a `{ 'kpi-strip': … }` map) reaches into
// an element's internals from outside — the exact thing the law forbids.
const EXTERNAL_SPECIAL_CASE =
  /['"]kpi-strip['"]|['"]kpi-card['"]|\bregisterNodeProjector\b|\bnodeProjection\b/

describe('FF-NO-EXTERNAL-SPECIAL-CASE — generic layers hold no per-type wire (ADR-038)', () => {
  it('scans a real, non-trivial set of generic-layer sources (guard is running)', () => {
    expect(Object.keys(GENERIC_SOURCES).length).toBeGreaterThanOrEqual(6)
    expect(Object.keys(LAYER_SOURCES).length).toBeGreaterThanOrEqual(10)
  })

  it('no generic selection/projection source special-cases a concrete type (comments stripped)', () => {
    const offenders = Object.entries(GENERIC_SOURCES)
      .filter(([, src]) => EXTERNAL_SPECIAL_CASE.test(stripComments(src)))
      .map(([path]) => path)
    expect(offenders).toEqual([])
  })

  it('no authoring-layer source hand-wires a value→node projector', () => {
    const offenders = Object.entries(LAYER_SOURCES)
      .filter(([path]) => !path.includes('.test.') && !path.includes('.fitness.'))
      .filter(([, src]) => /\bregisterNodeProjector\b|\bnodeProjection\b/.test(stripComments(src)))
      .map(([path]) => path)
    expect(offenders).toEqual([])
  })

  it('the reverted `nodeProjection` module does not exist (0056 stays reverted)', () => {
    expect(Object.keys(PROJECTOR_MODULES)).toEqual([])
  })

  it('the guard BITES — a planted per-type branch / projector IS detected (not vacuous)', () => {
    expect(EXTERNAL_SPECIAL_CASE.test("if (node.type === 'kpi-strip') { /* … */ }")).toBe(true)
    expect(EXTERNAL_SPECIAL_CASE.test("registerNodeProjector('kpi-strip', { toNode })")).toBe(true)
    // …and a mere comment mention does NOT trip it (prose is allowed after stripping).
    expect(EXTERNAL_SPECIAL_CASE.test(stripComments('// the kpi-strip owns its band'))).toBe(false)
  })

  // ── POSITIVE — band selection is DERIVED from the declared itemSchema ──────────
  it('bandFieldsOf is a pure projection of the declaration — type-agnostic', () => {
    const synthetic: PropSchema = [
      { field: 'title', type: 'string', label: 'Title' },
      { field: 'rows',  type: 'array',  label: 'Rows', itemSchema: [{ field: 'x', type: 'string', label: 'X' }] },
    ]
    // The band is found by its DECLARATION (array + itemSchema), not by any name.
    expect(bandFieldsOf(synthetic).map((f) => f.field)).toEqual(['rows'])
    // A schema that declares NO band yields none — a non-band element is not special-cased.
    expect(bandFieldsOf([{ field: 'title', type: 'string', label: 'Title' }])).toEqual([])
    // Items enumerate generically over any container holding the declared field.
    const items = bandItemsOf({ rows: [{ x: 'a' }, { x: 'b' }] }, synthetic)
    expect(items.map((i) => i.path)).toEqual(['rows.0', 'rows.1'])
    expect(items[0]!.itemSchema).toEqual([{ field: 'x', type: 'string', label: 'X' }])
  })

  it('the REAL kpi-strip declares its value-band via itemSchema — the generic path sees it', () => {
    // The concrete assertion 0057 asks for: `nodeRegistry.getSchema('kpi-strip')`
    // already satisfies the declaration the generic selection reads. This test is the
    // ONLY place a concrete type name is allowed — it is the CONSUMER proving the
    // registry satisfies the law, not a generic layer special-casing it.
    const schema = nodeRegistry.getSchema('kpi-strip')
    expect(schema).toBeTruthy()
    const bands = bandFieldsOf(schema!)
    expect(bands.length).toBeGreaterThanOrEqual(1)
    expect(bands.every((f) => Array.isArray(f.itemSchema) && f.itemSchema.length > 0)).toBe(true)
  })
})
