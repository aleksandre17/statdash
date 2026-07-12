// ── FF-CAPABILITY-ACCEPTS — the composition grammar is a GRAMMAR, not a widened list ──
//
//  The root fix for the owner's "a blank page can only hold a section": what nests in
//  what is now derived from CAPABILITIES (the HTML5 content-model grammar), not a
//  hand-maintained `slots.accepts` type list. A container declares the content CATEGORY
//  it admits (`SlotDef.acceptsCaps`); an element is placeable iff it DECLARES that
//  category (`caps`). The membership reading is ONE pure predicate, `slotAdmits`.
//
//  This gate proves the OCP property (the twin of the ADR-041 table-columns proof): a
//  NEW content block is placeable in a section by DECLARING `flow` ALONE — with ZERO edit
//  to the section (or any container). Adding `flow` makes it placeable; removing it makes
//  it homeless. The container is never touched — the mechanism is unchanged, only the new
//  element's declaration differs.
//
import { describe, it, expect, beforeAll } from 'vitest'
import { nodeRegistry, slotAdmits } from '@statdash/react/engine'
import { setupCanvasRegistry } from './setupCanvasRegistry'
import { nestAccepts } from './insertNode'

// A minimal inert shell — the grammar reads META (caps), never the renderer.
const inertShell = () => null

beforeAll(() => {
  setupCanvasRegistry()
  // Two brand-new blocks registered AFTER section — NO edit to section's meta. Their ONLY
  // difference is the declared placement capability.
  nodeRegistry.register('ff-flow-widget',  'default', inertShell, { category: 'content', caps: ['flow'] })
  nodeRegistry.register('ff-inert-widget', 'default', inertShell, { category: 'content', caps: [] })
})

describe('FF-CAPABILITY-ACCEPTS — slotAdmits: the ONE pure content-model predicate', () => {
  it('an OPEN slot (no accepts, no acceptsCaps) admits any child', () => {
    expect(slotAdmits({}, { type: 'anything', caps: [] })).toBe(true)
  })

  it('a capability slot admits a child that DECLARES the category, rejects one that does not', () => {
    const flowSlot = { acceptsCaps: ['flow'] }
    expect(slotAdmits(flowSlot, { type: 'x', caps: ['flow'] })).toBe(true)
    expect(slotAdmits(flowSlot, { type: 'y', caps: ['data'] })).toBe(false)
    expect(slotAdmits(flowSlot, { type: 'z', caps: [] })).toBe(false)
  })

  it('an identity slot (accepts type list) still gates by type — Strangler back-compat', () => {
    const typeSlot = { accepts: ['table'] }
    expect(slotAdmits(typeSlot, { type: 'table', caps: [] })).toBe(true)
    expect(slotAdmits(typeSlot, { type: 'chart', caps: ['flow'] })).toBe(false)
  })

  it('accepts ∪ acceptsCaps compose as a DISJUNCTION (either path admits)', () => {
    const both = { accepts: ['special'], acceptsCaps: ['flow'] }
    expect(slotAdmits(both, { type: 'special', caps: [] })).toBe(true)      // by identity
    expect(slotAdmits(both, { type: 'other',   caps: ['flow'] })).toBe(true) // by capability
    expect(slotAdmits(both, { type: 'nope',    caps: ['data'] })).toBe(false)
  })
})

describe('FF-CAPABILITY-ACCEPTS — OCP: a new content block is placeable by DECLARATION alone', () => {
  it('section admits a NEW block that declares `flow` — with ZERO edit to section', () => {
    // ff-flow-widget was registered after section, declaring only caps:['flow'].
    expect(nestAccepts('section', 'ff-flow-widget')).toBe(true)
  })

  it('the SAME-shaped block WITHOUT `flow` is homeless (the declaration is what gates)', () => {
    expect(nestAccepts('section', 'ff-inert-widget')).toBe(false)
  })

  it("section's content slot declares NO concrete `accepts` — it is a pure capability model", () => {
    const slots = nodeRegistry.getSlots('section')!
    const primary = slots.children
    expect(primary.accepts).toBeUndefined()             // the hardcoded type list is GONE
    expect(primary.acceptsCaps).toEqual(['flow'])       // replaced by the content category
  })
})

describe('FF-CAPABILITY-ACCEPTS — the owner\'s felt-list is resolved (blank-page content blocks)', () => {
  // Every formerly-homeless content block now nests in a section BY DECLARING `flow`.
  const FLOW_BLOCKS = ['hero', 'text', 'links', 'card', 'divider', 'spacer', 'stack']
  // Plus the blocks the old hardcoded list already allowed — still admitted (no regression).
  const LEGACY_BLOCKS = ['chart', 'table', 'kpi-strip', 'columns', 'grid', 'wrap', 'geograph', 'gauge']

  it.each([...FLOW_BLOCKS, ...LEGACY_BLOCKS])('section admits `%s` (flow content)', (t) => {
    expect(nestAccepts('section', t)).toBe(true)
  })

  it.each(['page-header', 'filter-bar', 'perspective-bar', 'section', 'repeat'])(
    'section still REJECTS page-structure `%s` (not flow content)', (t) => {
      expect(nestAccepts('section', t)).toBe(false)
    },
  )
})
