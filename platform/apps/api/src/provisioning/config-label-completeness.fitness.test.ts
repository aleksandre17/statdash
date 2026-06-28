// ── Fitness function — CONFIG-TIER label completeness (Law 4, bilingual floor) ──
//
// THE INVARIANT: every USER-FACING DISPLAY string shipped in the provisioning
// manifest (page configs + siteConfig nav/chrome) is a COMPLETE LocaleString over
// the active locales — never a single-locale (e.g. Georgian-only) literal.
//
// This is the CONFIG-TIER sibling of the plugins authoring gate
// (packages/plugins/__tests__/labelCompleteness.fitness.test.ts), which defends the
// Constructor's *authoring* labels. THIS gate defends the *authored* artifact: the
// committed manifest is the Single Source of Truth for what a tenant renders, so a
// `"title": "ეროვნული ანგარიშები"` (Georgian-only) is a Law-4 violation AT THE
// CONFIG TIER — invisible under a single runtime locale, a real defect the moment a
// non-Georgian client-side locale switch ships, and ACTIVELY DRIFTING because, until
// this gate, nothing held the line. The shrinking-list discipline of the sibling
// gates applies: it fails with the full offender list, you migrate to green, and it
// stays green forever after.
//
// DISPLAY vs BINDING — the load-bearing distinction (the gate must not flag a data
// binding). A string is enforced iff (a) its leaf key is one of the DISPLAY_KEYS
// authored as human-facing prose/labels/units, AND (b) it does NOT live inside a
// data/logic subtree (BINDING_SEGMENTS): `encoding.label: "time"`, a `data.pipe`
// `rename.label: "accountLabel"`, an `options.labelField`, a `vars` template — these
// reference DATA COLUMNS or carry transform logic and stay bare by design. The two
// tiers are derived structurally (key + ancestor path), never by inspecting the
// string's contents, so the rule is locale- and value-agnostic.
//
// LOCALE-AGNOSTIC BY CONSTRUCTION (no hardcoded 'ka'/'en'): the "active locales" are
// DERIVED as the union of every locale key present across all object-form display
// labels in the artifact. Completeness = every display label covers that observed
// union with a non-empty value. A bilingual floor (≥2 locales) encodes Law 4 without
// naming a locale, so the gate cannot pass vacuously on a uniformly single-locale
// artifact. Adding a 3rd locale to one label forces it onto every label — drift is
// caught in both directions. (The artifact's own siteConfig `i18n.locales` is the
// declared SSOT; we re-derive structurally so the gate stays self-contained and
// honours the same "derive, don't hardcode" canon as the plugins gate.)
//
// Needs no DATABASE_URL: reads the committed artifact off disk.

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
// src/provisioning → apps/api/provisioning/geostat.provisioning.json
const ARTIFACT_PATH = resolve(here, '../../provisioning/geostat.provisioning.json')

// ── The display/binding classifier (the SSOT both this gate and the migration use) ─
//
// DISPLAY_KEYS — leaf keys authored as user-facing prose / labels / titles / units.
// Extensible: a new display-bearing field key is added here (and to the migration),
// and the gate auto-covers every occurrence. NOT a privileged-dimension list — these
// are presentation field NAMES, agnostic to which dimension/measure they describe.
const DISPLAY_KEYS = new Set([
  'title', 'subtitle', 'label', 'trendSub', 'unit',
  'colLabel', 'valueLabel', 'centerLabel', 'emptyLabel', 'suffix',
])

// BINDING_SEGMENTS — ancestor path segments under which a string is DATA or LOGIC,
// never a display label: a `data` query/encoding/pipe subtree, a `vars`/`options`/
// `transforms` expression tree. A DISPLAY_KEY appearing anywhere beneath one of these
// (e.g. `encoding.label`, `pipe[].rename.label`) is a binding and is NOT enforced.
const BINDING_SEGMENTS = new Set([
  'data', 'vars', 'encoding', 'pipe', 'query', 'transforms', 'options',
])

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** A located display label = its JSON path + the raw value to check. */
interface LocatedLabel { path: string; value: unknown }

/**
 * Walk the artifact, collecting every DISPLAY-tier label leaf. `ancestors` is the
 * chain of object keys from the root to (but excluding) the current key — the
 * binding-context test reads it so a DISPLAY_KEY under any BINDING_SEGMENT ancestor
 * is skipped. Arrays are transparent to the ancestor chain (an index is not a key).
 */
function collectLabels(node: unknown, path: string, ancestors: string[], out: LocatedLabel[]): void {
  if (Array.isArray(node)) {
    node.forEach((n, i) => collectLabels(n, `${path}[${i}]`, ancestors, out))
    return
  }
  if (!isPlainObject(node)) return
  for (const [key, value] of Object.entries(node)) {
    const childPath = `${path}.${key}`
    const underBinding = ancestors.some((s) => BINDING_SEGMENTS.has(s))
    if (DISPLAY_KEYS.has(key) && !underBinding && (typeof value === 'string' || isPlainObject(value))) {
      // A LocaleString carrier: a bare string (single-locale legacy — an offender) or
      // an object map (must cover every active locale). Object-typed DataSpec carriers
      // (e.g. a `value` KpiValueSpec) never reach here — their keys aren't DISPLAY_KEYS.
      out.push({ path: childPath, value })
    }
    // Recurse regardless: a display object's locale leaves aren't DISPLAY_KEYS, so the
    // re-walk over them is inert; nested display nodes (children/items) are reached.
    collectLabels(value, childPath, [...ancestors, key], out)
  }
}

/** The locale keys carried by an object-form label (a bare string carries none). */
function localeKeysOf(value: unknown): string[] {
  if (!isPlainObject(value)) return []
  return Object.keys(value)
}

/** A label is complete iff it carries a non-empty string for every active locale. */
function missingLocales(value: unknown, active: string[]): string[] {
  const rec = isPlainObject(value) ? value : null
  return active.filter((loc) => {
    const v = rec?.[loc]
    return typeof v !== 'string' || v.trim() === ''
  })
}

describe('config-tier label completeness — every manifest display label is a complete LocaleString (Law 4)', () => {
  let labels: LocatedLabel[]
  let activeLocales: string[]

  beforeAll(() => {
    const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8'))
    labels = []
    collectLabels(artifact, '$', [], labels)
    // Active-locale set DERIVED from the artifact: the union of all object-form
    // display-label locales (no hardcoded 'ka'/'en').
    activeLocales = [...new Set(labels.flatMap((l) => localeKeysOf(l.value)))].sort()
  })

  it('discovers a non-trivial set of display labels to defend', () => {
    // Guards against a refactor silently emptying discovery (a gate that checks
    // nothing is worse than no gate). The artifact ships hundreds of display labels.
    expect(labels.length).toBeGreaterThan(100)
  })

  it('the artifact declares at least two active locales (Law 4 bilingual floor)', () => {
    // Locale-agnostic: we name no locale, only require the display surface be plural.
    // A uniformly single-locale artifact fails HERE rather than passing the
    // completeness check vacuously.
    expect(activeLocales.length).toBeGreaterThanOrEqual(2)
  })

  it('every display label covers every active locale with a non-empty value', () => {
    const offenders = labels
      .map((l) => ({ path: l.path, missing: missingLocales(l.value, activeLocales), value: l.value }))
      .filter((o) => o.missing.length > 0)

    // Shrinking-list pattern: the assertion message IS the migration worklist.
    const report = offenders
      .map((o) => `  · ${o.path} — missing [${o.missing.join(', ')}]  (${JSON.stringify(o.value)})`)
      .join('\n')

    expect(
      offenders.length,
      `\n${offenders.length} manifest display label(s) are not complete LocaleStrings over ` +
        `[${activeLocales.join(', ')}]:\n${report}\n`,
    ).toBe(0)
  })
})
