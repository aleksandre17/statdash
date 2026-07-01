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

  // ── FF-DARK-COMPLETE — the dark theme covers the WHOLE semantic layer ────
  //
  // Root cause this guards: dark mode is a token-OVERRIDE layer. Any semantic
  // color role the dark block does NOT redefine stays frozen at its LIGHT
  // value — a light box / invisible text on a dark page. (The perspective
  // switcher shipped exactly this: bg = --color-surface-frame, never flipped.)
  //
  // Rule: every semantic color role (--color-* / --status-* / --chart-color-*)
  // bound by the default :root theme must be "dark-safe" — either redefined in
  // the dark blocks, OR derived (via var()) exclusively from roles that are
  // themselves dark-safe (transitive; a role that only references --gray-* /
  // --color-surface / etc. inherits the flip for free). A bare hex/rgb literal
  // that is not redefined in dark is NOT dark-safe. This makes "we forgot a
  // dark value" a red test, not a memory note.
  it('FF-DARK-COMPLETE: every semantic color role has a dark value (directly or transitively)', () => {
    const src = readFileSync(cssPath, 'utf8')

    function parseBlockAt(from: number): Map<string, string> {
      const open = src.indexOf('{', from)
      let depth = 0, end = open
      for (let i = open; i < src.length; i++) {
        if (src[i] === '{') depth++
        else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break } }
      }
      const block = src.slice(open + 1, end)
      const map = new Map<string, string>()
      const re = /(--[\w-]+)\s*:\s*([^;]+);/g
      let m: RegExpExecArray | null
      while ((m = re.exec(block)) !== null) map.set(m[1], m[2].trim())
      return map
    }

    const defaultMap = parseBlockAt(src.indexOf(':root'))
    const mediaMap   = parseBlockAt(src.indexOf(':root', src.indexOf('prefers-color-scheme: dark')))
    const attrMap    = parseBlockAt(src.lastIndexOf('[data-theme="dark"]'))
    const darkNames  = new Set<string>([...mediaMap.keys(), ...attrMap.keys()])

    const varRefs = (val: string): string[] => {
      const out: string[] = []
      const re = /var\((--[\w-]+)/g
      let m: RegExpExecArray | null
      while ((m = re.exec(val)) !== null) out.push(m[1])
      return out
    }

    const memo = new Map<string, boolean>()
    function isDarkSafe(name: string, seen = new Set<string>()): boolean {
      if (memo.has(name)) return memo.get(name)!
      if (darkNames.has(name)) return true
      if (seen.has(name)) return false           // cycle → not provably safe
      seen.add(name)
      const val = defaultMap.get(name)
      if (val === undefined) return false
      const refs = varRefs(val)
      if (refs.length === 0) { memo.set(name, false); return false }  // bare literal, frozen
      const safe = refs.every(r => isDarkSafe(r, seen))
      memo.set(name, safe)
      return safe
    }

    const semanticColor = [...defaultMap.keys()].filter(n =>
      /^--color-/.test(n) || /^--status-/.test(n) || /^--chart-color-/.test(n),
    )

    const frozen = semanticColor.filter(n => !isDarkSafe(n))
    if (frozen.length > 0) {
      const list = frozen.sort().map(n => `${n}  (= ${defaultMap.get(n)})`).join('\n  ')
      expect.fail(
        `${frozen.length} semantic color role(s) stay FROZEN at their light value in dark mode:\n\n  ${list}\n\n` +
          `Add a dark value to BOTH dark blocks in tokens.css (the @media prefers-color-scheme:dark ` +
          `and [data-theme="dark"] selectors), or derive the role from one that already flips.`,
      )
    }
    expect(semanticColor.length).toBeGreaterThan(30)   // guard vacuous pass
  })

  // The two dark selectors (system-preference @media + explicit attribute) MUST
  // stay in lockstep — a value added to one and forgotten in the other is a
  // half-dark theme. CSS has no cross-media-boundary DRY, so we assert equality.
  it('FF-DARK-COMPLETE: the @media and [data-theme="dark"] blocks are identical', () => {
    const src = readFileSync(cssPath, 'utf8')
    function parseBlockAt(from: number): Map<string, string> {
      const open = src.indexOf('{', from)
      let depth = 0, end = open
      for (let i = open; i < src.length; i++) {
        if (src[i] === '{') depth++
        else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break } }
      }
      const block = src.slice(open + 1, end)
      const map = new Map<string, string>()
      const re = /(--[\w-]+)\s*:\s*([^;]+);/g
      let m: RegExpExecArray | null
      while ((m = re.exec(block)) !== null) map.set(m[1], m[2].replace(/\s+/g, ' ').trim())
      return map
    }
    const mediaMap = parseBlockAt(src.indexOf(':root', src.indexOf('prefers-color-scheme: dark')))
    const attrMap  = parseBlockAt(src.lastIndexOf('[data-theme="dark"]'))

    const diffs: string[] = []
    for (const [k, v] of mediaMap) {
      if (!attrMap.has(k)) diffs.push(`${k}: in @media but missing from [data-theme="dark"]`)
      else if (attrMap.get(k) !== v) diffs.push(`${k}: @media=${v} vs attr=${attrMap.get(k)}`)
    }
    for (const k of attrMap.keys()) {
      if (!mediaMap.has(k)) diffs.push(`${k}: in [data-theme="dark"] but missing from @media`)
    }
    expect(diffs, `Dark blocks diverged:\n  ${diffs.join('\n  ')}`).toHaveLength(0)
    expect(mediaMap.size).toBeGreaterThan(30)
  })

  // WCAG 2.1 AA in dark mode (Law 9): the key text/surface pairs — including
  // the perspective switcher (secondary text on the --color-surface-frame
  // track) that regressed — must clear 4.5:1 with their DARK values.
  it('FF-DARK-COMPLETE: key control pairs clear WCAG AA contrast in dark mode', () => {
    const src = readFileSync(cssPath, 'utf8')
    const open = src.indexOf('{', src.lastIndexOf('[data-theme="dark"]'))
    let depth = 0, end = open
    for (let i = open; i < src.length; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break } }
    }
    const block = src.slice(open + 1, end)
    const val = (name: string): string => {
      const m = new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{6})`).exec(block)
      if (!m) throw new Error(`dark value for ${name} not a direct hex`)
      return m[1]
    }
    const lin = (c: number): number => {
      const s = c / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    }
    const lum = (hex: string): number => {
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    }
    const contrast = (a: string, b: string): number => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
      return (hi + 0.05) / (lo + 0.05)
    }
    const pairs: [string, string, string][] = [
      ['--color-text-secondary', '--color-surface-frame', 'switcher: unselected tab label on track'],
      ['--color-accent',         '--color-surface',       'switcher: selected tab label'],
      ['--color-text-primary',   '--color-surface',       'body text on page'],
      ['--color-text-secondary', '--color-surface',       'secondary text on page'],
      ['--color-text-primary',   '--color-surface-raised','text on raised card'],
    ]
    const fails = pairs
      .map(([fg, bg, label]) => ({ label, ratio: contrast(val(fg), val(bg)) }))
      .filter(p => p.ratio < 4.5)
    expect(
      fails,
      `Dark-mode contrast < 4.5:1:\n  ${fails.map(f => `${f.label} = ${f.ratio.toFixed(2)}:1`).join('\n  ')}`,
    ).toHaveLength(0)
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
