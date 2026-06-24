import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, dirname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

// ── Fitness function: NO tenant content in the app-agnostic layers ──────────
//
//  Law 1 / Law 3 (de-tenant north-star): `packages/react` and `packages/styles`
//  are the app-agnostic platform layers — they must carry ZERO tenant content.
//  The first-tenant ("geostat") identity historically leaked in as the event-map
//  name (`GeostatEventMap`), a hardcoded snapshot class (`geostat-snapshot`), and
//  brand copy in the styles catalog ("GeoStat blue / GeoStat ლურჯი").
//
//  This test makes the de-tenant guarantee UN-REGRESSABLE: it source-scans both
//  layers and fails the build the moment any `/geostat/i` identifier, string, or
//  comment reappears — matching the existing `no-magic-vars` discipline.
//
//  Tenant/app-specific events are contributed app-side via module augmentation
//  of the platform-generic `PlatformEventMap` (open for extension, closed for
//  modification) — exactly like `PlatformCommandMap`. The base map declared in
//  this layer names no tenant.
//
//  ALLOWLIST: intentionally EMPTY. There is no legitimate reason for the string
//  "geostat" to appear in an app-agnostic layer — not even in a comment. The
//  DI boundary is documented generically ("the app tier injects …"), never by
//  naming a specific tenant app. A new entry here would be a regression and must
//  be justified deliberately, never added silently.
//
const ALLOWED: { file: string; reason: string }[] = []

const here = dirname(fileURLToPath(import.meta.url))
// here = packages/react/src/engine
const reactSrcDir  = resolve(here, '..')                  // packages/react/src
const stylesSrcDir = resolve(here, '../../../styles/src') // packages/styles/src

const SCANNED_EXT = ['.ts', '.tsx', '.css', '.js', '.jsx']

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = resolve(dir, e.name)
    if (e.isDirectory()) return sourceFiles(full)
    // Skip this fitness test itself — it names the banned token in prose.
    if (e.name === 'no-tenant-content.fitness.test.ts') return []
    if (SCANNED_EXT.some((ext) => e.name.endsWith(ext))) return [full]
    return []
  })
}

const TENANT_RE = /geostat/i

describe('app-agnostic layers carry NO tenant content', () => {
  const targets = [
    ...sourceFiles(reactSrcDir),
    ...sourceFiles(stylesSrcDir),
  ]
  const allowed = new Set(ALLOWED.map((a) => resolve(a.file)))

  // The platform event-map file (packages/react/src/events/events.ts).
  const isEventMapFile = (f: string) => f.endsWith(`events${sep}events.ts`)

  it('scans a non-empty set of react + styles source files', () => {
    // Guard against a silently-empty scan (wrong path ⇒ false green).
    expect(targets.length).toBeGreaterThan(0)
    expect(targets.some(isEventMapFile)).toBe(true)
    expect(targets.some((f) => f.endsWith('data-color.ts'))).toBe(true)
  })

  it('contains NO /geostat/i token in any source file (allowlist empty)', () => {
    const offenders: string[] = []
    for (const file of targets) {
      if (allowed.has(file)) continue
      const src = readFileSync(file, 'utf8')
      const lines = src.split('\n')
      lines.forEach((line, i) => {
        if (TENANT_RE.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim()}`)
      })
    }
    expect(offenders).toEqual([])
  })

  it('PlatformEventMap is the canonical event map (rename complete)', () => {
    const eventsFile = targets.find(isEventMapFile)
    expect(eventsFile).toBeDefined()
    const src = readFileSync(eventsFile!, 'utf8')
    // Positive: the generic, augmentable map exists with the documented seam.
    expect(src).toContain('export interface PlatformEventMap')
    expect(src).toContain("declare module '@statdash/react'")
    // Negative: the tenant-named map is gone.
    expect(src).not.toContain('GeostatEventMap')
  })
})
