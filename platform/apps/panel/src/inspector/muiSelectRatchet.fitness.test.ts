// ── FF-NO-NEW-MUI (Select ratchet) ───────────────────────────────────────────
//
//  The Strangler ratchet for the MUI→Radix migration: the number of MUI `Select`
//  import sites may only go DOWN, never up. A new `import { Select } from
//  '@mui/material'` anywhere in apps/panel fails this gate — new work lands on the
//  OWNED Radix Select (`@statdash/react` → components/ui/select), not on MUI.
//
//  Two invariants:
//    1. The INSPECTOR is now MUI-Select-FREE (count === 0). Wave 0071 retired its
//       last MUI Select (EventsField), swapping it onto the owned Radix Select
//       behind the FieldControlRegistry seam. This is the "goes DOWN" proof.
//    2. App-wide, the count may not exceed the current baseline (the remaining
//       sites are the wave 0072–0074 sweep). Ratchet DOWN as each surface migrates
//       — lower this number, never raise it.
//
//  Reads SOURCE via Vite `?raw` glob (the panel tsconfig omits node:fs types) —
//  it inspects import statements, not the runtime, so it catches a new MUI Select
//  the moment it is typed.
//
import { describe, it, expect } from 'vitest'

// Raw source of every inspector file (this dir) and every panel file (app-wide).
const inspectorSrc = import.meta.glob('./**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const appSrc       = import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

// A file that imports the MUI `Select` NAMED export (exact — not SelectControl,
// not MultiSelect; ignores `as` aliases and drops `type`-only names of others).
const MUI_IMPORT = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["']@mui\/material["']/g

function muiSelectSites(src: Record<string, string>): string[] {
  const out: string[] = []
  for (const [path, code] of Object.entries(src)) {
    if (path.includes('.test.')) continue
    let m: RegExpExecArray | null
    MUI_IMPORT.lastIndex = 0
    while ((m = MUI_IMPORT.exec(code))) {
      const names = m[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0].trim())
      if (names.includes('Select')) { out.push(path); break }
    }
  }
  return out
}

// Ratchet baseline — LOWER as surfaces migrate (waves 0072–0074), NEVER raise.
const APP_WIDE_BASELINE = 12

describe('FF-NO-NEW-MUI — MUI Select sites only ratchet down', () => {
  it('scans a non-empty source set (guard against a false-green empty glob)', () => {
    expect(Object.keys(inspectorSrc).length).toBeGreaterThan(5)
    expect(Object.keys(appSrc).length).toBeGreaterThan(50)
  })

  it('the inspector is MUI-Select-free (wave 0071 retired its last one)', () => {
    const sites = muiSelectSites(inspectorSrc)
    expect(sites, `inspector must have 0 MUI Select imports; found:\n${sites.join('\n')}`).toHaveLength(0)
  })

  it('app-wide MUI Select import count does not exceed the ratchet baseline', () => {
    const sites = muiSelectSites(appSrc)
    expect(
      sites.length,
      `MUI Select sites rose above baseline ${APP_WIDE_BASELINE}. New work must use the owned ` +
        `Radix Select (@statdash/react), not @mui/material. Sites:\n${sites.join('\n')}`,
    ).toBeLessThanOrEqual(APP_WIDE_BASELINE)
  })
})
