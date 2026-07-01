// ── Fitness function — no monolingual-content LEAK in the provisioning manifest ──
//
// THE INVARIANT (structural, so the leak class CANNOT recur): a non-Latin display
// codepoint may appear in the committed manifest ONLY inside a locale arm of a
// LocaleString bag — never as a bare, single-locale content value. If a Georgian
// string sits under a NON-locale key (`series`, a badge `year`/`range` perspective arm,
// a KpiTrend static `value`, a geograph `labelOverrides` entry, an `expr` literal), it
// is STRUCTURALLY un-localizable — it renders Georgian on EVERY locale, including the
// English product. This was the F3 "i18n leak" class in AUDIT-live-product.md.
//
// This is the CONTENT-tier complement of config-label-completeness.fitness.test.ts.
// That gate is KEY-driven (a fixed DISPLAY_KEYS set over object-form bags) and
// therefore CANNOT see the leak fields: `series` lives under a `data` BINDING subtree,
// `value` is a KpiValueSpec binding key, and badge `year`/`range` + `labelOverrides`
// entries are not DISPLAY_KEYS at all. So a bare Georgian literal in any of those
// slipped through every key-based check. This gate closes that gap by inspecting the
// VALUE: wherever the authored text carries the tenant's script, it must be under a
// locale key. The two gates together make the leak un-representable — one guards
// completeness of the bags, the other bans content outside them.
//
// LOCALE-AGNOSTIC BY CONSTRUCTION: the "locale keys" are DERIVED as the union of keys
// across every bilingual (≥2-locale) string bag in the artifact — no hardcoded 'ka'.
// The tenant script range IS named (Georgian, U+10A0–U+10FF) because it is precisely
// the leak this tenant ships; it is the codepoint-scan the audit charge specifies. A
// new tenant adds its own range (or generalises to "any non-ASCII"), but naming this
// range keeps the guard honest about what it actually defends today.
//
// Needs no DATABASE_URL: reads the committed artifact off disk.

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
// src/provisioning → apps/api/provisioning/geostat.provisioning.json
const ARTIFACT_PATH = resolve(here, '../../provisioning/geostat.provisioning.json')

// The tenant display script this gate defends (Georgian, per the audit charge [Ⴀ-ჿ]).
const TENANT_SCRIPT = /[Ⴀ-ჿ]/
// A BCP-47-shaped locale code: lowercase primary subtag (+ optional region/script). Used
// to tell a LocaleString arm key (`ka`, `en`, `en-US`) from a data-map key (`GE-AJ`, `R3`).
const LOCALE_CODE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Derive the locale-key set structurally: the union of keys of every object that is a
 * "string bag" carrying ≥2 string-valued keys (a bilingual LocaleString). This is the
 * same derive-don't-hardcode discipline the sibling completeness gate uses — the gate
 * names no locale. A `{ ka, en }` label, a badge `{ year:{ka,en}, range:{ka,en} }` arm,
 * and a `series: { ka, en }` bag all contribute `ka`+`en`; a `{ year:'x', range:'y' }`
 * perspective carrier of plain strings contributes `year`+`range` but carries no tenant
 * script (ASCII), so it never gates.
 */
function deriveLocaleKeys(node: unknown, acc: Set<string>): void {
  if (Array.isArray(node)) { node.forEach((n) => deriveLocaleKeys(n, acc)); return }
  if (!isPlainObject(node)) return
  const entries = Object.entries(node)
  // A LocaleString bag = ≥2 string leaves whose keys are ALL BCP-47 locale codes. The
  // locale-code filter keeps a data map (geoCodeMap `GE-AJ→R3`, a `from` lookup) or a
  // data row (many string columns) from polluting the derived locale-key set.
  const stringKeys = entries.filter(([, v]) => typeof v === 'string').map(([k]) => k)
  const looksLikeBag = stringKeys.length >= 2 && stringKeys.every((k) => LOCALE_CODE.test(k))
  if (looksLikeBag) for (const k of stringKeys) acc.add(k)
  for (const [, v] of entries) deriveLocaleKeys(v, acc)
}

interface Leak { path: string; key: string; value: string }

/** Collect every tenant-script string whose immediate parent key is NOT a locale key. */
function collectLeaks(node: unknown, path: string, key: string | undefined, localeKeys: Set<string>, out: Leak[]): void {
  if (typeof node === 'string') {
    if (TENANT_SCRIPT.test(node) && !(key !== undefined && localeKeys.has(key))) {
      out.push({ path, key: key ?? '(root)', value: node })
    }
    return
  }
  if (Array.isArray(node)) { node.forEach((n, i) => collectLeaks(n, `${path}[${i}]`, undefined, localeKeys, out)); return }
  if (!isPlainObject(node)) return
  for (const [k, v] of Object.entries(node)) collectLeaks(v, `${path}.${k}`, k, localeKeys, out)
}

describe('config-tier locale-leak guard — tenant-script content only inside LocaleString arms (F3)', () => {
  let localeKeys: Set<string>
  let leaks: Leak[]

  beforeAll(() => {
    const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8'))
    localeKeys = new Set<string>()
    deriveLocaleKeys(artifact, localeKeys)
    leaks = []
    collectLeaks(artifact, '$', undefined, localeKeys, leaks)
  })

  it('derives a plural locale-key set (the bilingual floor exists to enforce)', () => {
    // Guards against a refactor that empties the derivation (then every string would
    // pass as "under a locale key"). At least the tenant + one more locale must exist.
    expect(localeKeys.size).toBeGreaterThanOrEqual(2)
  })

  it('no tenant-script string appears outside a LocaleString locale arm', () => {
    // Shrinking-list pattern: the message IS the migration worklist. Each offender is a
    // bare monolingual content value that would render the tenant script on every locale.
    const report = leaks
      .map((l) => `  · ${l.path}  (key "${l.key}") = ${JSON.stringify(l.value)}`)
      .join('\n')
    expect(
      leaks.length,
      `\n${leaks.length} monolingual tenant-script leak(s) — author these as { <locale>: … } ` +
        `LocaleString bags so they localize (locale keys: [${[...localeKeys].sort().join(', ')}]):\n${report}\n`,
    ).toBe(0)
  })
})
