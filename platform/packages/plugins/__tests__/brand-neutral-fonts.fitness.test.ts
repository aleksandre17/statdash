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
//  The platform's own DEFAULT typeface is a self-hosted, brand-NEUTRAL family
//  (FiraGO — libre OFL-1.1, Latin + Georgian, @font-face in styles/css/fonts.css).
//  That is NOT a tenant brand, so packages/ may name it; this file additionally
//  LOCKS it as the default value of both --font-family roles so no one silently
//  regresses the platform back to a Georgian-less `system-ui` default or swaps
//  in a tenant brand at the token layer.
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

// ── Positive lock: the canonical platform typeface ──────────────────────────
//
//  The neutrality gate above is a NEGATIVE guard (no brand names). This is the
//  POSITIVE half: the platform default MUST be the self-hosted FiraGO super-
//  family, wired at the SSOT (tokens.css) into BOTH font-family roles and
//  actually served via @font-face. Locking the family here means a future edit
//  that drops FiraGO back to a bare `system-ui` (which has no guaranteed
//  Georgian coverage — the very gap this typeface closes) fails as a red test.
//
describe('FF-PLATFORM-TYPEFACE — the canonical brand-neutral family is FiraGO', () => {
  const PLATFORM_FAMILY = 'FiraGO'
  const tokensCss = join(stylesSrcRoot, 'css', 'tokens.css')
  const fontsCss  = join(stylesSrcRoot, 'css', 'fonts.css')

  it('tokens.css leads both --font-family roles with the platform family', () => {
    const css = readFileSync(tokensCss, 'utf8')
    for (const role of ['--font-family-base', '--font-family-display']) {
      const m = css.match(new RegExp(`${role}:\\s*'([^']+)'`))
      expect(m, `${role} must be defined with a quoted leading family`).toBeTruthy()
      expect(m![1]).toBe(PLATFORM_FAMILY)
    }
  })

  it('fonts.css serves the platform family via @font-face with font-display:swap', () => {
    expect(existsSync(fontsCss)).toBe(true)
    const css = readFileSync(fontsCss, 'utf8')
    expect(css).toContain(`font-family: '${PLATFORM_FAMILY}'`)
    expect(css).toContain('font-display: swap')
    // Every weight on the --font-weight-* scale must be present as a face.
    for (const w of ['400', '500', '600', '700']) {
      expect(css, `@font-face weight ${w} missing`).toContain(`font-weight: ${w}`)
    }
  })

  it('the four subset woff2 weights are actually vendored (self-hosted, not CDN)', () => {
    for (const w of ['400', '500', '600', '700']) {
      const file = join(stylesSrcRoot, 'css', 'fonts', `firago-${w}-normal.woff2`)
      expect(existsSync(file), `${file} must be self-hosted in the package`).toBe(true)
    }
  })
})
