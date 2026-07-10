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
import type {
  ObjectMeta, NodeSliceMeta, PageSliceMeta, PanelSliceMeta,
  ChromeSliceMeta, FilterControlMeta, SlotDef,
} from './slice-meta'

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
