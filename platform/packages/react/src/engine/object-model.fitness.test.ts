// @vitest-environment node
//
// ── object-model.fitness.test.ts — ADR-023 R1 invariants ──────────────
//
//  "One Type System, One Tree, Two Residences." These fitness functions pin the
//  R1 unification so it cannot silently regress:
//
//    FF-ONE-TYPE-SYSTEM        — one ObjectMeta ingestion path; every kind is a
//                                refinement of ObjectMeta; a new kind is a facet,
//                                never a new type registry. (REAL — R1.)
//    FF-KIND-IS-FACET          — kind is a pinned facet; NO sliceType/kind
//                                branching outside the registry-view layer
//                                (renderNode is zero — locked). (REAL — R1.)
//    FF-ONE-COMPOSITION-GRAMMAR — SlotDef is the ONE tree-band composition
//                                grammar; the single known second mechanism
//                                (chrome positional resolution) is allowlisted,
//                                to be folded into SlotDef at R4. (SCAFFOLD — R4.)
//
//  Residence / promotion / facet-reinvention gates live plugins-side (they scan
//  the authoring METAs): object-model-residence.fitness.test.ts.
//

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ObjectRegistry, normalizeObjectIdentity } from './objectRegistry'
import { partFieldsOf } from './slice-meta'
import type {
  ObjectMeta, NodeSliceMeta, PageSliceMeta, PanelSliceMeta,
  ChromeSliceMeta, FilterControlMeta, SlotDef,
} from './slice-meta'
import type { PartField, PartResidence } from './partPort'

const here      = dirname(fileURLToPath(import.meta.url))   // …/packages/react/src/engine
const read      = (f: string): string => readFileSync(resolve(here, f), 'utf8')

// Recursively list engine .ts/.tsx source files (skip tests + fitness files).
function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = resolve(dir, e.name)
    if (e.isDirectory()) return sourceFiles(full)
    if (e.name.includes('.test.') || e.name.includes('.fitness.')) return []
    if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) return [full]
    return []
  })
}

// ── Type-level: every kind is a refinement of the ONE ObjectMeta ──────
//  `Extends<A,B>` is `true` only when A is assignable to B. Forcing the literal
//  `true` makes any kind drifting OUT of ObjectMeta a compile error here.
type Extends<A, B> = [A] extends [B] ? true : false

const _nodeIsObject:    Extends<NodeSliceMeta,    ObjectMeta> = true
const _pageIsObject:    Extends<PageSliceMeta,    ObjectMeta> = true
const _panelIsObject:   Extends<PanelSliceMeta,   ObjectMeta> = true
const _chromeIsObject:  Extends<ChromeSliceMeta,  ObjectMeta> = true
const _controlIsObject: Extends<FilterControlMeta, ObjectMeta> = true

// ── Type-level: illegal-state facets stay literal-pinned (kind-as-facet) ──
const _pageRootPinned:  Extends<PageSliceMeta['rootOnly'], true> = true
const _panelLeafPinned: Extends<Exclude<PanelSliceMeta['canHaveChildren'], undefined>, false> = true

// A page META without the pinned `rootOnly: true` facet is UNREPRESENTABLE.
// @ts-expect-error — page requires rootOnly:true (illegal-state-unrepresentable)
const _badPage: PageSliceMeta = { sliceType: 'page', type: 'x' }
// A panel META that claims children is UNREPRESENTABLE.
// @ts-expect-error — panels are leaves (canHaveChildren pinned false)
const _badPanel: PanelSliceMeta = { sliceType: 'panel', type: 'x', category: 'data', canHaveChildren: true }

void [_nodeIsObject, _pageIsObject, _panelIsObject, _chromeIsObject, _controlIsObject,
  _pageRootPinned, _panelLeafPinned, _badPage, _badPanel]

// ── Sample METAs (one per kind) — synthetic, no plugin import (arrow-clean) ──
const nodeMeta:    NodeSliceMeta    = { sliceType: 'node', type: '__ff_node__', caps: ['children'], slots: { children: { field: 'children', label: 'c', multi: true } } }
const pageMeta:    PageSliceMeta    = { sliceType: 'page', type: '__ff_page__', rootOnly: true }
const panelMeta:   PanelSliceMeta   = { sliceType: 'panel', type: '__ff_panel__', category: 'data', caps: ['data'] }
const chromeMeta:  ChromeSliceMeta  = { sliceType: 'chrome', slot: '__ff_slot__', key: 'default', label: 'H', defaultRegion: 'top', defaultOrder: 10 }
const controlMeta: FilterControlMeta = { sliceType: 'control', controlType: '__ff_control__', label: 'C', dimension: 'time' }

describe('FF-ONE-TYPE-SYSTEM — one ObjectMeta ingestion path, kind is a facet not a registry', () => {
  it('the one registry ingests EVERY kind through a single path', () => {
    const reg = new ObjectRegistry()
    ;[nodeMeta, pageMeta, panelMeta, chromeMeta, controlMeta].forEach(m => reg.register(m))

    // All five residences land in ONE registry, spanning the kind facet.
    expect(reg.kinds().sort()).toEqual(['chrome', 'control', 'node', 'page', 'panel'])
    expect(reg.list()).toHaveLength(5)
  })

  it('normalizes each kind onto the ONE (type, variant) identity spine', () => {
    expect(normalizeObjectIdentity(nodeMeta)).toEqual({ type: '__ff_node__', variant: 'default' })
    expect(normalizeObjectIdentity(chromeMeta)).toEqual({ type: '__ff_slot__', variant: 'default' })
    expect(normalizeObjectIdentity(controlMeta)).toEqual({ type: '__ff_control__', variant: 'default' })
  })

  it('capability discovery is cross-kind over the ONE registry', () => {
    const reg = new ObjectRegistry()
    ;[nodeMeta, panelMeta].forEach(m => reg.register(m))
    expect(reg.getByCapability('data').map(e => e.type)).toEqual(['__ff_panel__'])
    expect(reg.getByCapability('children').map(e => e.type)).toEqual(['__ff_node__'])
  })

  it('registerSlice has EXACTLY ONE unconditional ObjectMeta ingestion, before any kind branch', () => {
    const src = read('registerSlice.ts')
    const ingestions = src.match(/objectRegistry\.register\(/g) ?? []
    expect(ingestions).toHaveLength(1)                                // one ingestion path
    const ingestAt = src.indexOf('objectRegistry.register(')
    const firstKindBranch = src.indexOf('sliceType ===')
    expect(ingestAt).toBeGreaterThan(-1)
    expect(ingestAt).toBeLessThan(firstKindBranch)                    // ingested BEFORE behaviour routing
  })

  it('no NEW per-kind type registry is minted — the engine registry set is frozen', () => {
    // A new kind must be a FACET on ObjectMeta, never a fresh parallel registry.
    // Scans the WHOLE engine tree: the registry classes are exactly the known
    // behaviour stores (node/chrome/control/skeleton/chart/extension) + the ONE
    // ObjectRegistry (the type system). A 4th parallel TYPE registry answering
    // "new kind" (the fragmentation R1 removes) breaks this gate.
    const KNOWN_REGISTRIES = [
      'ChartRendererRegistry', 'ChromeRegistry', 'ExtensionRegistry',
      'FilterControlRegistry', 'NodeRegistry', 'ObjectRegistry', 'SkeletonRegistry',
    ]
    const found = new Set<string>()
    for (const f of sourceFiles(here)) {
      for (const m of readFileSync(f, 'utf8').matchAll(/export class (\w*Registry)\b/g)) found.add(m[1])
    }
    expect([...found].sort()).toEqual(KNOWN_REGISTRIES)
  })
})

describe('FF-KIND-IS-FACET — no kind branching outside the registry-view layer', () => {
  it('renderNode is ZERO kind-branching (locked)', () => {
    const src = read('renderNode.ts')
    expect(src).not.toMatch(/sliceType/)
  })

  it('the ONLY sliceType branching lives in the registry-view layer', () => {
    // slice-meta.ts DECLARES the facet (type defs); registerSlice + objectRegistry
    // are the registry-view layer that maps kind→behaviour/identity. Anywhere else
    // reading `sliceType` at runtime is a kind-privilege smell (Law 1 analogue).
    const engineFiles = ['renderNode.ts', 'resolveChrome.ts', 'NodeRegistry.ts', 'validateNodeConfig.ts']
    for (const f of engineFiles) {
      expect(read(f), `${f} must not branch on sliceType`).not.toMatch(/sliceType/)
    }
    // The permitted homes still name it (declaration + view layer):
    expect(read('slice-meta.ts')).toMatch(/sliceType/)
    expect(read('objectRegistry.ts')).toMatch(/sliceType/)
    expect(read('registerSlice.ts')).toMatch(/sliceType/)
  })
})

describe('FF-ONE-COMPOSITION-GRAMMAR — SlotDef is the one tree-band grammar [SCAFFOLD · flips at R4]', () => {
  it('tree-band composition is expressed as SlotDef', () => {
    // The children mechanism is a declared SlotDef on ObjectMeta.slots — one grammar.
    const slots: Record<string, SlotDef> | undefined = nodeMeta.slots
    expect(slots?.children).toMatchObject({ field: 'children', multi: true })
  })

  it('exactly ONE second composition mechanism remains (chrome positional) — R4 folds it into SlotDef', () => {
    // R1 delivers chrome into the ONE type system (objectRegistry), but chrome
    // still COMPOSES via positional region resolution (resolveChrome), a second
    // grammar. SPEC/MASTER-PLAN sequence chrome-residence to R4 (after SL). This
    // scaffold asserts the second mechanism is the SINGLE known exception — a
    // THIRD bespoke composition path would break it — and flips green (empty) at R4.
    const KNOWN_SECOND_MECHANISMS = existsSync(resolve(here, 'resolveChrome.ts')) ? ['chrome-positional'] : []
    expect(KNOWN_SECOND_MECHANISMS).toEqual(['chrome-positional'])   // R4: becomes []
  })
})

// ── ADR-041 Phase 1 — the Part grammar + Part port (ROOT-2 / ROOT-3) ─────────────
//
//  Synthetic corpus MIRRORING the three real registered shapes (arrow-clean — the
//  engine fitness may not import @statdash/plugins; these reproduce the real metas'
//  containment fragments byte-for-byte in structure):
//    section-like    → slots.children              → residence 'slot'
//    kpi-strip-like  → schema items[] + itemSchema  → residence 'value'
//    filter-bar-like → band.source 'page-filters'   → residence 'sourced'
//  (Confirmed against packages/plugins: section META `slots`, kpi-strip META
//   `schema.items` array+itemSchema, filter-bar META `band:{source:'page-filters'}`.)
//
const sectionLike: NodeSliceMeta = {
  sliceType: 'node', type: '__ff_section__', canHaveChildren: true,
  slots: { children: { field: 'children', label: 'c', accepts: ['chart', 'table', 'kpi-strip'], multi: true } },
}
const kpiStripLike: PanelSliceMeta = {
  sliceType: 'panel', type: '__ff_kpi__', category: 'data',
  schema: [{ field: 'items', type: 'array', label: 'KPI', itemLabel: 'label',
    itemSchema: [{ field: 'label', type: 'string', label: 'L' }] }],
}
const filterBarLike: NodeSliceMeta = {
  sliceType: 'node', type: '__ff_filterbar__',
  band: { source: 'page-filters' },
}
const CORPUS = [sectionLike, kpiStripLike, filterBarLike]

// Type-level: `partFieldsOf` returns the PORT's `PartField[]` — the port type IS the
// sole part-enumeration contract (any drift of the return off the port errors here).
const _returnsPortContract: Extends<ReturnType<typeof partFieldsOf>, PartField[]> = true
void _returnsPortContract

describe('FF-ONE-PART-GRAMMAR — one derivation reads ALL three containment fragments', () => {
  it('enumerates all three residences across the corpus (no fragment left unread)', () => {
    const residences = new Set<PartResidence>(
      CORPUS.flatMap((m) => partFieldsOf(m).map((p) => p.residence)),
    )
    expect([...residences].sort()).toEqual(['slot', 'sourced', 'value'])
  })

  it('section-like `slots` → ONE `slot` part carrying the accepts-gate', () => {
    const parts = partFieldsOf(sectionLike)
    expect(parts).toHaveLength(1)
    expect(parts[0]).toMatchObject({ field: 'children', residence: 'slot', accepts: ['chart', 'table', 'kpi-strip'], multi: true })
  })

  it('kpi-strip-like `items[]`+itemSchema → ONE `value` part carrying the per-item contract', () => {
    const parts = partFieldsOf(kpiStripLike)
    expect(parts).toHaveLength(1)
    expect(parts[0]).toMatchObject({ field: 'items', residence: 'value' })
    expect(parts[0].itemSchema).toEqual([{ field: 'label', type: 'string', label: 'L' }])
  })

  it('filter-bar-like `band` → ONE `sourced` part naming its registered adapter', () => {
    const parts = partFieldsOf(filterBarLike)
    expect(parts).toHaveLength(1)
    expect(parts[0]).toMatchObject({ residence: 'sourced', source: 'page-filters' })
  })

  it('ONE derivation reads ALL three fragments from a SINGLE meta (not one enumerator per grammar)', () => {
    const all: NodeSliceMeta = {
      sliceType: 'node', type: '__ff_all__', canHaveChildren: true,
      slots:  { children: { field: 'children', label: 'c', multi: true } },
      schema: [{ field: 'items', type: 'array', label: 'i', itemSchema: [{ field: 'x', type: 'string', label: 'x' }] }],
      band:   { source: 'page-filters' },
    }
    const byResidence = partFieldsOf(all).reduce<Record<string, number>>(
      (acc, p) => ({ ...acc, [p.residence]: (acc[p.residence] ?? 0) + 1 }), {})
    expect(byResidence).toEqual({ slot: 1, value: 1, sourced: 1 })
  })

  it('an OPAQUE array (no itemSchema — e.g. filter-bar `barIds`) is NOT a value part (BE-1 predicate, verbatim)', () => {
    const opaque: PanelSliceMeta = {
      sliceType: 'panel', type: '__ff_opaque__', category: 'data',
      schema: [{ field: 'barIds', type: 'array', label: 'b' }],
    }
    expect(partFieldsOf(opaque)).toHaveLength(0)
  })

  it('a LEAF declaring no part fields enumerates none — wrapper/leaf is a DERIVED predicate', () => {
    const leaf: PanelSliceMeta = {
      sliceType: 'panel', type: '__ff_leaf__', category: 'data',
      schema: [{ field: 'title', type: 'string', label: 't' }],
    }
    expect(partFieldsOf(leaf)).toHaveLength(0)          // WRAPPER ⇔ partFieldsOf(m).length > 0
  })
})

describe('FF-RESIDENCE-AT-FIELD — residence read from the FIELD, never the node kind', () => {
  const CLOSED: PartResidence[] = ['slot', 'value', 'sourced']

  it('every enumerated PartField carries a residence in the closed set (none omit it)', () => {
    for (const m of CORPUS) {
      for (const p of partFieldsOf(m)) {
        expect(p.residence).toBeDefined()
        expect(CLOSED).toContain(p.residence)
      }
    }
  })

  it('residence is a function of the FRAGMENT — same node kind, different residence', () => {
    // section-like and filter-bar-like are BOTH sliceType 'node'; their residences
    // differ purely by which fragment declares the part (slots vs band). If residence
    // were read from the kind, these would be equal — they must NOT be.
    expect(sectionLike.sliceType).toBe(filterBarLike.sliceType)          // same kind
    expect(partFieldsOf(sectionLike)[0].residence).toBe('slot')          // from the `slots` fragment
    expect(partFieldsOf(filterBarLike)[0].residence).toBe('sourced')     // from the `band` fragment
  })

  it('the SAME fragment yields the SAME residence across DIFFERENT kinds — kind is not read', () => {
    // A slots-bearing 'panel' enumerates 'slot' identically to a slots-bearing 'node':
    // the derivation branches on the FIELD, never on sliceType.
    const panelWithSlots: PanelSliceMeta = {
      sliceType: 'panel', type: '__ff_panelslots__', category: 'data',
      slots: { children: { field: 'children', label: 'c', multi: true } },
    }
    expect(partFieldsOf(panelWithSlots)[0].residence)
      .toBe(partFieldsOf(sectionLike)[0].residence)                      // both 'slot'
  })

  it('the derivation SOURCE reads slots/schema/band only — it names no `sliceType` (BITES guard)', () => {
    const src = read('slice-meta.ts')
    const fn  = src.slice(src.indexOf('export function partFieldsOf'))
    expect(fn).toMatch(/meta\.slots/)                                    // reads the fragment…
    expect(fn).toMatch(/meta\.schema/)
    expect(fn).toMatch(/meta\.band/)
    expect(fn).not.toMatch(/sliceType/)                                  // …never the kind
    expect(fn).not.toMatch(/canHaveChildren/)
  })
})

// ══ THE FENCE — ADR-041 Phase 1.5 · the regression-guard RATCHET (§0.5a) ══════════
//
//  Phase 1 proved the port BEHAVIOURALLY (partFieldsOf reads all three fragments).
//  Phase 1.5 turns the two engine FFs into shrinking-allowlist REGRESSION GUARDS: a
//  meta-assertion (`ALLOWLIST.length <= BASELINE`) fails the build if anyone GROWS an
//  allowlist, and a BITES test proves each guard catches a planted old-shape site (so
//  it is not vacuous). The allowlists can only SHRINK as the migration removes sites.
//
const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

// A PartField CONSTRUCTION — a residence LITERAL assignment (`residence: 'value'`),
// distinct from the port's type DECLARATION (`residence:  PartResidence`, no quote).
// Only a function BUILDING parts constructs these; the port file merely declares them.
const RESIDENCE_LITERAL = /residence:\s*['"](slot|value|sourced)['"]/

describe('FF-ONE-PART-GRAMMAR — RATCHET: partFieldsOf is the SOLE part-field constructor [§0.5a]', () => {
  // The engine has ONE derivation that CONSTRUCTS residence-tagged PartFields. A
  // second engine module building parts (residence literals) is a PARALLEL grammar —
  // the exact regression the port removes. Allowlist = the canonical home only.
  const PART_FIELD_CONSTRUCTORS_ALLOWLIST = ['slice-meta.ts']   // Phase 2 keeps this = 1 (adapters CALL, they don't re-derive)
  const BASELINE = 1

  const constructorFiles = (): string[] =>
    sourceFiles(here)
      .filter((f) => RESIDENCE_LITERAL.test(stripComments(readFileSync(f, 'utf8'))))
      .map((f) => f.split(/[\\/]/).pop()!)
      .sort()

  it('exactly the allowlisted file(s) construct residence-tagged PartFields', () => {
    expect(constructorFiles()).toEqual([...PART_FIELD_CONSTRUCTORS_ALLOWLIST].sort())
  })

  it('META: the allowlist can only SHRINK — a GROWN allowlist fails the build', () => {
    expect(PART_FIELD_CONSTRUCTORS_ALLOWLIST.length).toBeLessThanOrEqual(BASELINE)
  })

  it('BITES: a planted parallel enumerator (a second residence construction) IS caught', () => {
    // A new engine module that builds its own parts — the parallel grammar the port bans.
    const plantedParallelGrammar = `
      export function myOwnPartsReading(meta) {
        return meta.widgets.map((w) => ({ field: w.id, residence: 'value' }))
      }`
    expect(RESIDENCE_LITERAL.test(stripComments(plantedParallelGrammar))).toBe(true)   // caught
    // …and the port's TYPE declaration (no residence literal) does NOT trip it:
    expect(RESIDENCE_LITERAL.test('  residence:  PartResidence')).toBe(false)
    // …nor a mere prose mention after stripping:
    expect(RESIDENCE_LITERAL.test(stripComments("// residence 'value' is the props band"))).toBe(false)
  })
})

// The node-level residence keys the derivation reads: every `if (meta.X)` guard in
// partFieldsOf MINUS the field-collection iterables (`slots`, `schema` — residence-AT-
// FIELD). The remainder are NODE-level residence fragments (the ROOT-2 correction the
// migration is unwinding). Extracted as a PURE function so the BITES test can run it
// on a planted source.
const FIELD_COLLECTIONS = new Set(['slots', 'schema'])
function nodeLevelResidenceKeys(partFieldsOfSrc: string): string[] {
  const keys = new Set<string>()
  for (const m of stripComments(partFieldsOfSrc).matchAll(/if\s*\(\s*meta\.(\w+)\s*\)/g)) {
    if (!FIELD_COLLECTIONS.has(m[1])) keys.add(m[1])
  }
  return [...keys].sort()
}

describe('FF-RESIDENCE-AT-FIELD — RATCHET: exactly ONE grandfathered node-level residence [§0.5a]', () => {
  // Residence is a property of the FIELD (Puck's law). The ONE grandfathered exception
  // is `META.band` (node-level today; Phase 6 moves it onto a field → allowlist []).
  const NODE_LEVEL_RESIDENCE_ALLOWLIST = ['band']   // Phase 6 de-alias → []
  const BASELINE = 1

  // partFieldsOf is the last export in slice-meta.ts; no other `if (meta.X)` guard
  // exists after it, so slicing from its start to EOF captures exactly its guards.
  const partFieldsOfSrc = (): string =>
    read('slice-meta.ts').slice(read('slice-meta.ts').indexOf('export function partFieldsOf'))

  it('the derivation reads exactly the allowlisted node-level residence key(s)', () => {
    expect(nodeLevelResidenceKeys(partFieldsOfSrc())).toEqual([...NODE_LEVEL_RESIDENCE_ALLOWLIST].sort())
  })

  it('META: the allowlist can only SHRINK — a GROWN node-level residence fails the build', () => {
    expect(NODE_LEVEL_RESIDENCE_ALLOWLIST.length).toBeLessThanOrEqual(BASELINE)
  })

  it('BITES: a planted NEW node-level residence (`if (meta.chromeBand)`) IS caught', () => {
    const plantedNewResidence = `
      export function partFieldsOf(meta) {
        if (meta.slots)  { /* field-level, ok */ }
        if (meta.schema) { /* field-level, ok */ }
        if (meta.band)   { parts.push({ residence: 'sourced' }) }
        if (meta.chromeBand) { parts.push({ residence: 'sourced' }) }   // NEW node-level residence
      }`
    const detected = nodeLevelResidenceKeys(plantedNewResidence)
    expect(detected).toContain('chromeBand')                                    // the planted key is seen…
    const offenders = detected.filter((k) => !NODE_LEVEL_RESIDENCE_ALLOWLIST.includes(k))
    expect(offenders).toEqual(['chromeBand'])                                   // …and flagged as NOT grandfathered
  })
})
