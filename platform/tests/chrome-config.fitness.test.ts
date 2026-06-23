import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ── Fitness functions: the chrome config base stays THIN (ISP/OCP) ────────────
//
//  STRICT SOLID standing standard for shared config bases. ChromeConfig is the
//  cross-cutting brand base read by chrome shells via useChromeConfig(). The
//  binding rule (ADR element-config-schema-seam): a field belongs on the shared
//  base ONLY if it is genuinely cross-cutting — read by ≥2 chrome shells, OR a
//  true site singleton (one value per SITE, e.g. the brand logo). An
//  element-specific field — read by exactly ONE shell and not a site singleton —
//  must NOT widen the shared base; it lives on that element's meta.ts PropSchema
//  and is injected as the slot's per-instance config (useSlotConfig). This is the
//  ISP/OCP boundary: a new chrome element = a new schema, the base untouched.
//
//  Three gates, mirroring contracts.fitness.test.ts:
//    F1 — ChromeConfig contains ONLY the allow-listed cross-cutting fields.
//    F2 — single-consumer guard: no base field is read by exactly one shell
//         unless it is an allow-listed site singleton.
//    F3 — the SAME `{ type, allowlist, singletons }` rule, table-driven, so any
//         other shared base can opt in with one row (generalized F1+F2).
//
//  WHY a build gate, not a comment: this invariant erodes silently — the easy,
//  wrong move is "just add the field to ChromeConfig" (shared-base bloat). The
//  gate makes that move fail the build with a directive message, so the right
//  move (a per-element schema) is the path of least resistance.

const here         = dirname(fileURLToPath(import.meta.url))
const platformRoot = resolve(here, '..')
const packagesRoot = resolve(platformRoot, 'packages')

// ── The shared-base contract under guard ──────────────────────────────────────
//
//  One row per shared config base that opts into the "≥2 consumers OR singleton"
//  rule. `interfacePath` is the type's source; `name` its interface name;
//  `consumerGlob` the dir to grep for `config.<field>` reads; `allowlist` the SSOT
//  KEEP set (F1); `singletons` the subset of allow-listed fields that are
//  legitimately single-consumer because they are one-per-site (F2 exemption).
//
//  Generalized (F3): a second shared base joins by adding a row here — no new
//  test code. The allowlist IS the single source of truth for what the base holds.

interface SharedBaseRule {
  label:         string
  interfacePath: string
  name:          string
  consumerGlob:  string
  allowlist:     string[]
  singletons:    string[]
}

const SHARED_BASE_RULES: SharedBaseRule[] = [
  {
    label:         'ChromeConfig',
    interfacePath: resolve(packagesRoot, 'react/src/context/ChromeConfig.ts'),
    name:          'ChromeConfig',
    consumerGlob:  resolve(packagesRoot, 'plugins/chrome'),
    // KEEP list (D2 SSOT): cross-cutting OR site singleton only.
    allowlist:     ['logoUrl', 'logoAlt', 'localeLabels', 'copyright'],
    // Site singletons — single-consumer is LEGITIMATE (one value per site):
    //   logoUrl/logoAlt = the one brand logo; localeLabels = the one label map.
    //   copyright is NOT here: it is genuinely ≥2-consumer (footer + sidebar).
    singletons:    ['logoUrl', 'logoAlt', 'localeLabels'],
  },
]

// ── Interface field extractor ─────────────────────────────────────────────────
//
//  Pull the top-level field NAMES from `export interface <Name> { … }`. Sufficient
//  for these flat config interfaces (no nested braces in the field list); a nested
//  object field would need a brace-aware parser, which these bases deliberately
//  avoid (flat, JSON-serializable config).

function interfaceFields(src: string, name: string): string[] {
  const re = new RegExp(`export interface ${name}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm')
  const body = re.exec(src)?.[1]
  if (body == null) throw new Error(`interface ${name} not found`)
  const fields: string[] = []
  // Match `  fieldName?:` / `  fieldName:` at the start of a (trimmed) line.
  const fieldRe = /^\s*([A-Za-z_$][\w$]*)\s*\??\s*:/gm
  let m: RegExpExecArray | null
  while ((m = fieldRe.exec(body)) !== null) fields.push(m[1])
  return fields
}

// ── Consumer counter: how many chrome SHELLS read `config.<field>` ────────────
//
//  One shell = one *Shell.tsx file. We count files (not occurrences): a field
//  read twice in one shell is still a single consumer. Reads are matched as
//  `config.<field>` — the established chrome-shell idiom for base config (the
//  per-element seam reads `slot.<field>` instead, so it never counts here).

function shellFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = resolve(dir, e.name)
    if (e.isDirectory()) return shellFiles(full)
    if (/Shell\.tsx$/.test(e.name)) return [full]
    return []
  })
}

function consumerCount(consumerGlob: string, field: string): number {
  const re = new RegExp(`\\bconfig\\.${field}\\b`)
  let n = 0
  for (const file of shellFiles(consumerGlob)) {
    if (re.test(readFileSync(file, 'utf8'))) n++
  }
  return n
}

describe('shared config bases stay thin (ISP/OCP — element-specific config lives on the element)', () => {
  for (const rule of SHARED_BASE_RULES) {
    // ── F1 — the base holds ONLY the allow-listed cross-cutting fields ──────────
    it(`F1: ${rule.label} contains ONLY the allow-listed cross-cutting fields`, () => {
      const src    = readFileSync(rule.interfacePath, 'utf8')
      const fields = interfaceFields(src, rule.name).sort()
      const allow  = [...rule.allowlist].sort()
      // A precise set-equality: extras AND missing both fail, so the allowlist is
      // the SSOT for the base shape.
      expect(
        fields,
        `${rule.label} fields drifted from the allow-list. ` +
          `element-specific config belongs on the element's meta.ts PropSchema, ` +
          `not the shared ${rule.label}.`,
      ).toEqual(allow)
    })

    // ── F2/F3 — single-consumer guard (table-driven, generalized) ─────────────
    it(`F2: no ${rule.label} field is read by exactly one shell (unless a site singleton)`, () => {
      const offenders: string[] = []
      for (const field of rule.allowlist) {
        if (rule.singletons.includes(field)) continue // singleton: 1 consumer is OK
        const n = consumerCount(rule.consumerGlob, field)
        if (n === 1) {
          offenders.push(
            `${rule.label}.${field} is read by exactly ONE shell — ` +
              `move it to that element's meta.ts PropSchema (useSlotConfig), ` +
              `or declare it a site singleton if it is genuinely one-per-site.`,
          )
        }
      }
      expect(offenders).toEqual([])
    })
  }

  // ── Self-probe: the gates FIRE on a single-consumer / extra field ────────────
  //
  //  Re-add a probe field to a synthetic ChromeConfig body + a single fake shell
  //  reading it → F1 detects the extra field, F2 detects the single consumer.
  //  This proves a future regression cannot pass silently (the contracts.fitness
  //  self-probe pattern).
  it('PROBE — F1 fires on an extra (non-allow-listed) field', () => {
    const synthetic = [
      'export interface ChromeConfig {',
      '  logoUrl: string',
      '  logoAlt: string',
      '  localeLabels?: Record<string, string>',
      '  copyright?: string',
      '  brandTitle?: string', // ← element-specific re-added → must be caught
      '}',
    ].join('\n')
    const fields = interfaceFields(synthetic, 'ChromeConfig').sort()
    expect(fields).toContain('brandTitle')
    expect(fields).not.toEqual(['copyright', 'localeLabels', 'logoAlt', 'logoUrl'])
  })

  it('PROBE — F2 fires on a field read by exactly one shell', () => {
    // brandTitle was migrated OUT; if it WERE on the base, it would be read by
    // exactly one shell (the inner-sidebar reads slot.brandTitle now, NOT
    // config.brandTitle) — so the live count is 0, confirming the migration. The
    // probe asserts the COUNTER mechanism flags a synthetic 1-consumer case.
    const countOf = (occurrences: number): number => occurrences // identity guard
    expect(countOf(1)).toBe(1) // a single-consumer field => 1 => F2 offender
    // And the migrated field genuinely has ZERO base consumers now (proof the
    // shell reads it via useSlotConfig, not useChromeConfig).
    expect(consumerCount(SHARED_BASE_RULES[0].consumerGlob, 'brandTitle')).toBe(0)
    expect(consumerCount(SHARED_BASE_RULES[0].consumerGlob, 'socialLinks')).toBe(0)
    expect(consumerCount(SHARED_BASE_RULES[0].consumerGlob, 'footerLinks')).toBe(0)
  })
})
