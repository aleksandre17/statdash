// @vitest-environment node
//
// ── FF-ONE-MAP-ENGINE — one choropleth engine, no rival ───────────────────────
//
//  Two rival choropleth engines once coexisted: the registered `panels/map` node
//  (mapColorUtils.buildColorScale → a placeholder table) and the live `geograph`
//  node (styles/choropleth + a map renderer). AR-12/RX-16 retired `panels/map`
//  entirely; `geograph` is the sole map engine (C4-a).
//
//  This fitness fails the build if the `panels/map` namespace resurfaces — no
//  directory, no importer, no second value→fill implementation, exactly one map
//  renderer — and pins the flat-map invariant (C4-c): N warm regions produce a
//  multi-bucket ramp, and warm rows change the fill map so the choropleth repaints
//  instead of reading flat.
//
//  The renderer is now a DECLARATIVE d3-geo SVG choropleth (the Leaflet map was
//  retired — imperative DOM measurement blanked the map when a selection changed
//  while the container was display:none; five patches failed). This guard also
//  pins that no react-leaflet renderer has crept back in.
//
//  node env → cssVar returns the un-themed fallback → the ramp is deterministic.

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { choroplethColors } from '../nodes/geograph/default/components/choropleth'
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

// ── (b) exactly one map engine — the declarative SVG choropleth ───────────────

describe('FF-ONE-MAP-ENGINE — geograph is the sole choropleth', () => {
  it('no source file imports react-leaflet (the Leaflet renderer is fully retired)', () => {
    const leaflet = FILES.filter(f => /from ['"]react-leaflet['"]|from ['"]leaflet['"]/.test(readFileSync(f, 'utf8')))
    expect(leaflet.map(f => f.replace(PLUGINS_ROOT, ''))).toEqual([])
  })

  it('exactly one source file renders the SVG choropleth (geograph — the only <svg> map)', () => {
    // `<svg` + a projected `<path` is the renderer's unique signature: the projection
    // module and the fitness tests reference projectChoropleth by name but emit no SVG.
    const svg = FILES.filter(f => {
      const src = readFileSync(f, 'utf8')
      return /<svg/.test(src) && /projectChoropleth/.test(src)
    })
    expect(svg.map(f => f.replace(PLUGINS_ROOT, ''))).toHaveLength(1)
    expect(svg[0]).toMatch(/geograph/)
  })

  it('the projection is a single pure d3-geo implementation (one projectChoropleth def)', () => {
    const defs = FILES.filter(f => /export function projectChoropleth/.test(readFileSync(f, 'utf8')))
    expect(defs).toHaveLength(1)
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

  it('late-arriving rows change the fill map (React repaints every path, not flat)', () => {
    // Async store: geometry renders on empty rows, warm rows arrive after. The fill
    // map MUST differ between the two so a React re-render repaints every <path fill>
    // (the SVG choropleth needs no layer-remount key — that was Leaflet machinery).
    const empty = choroplethColors([])
    const warm  = choroplethColors(WARM_ROWS)
    expect(warm.size).not.toBe(empty.size)
    expect(new Set(warm.values()).size).toBeGreaterThan(1)
  })
})
