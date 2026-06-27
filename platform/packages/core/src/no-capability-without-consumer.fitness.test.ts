// ── FF-NO-CAPABILITY-WITHOUT-CONSUMER — the adoption-debt invariant [X-2] ─────
//
//  THE DOCTRINE, MADE ENFORCEABLE. The platform repeatedly built "cathedrals
//  without congregations" — fully-wired, fitness-locked capabilities with ZERO
//  runtime consumers (the semantic layer, the `metric` scope no-op, the `custom`
//  dead discriminant). Each rotted because nothing exercised the seam.
//
//  This meta-fitness makes that class of debt a CI-VISIBLE, SHRINKING NUMBER (same
//  spirit as the Constructor coverage gate): every registered / authorable
//  capability key MUST have a runtime consumer OR sit on an explicit, named,
//  shrinking deferred-list. A capability that is built but unused now FAILS here —
//  it cannot be merged silently. No cathedral without a congregation again.
//
//  Three capability families are guarded at the ENGINE tier:
//    A. DataSpec discriminants   — consumer = a registered SpecResolver.
//    B. Perspective scope-keys   — consumer = a read in scopeCtxByPerspective.
//    C. Registered MetricDefs    — consumer = resolvable through resolveMeasureRef
//       (the one binding seam). Config-REFERENCE adoption (a page using the id) is
//       enforced one tier out, at the provisioning gate (apps/api).
//
// @vitest-environment node

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { describe, it, expect } from 'vitest'

import { DATASPEC_DISCRIMINANTS } from './config/discriminant-manifest'
import { defaultRegistry } from './registry/engine'
import './registry/resolvers'                 // side-effect: register every built-in resolver
import { listPerspectiveScopeKeys } from './config/perspective-scope-registry'
import './config/perspective-scope-schemas'   // side-effect: register timeBinding + metric scope-keys
import { listMetricDefs, registerMetric, resolveMeasureRef } from './data/metric'

const srcDir = fileURLToPath(new URL('.', import.meta.url))
const read = (rel: string) => readFileSync(srcDir + rel, 'utf8')

// ── A. DataSpec discriminants ─────────────────────────────────────────────────
//
//  Every authorable DataSpec discriminant must dispatch to a REGISTERED resolver.
//  The deferred-list is the named, shrinking escape — EMPTY today (the `custom`
//  dead discriminant was removed wholesale, ENG-16; the single extension path is
//  registerSpec). A discriminant with no resolver and no deferred entry FAILS.
const DATASPEC_DEFERRED: Record<string, string> = {
  // (empty) — every shipped discriminant has a runtime resolver.
}

describe('A · DataSpec discriminants — no discriminant without a resolver', () => {
  it('every DATASPEC_DISCRIMINANT has a registered SpecResolver or a named deferral', () => {
    const registered = new Set(defaultRegistry.specTypes())
    const orphans = DATASPEC_DISCRIMINANTS.filter(
      (d) => !registered.has(d) && !(d in DATASPEC_DEFERRED),
    )
    expect(orphans, `DataSpec discriminants with no consumer:\n${orphans.join('\n')}`).toEqual([])
  })

  it('the deferred-list is a SHRINKING number (0 today — doctrine satisfied)', () => {
    expect(Object.keys(DATASPEC_DEFERRED).length).toBe(0)
  })
})

// ── B. Perspective scope-keys ─────────────────────────────────────────────────
//
//  Every registered perspective-scope key (authorable via the Constructor pane)
//  must be READ by scopeCtxByPerspective — the runtime that folds the active
//  perspective's scope into ctx. A key that is authorable but folds NOTHING is the
//  exact `metric` no-op this epic closed (ENG-10). The deferred-list names any key
//  intentionally registered ahead of its runtime — EMPTY today.
const SCOPE_KEY_DEFERRED: Record<string, string> = {
  // (empty) — timeBinding + metric are both applied in scopeCtxByPerspective.
}

describe('B · Perspective scope-keys — no authoring affordance without runtime', () => {
  const parserSrc = read('config/perspective-axis-parser.ts')

  it('every registered scope-key is consumed in scopeCtxByPerspective (or named-deferred)', () => {
    const keys = listPerspectiveScopeKeys()
    expect(keys.length, 'expected the built-in scope-keys to be registered').toBeGreaterThan(0)
    const orphans = keys.filter((k) => {
      // The runtime reads the key off `def.scope` — `scope?.<key>` / `scope.<key>`.
      const consumed = parserSrc.includes(`scope?.${k}`) || parserSrc.includes(`scope.${k}`)
      return !consumed && !(k in SCOPE_KEY_DEFERRED)
    })
    expect(orphans, `scope-keys authorable but not folded at runtime:\n${orphans.join('\n')}`).toEqual([])
  })

  it('both registered keys are present AND consumed (non-vacuous)', () => {
    expect(listPerspectiveScopeKeys()).toEqual(expect.arrayContaining(['timeBinding', 'metric']))
    expect(parserSrc).toMatch(/scope\?\.timeBinding/)
    expect(parserSrc).toMatch(/scope\?\.metric/)
  })

  it('the deferred-list is a SHRINKING number (0 today — doctrine satisfied)', () => {
    expect(Object.keys(SCOPE_KEY_DEFERRED).length).toBe(0)
  })
})

// ── C. Registered MetricDefs ──────────────────────────────────────────────────
//
//  Every registered metric must be CONSUMABLE through the one binding seam
//  (resolveMeasureRef) — i.e. it expands to ≥1 underlying store code, never an
//  orphan disconnected from the resolution path. This bites the moment a metric is
//  registered with no code. (Config-REFERENCE adoption — a page actually using the
//  id — is asserted at the provisioning tier, apps/api, where page configs live.)
describe('C · Registered MetricDefs — no metric orphaned from the binding seam', () => {
  it('every registered metric resolves to ≥1 underlying code via resolveMeasureRef', () => {
    const orphans = Object.keys(listMetricDefs()).filter(
      (id) => resolveMeasureRef(id).codes.length === 0,
    )
    expect(orphans, `metrics not consumable via the binding seam:\n${orphans.join('\n')}`).toEqual([])
  })

  it('the gate BITES: a registered metric flows through resolveMeasureRef to its code', () => {
    // Non-vacuous proof — register a real metric and prove the consumer reaches it.
    registerMetric('metric:adoption-probe', { code: 'B1G', label: { ka: 'პრობი', en: 'Probe' } })
    expect(resolveMeasureRef('metric:adoption-probe').codes).toContain('B1G')
    // And the general invariant still holds with it registered.
    const orphans = Object.keys(listMetricDefs()).filter(
      (id) => resolveMeasureRef(id).codes.length === 0,
    )
    expect(orphans).toEqual([])
  })
})
