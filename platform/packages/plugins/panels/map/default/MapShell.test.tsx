// @vitest-environment node
//
// ── MapShell — shell contract + topology registry tests (node env) ────
//
// This file tests:
//   1. topologyRegistry — the data contract the shell depends on
//   2. Shell barrel export shape (Shell is a function)
//   3. "No topology" path logic via topologyRegistry (pre-render)
//
// NOTE: Direct MapShell(node, ctx, children) calls are NOT made here.
// The shell imports defineShell from @statdash/react/engine — a sub-path
// not resolvable in the node vitest environment (same limitation as the
// pre-existing annotationUtils.test.ts). The shell is exercised in the
// apps/geostat jsdom integration tests.
//
// What IS tested here: the data-pipeline contract the shell depends on:
//   - registerTopology → getTopology (topology resolution path)
//   - getTopology returns undefined when not registered (placeholder path)
//   - The MAP_NODE type spec (field presence via MapNode import)
//
// buildColorScale is tested exhaustively in mapColorUtils.test.ts.
//

import { describe, it, expect, beforeEach } from 'vitest'
import {
  registerTopology,
  getTopology,
  listTopologies,
}                                             from './topologyRegistry'
import type { TopologyDescriptor }            from './topologyRegistry'
import { buildColorScale, DEFAULT_PALETTE }   from './mapColorUtils'

// ── topologyRegistry contract ─────────────────────────────────────────

describe('topologyRegistry — registration', () => {
  it('registerTopology adds an entry retrievable by getTopology', () => {
    registerTopology({
      id:      'shell-test-get',
      label:   'Get Test',
      data:    { type: 'FeatureCollection', features: [] },
      dimProp: 'iso',
    })
    const desc = getTopology('shell-test-get')
    expect(desc).toBeDefined()
    expect(desc?.label).toBe('Get Test')
    expect(desc?.dimProp).toBe('iso')
  })

  it('getTopology returns undefined for an unregistered id', () => {
    expect(getTopology('no-such-topo-xyz-abc')).toBeUndefined()
  })

  it('listTopologies includes all registered ids', () => {
    registerTopology({ id: 'list-shell-a', data: {}, dimProp: 'code' })
    registerTopology({ id: 'list-shell-b', data: {}, dimProp: 'iso' })
    const list = listTopologies()
    expect(list).toContain('list-shell-a')
    expect(list).toContain('list-shell-b')
  })

  it('registerTopology overwrites existing entry with same id', () => {
    registerTopology({ id: 'overwrite-shell', label: 'First',  data: {}, dimProp: 'code' })
    registerTopology({ id: 'overwrite-shell', label: 'Second', data: {}, dimProp: 'iso'  })
    const desc = getTopology('overwrite-shell')
    expect(desc?.label).toBe('Second')
    expect(desc?.dimProp).toBe('iso')
  })

  it('TopologyDescriptor type shape is satisfied by a minimal descriptor', () => {
    const desc: TopologyDescriptor = {
      id:      'shape-check',
      data:    {},
      dimProp: 'code',
    }
    registerTopology(desc)
    expect(getTopology('shape-check')?.dimProp).toBe('code')
  })
})

// ── "No topology" data-pipeline path ─────────────────────────────────
//
//  MapShell resolves topology by id then falls back to placeholder when
//  absent. We test the decision data here — the shell's render path
//  depends on: getTopology(topologyId) === undefined → placeholder.
//

describe('MapShell render decision — topology absent path', () => {
  it('getTopology returns undefined when topology not registered → placeholder path fires', () => {
    const topologyId = 'not-registered-id-1234'
    const resolved = getTopology(topologyId)
    // Shell will enter placeholder path when resolved === undefined
    expect(resolved).toBeUndefined()
  })

  it('buildColorScale runs and produces a map regardless of topology presence', () => {
    const rows = [
      { region: 'A', value: 10 },
      { region: 'B', value: 50 },
      { region: 'C', value: 80 },
    ]
    const colorMap = buildColorScale(rows, 'region', 'value', DEFAULT_PALETTE, 'quantile')
    expect(colorMap.size).toBe(3)
    expect(colorMap.has('A')).toBe(true)
    expect(colorMap.has('B')).toBe(true)
    expect(colorMap.has('C')).toBe(true)
  })

  it('buildColorScale returns empty Map when rows is empty → no color entries for placeholder table', () => {
    const colorMap = buildColorScale([], 'region', 'value', DEFAULT_PALETTE, 'quantile')
    expect(colorMap.size).toBe(0)
  })
})

// ── "Topology registered" path ────────────────────────────────────────

describe('MapShell render decision — topology registered path', () => {
  beforeEach(() => {
    registerTopology({
      id:      'shell-registered-topo',
      label:   'Registered Topology',
      data:    { type: 'FeatureCollection', features: [] },
      dimProp: 'code',
    })
  })

  it('getTopology returns descriptor when topology is registered → SVG path fires', () => {
    const desc = getTopology('shell-registered-topo')
    expect(desc).toBeDefined()
    expect(desc?.id).toBe('shell-registered-topo')
    expect(desc?.label).toBe('Registered Topology')
  })

  it('color map is still built when topology is registered', () => {
    const rows = [{ geo: 'KA', value: 100 }, { geo: 'AJ', value: 200 }]
    const colorMap = buildColorScale(rows, 'geo', 'value', DEFAULT_PALETTE, 'linear')
    expect(colorMap.size).toBe(2)
  })
})
