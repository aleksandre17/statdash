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
//  Scope: packages/plugins/** + packages/react/src/** + packages/charts/src/** +
//  packages/core/src/** (*.css, *.ts, *.tsx) — the WHOLE tree, no dir-level
//  exclusions (only dist/test/story files are out). charts + core are the
//  upstream JS axis: ChartOutput / EngineRow are renderer-agnostic JSON parsed
//  where var() is invalid, so they carry literal wire-seeds — but a tenant BRAND
//  hex must NEVER masquerade as a neutral seed there (the leak this gate now
//  closes). Brand belongs at [data-tenant]/config, never baked into a package.
//
//  ALLOWLIST (narrow, each entry commented WHY). It is for non-themeable
//  STRUCTURAL values and genuine data-viz palettes that MUST be literal — never
//  for frozen color debt. A new entry is a deliberate, justified decision.
//  Entries MAY pin an exact `literals` set: only those values are exempt in that
//  file, so a NEW (e.g. brand) hex slipped beside a sanctioned seed still FAILS
//  (value-aware, not a file-blanket — the gate is no longer value-blind).
//
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here         = dirname(fileURLToPath(import.meta.url))    // .../plugins/nodes/__tests__
const pluginsRoot   = join(here, '..', '..')                    // .../plugins
const packagesRoot  = join(pluginsRoot, '..')                   // .../packages
const reactSrcRoot  = join(packagesRoot, 'react', 'src')        // .../react/src
const chartsSrcRoot = join(packagesRoot, 'charts', 'src')       // .../charts/src (JS axis)
const coreSrcRoot   = join(packagesRoot, 'core', 'src')         // .../core/src   (JS axis)

const SCANNED_EXT = ['.css', '.ts', '.tsx']

// Directories/files that are out of scope for the color gate.
function isExcluded(file: string): boolean {
  // Test fixtures + Storybook stories are not render shells (sample data colors).
  if (/\.test\.[tj]sx?$/.test(file)) return true
  if (/\.stories\.[tj]sx?$/.test(file)) return true
  if (file.endsWith('.fitness.test.ts')) return true
  return false
}

// ── Per-file allowlist of literal colors that MUST stay concrete ──────────────
//
//  Keyed by the path tail; the value documents WHY each literal is exempt.
//  `literals` (optional): the EXACT set of values exempt in that file. When set,
//  any OTHER literal in the file still fails — so a brand hex cannot ride in
//  beside a sanctioned seed. Omit `literals` for a whole-file exemption.
type AllowEntry = { tail: string; why: string; literals?: string[] }

const ALLOWED: AllowEntry[] = [
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
  {
    tail: join('charts', 'src', 'colors.ts'),
    why:  'Renderer-agnostic ChartOutput is JSON parsed where var() is invalid ' +
          '(SVG attrs / JS color math). These are the neutral series-grey + the ' +
          'semantic action-red wire-seeds, named once (DRY/SSOT). The themed ' +
          'ACCENT is NOT seeded here — it resolves via --color-accent at the apex ' +
          'render layer; a tenant brand hex in this file is a leak and FAILS.',
    literals: ['#6B7B8D', '#E53E3E'],
  },
  {
    tail: join('core', 'src', 'registry', 'resolvers.ts'),
    why:  'Growth-sign +/- semantic encoding colors emitted onto EngineRow JSON ' +
          '(var() invalid). Universal up/down data semantics, not tenant brand. ' +
          'Follow-up: promote to a named core color SSOT (out of this wave’s lane).',
    literals: ['#00A896', '#E76F51'],
  },
]

function allowedFor(file: string): AllowEntry | undefined {
  return ALLOWED.find(a => file.endsWith(a.tail))
}

// Literals in `file` that are NOT covered by its allowlist entry (if any).
function unallowedLiterals(file: string, src: string): string[] {
  const found = offendingLiterals(src)
  const entry = allowedFor(file)
  if (!entry) return found
  if (!entry.literals) return []                  // whole-file exemption
  const ok = new Set(entry.literals.map((s) => s.toLowerCase()))
  return found.filter((lit) => !ok.has(lit.toLowerCase()))
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
  for (const rawLine of src.split('\n')) {
    // Strip line comments first — a hex inside `// …` is documentation (e.g. a
    // colorStops example), never a render color. Doc hex must not fail the gate.
    const line = rawLine.replace(/\/\/.*$/, '')
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
  const targets = [
    ...sourceFiles(pluginsRoot),
    ...sourceFiles(reactSrcRoot),
    ...sourceFiles(chartsSrcRoot),
    ...sourceFiles(coreSrcRoot),
  ]

  it('scans a non-empty set of plugins + react + charts + core source files', () => {
    // Guard against a silently-empty scan (wrong path ⇒ false green).
    expect(targets.length).toBeGreaterThan(50)
    expect(targets.some(f => f.endsWith('section.css'))).toBe(true)
    expect(targets.some(f => f.endsWith('DonutChart.tsx'))).toBe(true)
    // The JS axis (charts + core) is now in scope — assert each is reached so the
    // brand-leak class (#0080BE in charts) cannot hide in an unscanned package.
    expect(targets.some(f => f.endsWith(join('charts', 'src', 'colors.ts')))).toBe(true)
    expect(targets.some(f => f.endsWith(join('core', 'src', 'registry', 'resolvers.ts')))).toBe(true)
  })

  it('no hex / rgb / hsl color literal survives outside the documented allowlist', () => {
    const offenders: string[] = []
    for (const file of targets) {
      const found = unallowedLiterals(file, readFileSync(file, 'utf8'))
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
      const present = offendingLiterals(readFileSync(match!, 'utf8'))
      expect(present.length,
        `allowlist entry no longer needed (no literal present): ${a.tail}`).toBeGreaterThan(0)
      // Literal-scoped entry: every pinned value must still exist, else it is a
      // stale exemption (and a removed value could silently re-open the gate).
      if (a.literals) {
        const have = new Set(present.map((s) => s.toLowerCase()))
        for (const lit of a.literals) {
          expect(have.has(lit.toLowerCase()),
            `stale literal exemption — ${lit} no longer in ${a.tail}`).toBe(true)
        }
      }
    }
    // Keep the allowlist small — color exemptions are a smell, not a budget.
    expect(ALLOWED.length).toBeLessThanOrEqual(4)
  })
})
