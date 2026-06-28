// ── labelCompleteness.fitness.test.ts — i18n drift gate (Law 4) [CON-14 / X-3] ──
//
//  THE INVARIANT: every shipped *authoring* label is a COMPLETE LocaleString over
//  the active locales. `PropField.label` is typed `LocaleString` precisely so the
//  Constructor UI itself localises — but a plain single-locale string also satisfies
//  that type (LocaleString = string | Record<string,string>), so the type system
//  alone cannot stop a `label: 'Chart Type'` (English-only) or a `label: 'სათაური'`
//  (Georgian-only) from shipping. Invisible today (single runtime locale), a real
//  defect the moment a non-Georgian tenant or client-side locale switching ships —
//  and ACTIVELY DRIFTING because nothing holds the line.
//
//  This gate IS that line. It walks every shipped authoring surface (META label +
//  PropSchema field labels + select-option labels + PropertyGroup labels + SlotDef
//  labels) discovered from the catalog SSOT, and asserts each is a complete
//  LocaleString. Same shrinking-list discipline as the coverage gate: it fails with
//  the full offender list, you migrate to green, and it stays green forever after.
//
//  SCOPE (per the task): PropSchema / node-META authoring labels only. It does NOT
//  touch PerspectiveOption.label (a deferred resolve-at-parse carrier, a separate
//  architecture) nor FilterControlMeta.label (typed plain `string` by design — a
//  technical control key, not a localised authoring label).
//
//  LOCALE-AGNOSTIC BY CONSTRUCTION (no hardcoded 'ka'/'en'): the "active locales"
//  are DERIVED as the union of every locale key present across all object-form
//  labels. Completeness = every label covers that observed union with a non-empty
//  value. A bilingual floor (≥2 locales) encodes Law 4 without naming a locale, so
//  the gate cannot pass vacuously on a uniformly single-locale catalog. Adding a 3rd
//  locale to one label forces it onto every label — drift is caught in both
//  directions. The platform locale registry SSOT (apps/panel `PLATFORM_LOCALES`,
//  projected from `config.locale`) is unreachable here by the dependency arrow
//  (plugins ⊄ apps), so the canon is re-derived structurally rather than imported.
//
import { describe, it, expect } from 'vitest'
import { AUTHORING_METAS }      from '../authoring-metas'

// ── structural view over the label-bearing surfaces of any SliceMeta ──────────
// (a union-narrowing-free shape — every member of SliceMeta is a subset of this)
interface LabelBearer {
  type?:        string
  key?:         string
  slot?:        string
  controlType?: string
  label?:       unknown
  schema?:      Array<{ field?: string; label?: unknown; options?: Array<{ value?: string; label?: unknown }> }>
  groups?:      Array<{ label?: unknown }>
  slots?:       Record<string, { label?: unknown }>
}

// Every shipped authoring META, discovered from the pure + complete SSOT
// (`authoring-metas.ts`) so a new label-bearing slice is auto-covered by this gate.
const ALL_META: LabelBearer[] = AUTHORING_METAS as unknown as LabelBearer[]

/** A located label = its dotted authoring path + the raw value to check. */
interface LocatedLabel { path: string; value: unknown }

/** Collect every LocaleString-typed authoring label carried by one META. */
function labelsOf(m: LabelBearer): LocatedLabel[] {
  const id  = m.type ?? m.key ?? m.slot ?? m.controlType ?? 'unknown'
  const out: LocatedLabel[] = []
  if ('label' in m && m.label !== undefined) out.push({ path: `${id}.label`, value: m.label })
  for (const f of m.schema ?? []) {
    out.push({ path: `${id}.schema[${f.field}].label`, value: f.label })
    for (const o of f.options ?? []) {
      out.push({ path: `${id}.schema[${f.field}].option[${o.value}].label`, value: o.label })
    }
  }
  for (const [i, g] of (m.groups ?? []).entries()) {
    out.push({ path: `${id}.groups[${i}].label`, value: g.label })
  }
  for (const [name, s] of Object.entries(m.slots ?? {})) {
    out.push({ path: `${id}.slots[${name}].label`, value: s.label })
  }
  return out
}

const ALL_LABELS: LocatedLabel[] = ALL_META.flatMap(labelsOf)

/** The locale keys carried by an object-form label (a bare string carries none). */
function localeKeysOf(value: unknown): string[] {
  if (value === null || typeof value !== 'object') return []
  return Object.keys(value as Record<string, unknown>)
}

/** The active-locale set DERIVED from the catalog: the union of all label locales. */
const ACTIVE_LOCALES: string[] = [
  ...new Set(ALL_LABELS.flatMap((l) => localeKeysOf(l.value))),
].sort()

/** A label is complete iff it carries a non-empty string for every active locale. */
function missingLocales(value: unknown, active: string[]): string[] {
  const rec = (value !== null && typeof value === 'object')
    ? (value as Record<string, unknown>)
    : null
  return active.filter((loc) => {
    const v = rec?.[loc]
    return typeof v !== 'string' || v.trim() === ''
  })
}

describe('labelCompleteness fitness — every authoring label is a complete LocaleString (Law 4)', () => {
  it('discovers a non-trivial set of authoring labels to defend', () => {
    // Guards against a refactor silently emptying the discovery source (a gate that
    // checks nothing is worse than no gate).
    expect(ALL_META.length).toBeGreaterThan(10)
    expect(ALL_LABELS.length).toBeGreaterThan(40)
  })

  it('the catalog declares at least two active locales (Law 4 bilingual floor)', () => {
    // Locale-agnostic: we do not name a locale, only require the catalog be plural.
    // A uniformly single-locale catalog (every label `{ka:…}`) fails HERE rather
    // than passing the completeness check vacuously.
    expect(ACTIVE_LOCALES.length).toBeGreaterThanOrEqual(2)
  })

  it('every shipped authoring label covers every active locale with a non-empty value', () => {
    const offenders = ALL_LABELS
      .map((l) => ({ path: l.path, missing: missingLocales(l.value, ACTIVE_LOCALES), value: l.value }))
      .filter((o) => o.missing.length > 0)

    // Shrinking-list pattern: the assertion message IS the migration worklist.
    const report = offenders
      .map((o) => `  · ${o.path} — missing [${o.missing.join(', ')}]  (${JSON.stringify(o.value)})`)
      .join('\n')

    expect(
      offenders.length,
      `\n${offenders.length} authoring label(s) are not complete LocaleStrings over ` +
        `[${ACTIVE_LOCALES.join(', ')}]:\n${report}\n`,
    ).toBe(0)
  })
})
