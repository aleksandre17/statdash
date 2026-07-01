// @vitest-environment node
//
// ── no-unthemed-color.fitness.test.ts — FF-NO-UNTHEMED-COLOR ──────────────────
//
//  Every color in a themeable COMPONENT stylesheet must be a design token
//  (var(--…)) — never a raw hex / rgb() / hsl() / named literal. A raw literal
//  cannot flip between light and dark (or between tenants): it is the root cause
//  of the class of defects the perspective switcher exposed (a control that only
//  worked in the mode it was verified in). Routing every color through a token
//  makes both-mode correctness structural — the dark value is chosen ONCE, in
//  tokens.css, and completeness there is guarded by FF-DARK-COMPLETE.
//
//  Scope: component CSS in packages/plugins/** and packages/react/src/**.
//  NOT packages/styles/src/css/** — that is the token DEFINITION site (where hex
//  literals legitimately live) and the chart-fill chain, out of this gate.
//
//  Allowed raw literals: box-shadow / text-shadow / filter (shadow effects, not
//  surface color) are excluded properties; and `transparent` / `currentColor` /
//  `inherit` / `none` keywords are theme-neutral. Everything else in a color-
//  bearing property must be a var() or a color-mix()/light-dark() over vars.
//
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here         = dirname(fileURLToPath(import.meta.url))     // .../plugins/__tests__
const pluginsRoot  = join(here, '..')                            // .../plugins
const packagesRoot = join(pluginsRoot, '..')                     // .../packages
const reactSrcRoot = join(packagesRoot, 'react', 'src')          // .../react/src

const SKIP_DIRS = new Set(['dist', 'node_modules', '.turbo', 'coverage'])

function cssFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name)
    if (e.isDirectory()) return SKIP_DIRS.has(e.name) ? [] : cssFiles(full)
    return e.name.endsWith('.css') ? [full] : []
  })
}

// Color-bearing properties. SHADOW properties (box-shadow/text-shadow/filter)
// are intentionally absent — a shadow's rgba is an effect alpha, not a themed
// surface color, and reads correctly dark-on-dark.
const COLOR_PROPS = new Set([
  'color', 'background', 'background-color', 'background-image',
  'border', 'border-color',
  'border-top', 'border-right', 'border-bottom', 'border-left',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'outline', 'outline-color', 'fill', 'stroke',
  'caret-color', 'text-decoration-color', 'column-rule', 'column-rule-color',
])

// A raw color literal: hex, rgb/rgba, hsl/hsla, or the CSS named colors that
// commonly slip in. (We do not enumerate all 148 names — these are the ones a
// developer actually types by hand.)
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\b(white|black|red|green|blue|gray|grey|silver|orange|yellow|purple|navy|teal|gold|crimson|tomato)\b/

interface Offender { file: string; line: number; prop: string; content: string }

function scan(file: string, src: string): Offender[] {
  const out: Offender[] = []
  // Strip block comments so a hex inside /* … */ is not a live reference.
  const noComments = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  const lines = noComments.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = /^\s*([a-z-]+)\s*:\s*([^;]*)/.exec(line)
    if (!m) continue
    const prop = m[1].toLowerCase()
    if (!COLOR_PROPS.has(prop)) continue
    // Remove every var()/color-mix()/light-dark() reference — what THEY resolve
    // to is a token's job. Whatever raw literal remains is unthemed.
    const residual = m[2].replace(/var\([^)]*\)/g, '').replace(/(color-mix|light-dark)\([^;]*\)/g, '')
    if (RAW_COLOR.test(residual)) {
      out.push({ file, line: i + 1, prop, content: src.split('\n')[i].trim() })
    }
  }
  return out
}

describe('FF-NO-UNTHEMED-COLOR — component CSS colors are tokens, never raw literals', () => {
  const targets = [...cssFiles(pluginsRoot), ...cssFiles(reactSrcRoot)]

  it('scans a non-empty set of component CSS files', () => {
    // Guard against a silently-empty scan (wrong path ⇒ false green).
    expect(targets.length).toBeGreaterThan(15)
    expect(targets.some(f => f.endsWith('perspective-bar.css'))).toBe(true)
  })

  it('no color-bearing property uses a raw hex / rgb / hsl / named-color literal', () => {
    const offenders: Offender[] = []
    for (const file of targets) offenders.push(...scan(file, readFileSync(file, 'utf8')))
    if (offenders.length) {
      const lines = offenders.map(o => `${o.file}:${o.line}  [${o.prop}]  ${o.content}`)
      expect.fail(
        `${offenders.length} component CSS color(s) are hardcoded literals — they cannot flip in dark mode:\n\n` +
        lines.join('\n') +
        `\n\nRoute each through a design token: var(--color-…). Add the token (with a dark value) ` +
        `to tokens.css if it does not exist. Shadows (box-shadow/text-shadow/filter) are exempt.`,
      )
    }
  })
})
