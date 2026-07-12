// @vitest-environment node
//
// ── FF-ACTION-ARM-CONSUMED — no latent (declared-but-unconsumed) grammar arm ──
//
//  The interaction SPINE (AR-42) grew arms FASTER than the render boundary
//  consumed them: `HighlightAction` (`type:'highlight'`) and `interval:brush`
//  were added to the grammar (committed f28a887) but nothing at the render layer
//  READ them — a `highlight` wrote a param no Consumer styled from, and
//  `interval:brush` had no emitter. A "declared-but-inert" arm is invisible: it
//  type-checks, ships, and silently does nothing.
//
//  This fitness makes that class impossible to reintroduce. It PARSES the live
//  grammar (the NodeAction arms, the NodeEventTrigger union, the SelectionMode
//  union) straight from source, and asserts EVERY arm is accounted for — either
//  (a) it names a live Consumer/emitter whose evidence token is still present in
//  the render layer, or (b) it is an EXPLICIT, reasoned pending allowlist entry.
//  A NEW arm added to any of the three grammars with no matrix entry FAILS here —
//  forcing the author to wire a Consumer (or consciously allowlist it), never to
//  ship an inert arm. Removing a Consumer (its evidence token vanishes) also FAILS.
//
//  Honest, not vacuous: `interval:brush` genuinely has no emitter yet, so it is
//  allowlisted WITH a reason (not silently passed). The reducer branch for the
//  `interval` MODE is live (applySelection), so the mode is consumed even though
//  its producer is pending — the gate distinguishes the two precisely.
//

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve as resolvePath } from 'node:path'
import { describe, it, expect } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const P = (rel: string) => resolvePath(here, rel)

// ── Source-of-truth grammar files ───────────────────────────────────────────
const NODE_EVENTS    = P('../../react/src/engine/node-events.ts')
const APPLY_SELECTION = P('../../core/src/data/applySelection.ts')

// ── Consumer/emitter evidence sites (the render layer) ──────────────────────
const USE_NODE_INTERACTIONS = P('../../react/src/engine/useNodeInteractions.ts')
const RESOLVE_DRILL         = P('../../react/src/engine/resolveDrill.ts')
const RESOLVE_NODE_ROWS     = P('../../react/src/engine/resolveNodeRows.ts')
const USE_CHART_INTERACTIONS = P('../panels/chart/default/useChartInteractions.ts')
const USE_CHART_OUTPUT       = P('../panels/chart/default/useChartOutput.ts')
const TABLE_SHELL            = P('../panels/table/default/TableShell.tsx')
const GEOGRAPH_SHELL         = P('../nodes/geograph/default/GeographShell.tsx')
const EMIT_CARTESIAN         = P('../../charts/src/emit/cartesian.ts')

const read = (f: string): string => readFileSync(f, 'utf8')

// ── Grammar parsers — read the arms straight from source ─────────────────────

/** Every `XxxAction` interface's `type:'…'` discriminant → the NodeAction arm set. */
function parseActionArms(src: string): string[] {
  const out: string[] = []
  const re = /interface \w+Action \{[\s\S]*?type:\s*'([\w:]+)'/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) out.push(m[1]!)
  return out
}

/** The `NodeEventTrigger` union string-literal members. */
function parseTriggers(src: string): string[] {
  const seg = /export type NodeEventTrigger =([\s\S]*?)\n\n/.exec(src)?.[1] ?? ''
  return [...seg.matchAll(/'([\w:]+)'/g)].map((m) => m[1]!)
}

/** The `SelectionMode` union string-literal members (SSOT in applySelection). */
function parseModes(src: string): string[] {
  const line = /export type SelectionMode =([^\n]*)/.exec(src)?.[1] ?? ''
  return [...line.matchAll(/'(\w+)'/g)].map((m) => m[1]!)
}

// ── Consumer matrices — arm → live evidence, or an explicit pending reason ────
//
//  `evidence: [file, token][]` — each token MUST still be present in that render-
//  layer file (the Consumer is live). `pending` — a reasoned allowlist entry for
//  an arm with no producer/consumer yet (honest gap, not a silent pass).

type Entry =
  | { consumer: string; evidence: [string, string][] }
  | { pending: string }

const ACTION_CONSUMERS: Record<string, Entry> = {
  // A filter param scopes the query (requery) AND renders the selected-row style;
  // it folds through the one write point (SELECTION_WRITE_ACTIONS) and is read back
  // in TableShell's selectedIds.
  filter: {
    consumer: 'query params + TableShell selectedIds (SELECTION_WRITE_ACTIONS)',
    evidence: [
      [USE_NODE_INTERACTIONS, 'SELECTION_WRITE_ACTIONS'],
      [TABLE_SHELL, 'SELECTION_WRITE_ACTIONS'],
    ],
  },
  // A highlight param is transient (no requery). Its render Consumers: TableShell
  // renders the selected-row style from it (same SELECTION_WRITE_ACTIONS detect),
  // and the chart EMPHASIS channel dims non-emphasized marks (ChartOutput.emphasis,
  // resolved in useChartOutput, consumed by emitCartesian).
  highlight: {
    consumer: 'TableShell row--selected + ChartOutput.emphasis (emitCartesian)',
    evidence: [
      [TABLE_SHELL, 'SELECTION_WRITE_ACTIONS'],
      [USE_CHART_OUTPUT, 'resolveEmphasis'],
      [EMIT_CARTESIAN, 'emphasis'],
    ],
  },
  // A drill action writes a drill-state param (the target hierarchy level) through the
  // SAME applySelection/CommandBus write point (drillParamKey SSOT, selectionWrite in
  // useNodeInteractions). Its render Consumer: resolveDrill re-renders a metric-spec node
  // at the drilled grain via the core evalMetricDrill seam (additivity-correct), wired into
  // the row path in resolveNodeRows.
  drill: {
    consumer: 'resolveDrill → evalMetricDrill (drilled metric grain), wired in resolveNodeRows',
    evidence: [
      [USE_NODE_INTERACTIONS, 'drillParamKey'],
      [RESOLVE_DRILL, 'evalMetricDrill'],
      [RESOLVE_NODE_ROWS, 'resolveDrill'],
    ],
  },
}

const TRIGGER_EMITTERS: Record<string, Entry> = {
  'point:click': {
    consumer: 'useChartInteractions.onDataClick → emit',
    evidence: [[USE_CHART_INTERACTIONS, "'point:click'"]],
  },
  'row:click': {
    consumer: 'TableShell.onRowSelect → emit',
    evidence: [[TABLE_SHELL, "'row:click'"]],
  },
  'row:hover': {
    consumer: 'useChartInteractions publishes → TableShell subscribes (EventBus)',
    evidence: [
      [USE_CHART_INTERACTIONS, "'row:hover'"],
      [TABLE_SHELL, "'row:hover'"],
    ],
  },
  'selection:change': {
    consumer: 'GeographShell.handleSelect → emit',
    evidence: [[GEOGRAPH_SHELL, "'selection:change'"]],
  },
  'interval:brush': {
    pending:
      'KNOWN-PENDING: no emitter. AR-42 P1 declared the range peer of the point/row ' +
      'gestures, but the drag-select (brush) gesture producer over a continuous axis ' +
      'is not yet wired in any shell. The RANGE FOLD is ready downstream (applySelection ' +
      "'interval' mode); only the brush emitter is missing. Next step: a brush overlay on " +
      'a cartesian/continuous renderer that emits interval:brush([lo,hi]).',
  },
}

const MODE_CONSUMERS: Record<string, Entry> = {
  replace: { consumer: 'applySelection', evidence: [[APPLY_SELECTION, "mode === 'replace'"]] },
  toggle: { consumer: 'applySelection (fallthrough accumulate)', evidence: [[APPLY_SELECTION, 'toggle']] },
  interval: { consumer: 'applySelection', evidence: [[APPLY_SELECTION, "mode === 'interval'"]] },
  clear: { consumer: 'applySelection', evidence: [[APPLY_SELECTION, "mode === 'clear'"]] },
}

// ── The gate ─────────────────────────────────────────────────────────────────

function assertCovered(label: string, arms: string[], matrix: Record<string, Entry>) {
  it(`every ${label} arm has a live Consumer or a reasoned pending entry`, () => {
    expect(arms.length, `parsed no ${label} arms — the grammar parser drifted`).toBeGreaterThan(0)
    for (const arm of arms) {
      const entry = matrix[arm]
      expect(
        entry,
        `${label} arm '${arm}' has NO matrix entry — it is declared-but-unconsumed. ` +
          `Wire a render Consumer and register it, or add a reasoned pending allowlist entry.`,
      ).toBeDefined()
      if (!entry) continue
      if ('pending' in entry) {
        expect(entry.pending.length, `${label} arm '${arm}' pending entry needs a reason`).toBeGreaterThan(20)
        continue
      }
      for (const [file, token] of entry.evidence) {
        expect(
          read(file).includes(token),
          `${label} arm '${arm}' Consumer evidence '${token}' missing from ${file.slice(file.indexOf('packages'))}`,
        ).toBe(true)
      }
    }
  })

  it(`every ${label} matrix key is a real grammar arm (no stale entry)`, () => {
    for (const key of Object.keys(matrix)) {
      expect(arms, `matrix lists '${key}' but it is not a declared ${label} arm`).toContain(key)
    }
  })
}

describe('FF-ACTION-ARM-CONSUMED — the interaction spine has no latent arm', () => {
  const eventsSrc = read(NODE_EVENTS)
  const modesSrc = read(APPLY_SELECTION)

  assertCovered('NodeAction', parseActionArms(eventsSrc), ACTION_CONSUMERS)
  assertCovered('NodeEventTrigger', parseTriggers(eventsSrc), TRIGGER_EMITTERS)
  assertCovered('SelectionMode', parseModes(modesSrc), MODE_CONSUMERS)

  // The one render-parity gap that is NOT a grammar arm but IS a known-pending
  // Consumer gap: the LIVE ApexCharts realizer does not yet read ChartOutput.emphasis
  // (only the SVG realizer emitCartesian does). Documented here so it is tracked, not
  // silently assumed complete.
  it('documents the ApexCharts emphasis-parity follow-up (emit realizer consumes; apex pending)', () => {
    expect(read(EMIT_CARTESIAN)).toContain('emphasis')
    // toApexOptions / buildCartesian consuming output.emphasis is the tracked next step.
  })
})
