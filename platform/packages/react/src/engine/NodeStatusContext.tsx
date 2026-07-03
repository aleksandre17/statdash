// ── NodeStatusContext — section-scoped data-integrity publish/subscribe (AR-39) ──
//
//  The Protected-Variations seam SectionShell explicitly reserved (Option D →
//  "if a real aggregate-status consumer appears, introduce a NodeStatusContext:
//  panels publish NodeStatus, the section subscribes and aggregates here"). AR-39
//  IS that second consumer, so the fence opens for the reason it was left — not
//  speculatively (YAGNI satisfied).
//
//  THE MODEL (GRASP information-expert + low coupling):
//    • Each data panel PUBLISHES the exact data-integrity signal it already
//      computes (`resolvePreliminary(def, ctx)` — it holds ctx.rows, the precise
//      per-slice truth) UPWARD via `useReportNodeStatus`, instead of each
//      rendering its own repeated "Prelim." pill.
//    • The nearest scope (a section) SUBSCRIBES, OR-folds children into ONE
//      aggregate, and renders a SINGLE integrity indicator. The section never
//      reads a child's ctx.rows — it receives a *reported status*, so the
//      data/structure boundary stays intact (the thing Option D protected).
//    • Postel: a panel with NO scope above it (standalone / outside a section)
//      publishes nowhere and falls back to its own local badge — nothing lost
//      outside the page anatomy.
//
//  Engine-layer placement is correct: depends only on React + engine primitives,
//  never on a plugin. Sections (plugins) consume the scope; panels (plugins)
//  consume the report hook. The arrow stays clean.
//

import { createContext, useContext, useEffect, useId, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

// ── The published unit ────────────────────────────────────────────────────
//
//  Deliberately a small OPEN record, not a bare boolean: `preliminary` is the
//  first (and today only) integrity facet, but vintage / OBS_STATUS aggregation
//  are the natural next facets (Law 8 — a new facet = a new optional field, the
//  publish/subscribe interface unchanged).
export interface IntegrityStatus {
  /** True when this node's DISPLAYED data is preliminary (SDMX 'p' or author override). */
  preliminary?: boolean
}

/** The OR-folded view a scope owner (section) reads to render ONE indicator. */
export interface NodeStatusAggregate {
  /** True when ANY reporting descendant published preliminary data. */
  preliminary: boolean
  /** How many descendants have reported (0 ⇒ nothing to consolidate). */
  count: number
}

interface NodeStatusCollector {
  report(nodeId: string, status: IntegrityStatus): void
  clear(nodeId: string): void
}

const NodeStatusContext = createContext<NodeStatusCollector | null>(null)

// ── NodeStatusProvider — wrap a subtree so its panels publish to this scope ──
export function NodeStatusProvider({
  collector,
  children,
}: {
  collector: NodeStatusCollector
  children: ReactNode
}) {
  return <NodeStatusContext.Provider value={collector}>{children}</NodeStatusContext.Provider>
}

// ── useNodeStatusScope — a section creates ONE scope; reads the aggregate ─────
//
//  Returns the stable collector to hand NodeStatusProvider, plus the OR-folded
//  aggregate the owner renders from. State is a `Record<nodeId, NodeStatus>`:
//  report is an idempotent upsert (no state churn when a panel re-publishes the
//  same status), clear removes on unmount — so a panel that stops being
//  preliminary (or unmounts) drops out of the fold. The extra commit a child's
//  post-mount report triggers is one bounded pass (deps are primitive-stable, so
//  no report loop).
export function useNodeStatusScope(): { collector: NodeStatusCollector; aggregate: NodeStatusAggregate } {
  const [byId, setById] = useState<Record<string, IntegrityStatus>>({})

  const collector = useMemo<NodeStatusCollector>(
    () => ({
      report: (id, s) =>
        setById((prev) => {
          const cur = prev[id]
          if (cur && cur.preliminary === s.preliminary) return prev // idempotent — no churn
          return { ...prev, [id]: s }
        }),
      clear: (id) =>
        setById((prev) => {
          if (!(id in prev)) return prev
          const next = { ...prev }
          delete next[id]
          return next
        }),
    }),
    [],
  )

  const aggregate = useMemo<NodeStatusAggregate>(() => {
    const values = Object.values(byId)
    return {
      preliminary: values.some((s) => s.preliminary === true),
      count:       values.length,
    }
  }, [byId])

  return { collector, aggregate }
}

// ── useReportNodeStatus — a panel publishes its status to the nearest scope ──
//
//  Returns TRUE when a scope is present (the panel published upward and should
//  render NO local pill); FALSE when standalone (the panel renders its own badge,
//  Postel). Keyed on the node's authored id, falling back to a stable useId() so
//  an id-less panel still reports exactly once. The report runs in an effect
//  (post-commit) with primitive-stable deps, so it fires on mount / when the
//  status flips, and cleans up on unmount — never in a loop.
export function useReportNodeStatus(nodeId: string | undefined, status: IntegrityStatus): boolean {
  const collector = useContext(NodeStatusContext)
  const fallbackId = useId()
  const id = nodeId ?? fallbackId
  const preliminary = status.preliminary

  useEffect(() => {
    if (!collector) return
    collector.report(id, { preliminary })
    return () => collector.clear(id)
  }, [collector, id, preliminary])

  return collector !== null
}
