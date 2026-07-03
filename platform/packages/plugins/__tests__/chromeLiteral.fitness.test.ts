// ── Fitness — FF-NO-BARE-CHROME-LITERAL (chrome i18n leak-proof gate, AR-37) ────
//
//  THE INVARIANT: no shell renders a hardcoded natural-language string into a
//  user-facing attribute (aria-label / title / placeholder / alt). Such a literal
//  is a raw-string leak — it renders one frozen language on every locale, bypassing
//  the resolve-at-boundary seam (it must be `{t(...)}` / `{resolve(...)}` /
//  `{expr}`, never a `"…"` literal). This is the R2 chrome half of the mixed-locale
//  symptom: nav/switcher/status aria all sat as English literals in shell JSX.
//
//  Structural, so the class cannot recur: a future shell that hardcodes an
//  aria/title/placeholder/alt string fails with the file+line. Because a bound
//  value is written `={…}` (not `="…"`), the gate flags ONLY literal leaks and
//  never a correctly-localized binding.
//
//  Reads the shell source off disk (no render, no DATABASE_URL) — walks the shipped
//  plugins tree, skipping test/story files.

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, relative } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
// packages/plugins/__tests__ → packages/plugins
const PLUGINS_ROOT = resolve(here, '..')

/** Recursively collect shipped .tsx shell/component source (skip tests + stories). */
function collectTsx(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '__tests__') continue
    const full = resolve(dir, entry)
    if (statSync(full).isDirectory()) { collectTsx(full, out); continue }
    if (!entry.endsWith('.tsx')) continue
    if (entry.endsWith('.test.tsx') || entry.endsWith('.stories.tsx')) continue
    out.push(full)
  }
}

// A user-facing attribute assigned a DOUBLE-QUOTED literal that contains a natural-
// language run (≥2 letters). A JSX-expression value (`={…}`) has no leading quote,
// so it never matches — only bare literals are caught.
const CHROME_ATTR_LITERAL = /\b(aria-label|placeholder|alt|title)\s*=\s*"([^"{}]*[A-Za-z]{2,}[^"{}]*)"/g

interface Leak { file: string; attr: string; value: string }

describe('FF-NO-BARE-CHROME-LITERAL — chrome a11y strings resolve through the i18n seam', () => {
  const files: string[] = []
  collectTsx(PLUGINS_ROOT, files)

  it('discovers shell source to defend (guards against an empty walk)', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it('no shell hardcodes a natural-language aria-label / title / placeholder / alt', () => {
    const leaks: Leak[] = []
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(CHROME_ATTR_LITERAL)) {
        leaks.push({ file: relative(PLUGINS_ROOT, file), attr: m[1], value: m[2] })
      }
    }
    const report = leaks
      .map((l) => `  · ${l.file} — ${l.attr}="${l.value}"  → use useT(...) / resolve(...)`)
      .join('\n')
    expect(
      leaks.length,
      `\n${leaks.length} hardcoded chrome literal(s) — route each through the locale seam:\n${report}\n`,
    ).toBe(0)
  })
})
