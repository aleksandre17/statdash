// @vitest-environment node
//
// ── token-cohesion.fitness.test.ts — FF-TOKEN-ONLY (cohesion gate) ─────────────
//
//  The cohesion invariant of the semantic-token / theming spine
//  (ADR adr_semantic_token_theming_spine §5.1, Pfinal). After the Strangler-Fig
//  tokenization burn-down, NO hardcoded color literal may survive in the shell
//  layers — every shell color references a Tier-2 semantic token (`var(--…)`)
//  or, where var() is invalid (SVG presentation attrs / JS-parsed / Apex config
//  strings), resolves through `cssVar('--token', fallback)`. Cohesion is now
//  STRUCTURAL: a new copy-pasted hex fails the build, it cannot regress by
//  convention. This is the Pfinal flip from warn → ERROR.
//
//  Scope: packages/plugins/** + packages/react/src/** (*.css, *.ts, *.tsx).
//  EXCLUDED: packages/plugins/nodes/geograph/** (a sibling effort owns that dir).
//
//  ALLOWLIST (narrow, each entry commented WHY). It is for non-themeable
//  STRUCTURAL values and genuine data-viz palettes that MUST be literal — never
//  for frozen color debt. A new entry is a deliberate, justified decision.
//
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, sep } from 'node:path'

const here        = dirname(fileURLToPath(import.meta.url))   // .../plugins/nodes/__tests__
const pluginsRoot  = join(here, '..', '..')                   // .../plugins
const reactSrcRoot = join(pluginsRoot, '..', 'react', 'src')  // .../react/src

const SCANNED_EXT = ['.css', '.ts', '.tsx']

// Directories/files that are out of scope for the color gate.
function isExcluded(file: string): boolean {
  // The geograph node dir is owned by a parallel rename effort.
  if (file.includes(`${sep}geograph${sep}`)) return true
  // Test fixtures + Storybook stories are not render shells (sample data colors).
  if (/\.test\.[tj]sx?$/.test(file)) return true
  if (/\.stories\.[tj]sx?$/.test(file)) return true
  if (file.endsWith('.fitness.test.ts')) return true
  return false
}

// ── Per-file allowlist of literal colors that MUST stay concrete ──────────────
//
//  Keyed by the path tail; the value documents WHY each literal is exempt.
const ALLOWED: { tail: string; why: string }[] = [
  {
    tail: join('panels', 'map', 'default', 'mapColorUtils.ts'),
    why:  'DEFAULT_PALETTE: sequential ColorBrewer-Blues choropleth scale fed to ' +
          'Leaflet path fillColor (var() invalid) AND parsed/interpolated in JS ' +
          '(hexToRgb/lerp) — a data-encoding palette, not themeable chrome.',
  },
  {
    tail: join('components', 'PropSchemaForm.tsx'),
    why:  "`<input type=color>` default VALUE ('#000000') — a form data default, " +
          'not a styling color (the swatch the picker shows before a pick).',
  },
]

function allowReason(file: string): string | undefined {
  return ALLOWED.find(a => file.endsWith(a.tail))?.why
}

// ── Token-literal scanner ─────────────────────────────────────────────────────
//
//  Flags: hex colors (#rgb..#rrggbbaa), rgb()/rgba(), hsl()/hsla().
//  Accepts (not a color literal): pure-black overlay rgba(0,0,0,…) shadows
//  (theme-neutral, allowlisted as a class), `transparent`, `currentColor`,
//  the CSS keyword `white`/`black` used inside color-mix, and any `var(--…)` /
//  `cssVar(` reference.
const HEX_RE  = /#[0-9a-fA-F]{3,8}\b/g
const FUNC_RE = /\b(?:rgba?|hsla?)\([^)]*\)/gi

// A black-overlay shadow/scrim — theme-neutral, allowed (not a brandable color).
const BLACK_OVERLAY_RE = /\b(?:rgba?)\(\s*0\s*,\s*0\s*,\s*0\b/i

function offendingLiterals(src: string): string[] {
  const out: string[] = []
  for (const line of src.split('\n')) {
    // Strip cssVar(...) fallbacks and var(...) refs from consideration — the
    // literal inside cssVar('--x', '#hex') is the un-themed fallback, which is
    // the SANCTIONED home for a chart-fill default (it pairs with a token).
    const scrubbed = line.replace(/cssVar\([^)]*\)/g, '')
    for (const m of scrubbed.match(HEX_RE) ?? []) out.push(m)
    for (const m of scrubbed.match(FUNC_RE) ?? []) {
      if (BLACK_OVERLAY_RE.test(m)) continue
      out.push(m)
    }
  }
  return out
}

// Build-output + dependency dirs are never source.
const SKIP_DIRS = new Set(['dist', 'node_modules', '.turbo', 'coverage'])

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) return []
      return sourceFiles(full)
    }
    if (!SCANNED_EXT.some(ext => e.name.endsWith(ext))) return []
    if (isExcluded(full)) return []
    return [full]
  })
}

describe('FF-TOKEN-ONLY — shells carry NO hardcoded color literals (cohesion gate)', () => {
  const targets = [...sourceFiles(pluginsRoot), ...sourceFiles(reactSrcRoot)]

  it('scans a non-empty set of plugin + react-src source files', () => {
    // Guard against a silently-empty scan (wrong path ⇒ false green).
    expect(targets.length).toBeGreaterThan(50)
    expect(targets.some(f => f.endsWith('section.css'))).toBe(true)
    expect(targets.some(f => f.endsWith('DonutChart.tsx'))).toBe(true)
  })

  it('no hex / rgb / hsl color literal survives outside the documented allowlist', () => {
    const offenders: string[] = []
    for (const file of targets) {
      if (allowReason(file)) continue
      const found = offendingLiterals(readFileSync(file, 'utf8'))
      if (found.length) {
        offenders.push(`${file}\n    → ${[...new Set(found)].join(', ')}`)
      }
    }
    if (offenders.length) {
      expect.fail(
        `${offenders.length} shell file(s) still hold hardcoded color literals.\n` +
        `Replace each with a Tier-2 semantic token (var(--color-…) in CSS, or ` +
        `cssVar('--color-…', fallback) where var() is invalid).\n\n` +
        offenders.join('\n'),
      )
    }
  })

  it('the allowlist is narrow and every entry still exists (no stale exemptions)', () => {
    // An allowlisted file must (a) be in the scanned set and (b) actually still
    // contain a literal — otherwise the exemption is dead and should be removed.
    for (const a of ALLOWED) {
      const match = targets.find(f => f.endsWith(a.tail))
      expect(match, `allowlisted file not found in scan: ${a.tail}`).toBeDefined()
      expect(offendingLiterals(readFileSync(match!, 'utf8')).length,
        `allowlist entry no longer needed (no literal present): ${a.tail}`).toBeGreaterThan(0)
    }
    // Keep the allowlist small — color exemptions are a smell, not a budget.
    expect(ALLOWED.length).toBeLessThanOrEqual(4)
  })
})
