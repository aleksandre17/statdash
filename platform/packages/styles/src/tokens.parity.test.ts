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
