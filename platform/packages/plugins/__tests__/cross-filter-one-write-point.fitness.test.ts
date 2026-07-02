// @vitest-environment node
//
// ── FF-XF-ONE-WRITE-POINT — one selection write point, no bespoke fork ──────
//
//  The recurring cross-filter regression was NON-UNIFORM application: each
//  surface reinvented gesture→filter wiring (only the geograph ever did, as a
//  one-off; charts dropped the branch; tables were silent). The cure is a SINGLE
//  agnostic adapter (useNodeInteractions → the ONE CommandBus write point) that
//  EVERY data shell routes through identically. This fitness makes a second fork
//  structurally impossible:
//
//   1. NO plugin shell emits a `filter:set|setMany|clear` command literal
//      directly — those live ONLY in the react engine (the adapter + the bus
//      wiring). A shell re-implementing selection would reintroduce one → fail.
//   2. NO plugin shell calls `useFilter().set` / `ctx.set(` for a selection —
//      the deprecated direct-write path.
//   3. Every data shell that has a click gesture (chart, table, geograph) DOES
//      route through `useNodeInteractions` (positive assertion — the surface
//      cannot silently drop selection to pass rules 1–2).
//

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname }         from 'node:path'
import { fileURLToPath }         from 'node:url'

const PLUGINS_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SELF = fileURLToPath(import.meta.url)

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

const FILES = sourceFiles(PLUGINS_ROOT)
  .filter(f => f !== SELF && !/\.test\.tsx?$/.test(f))

describe('FF-XF-ONE-WRITE-POINT', () => {
  it('no plugin shell dispatches a filter:* command literal (only the engine adapter may)', () => {
    const offenders = FILES.filter(f => /filter:set|filter:setMany|filter:clear/.test(readFileSync(f, 'utf8')))
      .map(f => f.slice(PLUGINS_ROOT.length + 1))
    expect(offenders).toEqual([])
  })

  it('no plugin shell writes a selection via useFilter().set / ctx.set(', () => {
    const offenders = FILES.filter(f => {
      const src = readFileSync(f, 'utf8')
      return /useFilter\(\)\.set\b/.test(src) || /\bctx\.set\(/.test(src)
    }).map(f => f.slice(PLUGINS_ROOT.length + 1))
    expect(offenders).toEqual([])
  })

  it('every clickable data shell routes through the shared useNodeInteractions adapter', () => {
    const shells = [
      'nodes/geograph/default/GeographShell.tsx',
      'panels/chart/default/useChartInteractions.ts',
      'panels/table/default/TableShell.tsx',
    ]
    for (const rel of shells) {
      const src = readFileSync(join(PLUGINS_ROOT, rel), 'utf8')
      expect(src, `${rel} must route selection through useNodeInteractions`).toMatch(/useNodeInteractions/)
    }
  })
})
