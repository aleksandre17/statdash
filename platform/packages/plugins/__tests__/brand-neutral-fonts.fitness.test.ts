// @vitest-environment node
//
// ── brand-neutral-fonts.fitness.test.ts — FF-BRAND-NEUTRAL-FONTS ──────────────
//
//  Enforces that no tenant brand font family name appears in the shared platform
//  packages. After Wave 3 removed all hardcoded brand font names ('BPG Arial',
//  'Noto Sans Georgian', 'Noto Serif Georgian') from packages/, this gate
//  prevents silent regression.
//
//  Brand fonts belong ONLY in apps/ under [data-tenant] — never in packages/.
//  In packages/ use var(--font-family-base) / var(--font-family-display) in CSS,
//  or read the CSS var via getComputedStyle at render time in JS/TS.
//
//  Scope: packages/plugins/** + packages/react/src/** + packages/styles/src/** +
//  packages/charts/src/** + packages/core/src/** (*.css, *.ts, *.tsx)
//
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here          = dirname(fileURLToPath(import.meta.url))   // .../plugins/__tests__
const pluginsRoot   = join(here, '..')                          // .../plugins
const packagesRoot  = join(pluginsRoot, '..')                   // .../packages
const reactSrcRoot  = join(packagesRoot, 'react', 'src')        // .../react/src
const stylesSrcRoot = join(packagesRoot, 'styles', 'src')       // .../styles/src
const chartsSrcRoot = join(packagesRoot, 'charts', 'src')       // .../charts/src
const coreSrcRoot   = join(packagesRoot, 'core', 'src')         // .../core/src

const SCANNED_EXT = ['.css', '.ts', '.tsx']

// Build-output + dependency dirs are never source.
const SKIP_DIRS = new Set(['dist', 'node_modules', '.turbo', 'coverage'])

function isExcluded(file: string): boolean {
  if (/\.test\.[tj]sx?$/.test(file)) return true
  if (/\.stories\.[tj]sx?$/.test(file)) return true
  if (file.endsWith('brand-neutral-fonts.fitness.test.ts')) return true
  return false
}

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

// Brand font family names that must never appear in platform packages.
const BRAND_FONTS = ['BPG Arial', 'Noto Serif Georgian', 'Noto Sans Georgian']

interface FontOffender {
  file:    string
  line:    number
  content: string
}

function findBrandFonts(file: string, src: string): FontOffender[] {
  const offenders: FontOffender[] = []
  const rawLines = src.split('\n')
  for (let i = 0; i < rawLines.length; i++) {
    // Strip line comments — a font name inside `// …` is documentation, not a live reference.
    const stripped = rawLines[i].replace(/\/\/.*$/, '')
    const lower    = stripped.toLowerCase()
    for (const font of BRAND_FONTS) {
      if (lower.includes(font.toLowerCase())) {
        offenders.push({ file, line: i + 1, content: rawLines[i].trim() })
        break // one entry per line is sufficient
      }
    }
  }
  return offenders
}

describe('FF-BRAND-NEUTRAL-FONTS — no tenant brand font family name in platform packages', () => {
  const targets = [
    ...sourceFiles(pluginsRoot),
    ...sourceFiles(reactSrcRoot),
    ...sourceFiles(stylesSrcRoot),
    ...sourceFiles(chartsSrcRoot),
    ...sourceFiles(coreSrcRoot),
  ]

  it('scans a non-empty set of package source files', () => {
    // Guard against a silently-empty scan (wrong path ⇒ false green).
    expect(targets.length).toBeGreaterThan(50)
    expect(targets.some(f => f.endsWith('section.css'))).toBe(true)
    expect(targets.some(f => f.endsWith('DonutChart.tsx'))).toBe(true)
  })

  it('no brand font family name appears in any package source file', () => {
    const offenders: FontOffender[] = []
    for (const file of targets) {
      offenders.push(...findBrandFonts(file, readFileSync(file, 'utf8')))
    }
    if (offenders.length) {
      const lines = offenders.map(o => `${o.file}:${o.line}: ${o.content}`)
      expect.fail(
        `${offenders.length} package file(s) contain hardcoded brand font family names.\n` +
        `Brand fonts belong ONLY in apps/ under [data-tenant] — never in packages/.\n` +
        `Replace with var(--font-family-base) / var(--font-family-display) in CSS,\n` +
        `or read the CSS var via getComputedStyle at render time in JS/TS.\n\n` +
        `Offenders:\n` +
        lines.join('\n'),
      )
    }
  })

  it('the scan reaches the chart component layer (regression anchor)', () => {
    expect(targets.some(f => f.endsWith('DonutChart.tsx'))).toBe(true)
  })
})
