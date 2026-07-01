// ── FF-NO-PRIVILEGED-LITERAL — no privileged dim / tenant field literal in resolvers ─
//
//  THE LAW (root, Law 1). The built-in SpecResolvers are the crown layer of the pure
//  engine — the exact surface `second-tenant.fitness` certifies as tenant-agnostic. Two
//  classes of literal must NEVER live here:
//
//    (1) A PRIVILEGED DIMENSION-NAME literal — `'time'`, `'geo'`, `'sector'`, `'region'`
//        as a quoted string OR a bare object key (`{ time: … }`). The conventional
//        time-axis key has ONE SSOT: `TIME_DIM` (core/context.ts); a filter/pin must
//        route through it, never a scattered magic literal. (The killed leak lived at
//        resolvers.ts GrowthResolver multi-code branch: `filter: { time: years[0] }`.)
//
//    (2) A TENANT FIELD-NAME literal — a namespaced compound field like `accountColor`
//        / `accountLabel` / `regionColor`. The engine reads GENERIC obs fields only
//        (`meta['color']`, `meta['label']`); a tenant's renamed field (geostat's
//        provisioning `"color":"accountColor"`) must never be baked into the agnostic
//        engine. The rule is general: bare `color`/`label` are the engine vocabulary;
//        ANY `<x>Color`/`<x>Label` camelCase compound is a tenant name and is forbidden.
//
//  `measure` is DELIBERATELY not a privileged-dim literal here: `{ measure: code }` is
//  the ObsQuery field name (the query API's own key), and obs-ROW measure access has its
//  own SSOT `MEASURE_DIM`. This gate scopes to `packages/core/src/registry/**` (the
//  resolver crown); it is the vitest SSOT, twinned by check-laws.sh.
//
// @vitest-environment node

import { readFileSync, readdirSync, statSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { describe, it, expect } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const REGISTRY = HERE   // packages/core/src/registry

/** Recursively list .ts/.tsx source files, skipping tests, fitness, and declarations. */
function sourceFiles(root: string): string[] {
  let out: string[] = []
  let entries: string[]
  try { entries = readdirSync(root) } catch { return [] }
  for (const name of entries) {
    const full = join(root, name)
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue
      out = out.concat(sourceFiles(full))
      continue
    }
    if (!/\.(ts|tsx)$/.test(name)) continue
    if (/\.(test|fitness)\./.test(name)) continue   // tests reference the pattern deliberately
    if (name.endsWith('.d.ts')) continue
    out.push(full)
  }
  return out
}

// Forbidden per source LINE (comment lines skipped below):
const FORBIDDEN: RegExp[] = [
  /['"](?:time|geo|sector|region)['"]/,          // (1a) quoted privileged dim literal
  /[{,]\s*(?:time|geo|sector|region)\s*:/,       // (1b) bare privileged-dim object key
  /['"][a-z][A-Za-z]*(?:Color|Label)['"]/,       // (2)  tenant-namespaced <x>Color/<x>Label
]

function violationsIn(file: string): string[] {
  const lines = readFileSync(file, 'utf8').split('\n')
  const hits: string[] = []
  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
    if (FORBIDDEN.some((re) => re.test(line))) hits.push(`${file}:${i + 1}: ${trimmed}`)
  })
  return hits
}

describe('FF-NO-PRIVILEGED-LITERAL — resolvers carry zero privileged-dim / tenant-field literals', () => {
  it('packages/core/src/registry/** is clean', () => {
    const files = sourceFiles(REGISTRY)
    expect(files.length).toBeGreaterThan(3)   // non-vacuous: the scan reached real source
    const violations = files.flatMap(violationsIn)
    expect(violations, `privileged/tenant literals found:\n${violations.join('\n')}`).toEqual([])
  })

  it('the gate BITES — synthetic leaks are caught', () => {
    // (1a) quoted privileged dim
    expect(FORBIDDEN.some((re) => re.test(`storeObs(store, { measure: c, filter: { 'time': y } }, ctx)`))).toBe(true)
    // (1b) bare privileged-dim object key
    expect(FORBIDDEN.some((re) => re.test(`filter: { time: years[0] }`))).toBe(true)
    expect(FORBIDDEN.some((re) => re.test(`const q = { geo: 'GE' }`))).toBe(true)
    // (2) tenant-namespaced field
    expect(FORBIDDEN.some((re) => re.test(`const color = String(meta['accountColor'] ?? '')`))).toBe(true)
    expect(FORBIDDEN.some((re) => re.test(`meta['regionLabel']`))).toBe(true)
  })

  it('the gate does NOT bite the GENERIC engine vocabulary', () => {
    // TIME_DIM computed key (the honored path) + generic color/label + ObsQuery measure field.
    expect(FORBIDDEN.some((re) => re.test(`filter: { [TIME_DIM]: years[0] }`))).toBe(false)
    expect(FORBIDDEN.some((re) => re.test(`const color = String(meta['color'] ?? '')`))).toBe(false)
    expect(FORBIDDEN.some((re) => re.test(`const label = String(meta['label'] ?? code)`))).toBe(false)
    expect(FORBIDDEN.some((re) => re.test(`storeObs(store, { measure: code }, ctx)`))).toBe(false)
  })
})
