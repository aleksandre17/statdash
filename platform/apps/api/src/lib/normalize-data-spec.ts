// ── normalize-data-spec — the ONE-DIALECT normalize-on-write seam (W0 / Z8) ────
//
//  ONE-PIPE §4·D1 + three-zooms §Z8. The rest grammar is ONE: every stored
//  DataSpec is `type:'pipeline'`. The sugar dialects remain ACCEPTED at the write
//  boundary forever (Postel — they are the manifest's *input* grammar), but they
//  are LOWERED here, via the engine's OWN `desugarToPipeline` (never a
//  re-implementation), before anything persists. This is THE enforcement seam —
//  the panel's lane emission flip is UX consistency on top of it, never a
//  substitute. Every `config.data_spec` write path (POST create · PUT update ·
//  revision restore) routes through this function so the invariant cannot be
//  bypassed by picking a different door.
//
//  U2-BLOCKED ALLOWLIST (must EMPTY at U2 — the FF-ALL-KINDS-SHAPED pattern):
//  the kinds `desugarToPipeline` cannot yet fold pass through UNCHANGED, held by
//  the EXPLICIT set below. FF-ONE-DIALECT-AT-REST freezes the set byte-for-byte —
//  regrowth (a new sugar kind resting un-lowered) fails the build.
//
//    • ratio-list         — DU4c: needs the `cells` head (ADR-046 Add.5 / U2)
//    • row-list           — DU4d: same `cells` head + store-meta enrichment
//    • growth (multi-code) — per-code store meta read; single-code growth FOLDS
//    • metric             — SURFACED past-the-brief finding: `desugarToPipeline`
//                           returns it identity today ("already a source(metrics)
//                           head by construction" — its mechanical hoist is D1
//                           tail work, not designed yet). Allowlisted explicitly
//                           rather than silently rejected or silently stored.
//
//  A spec that is NOT a known DataSpec kind passes through untouched — dialect
//  judgment belongs to the validated-PUT shape gate (`validateConfigDoc`), which
//  rejects unknown discriminants; this seam never widens that contract.

import { desugarToPipeline, DATASPEC_DISCRIMINANTS, type DataSpec } from '@statdash/engine'
import type { ConfigViolation } from '@statdash/contracts'

/** The sugar kinds legally at rest until their fold lands (U2 empties this). */
export const SUGAR_AT_REST_ALLOWLIST: ReadonlySet<string> = new Set([
  'ratio-list',
  'row-list',
  'growth',   // multi-code only — a single-code growth FOLDS and never rests as sugar
  'metric',
])

const KNOWN_KINDS = new Set<string>(DATASPEC_DISCRIMINANTS)

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

export type NormalizeResult =
  | { spec: Record<string, unknown> }
  | { violation: ConfigViolation }

/**
 * Lower an incoming spec to the ONE rest grammar. Total over arbitrary JSON:
 *  • foldable sugar (`query`/`transform`/`pivot`/`timeseries`/single-code `growth`)
 *    → its `pipeline` lowering (the engine SSOT);
 *  • `pipeline` + the U2-blocked allowlist kinds → identity (honest pass-through);
 *  • not-an-object / unknown kind → identity (the shape gate owns that verdict);
 *  • a foldable kind too MALFORMED to lower (e.g. `transform` without `steps`)
 *    → a `shape` violation — never a 500, never silent sugar at rest.
 */
export function normalizeSpecForRest(spec: unknown): NormalizeResult {
  if (!isObj(spec) || typeof spec['type'] !== 'string' || !KNOWN_KINDS.has(spec['type'])) {
    return { spec: (isObj(spec) ? spec : {}) as Record<string, unknown> }
  }
  let lowered: DataSpec
  try {
    lowered = desugarToPipeline(spec as unknown as DataSpec)
  } catch (e) {
    return {
      violation: {
        check:  'shape',
        path:   '/spec',
        ref:    spec['type'],
        detail: `spec of kind '${spec['type']}' could not be lowered to the pipeline rest grammar: ${
          e instanceof Error ? e.message : String(e)}`,
      },
    }
  }
  // Drift guard: a KNOWN kind that neither lowers nor is allowlisted must never
  // rest as sugar silently (the class this seam exists to kill). Unreachable
  // today (every identity kind is 'pipeline' or allowlisted) — biting the day a
  // new discriminant lands without a fold or an explicit allowlist entry.
  if (lowered === (spec as unknown) && spec['type'] !== 'pipeline'
      && !SUGAR_AT_REST_ALLOWLIST.has(spec['type'])) {
    return {
      violation: {
        check:  'shape',
        path:   '/spec/type',
        ref:    spec['type'],
        detail: `spec kind '${spec['type']}' neither lowers to the pipeline rest grammar nor is `
          + `an allowlisted U2-blocked kind — extend the fold or the explicit allowlist, never store sugar silently`,
      },
    }
  }
  return { spec: lowered as unknown as Record<string, unknown> }
}
