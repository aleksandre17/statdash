import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ── Fitness function: NO privileged magic-key reads from generic var bags ──────
//
//  [N-ADR-0029] SiteRenderer.tsx used to reach into the generic
//  `vars: Record<string,unknown>` bag via privileged magic-string keys
//  `vars['_pageColor']` / `vars['_pageCrumbs']` — a Law-1 violation (a privileged
//  dimension over a uniform Record) and a magic-string smell in the shared layer.
//  That presentation concern now lives on the typed `PageConfigBase.presentation`
//  seam (color/crumbs), evaluated through the same evalVarMap machinery.
//
//  This test makes the violation UN-REGRESSABLE: it source-scans the engine
//  (packages/react/src/engine/**) and the pure core (packages/core/src/**) and
//  fails the build the moment any literal-underscore-key read reappears in a
//  generic vars bag — i.e. `vars['_…']` / `vars["_…"]` / `ctx.vars['_…']`.
//
//  ALLOWLIST: a small set of underscore keys are LEGITIMATE structural sentinels
//  (documented in the ADR sibling sweep), not privileged reads from a user bag.
//  They are listed explicitly so the test STATES its intent — any new underscore
//  key read that is not on this list is a regression and must be justified +
//  added here deliberately, never silently.
//
const ALLOWED_UNDERSCORE_KEYS = new Set<string>([
  // Documented page/node schema-version field (N19) — a reserved structural key,
  // analogous to a framework's reserved key, not a read from a generic content bag.
  '_version',
  // Internal computed-field sentinels in pure data transforms (transform/steps.ts,
  // reduce.ts/window.ts) — all with config-overridable field names; not
  // privileged-dimension reads from a user-facing vars bag.
  '_level',
  '_parentId',
  '_grp',
  '__all__',
  '__spacer__',
])

const here = dirname(fileURLToPath(import.meta.url))
// here = packages/react/src/engine
const reactEngineDir = here
const coreSrcDir     = resolve(here, '../../../../core/src')

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = resolve(dir, e.name)
    if (e.isDirectory()) return sourceFiles(full)
    // Skip this fitness test itself (it names the banned keys in prose/strings).
    if (e.name === 'no-magic-vars.fitness.test.ts') return []
    if (e.name.endsWith('.test.ts') || e.name.endsWith('.test.tsx')) return []
    if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) return [full]
    return []
  })
}

/**
 * Strip line (`//`) and block (slash-star) comments so prose that merely MENTIONS
 * a magic key (e.g. the ADR rationale in node.ts) is never treated as a read.
 * Cheap and good-enough for source scanning — not a full TS parser.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')   // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1') // line comments (avoid eating `://` in URLs)
}

// Matches an indexed read of an underscore key off a `vars`/`ctx.vars` bag:
//   vars['_x']  vars["_x"]  ctx.vars['_x']  .vars['_x']
const READ_RE = /\bvars\s*\[\s*['"`](_[A-Za-z0-9_]*)['"`]\s*\]/g

describe('engine has no privileged magic-key reads from generic vars bags', () => {
  const targets = [
    ...sourceFiles(reactEngineDir),
    ...sourceFiles(coreSrcDir),
  ]

  it('scans a non-empty set of engine + core source files', () => {
    // Guard against a silently-empty scan (wrong path ⇒ false green).
    expect(targets.length).toBeGreaterThan(0)
    expect(targets.some((f) => f.endsWith('SiteRenderer.tsx'))).toBe(true)
  })

  it('contains NO `vars[\'_…\']` reads outside the documented allowlist', () => {
    const offenders: string[] = []
    for (const file of targets) {
      const src = stripComments(readFileSync(file, 'utf8'))
      let m: RegExpExecArray | null
      READ_RE.lastIndex = 0
      while ((m = READ_RE.exec(src)) !== null) {
        const key = m[1]
        if (!ALLOWED_UNDERSCORE_KEYS.has(key)) {
          offenders.push(`${file}: vars['${key}']`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('SiteRenderer routes page presentation through the typed seam, not magic vars', () => {
    const siteRenderer = targets.find((f) => f.endsWith('SiteRenderer.tsx'))
    expect(siteRenderer).toBeDefined()
    const src = readFileSync(siteRenderer!, 'utf8')
    // Positive assertion: the typed seam is the source of page color/crumbs.
    expect(src).toContain('page.presentation')
    // Negative assertion: no magic page-key read remains (check raw source incl. comments
    // for the literal read form — a doc comment that mentions it in prose is fine, but the
    // executable `vars['_page…']` read form must be gone).
    const codeOnly = stripComments(src)
    expect(codeOnly).not.toContain("vars['_page")
    expect(codeOnly).not.toContain('vars["_page')
  })

  it('PageConfigBase declares the generic `presentation` seam (registry-projected)', () => {
    const nodeTypes = targets.find((f) => f.endsWith('types/node.ts') || f.endsWith('types\\node.ts'))
    expect(nodeTypes).toBeDefined()
    const src = readFileSync(nodeTypes!, 'utf8')
    expect(src).toContain('presentation?: PagePresentation')
    // [N-ADR-0029 v2] PagePresentation is now a GENERIC bag the projector registry
    // reads — no per-concern fields. The engine never names a presentation key.
    expect(src).toContain('type PagePresentation = Record<')
  })
})
