// @vitest-environment node
//
// ── FF-ONE-MAP-ENGINE — one choropleth engine, no rival ───────────────────────
//
//  Two rival choropleth engines once coexisted: the registered `panels/map` node
//  (mapColorUtils.buildColorScale → a placeholder table) and the live `geograph`
//  node (real Leaflet + styles/choropleth). AR-12/RX-16 retired `panels/map`
//  entirely; `geograph` is the sole map engine (C4-a).
//
//  This fitness fails the build if the `panels/map` namespace resurfaces — no
//  directory, no importer, no second value→fill implementation, exactly one
//  Leaflet renderer — and pins the flat-map invariant (C4-c): N warm regions
//  produce a multi-bucket ramp, and late-arriving rows change the layer key so
//  the choropleth re-styles instead of reading flat.
//
//  node env → cssVar returns the un-themed fallback → the ramp is deterministic.

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { choroplethColors, choroplethLayerKey } from '../nodes/geograph/default/components/choropleth'
import type { DataRow } from '@statdash/engine'

const PLUGINS_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SELF = fileURLToPath(import.meta.url)

/** Every .ts/.tsx source file under packages/plugins (excludes deps + build out). */
function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full))
    else if (/\.tsx?$/.test(name)) out.push(full)
  }
  return out
}

const FILES = sourceFiles(PLUGINS_ROOT).filter(f => f !== SELF)

// ── (a) the entire panels/map namespace is gone ───────────────────────────────

describe('FF-ONE-MAP-ENGINE — panels/map namespace retired', () => {
  it('the panels/map directory no longer exists', () => {
    expect(existsSync(join(PLUGINS_ROOT, 'panels', 'map'))).toBe(false)
  })

  it('no source file imports or references a panels/map symbol (zero importers)', () => {
    const forbidden = /panels\/map|buildColorScale|mapColorUtils|topologyRegistry|registerTopology/
    const offenders = FILES.filter(f => forbidden.test(readFileSync(f, 'utf8')))
    expect(offenders, `residual panels/map references:\n${offenders.join('\n')}`).toEqual([])
  })
})

// ── (b) exactly one map engine ────────────────────────────────────────────────

describe('FF-ONE-MAP-ENGINE — geograph is the sole choropleth', () => {
  it('exactly one source file renders a Leaflet map (react-leaflet MapContainer)', () => {
    const leaflet = FILES.filter(f => /from ['"]react-leaflet['"]/.test(readFileSync(f, 'utf8')))
    expect(leaflet.map(f => f.replace(PLUGINS_ROOT, ''))).toHaveLength(1)
    expect(leaflet[0]).toMatch(/geograph/)
  })

  it('exactly one value→fill implementation exists (styles/choropleth via ./choropleth)', () => {
    const scaleDefs = FILES.filter(f => /export function choroplethColors/.test(readFileSync(f, 'utf8')))
    expect(scaleDefs).toHaveLength(1)
  })
})

// ── (c) flat-map invariant — N warm regions → N distinct ramp buckets ─────────

// Real Regional-Accounts GDP-by-region spread (GEL mn, 2023), Tbilisi-dominant.
const WARM_ROWS: DataRow[] = ([
  ['GE-TB', 42620.8], ['GE-AJ', 5686.3], ['GE-IM', 5347.1], ['GE-KK', 5072.4],
  ['GE-SZ', 4403.2],  ['GE-KA', 4068.9], ['GE-SK', 3278.5], ['GE-SJ', 2535.7],
  ['GE-MM', 2196.1],  ['GE-GU', 1094.8], ['GE-RL', 278.8],
] as const).map(([id, value]) => ({ id, value } as unknown as DataRow))

describe('FF-ONE-MAP-ENGINE — choropleth is not flat once rows are warm', () => {
  it('assigns a fill to every one of the N regions', () => {
    const colors = choroplethColors(WARM_ROWS)
    expect(colors.size).toBe(WARM_ROWS.length)
  })

  it('N regions span multiple ramp buckets — not one flat color', () => {
    const colors = choroplethColors(WARM_ROWS)
    // >1 bucket is the anti-flat floor; the 5-stop ramp yields several here.
    expect(new Set(colors.values()).size).toBeGreaterThan(1)
    expect(new Set(colors.values()).size).toBeGreaterThanOrEqual(3)
  })

  it('late-arriving rows change the GeoJSON layer key (forces re-style, not flat)', () => {
    // Async store: geometry mounts on empty rows, warm rows arrive after. The layer
    // key MUST differ between the two so react-leaflet re-mounts and repaints.
    const emptyKey = choroplethLayerKey(choroplethColors([]))
    const warmKey  = choroplethLayerKey(choroplethColors(WARM_ROWS))
    expect(warmKey).not.toBe(emptyKey)
  })
})
