// @vitest-environment node
//
// ── no-privileged-node.fitness.test.ts — FF-NO-PRIVILEGED-NODE [No-Privileged-Node ADR] ──
//
//  Law 1 applied to plugin elements: NO node type is privileged in the engine.
//  Dispatch and traversal flow through the nodeRegistry capabilities, never a
//  `node.type === '<plugin-literal>'` branch. The lone historical violation was
//  navUtils.ts hardcoding 'section' / 'geograph' / 'row'; the capability seam
//  (nav-contributor / nav-transparent + NavContribution) removed it. These
//  fitness functions make the de-privileging UN-REGRESSABLE, mirroring
//  no-tenant-content.fitness.test.ts and presentation.fitness.test.ts (c).
//
//    (a) engine + core contain NO `type === '<plugin-node-literal>'` privilege
//        branch. The scan targets the COMPARISON form against a `type` operand
//        (a dispatch/branch smell) — not bare strings in comments, view-mode
//        enums, cap tokens, or validation corpora (the ADR-audited false
//        positives). ALLOWLIST = ONLY the structural framework page-roots.
//    (b) navUtils.ts references the registry (getCaps / getNavContribution) and
//        names NONE of 'section' / 'row' / 'geograph'. THE load-bearing assertion.
//    (c) a throwaway nav-contributor node registered at runtime is picked up by
//        extractNavSections with ZERO navUtils edit — proves the OCP seam.
//

import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { nodeRegistry }             from './register-all'
import { extractNavSectionsFromChildren } from './navUtils'

const here       = dirname(fileURLToPath(import.meta.url))   // …/packages/react/src/engine
const engineDir  = here
const coreSrcDir = resolve(here, '../../../core/src')        // …/packages/core/src
const navUtils   = resolve(engineDir, 'navUtils.ts')

// Every REGISTERED plugin node-type literal (from packages/plugins/**/meta.ts).
// A privilege branch comparing `type` against any of these in engine/core is the
// smell this FF forbids. Page-roots are listed but allowlisted below.
const PLUGIN_NODE_TYPES = [
  'card', 'chart', 'columns', 'divider', 'gauge', 'geograph', 'grid', 'hero',
  'kpi-strip', 'links', 'map', 'perspective-bar', 'page-header',
  'repeat',
  'section', 'spacer', 'stack', 'stats-carousel', 'table', 'text', 'wrap',
  'filter-bar',
]

// ALLOWLIST — structural framework page-roots ONLY. The engine STRUCTURALLY
// requires a page-tree root discriminant (generatePageConfigSchema PAGE_ROOT_TYPES,
// the types/node.ts page-root union); these are framework vocabulary, not plugin
// node privileges. Each justified.
const PAGE_ROOT_ALLOWLIST = ['inner-page', 'tab-page', 'container-page', 'page']

// Recursively list .ts/.tsx source files (skip tests + this fitness file).
import { readdirSync, existsSync } from 'node:fs'
function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = resolve(dir, e.name)
    if (e.isDirectory()) return sourceFiles(full)
    if (e.name.includes('.test.') || e.name.includes('.fitness.')) return []
    if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) return [full]
    return []
  })
}

// A privilege-branch comparison: `<type-operand> ===|!==|==|!= '<literal>'`
// or the mirror with the literal on the left. The left/right operand must be a
// `type` access (`.type`, `['type']`, `"type"`, or a bare `type` identifier) so
// view-mode enums (`default?: 'chart' | 'table'`), comments, cap-token strings,
// and `prop === 'map'` (an Array-method name on a Proxy) are NOT matched.
function comparisonBranchRegex(literal: string): RegExp {
  const esc = literal.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
  const typeOperand = `(?:\\bnode\\.type|\\.type|\\[['"]type['"]\\]|\\btype)`
  const lit = `['"]${esc}['"]`
  return new RegExp(
    `(?:${typeOperand}\\s*(?:===|!==|==|!=)\\s*${lit})` +
    `|(?:${lit}\\s*(?:===|!==|==|!=)\\s*${typeOperand})`,
  )
}

describe('(a) engine + core carry NO plugin-node-type privilege branch', () => {
  const targets = [...sourceFiles(engineDir), ...sourceFiles(coreSrcDir)]
  const forbidden = PLUGIN_NODE_TYPES.filter(t => !PAGE_ROOT_ALLOWLIST.includes(t))

  it('scans a non-empty set of engine + core source files', () => {
    expect(targets.length).toBeGreaterThan(0)
    expect(targets.some(f => f.endsWith('navUtils.ts'))).toBe(true)
    // Guard against a wrong core path silently scanning nothing (false green).
    expect(sourceFiles(coreSrcDir).length).toBeGreaterThan(0)
  })

  it('contains no `type === \'<plugin-node>\'` dispatch branch', () => {
    const offenders: string[] = []
    for (const file of targets) {
      const src = readFileSync(file, 'utf8')
      const lines = src.split('\n')
      lines.forEach((line, i) => {
        for (const t of forbidden) {
          if (comparisonBranchRegex(t).test(line)) {
            offenders.push(`${file}:${i + 1}: [${t}] ${line.trim()}`)
          }
        }
      })
    }
    expect(offenders).toEqual([])
  })
})

describe('(b) navUtils.ts routes through the registry, names no plugin node type', () => {
  const src = readFileSync(navUtils, 'utf8')

  it('references the capability registry (getCaps / getNavContribution)', () => {
    expect(src).toContain('getCaps')
    expect(src).toContain('getNavContribution')
  })

  it('names NONE of the de-privileged node-type literals', () => {
    for (const lit of ["'section'", "'geograph'", "'row'"]) {
      expect(src).not.toContain(lit)
    }
  })

  it('reads the nav capabilities by token, not by node type', () => {
    // The contributor seam is reached via getNavContribution (which gates on the
    // 'nav-contributor' cap inside the registry); the container seam is the
    // 'nav-transparent' token checked directly in the visitor.
    expect(src).toContain('getNavContribution')
    expect(src).toContain("'nav-transparent'")
  })
})

describe('(c) extractNavSections is a generic visitor — new nav node = ZERO navUtils edit', () => {
  // A throwaway type registered at runtime with the nav-contributor cap. The
  // extractor must pick it up purely from the registry — no navUtils change.
  const FNL_TYPE = '__fitness_nav_leaf__'
  const FNL_CONTAINER = '__fitness_nav_box__'

  beforeEach(() => {
    nodeRegistry.register(FNL_TYPE, 'default', () => null, {
      caps: ['nav-contributor'],
    })
    // A real-DOM container the extractor descends through (nav-transparent),
    // proving descent is also registry-driven (mirrors `row`).
    nodeRegistry.register(FNL_CONTAINER, 'default', () => null, {
      caps: ['nav-transparent'],
    })
  })

  it('emits a section for a freshly-registered nav-contributor node', () => {
    const out = extractNavSectionsFromChildren(
      [{ type: FNL_TYPE, id: 'leaf-1', title: 'Leaf One' } as never],
      'mode',
    )
    expect(out).toEqual([{ id: 'leaf-1', title: 'Leaf One', navMode: undefined }])
  })

  it('honours the NavContribution default reader (anchor overrides id)', () => {
    const out = extractNavSectionsFromChildren(
      [{ type: FNL_TYPE, id: 'leaf-1', anchor: 'anchored', title: 'Leaf One' } as never],
      'mode',
    )
    expect(out[0].id).toBe('anchored')
  })

  it('descends a nav-transparent container into its contributor children', () => {
    const out = extractNavSectionsFromChildren(
      [{
        type:  FNL_CONTAINER,
        items: [{ type: FNL_TYPE, id: 'nested', title: 'Nested' }],
      } as never],
      'mode',
    )
    expect(out).toEqual([{ id: 'nested', title: 'Nested', navMode: undefined }])
  })

  it('skips a node whose type declares no nav capability', () => {
    nodeRegistry.register('__fitness_plain__', 'default', () => null, { caps: [] })
    const out = extractNavSectionsFromChildren(
      [{ type: '__fitness_plain__', id: 'x', title: 'X' } as never],
      'mode',
    )
    expect(out).toEqual([])
  })
})
