/**
 * Token parity fitness function — @statdash/styles
 *
 * Invariant: every `var(--*)` reference in `src/tokens/**` must have a
 * matching custom-property definition inside a `:root` block in `src/css/tokens.css`.
 *
 * Why this matters: adding a TS constant without a CSS definition produces a
 * silently broken token — the var resolves to the `initial` value (empty /
 * browser default) at runtime with no TypeScript or build error.
 *
 * This test parses BOTH sides and reports mismatches by name so the developer
 * knows exactly which CSS var to add. It runs in < 10 ms (pure regex over
 * two text files; no bundling).
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve }                        from 'path'
import { describe, it, expect }                 from 'vitest'

const ROOT = resolve(__dirname, '..')

// ── 1. Collect every var(--*) reference from src/tokens/**/*.ts ───────────

function extractVarRefs(filePath: string): string[] {
  const src = readFileSync(filePath, 'utf8')
  const re  = /var\((--[\w-]+)\)/g
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) out.push(m[1])
  return out
}

function walkDir(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      files.push(...walkDir(full))
    } else if (full.endsWith('.ts') && !full.endsWith('.test.ts')) {
      files.push(full)
    }
  }
  return files
}

const tokensDir    = join(ROOT, 'src', 'tokens')
const tokenFiles   = walkDir(tokensDir)
const allVarRefs   = new Set<string>()

for (const f of tokenFiles) {
  for (const v of extractVarRefs(f)) allVarRefs.add(v)
}

// ── 2. Collect every --prop defined in :root blocks of tokens.css ─────────

function extractRootDefinitions(cssPath: string): Set<string> {
  const src    = readFileSync(cssPath, 'utf8')
  const defs   = new Set<string>()

  // Walk each :root { … } block (light + dark); extract all --prop: lines.
  // We collect ALL -- definitions regardless of which :root they're in,
  // because a var defined only in dark mode still needs a light-mode fallback
  // that the parity test would otherwise flag as missing. We only check that
  // the name EXISTS somewhere in tokens.css.
  const propRe = /^\s*(--[\w-]+)\s*:/gm
  let m: RegExpExecArray | null
  while ((m = propRe.exec(src)) !== null) defs.add(m[1])
  return defs
}

const cssPath  = join(ROOT, 'src', 'css', 'tokens.css')
const cssDefs  = extractRootDefinitions(cssPath)

// ── 2b. FF-THEME-COMPLETE — defs from the DEFAULT (:root) theme ONLY ──────
//
// Distinct from the parity check above (which accepts a definition in ANY
// block, incl. dark). FF-THEME-COMPLETE asserts that every Tier-2 SEMANTIC
// role referenced by the token registry is bound by the DEFAULT theme — so an
// un-themed render (no [data-theme], no [data-tenant]) never resolves a role
// to `initial`. A role defined only in the dark/tenant layer would be a
// dangling default; this catches it. (ADR semantic-token spine §5.2, light
// version: P0 asserts default-completeness; FF-TOKEN-ONLY + FF-TENANT-OVERRIDE
// arrive in later phases once shells stop carrying literals.)

function extractDefaultRootDefinitions(cssPath: string): Set<string> {
  const src = readFileSync(cssPath, 'utf8')
  // The first top-level `:root {` block is the default theme. We slice from
  // its opening brace to the matching close (brace-depth walk — robust to the
  // nested-free flat token block) and collect --prop names from that slice.
  const start = src.indexOf(':root')
  const open  = src.indexOf('{', start)
  let depth = 0
  let end   = open
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break } }
  }
  const block = src.slice(open, end)
  const defs  = new Set<string>()
  const propRe = /(--[\w-]+)\s*:/g
  let m: RegExpExecArray | null
  while ((m = propRe.exec(block)) !== null) defs.add(m[1])
  return defs
}

const defaultDefs = extractDefaultRootDefinitions(cssPath)

// Tier-2 semantic color roles the registry references (the shells' contract).
const semanticColorRefs = [...allVarRefs].filter(v => v.startsWith('--color-'))

// ── 3. Assert parity ──────────────────────────────────────────────────────

describe('@statdash/styles — token parity', () => {
  it('every var(--*) reference in src/tokens/** has a matching CSS custom property in tokens.css', () => {
    const missing: string[] = []

    for (const varName of allVarRefs) {
      if (!cssDefs.has(varName)) missing.push(varName)
    }

    if (missing.length > 0) {
      // Sort alphabetically so the error output is deterministic and readable.
      const list = [...missing].sort().join('\n  ')
      expect.fail(
        `${missing.length} CSS custom propert${missing.length === 1 ? 'y' : 'ies'} referenced in TS tokens but missing from tokens.css:\n\n  ${list}\n\nAdd each one to the appropriate :root block in src/css/tokens.css.`,
      )
    }
  })

  it('FF-THEME-COMPLETE: every Tier-2 semantic color role is defined by the default :root theme (no dangling role)', () => {
    const dangling = semanticColorRefs.filter(v => !defaultDefs.has(v))

    if (dangling.length > 0) {
      const list = [...dangling].sort().join('\n  ')
      expect.fail(
        `${dangling.length} semantic color role(s) referenced by the token registry but NOT bound by the default :root theme:\n\n  ${list}\n\n` +
          `Every Tier-2 role must have a brand-neutral default value in the first :root block of tokens.css, so an un-themed render never resolves to \`initial\`. ` +
          `Tenant/dark layers REBIND these roles — they must not be the only definition.`,
      )
    }
    // Guard against the assertion silently passing on an empty set.
    expect(semanticColorRefs.length).toBeGreaterThan(0)
  })

  it('tokens.css defines at least the core token groups (smoke test)', () => {
    const required = [
      '--spacing-md',
      '--font-size-md',
      '--color-text-primary',
      '--color-surface',
      '--chart-color-1',
      '--status-positive-bg',
      '--blur-md',
      '--duration-normal',
      '--easing-ease-out',
    ]
    const absent = required.filter(v => !cssDefs.has(v))
    expect(absent, `Core tokens missing from tokens.css: ${absent.join(', ')}`).toHaveLength(0)
  })
})
