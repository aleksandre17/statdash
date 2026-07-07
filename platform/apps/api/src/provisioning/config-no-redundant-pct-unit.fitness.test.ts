// ── Fitness function — CONFIG-TIER no redundant "%" unit on a %-formatted card ──
//
// THE INVARIANT: a KPI card / featured metric whose VALUE is rendered by a PERCENT
// formatter (the formatter already appends "%": `sign_pct` → "+15%", `pct` → "15%",
// or a `yoy` value which is always `sign_pct`) must NOT ALSO declare `unit: "%"` —
// the card renders VALUE + UNIT, so the two "%" collide into "+15%%" / "15% %".
//
// This is the admin-review "+15%%" defect (REQ A). The fix was declarative: remove
// the redundant `unit:"%"` from every %-formatter KPI/metric in the manifest. THIS
// gate holds that line so it can never drift back — the shrinking-list discipline of
// its sibling config-tier gates (fails with the full offender list, you migrate to
// green, it stays green forever).
//
// THE SUBTLE PART — a "%" unit is only redundant when the VALUE ALREADY CARRIES "%".
// The share / cagr / bare-metric formatter (`fmtKpiPct` = toFixed(1)) emits a BARE
// number ("53.1"), so those cards LEGITIMATELY need `unit:"%"` to read "53.1%". The
// classifier below encodes exactly that formatter contract (packages/core
// transform/formatters.ts + data/kpi.ts resolveValue): it flags ONLY the objects
// whose rendered value string already ends in "%".
//
//   value.type:  yoy            → always sign_pct        → EMITS %  → unit "%" redundant
//                point | expr   → format ∈ {sign_pct,pct}→ EMITS %  → redundant iff so
//                mean | metric  → format ∈ {sign_pct,pct}→ EMITS %  (absent ⇒ bare, OK)
//                share | cagr   → fmtKpiPct (bare number) → unit "%" REQUIRED — never flagged
//   metric def:  format ∈ {sign_pct,pct}                 → EMITS %  → unit "%" redundant
//
// A chart/table `fieldConfig.unit:"%"` is an AXIS/tooltip unit (no sibling `value`
// spec, no metric `format`), so `emitsPct` returns null and it is never flagged —
// correct: a chart axis labelled "%" over bare-number ticks is legitimate, not a
// double-render. The rule is value/value-agnostic and derived structurally.
//
// Needs no DATABASE_URL: reads the committed artifact off disk.

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const ARTIFACT_PATH = resolve(here, '../../provisioning/geostat.provisioning.json')

// Formatters that APPEND a "%" (packages/core/src/data/transform/formatters.ts).
const PCT_FORMATS = new Set(['sign_pct', 'pct', 'percent'])

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** A "%" unit — a bare "%" string OR a LocaleString whose every locale value is "%". */
function isPctUnit(unit: unknown): boolean {
  if (typeof unit === 'string') return unit.trim() === '%'
  if (isPlainObject(unit)) {
    const vals = Object.values(unit).filter((v): v is string => typeof v === 'string')
    return vals.length > 0 && vals.every((v) => v.trim() === '%')
  }
  return false
}

/**
 * Does this object's RENDERED VALUE string already end in "%"? Mirrors
 * resolveValue (data/kpi.ts) + the formatter registry. Returns:
 *   true  → value carries "%" (a "%" unit would be redundant),
 *   false → value is a bare number (a "%" unit is legitimate),
 *   null  → not a value-bearing card/metric (e.g. a chart fieldConfig) — ignore.
 */
function emitsPct(obj: Record<string, unknown>): boolean | null {
  const value = obj['value']
  if (isPlainObject(value)) {
    const t = value['type']
    const fmt = value['format']
    if (t === 'yoy') return true
    if (t === 'share' || t === 'cagr') return false
    if (t === 'point' || t === 'expr' || t === 'mean' || t === 'metric')
      return typeof fmt === 'string' && PCT_FORMATS.has(fmt)
    return typeof fmt === 'string' && PCT_FORMATS.has(fmt)
  }
  // A metric DEFINITION: `format` directly on the object, no nested `value` spec.
  if ('format' in obj && !('value' in obj)) {
    const fmt = obj['format']
    return typeof fmt === 'string' && PCT_FORMATS.has(fmt)
  }
  return null
}

interface Offender { path: string; kind: string }

function collectOffenders(node: unknown, path: string, out: Offender[]): void {
  if (Array.isArray(node)) {
    node.forEach((n, i) => collectOffenders(n, `${path}[${i}]`, out))
    return
  }
  if (!isPlainObject(node)) return
  if (isPctUnit(node['unit']) && emitsPct(node) === true) {
    const id = node['id'] ?? node['metric'] ?? '(anon)'
    out.push({ path: `${path} · ${String(id)}`, kind: JSON.stringify(node['value'] ?? node['format']) })
  }
  for (const [key, value] of Object.entries(node)) collectOffenders(value, `${path}.${key}`, out)
}

describe('config-tier — no redundant "%" unit on a percent-formatted KPI/metric (REQ A, no "%%")', () => {
  let offenders: Offender[]

  beforeAll(() => {
    const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8'))
    offenders = []
    collectOffenders(artifact, '$', offenders)
  })

  it('flags nothing — every %-formatter card/metric renders "%" ONCE (value, not unit)', () => {
    const report = offenders.map((o) => `  · ${o.path} — value/format ${o.kind}`).join('\n')
    expect(
      offenders.length,
      `\n${offenders.length} KPI/metric render "%%" — value is percent-formatted AND unit is "%":\n${report}\n` +
        `Fix: remove the redundant "unit":"%" (the formatter already appends "%").\n`,
    ).toBe(0)
  })
})
