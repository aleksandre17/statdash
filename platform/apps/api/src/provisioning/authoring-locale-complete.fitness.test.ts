// ── Fitness — FF-AUTHORING-LOCALE-COMPLETE (the authoring leak-proof gate, AR-37) ──
//
// THE VISION (structural, not manual): a future author CANNOT ship a monolingual
// user-facing field. Two structural invariants over the committed provisioning
// manifest make "nothing left untranslated" an executable contract, and — unlike a
// hardcoded DISPLAY_KEYS allowlist — the gate MAINTAINS ITSELF from the artifact:
//
//   INVARIANT 1 (bag completeness, self-derived, PRIMARY):
//     Every LocaleString bag — any object whose keys are all declared active
//     locales — covers EVERY active locale with a non-empty value. Catches a
//     `{ en: 'x' }` (missing ka) or `{ ka: 'x', en: '' }` ANYWHERE, including
//     fields no allowlist knows about: a new methodology.source, a `tab`/`sub`/
//     `brandTitle` chrome bag, a transform-injected `series` bag under a data
//     subtree. "If you localize a field, localize it in every locale."
//
//   INVARIANT 2 (no bare monolingual display value):
//     A bare string under a PURE display key — a key that appears as a complete
//     bag somewhere and NEVER as a non-bag value (so it is unambiguously a display
//     field, excluding polymorphic keys like `value`/`year` that are also numeric
//     data) — or directly under a `methodology` block, is a leak. Catches the
//     other direction: a field authored as bare English (e.g. `brandTitle: "X"`),
//     invisible to both the tenant-script leak gate (ASCII) and the completeness
//     gate (not a bag) — it would render English on /ka.
//
// This EXTENDS the two shipped config gates (config-label-completeness +
// config-no-locale-leak): those defend a curated key set / the tenant script; this
// derives the display surface from the artifact so a NEW key can never silently
// escape, and closes the English-only-display hole neither covered.
//
// LOCALE-AGNOSTIC BY THE DECLARED SSOT: the active-locale set is read from the
// artifact's own `siteConfig.i18n.locales` (the declared truth) — no hardcoded
// 'ka'/'en'. A bilingual floor (≥2) keeps it from passing vacuously.
//
// Needs no DATABASE_URL: reads the committed artifact off disk.

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
// src/provisioning → apps/api/provisioning/geostat.provisioning.json
const ARTIFACT_PATH = resolve(here, '../../provisioning/geostat.provisioning.json')

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

// Ancestor keys under which a string is DATA/LOGIC, never a display label — a
// LocaleString bag beneath one is still checked for completeness (INV1: a partial
// `series` bag is a real leak), but a BARE string beneath one is a binding, not a
// display leak (INV2 skips it).
const BINDING_SEGMENTS = new Set([
  'data', 'vars', 'encoding', 'pipe', 'query', 'transforms', 'options',
  'cond', 'expr', 'exprs', 'footer',
])
const underBinding = (ancestors: string[]): boolean => ancestors.some((s) => BINDING_SEGMENTS.has(s))

describe('FF-AUTHORING-LOCALE-COMPLETE — no monolingual user-facing field can ship (AR-37)', () => {
  let activeLocales: string[]
  let isBag: (n: unknown) => n is Record<string, string>
  let partialBags: { path: string; missing: string[]; value: unknown }[]
  let pureDisplayKeys: Set<string>
  let monolingualLeaks: { path: string; key: string; value: string }[]

  beforeAll(() => {
    const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8'))
    const siteConfig: Record<string, unknown> = Object.fromEntries(
      (artifact.siteConfig as { key: string; value: unknown }[]).map((r) => [r.key, r.value]),
    )
    // The DECLARED locale SSOT — reading it is not "hardcoding a locale".
    activeLocales = ((siteConfig.i18n as { locales: string[] }).locales ?? []).slice().sort()
    const ACTIVE = new Set(activeLocales)

    // A LocaleString bag: a plain object, non-empty, EVERY key a declared active
    // locale, with ≥1 string value. `{ ka, en }` qualifies; `{ by, op }` (data) and
    // `{ GE-AB: {…} }` (a code map) do not.
    isBag = ((n: unknown): n is Record<string, string> =>
      isPlainObject(n) &&
      Object.keys(n).length > 0 &&
      Object.keys(n).every((k) => ACTIVE.has(k)) &&
      Object.values(n).some((v) => typeof v === 'string')) as typeof isBag

    // ── INV1 pass + collect the display-key vocabulary (bags outside binding) ──
    partialBags = []
    const bagKeysOutsideBinding = new Set<string>()
    const nonBagKeysOutsideBinding = new Set<string>()
    const walk1 = (node: unknown, path: string, key: string | undefined, anc: string[]): void => {
      if (isBag(node)) {
        const missing = activeLocales.filter((l) => typeof node[l] !== 'string' || node[l].trim() === '')
        if (missing.length) partialBags.push({ path, missing, value: node })
        if (key && !underBinding(anc)) bagKeysOutsideBinding.add(key)
        return
      }
      if (typeof node === 'string') {
        if (key && !underBinding(anc)) nonBagKeysOutsideBinding.add(key)
        return
      }
      if (Array.isArray(node)) {
        node.forEach((n, i) => walk1(n, `${path}[${i}]`, key, anc))
        return
      }
      if (!isPlainObject(node)) return
      // a non-bag object under a key also marks that key polymorphic (not pure display)
      if (key && !underBinding(anc)) nonBagKeysOutsideBinding.add(key)
      for (const [k, v] of Object.entries(node)) walk1(v, `${path}.${k}`, k, [...anc, k])
    }
    walk1(artifact, '$', undefined, [])

    // A PURE display key: a bag key that is NEVER also a non-bag value — so it is
    // unambiguously a display field (drops polymorphic `value`/`year` which double
    // as numeric data). Self-maintaining: new display keys enter automatically.
    pureDisplayKeys = new Set([...bagKeysOutsideBinding].filter((k) => !nonBagKeysOutsideBinding.has(k)))

    // ── INV2: bare monolingual string under a pure-display key OR under methodology ──
    monolingualLeaks = []
    const walk2 = (node: unknown, path: string, key: string | undefined, anc: string[], parentKey: string | undefined): void => {
      if (typeof node === 'string') {
        const isDisplay = (key !== undefined && pureDisplayKeys.has(key)) || parentKey === 'methodology'
        if (isDisplay && !underBinding(anc)) monolingualLeaks.push({ path, key: key ?? '(root)', value: node })
        return
      }
      if (isBag(node)) return // a complete bag's locale leaves are not leaks (INV1 owns bags)
      if (Array.isArray(node)) {
        node.forEach((n, i) => walk2(n, `${path}[${i}]`, key, anc, parentKey))
        return
      }
      if (!isPlainObject(node)) return
      for (const [k, v] of Object.entries(node)) walk2(v, `${path}.${k}`, k, [...anc, k], k)
    }
    walk2(artifact, '$', undefined, [], undefined)
  })

  it('declares a plural active-locale set (Law 4 bilingual floor — not vacuous)', () => {
    expect(activeLocales.length).toBeGreaterThanOrEqual(2)
  })

  it('derives a non-trivial pure display-key vocabulary (self-maintenance is live)', () => {
    // If this empties, INV2 checks nothing — a gate that checks nothing is a false
    // green. The artifact ships many display keys (title/label/subtitle/tab/…).
    expect(pureDisplayKeys.size).toBeGreaterThan(5)
  })

  it('INV1 — every LocaleString bag is complete over all active locales', () => {
    const report = partialBags
      .map((b) => `  · ${b.path} — missing [${b.missing.join(', ')}]  (${JSON.stringify(b.value)})`)
      .join('\n')
    expect(
      partialBags.length,
      `\n${partialBags.length} incomplete LocaleString bag(s) over [${activeLocales.join(', ')}] — ` +
        `fill every locale, non-empty:\n${report}\n`,
    ).toBe(0)
  })

  it('INV2 — no bare monolingual string under a display key or a methodology block', () => {
    const report = monolingualLeaks
      .map((l) => `  · ${l.path}  (key "${l.key}") = ${JSON.stringify(l.value)}`)
      .join('\n')
    expect(
      monolingualLeaks.length,
      `\n${monolingualLeaks.length} monolingual display value(s) — author each as a ` +
        `{ <locale>: … } LocaleString so it localizes:\n${report}\n`,
    ).toBe(0)
  })
})
