// ── FF-ONE-SELECTION-ADDRESS — the selection collapses to ONE PartAddress (arm 1) ─
//
//  ADR-041 R4 (S6 fold): the selection is ONE `PartAddress` — arm count 1. The old
//  TRIPLE (`selectedNodeId` · `selectedItemPath` · `chromeSelection`) is gone; the two
//  live reads (`selectedNodeIdOf` / `selectedItemPathOf`) are pure DERIVATIONS of the ONE
//  `selection` address. `selectNode`/`selectItem`/`selectChrome` are named ergonomic
//  constructors of the ONE `select(address)`; because there is ONE address, a new
//  selection inherently clears the prior one (mutual exclusivity by construction). CHROME
//  is no longer a distinct species: `selectChrome(slot)` writes the site-frame chrome
//  PartAddress (`{ SITE_FRAME_ID, chrome.<slot> }`), so it flows through the SAME two
//  reads as any part — the `chromeSelectionOf`/`isChromeSelection` projections are retired.
//
import { describe, it, expect, beforeEach } from 'vitest'
import { SITE_FRAME_ID, chromePartPath } from '@statdash/react/engine'
import {
  useConstructorStore,
  selectedNodeIdOf, selectedItemPathOf,
} from './constructor.store'

const st = () => useConstructorStore.getState()

beforeEach(() => { useConstructorStore.setState({ selection: null }) })

describe('FF-ONE-SELECTION-ADDRESS — the selection is ONE derived PartAddress (ADR-041 R4)', () => {
  it('exposes exactly ONE `selection` field — the legacy triple is NOT independent state', () => {
    expect('selection' in st()).toBe(true)
    // The three legacy fields are DERIVED, never stored — no independent setter survives.
    expect('selectedNodeId'   in st()).toBe(false)
    expect('selectedItemPath' in st()).toBe(false)
    expect('chromeSelection'  in st()).toBe(false)
  })

  it('selectNode writes a whole-node address; the reads derive node-only', () => {
    st().selectNode('n1')
    expect(st().selection).toEqual({ nodeId: 'n1' })
    expect(selectedNodeIdOf(st().selection)).toBe('n1')
    expect(selectedItemPathOf(st().selection)).toBeNull()
  })

  it('selectItem writes a PART address (owning node + partPath); the node stays pinned', () => {
    st().selectItem('n1', 'items.0')
    expect(st().selection).toEqual({ nodeId: 'n1', partPath: 'items.0' })
    expect(selectedNodeIdOf(st().selection)).toBe('n1')
    expect(selectedItemPathOf(st().selection)).toBe('items.0')
  })

  it('a sourced (filter) part carries its Delta-1 STABLE key as the ONE partPath', () => {
    st().selectItem('fb', 'main.year')   // ${barId}.${controlKey}, not a position
    expect(st().selection).toEqual({ nodeId: 'fb', partPath: 'main.year' })
    expect(selectedItemPathOf(st().selection)).toBe('main.year')
  })

  it('selectChrome writes the site-frame chrome PART address — NO `kind` arm (S6 fold)', () => {
    st().selectNode('n1')
    st().selectChrome('InnerSidebar')
    // Chrome is a `PartAddress`: the site-frame nodeId + `chrome.<slot>` path (arm 1).
    expect(st().selection).toEqual({ nodeId: SITE_FRAME_ID, partPath: chromePartPath('InnerSidebar') })
    expect('kind' in (st().selection ?? {})).toBe(false)
    // It flows through the SAME two reads as any part — the node/item projections.
    expect(selectedNodeIdOf(st().selection)).toBe(SITE_FRAME_ID)
    expect(selectedItemPathOf(st().selection)).toBe('chrome.InnerSidebar')
  })

  it('every wrapper funnels through the ONE address — a new selection clears the prior', () => {
    st().selectChrome('AppHeader')
    st().selectItem('n2', 'items.3')
    // The chrome selection is fully replaced (mutual exclusivity by construction).
    expect(st().selection).toEqual({ nodeId: 'n2', partPath: 'items.3' })
    expect(selectedNodeIdOf(st().selection)).toBe('n2')

    st().select(null)   // the general entry clears everything
    expect(st().selection).toBeNull()
    expect(selectedNodeIdOf(st().selection)).toBeNull()
    expect(selectedItemPathOf(st().selection)).toBeNull()
  })

  it('selectChrome(null) clears the selection', () => {
    st().selectChrome('AppFooter')
    st().selectChrome(null)
    expect(st().selection).toBeNull()
  })

  it('selectNode(null) clears to the empty address (a whole-node deselect)', () => {
    st().selectItem('n1', 'items.0')
    st().selectNode(null)
    expect(st().selection).toBeNull()
  })
})
