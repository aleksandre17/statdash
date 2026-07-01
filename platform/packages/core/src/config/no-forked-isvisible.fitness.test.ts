// ── FF-NO-FORKED-ISVISIBLE — one showWhen evaluator + one dot-path reader ────
//
//  THE LAW (DESIGN-authoring-schema-ssot §3/§4 P1 — SSOT + DRY). The meaning of
//  `PropField.showWhen` (when a field is visible) and the meaning of a config
//  dot-path (`view.width`, `fields.0`) each have EXACTLY ONE authoritative body in
//  the whole tree — `packages/core/src/config/{prop-visibility,prop-path}.ts` —
//  re-exported through `@statdash/react/engine`. Before P1 there were TWO byte-
//  identical showWhen parsers (PropSchemaForm + panel showWhen) and FOUR near-
//  identical dot-path readers (one of which, saveGuard's `getAt`, was a
//  structurally-divergent reduce copy). This gate locks that duplication out
//  permanently: any re-fork regresses the build, not a review.
//
//  It scans packages/core + packages/react + apps/panel source (skipping tests,
//  which reference the shapes deliberately) and asserts:
//    • the showWhen `lhs === rhs` parser regex appears in exactly ONE file,
//    • `function getAtPath` / `function setAtPath` are each DECLARED exactly once,
//    • the retired divergent reader `function getAt(` exists nowhere.
//  Re-exports (`export { getAtPath … }`) and call-sites (`getAtPath(x, p)`) are
//  free — only a second *implementation* is forbidden.
//
// @vitest-environment node

import { readFileSync, readdirSync, statSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { describe, it, expect } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const CORE_SRC  = join(HERE, '..')                                       // packages/core/src
const REACT_SRC = join(HERE, '..', '..', '..', 'react', 'src')           // packages/react/src
const PANEL_SRC = join(HERE, '..', '..', '..', '..', 'apps', 'panel', 'src') // apps/panel/src

/** Recursively list .ts/.tsx source files, skipping tests, decls, node_modules/dist. */
function sourceFiles(root: string): string[] {
  let out: string[] = []
  let entries: string[]
  try { entries = readdirSync(root) } catch { return [] }   // dir absent ⇒ skip
  for (const name of entries) {
    const full = join(root, name)
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue
      out = out.concat(sourceFiles(full))
      continue
    }
    if (!/\.(ts|tsx)$/.test(name)) continue
    if (/\.(test|fitness)\./.test(name)) continue          // tests reference the shapes deliberately
    if (name.endsWith('.d.ts')) continue
    out.push(full)
  }
  return out
}

// The distinctive slice of the showWhen parser regex (`/^\s*([\w.]+)\s*===\s*(.+?)\s*$/`).
const SHOWWHEN_PARSER = '([\\w.]+)\\s*===\\s*(.+?)'
const DECL_GETATPATH  = /function\s+getAtPath\s*[(<]/
const DECL_SETATPATH  = /function\s+setAtPath\s*[(<]/
const DECL_DIVERGENT  = /function\s+getAt\s*\(/        // the retired reduce reader

function filesWith(files: string[], pred: (content: string) => boolean): string[] {
  return files.filter((f) => pred(readFileSync(f, 'utf8')))
}

describe('FF-NO-FORKED-ISVISIBLE — the config-semantics SSOT cannot be re-forked', () => {
  const files = [...sourceFiles(CORE_SRC), ...sourceFiles(REACT_SRC), ...sourceFiles(PANEL_SRC)]

  it('scans a non-vacuous body of source across all three trees', () => {
    expect(files.length).toBeGreaterThan(80)
  })

  it('the showWhen `lhs === rhs` parser lives in EXACTLY ONE file', () => {
    const hits = filesWith(files, (c) => c.includes(SHOWWHEN_PARSER))
    expect(hits, `showWhen parser forked into:\n${hits.join('\n')}`).toHaveLength(1)
    expect(hits[0].replace(/\\/g, '/')).toMatch(/config\/prop-visibility\.ts$/)
  })

  it('`getAtPath` is DECLARED exactly once (all else imports it)', () => {
    const hits = filesWith(files, (c) => DECL_GETATPATH.test(c))
    expect(hits, `getAtPath re-implemented in:\n${hits.join('\n')}`).toHaveLength(1)
    expect(hits[0].replace(/\\/g, '/')).toMatch(/config\/prop-path\.ts$/)
  })

  it('`setAtPath` is DECLARED exactly once', () => {
    const hits = filesWith(files, (c) => DECL_SETATPATH.test(c))
    expect(hits, `setAtPath re-implemented in:\n${hits.join('\n')}`).toHaveLength(1)
    expect(hits[0].replace(/\\/g, '/')).toMatch(/config\/prop-path\.ts$/)
  })

  it('the retired divergent reader `function getAt(` exists nowhere', () => {
    const hits = filesWith(files, (c) => DECL_DIVERGENT.test(c))
    expect(hits, `divergent dot-path reader still present in:\n${hits.join('\n')}`).toHaveLength(0)
  })

  it('the gate BITES — synthetic forks are detected', () => {
    expect('const m = /^\\s*([\\w.]+)\\s*===\\s*(.+?)\\s*$/'.includes(SHOWWHEN_PARSER)).toBe(true)
    expect(DECL_GETATPATH.test('function getAtPath(obj: unknown, path: string) {')).toBe(true)
    expect(DECL_DIVERGENT.test('function getAt(obj, path) {')).toBe(true)
  })
})
