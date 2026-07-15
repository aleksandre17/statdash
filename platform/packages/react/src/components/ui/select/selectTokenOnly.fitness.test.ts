// @vitest-environment node
//
// ── FF-RADIX-TOKEN-ONLY ──────────────────────────────────────────────────────
//
//  An owned component in components/ui/** is painted by the DTCG token spine and
//  NOTHING else. Concretely:
//    • its CSS references only var(--…) tokens for every color-bearing property —
//      no raw hex / rgb() / hsl() / named color (extends FF-NO-UNTHEMED-COLOR,
//      scoped to the owned foundation so the rule is legible at this seam);
//    • its .tsx carries NO CSS-in-JS coupling — no @emotion import, no `sx=`,
//      no @mui import. State is expressed via Radix data-attributes in CSS, never
//      tracked in React to drive styling.
//
//  Root cause it guards: a raw literal or an `sx` prop cannot flip between
//  light/dark or between tenants — it re-creates the exact styling coupling the
//  MUI→Radix migration exists to remove. Painting only through tokens makes
//  both-mode + multi-tenant correctness STRUCTURAL.
//
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here   = dirname(fileURLToPath(import.meta.url))          // .../components/ui/select
const uiRoot  = join(here, '..')                               // .../components/ui

function filesUnder(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name)
    if (e.isDirectory()) return filesUnder(full, ext)
    return e.name.endsWith(ext) && !e.name.includes('.test.') ? [full] : []
  })
}

// Color-bearing CSS properties (structural px like border-width/radius are fine;
// only COLOR must be a token). Shadows are excluded — a shadow's rgba is an
// effect alpha, not a themed surface color (matches FF-NO-UNTHEMED-COLOR).
const COLOR_PROPS = new Set([
  'color', 'background', 'background-color', 'background-image',
  'border', 'border-color',
  'border-top', 'border-right', 'border-bottom', 'border-left',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'outline', 'outline-color', 'fill', 'stroke',
  'caret-color', 'text-decoration-color', 'column-rule', 'column-rule-color',
])
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\b(white|black|red|green|blue|gray|grey|silver|orange|yellow|purple|navy|teal|gold|crimson|tomato)\b/

describe('FF-RADIX-TOKEN-ONLY — owned components paint only on the token spine', () => {
  const cssFiles = filesUnder(uiRoot, '.css')
  const tsxFiles = filesUnder(uiRoot, '.tsx')

  it('scans a non-empty owned-component surface (guard against a false-green empty scan)', () => {
    expect(cssFiles.length).toBeGreaterThan(0)
    expect(tsxFiles.length).toBeGreaterThan(0)
    expect(cssFiles.some((f) => f.endsWith('Select.css'))).toBe(true)
  })

  it('no color-bearing CSS property uses a raw hex / rgb / hsl / named-color literal', () => {
    const offenders: string[] = []
    for (const file of cssFiles) {
      const src = readFileSync(file, 'utf8')
      const noComments = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      noComments.split('\n').forEach((line, i) => {
        const m = /^\s*([a-z-]+)\s*:\s*([^;]*)/.exec(line)
        if (!m || !COLOR_PROPS.has(m[1].toLowerCase())) return
        const residual = m[2]
          .replace(/var\([^)]*\)/g, '')
          .replace(/(color-mix|light-dark)\([^;]*\)/g, '')
        if (RAW_COLOR.test(residual)) offenders.push(`${file}:${i + 1}  ${line.trim()}`)
      })
    }
    if (offenders.length) {
      expect.fail(
        `${offenders.length} owned-component CSS color(s) are raw literals — route each through a token var(--color-…):\n\n` +
        offenders.join('\n'),
      )
    }
  })

  it('no owned-component .tsx couples to CSS-in-JS (no @emotion, no sx=, no @mui)', () => {
    const offenders: string[] = []
    for (const file of tsxFiles) {
      const src = readFileSync(file, 'utf8')
      src.split('\n').forEach((line, i) => {
        if (/from ['"]@emotion\//.test(line) || /from ['"]@mui\//.test(line) || /\bsx\s*=\s*\{/.test(line)) {
          offenders.push(`${file}:${i + 1}  ${line.trim()}`)
        }
      })
    }
    if (offenders.length) {
      expect.fail(
        `${offenders.length} owned-component styling-coupling site(s) — paint via token CSS + Radix data-attributes, not CSS-in-JS:\n\n` +
        offenders.join('\n'),
      )
    }
  })
})
