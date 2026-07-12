// ── FF-ONE-SELECTION-ADDRESS — the selection triple collapses to ONE address ─────
//
//  ADR-041 Phase 3: the old selection TRIPLE (`selectedNodeId` · `selectedItemPath` ·
//  `chromeSelection`) is no longer three independent store fields. The store exposes
//  ONE `selection` address (the completed ADR-039 Composite address, ADR-041 ROOT-3),
//  and the three legacy reads are pure DERIVATIONS of it (`selectedNodeIdOf` /
//  `selectedItemPathOf` / `chromeSelectionOf`). `selectNode`/`selectItem`/`selectChrome`
//  are named ergonomic constructors of the ONE `select(address)`; because there is ONE
//  address, a new selection inherently clears the prior one (mutual exclusivity by
//  construction). This gate LOCKS that the triple is derived, not independently set.
//
import { describe, it, expect, beforeEach } from 'vitest'
import {
  useConstructorStore,
  selectedNodeIdOf, selectedItemPathOf, chromeSelectionOf,
} from './constructor.store'

const st = () => useConstructorStore.getState()

beforeEach(() => { useConstructorStore.setState({ selection: null }) })

describe('FF-ONE-SELECTION-ADDRESS — the selection triple is ONE derived address (ADR-041 Ph.3)', () => {
  it('exposes exactly ONE `selection` field — the legacy triple is NOT independent state', () => {
    expect('selection' in st()).toBe(true)
    // The three legacy fields are DERIVED, never stored — no independent setter survives.
    expect('selectedNodeId'   in st()).toBe(false)
    expect('selectedItemPath' in st()).toBe(false)
    expect('chromeSelection'  in st()).toBe(false)
  })

  it('selectNode writes a whole-node address; the triple derives node-only', () => {
    st().selectNode('n1')
    expect(st().selection).toEqual({ nodeId: 'n1' })
    expect(selectedNodeIdOf(st().selection)).toBe('n1')
    expect(selectedItemPathOf(st().selection)).toBeNull()
    expect(chromeSelectionOf(st().selection)).toBeNull()
  })

  it('selectItem writes a PART address (owning node + partPath); the node stays pinned', () => {
    st().selectItem('n1', 'items.0')
    expect(st().selection).toEqual({ nodeId: 'n1', partPath: 'items.0' })
    expect(selectedNodeIdOf(st().selection)).toBe('n1')
    expect(selectedItemPathOf(st().selection)).toBe('items.0')
    expect(chromeSelectionOf(st().selection)).toBeNull()
  })

  it('a sourced (filter) part carries its Delta-1 STABLE key as the ONE partPath', () => {
    st().selectItem('fb', 'main.year')   // ${barId}.${controlKey}, not a position
    expect(st().selection).toEqual({ nodeId: 'fb', partPath: 'main.year' })
    expect(selectedItemPathOf(st().selection)).toBe('main.year')
    expect(chromeSelectionOf(st().selection)).toBeNull()
  })

  it('selectChrome writes the chrome arm; the triple derives chrome-only (mutual exclusivity)', () => {
    st().selectNode('n1')
    st().selectChrome({ kind: 'chrome', slot: 'topbar', key: 'default' })
    expect(selectedNodeIdOf(st().selection)).toBeNull()
    expect(selectedItemPathOf(st().selection)).toBeNull()
    expect(chromeSelectionOf(st().selection)).toMatchObject({ slot: 'topbar', key: 'default' })
  })

  it('every wrapper funnels through the ONE address — a new selection clears the prior', () => {
    st().selectChrome({ kind: 'chrome', slot: 'topbar', key: 'default' })
    st().selectItem('n2', 'items.3')
    expect(chromeSelectionOf(st().selection)).toBeNull()
    expect(selectedNodeIdOf(st().selection)).toBe('n2')

    st().select(null)   // the general entry clears everything
    expect(st().selection).toBeNull()
    expect(selectedNodeIdOf(st().selection)).toBeNull()
    expect(selectedItemPathOf(st().selection)).toBeNull()
    expect(chromeSelectionOf(st().selection)).toBeNull()
  })

  it('selectNode(null) clears to the empty address (a whole-node deselect)', () => {
    st().selectItem('n1', 'items.0')
    st().selectNode(null)
    expect(st().selection).toBeNull()
  })
})
