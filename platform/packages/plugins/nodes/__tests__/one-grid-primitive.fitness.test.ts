// @vitest-environment node
//
// ── FF-NO-DUP-COLUMN-PRIMITIVE — one grid handwriting ─────────────────────────
//
//  DESIGN-responsive-composition.md §3.2 / P4: there must be exactly ONE grid
//  primitive family — the container-query `columns`/`grid` layout nodes. The
//  legacy `row` node + its viewport-media `.panel-row` grid (hardcoded 1280px
//  collapse) were the divergent second primitive; this fitness makes their
//  retirement un-regressable:
//
//    (a) the `row` node is no longer exported from the layout barrel, and its
//        source folder is gone (no re-introduction of the second node);
//    (b) no shipped (source, non-dist) CSS defines a `.panel-row` grid;
//    (c) no shell references the `panel-row` class.
//
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const HERE         = dirname(fileURLToPath(import.meta.url))
const PLUGINS_ROOT = resolve(HERE, '../..')           // …/packages/plugins
const PACKAGES     = resolve(PLUGINS_ROOT, '..')      // …/packages
const LAYOUT_DIR   = resolve(PLUGINS_ROOT, 'nodes/layout')

// Recursively collect source files (skip build artefacts + node_modules).
function sourceFiles(dir: string, exts: string[]): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap(name => {
    if (name === 'node_modules' || name === 'dist') return []
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return sourceFiles(full, exts)
    return exts.some(e => name.endsWith(e)) ? [full] : []
  })
}

describe('FF-NO-DUP-COLUMN-PRIMITIVE — one grid primitive', () => {

  it('(a) the layout barrel no longer exports a `row` node', () => {
    const barrel = readFileSync(resolve(LAYOUT_DIR, 'index.ts'), 'utf8')
    expect(barrel).not.toMatch(/export\s+\*\s+as\s+row\b/)
  })

  it('(a) the `row` node source folder is gone', () => {
    expect(existsSync(resolve(LAYOUT_DIR, 'row'))).toBe(false)
  })

  it('(b) no source CSS defines a `.panel-row` grid selector', () => {
    // Scan @statdash/react + @statdash/plugins source CSS (dist excluded above).
    // Strip /* … */ comments first — a retirement note that MENTIONS `.panel-row`
    // is not a live selector (the concern is a real rule, not documentation).
    const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')
    const cssFiles = [
      ...sourceFiles(resolve(PACKAGES, 'react/src'), ['.css']),
      ...sourceFiles(resolve(PLUGINS_ROOT), ['.css']),
    ]
    expect(cssFiles.length).toBeGreaterThan(0)
    const offenders = cssFiles.filter(f => /\.panel-row\b/.test(stripComments(readFileSync(f, 'utf8'))))
    expect(offenders).toEqual([])
  })

  it('(c) no shell references the `panel-row` class', () => {
    const shellFiles = [
      ...sourceFiles(resolve(PACKAGES, 'react/src'), ['.tsx', '.ts']),
      ...sourceFiles(resolve(PLUGINS_ROOT, 'nodes'), ['.tsx', '.ts']),
    ].filter(f => !f.includes('.test.') && !f.includes('.fitness.'))
    const offenders = shellFiles.filter(f => /panel-row/.test(readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })

})
