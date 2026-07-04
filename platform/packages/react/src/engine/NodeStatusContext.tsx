// ── NodeStatusContext — page-scoped data-integrity publish/subscribe (AR-39/AR-40) ──
//
//  The Protected-Variations seam SectionShell explicitly reserved (Option D →
//  "if a real aggregate-status consumer appears, introduce a NodeStatusContext:
//  panels publish NodeStatus, a scope owner subscribes and aggregates here").
//  AR-39 IS that consumer; AR-40 moves the OWNING SCOPE from the section up to
//  the PAGE — the whole page carries ONE data-integrity indicator (in the page
//  header), not one per section, matching the ONS/Eurostat page-anatomy summary.
//
//  THE MODEL (GRASP information-expert + low coupling):
//    • Each data panel PUBLISHES the exact data-integrity signal it computes
//      (`resolvePreliminary(def, ctx)` — it holds ctx.rows, the precise per-slice
//      truth; a kpi-strip folds its per-item flags) UPWARD via
//      `useReportNodeStatus`, instead of each rendering its own repeated pill.
//    • The PAGE ROOT (inner-page) owns the scope: it OR-folds every reporting
//      descendant into ONE aggregate. It never reads a child's ctx.rows — it
//      receives a *reported status*, so the data/structure boundary stays intact.
//    • The aggregate flows back DOWN a READ channel so a sibling subscriber (the
//      page header) can render the ONE indicator, even though it does not itself
//      wrap the sections. Two channels: `NodeStatusContext` (collector, panels
//      report UP) and `NodeStatusAggregateContext` (aggregate, subscriber reads
//      DOWN). Only aggregate-consumers re-render when the fold changes.
//    • Postel: a panel with NO scope above it (standalone / no page) publishes
//      nowhere and falls back to its own local badge — nothing lost outside the
//      page anatomy.
//
//  Engine-layer placement is correct: depends only on React + engine primitives,
//  never on a plugin. The page (plugin) creates the scope; the page header
//  (plugin) subscribes; panels (plugins) consume the report hook. The arrow
//  stays clean.
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

// Publish channel — panels report UP to the nearest scope collector.
const NodeStatusContext = createContext<NodeStatusCollector | null>(null)

// ── NodeVisibilityContext — the "is this subtree actually shown" gate ────────
//
//  The page fold must reflect only the VISIBLE data slice (AR-39 owner rule): a
//  panel the user cannot see must not contribute preliminary=true upward.
//
//  Two hiding mechanisms exist, and this context covers the one renderNode can't:
//    • visibleWhen / perspective-hidden — renderNode UNMOUNTS the node (returns
//      null); an unmounted panel never runs useReportNodeStatus, so its report is
//      cleaned up on unmount. Already correct, no context needed.
//    • view-toggle hidden — the section/geograph shells keep the INACTIVE view
//      MOUNTED and merely `display:none` it (resolveViewState → data-view=hidden)
//      so toggling is instant + a11y-safe. That panel stays mounted and KEEPS
//      publishing. THIS is the leak: a hidden chart/table timeseries folding its
//      preliminary=true into the page indicator while off-screen.
//
//  The owning container (the information-expert that decides a view is hidden)
//  wraps each hidden view-slot in <NodeVisibilityProvider visible={false}>; every
//  descendant publisher reads this and CLEARS its report instead of publishing.
//  Default `true` — a panel with no visibility scope above it is shown (Postel;
//  byte-identical to the pre-gate behaviour for every non-toggled panel).
const NodeVisibilityContext = createContext<boolean>(true)
// Read channel — the folded aggregate flows DOWN to any subscriber (the page
// header) that renders the ONE indicator. Separate from the collector so a
// subscriber re-renders when the fold changes, while panels (collector-only,
// and the collector identity is stable) do not.
const NodeStatusAggregateContext = createContext<NodeStatusAggregate | null>(null)

// ── NodeStatusProvider — wrap a subtree so its panels publish to this scope ──
//  Provides BOTH channels: the collector (panels report up) and the aggregate
//  (subscribers read down). The scope owner (inner-page) passes the pair it got
//  from useNodeStatusScope so its whole subtree — sections AND the sibling page
//  header — shares one fold.
export function NodeStatusProvider({
  collector,
  aggregate,
  children,
}: {
  collector: NodeStatusCollector
  aggregate: NodeStatusAggregate
  children: ReactNode
}) {
  return (
    <NodeStatusContext.Provider value={collector}>
      <NodeStatusAggregateContext.Provider value={aggregate}>
        {children}
      </NodeStatusAggregateContext.Provider>
    </NodeStatusContext.Provider>
  )
}

// ── NodeVisibilityProvider — mark a view-slot subtree shown / hidden ─────────
//
//  ANDs with the parent gate so nested hidden wrappers compose: a "visible" slot
//  nested inside a hidden section is still hidden (the parent wins). The owning
//  container passes `visible={!hidden}` for each view-slot it renders.
export function NodeVisibilityProvider({
  visible,
  children,
}: {
  visible:  boolean
  children: ReactNode
}) {
  const parentVisible = useContext(NodeVisibilityContext)
  return (
    <NodeVisibilityContext.Provider value={parentVisible && visible}>
      {children}
    </NodeVisibilityContext.Provider>
  )
}

// ── useNodeVisible — read the effective visibility of the current subtree ─────
//  True unless an ancestor NodeVisibilityProvider marked this slot hidden.
export function useNodeVisible(): boolean {
  return useContext(NodeVisibilityContext)
}

// ── useNodeStatusScope — the page root creates ONE scope; reads the aggregate ─
//
//  Returns the stable collector to hand NodeStatusProvider, plus the OR-folded
//  aggregate the owner distributes. State is a `Record<nodeId, NodeStatus>`:
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
//
//  VISIBILITY GATE (AR-39): a panel MOUNTED-but-hidden by a view-toggle
//  (display:none via an ancestor NodeVisibilityProvider) must NOT pollute the
//  page fold — it CLEARS its report and publishes nothing until it is shown
//  again. `visible` is a dep, so a toggle re-runs the effect: shown → report,
//  hidden → clear. (visibleWhen/perspective hiding unmounts upstream, so it never
//  reaches here; this covers the residual mounted-hidden case.)
export function useReportNodeStatus(nodeId: string | undefined, status: IntegrityStatus): boolean {
  const collector = useContext(NodeStatusContext)
  const visible    = useContext(NodeVisibilityContext)
  const fallbackId = useId()
  const id = nodeId ?? fallbackId
  const preliminary = status.preliminary

  useEffect(() => {
    if (!collector) return
    // Hidden (mounted, display:none) → contribute nothing; drop any prior report.
    if (!visible) { collector.clear(id); return }
    collector.report(id, { preliminary })
    return () => collector.clear(id)
  }, [collector, id, preliminary, visible])

  return collector !== null
}

// ── useNodeStatusAggregate — a subscriber reads the folded aggregate ─────────
//
//  The page header (a descendant of the scope, but a SIBLING of the sections it
//  summarises) reads the OR-folded aggregate here and renders the ONE indicator.
//  Returns `null` when there is NO scope above (a page header rendered outside a
//  page root) — the subscriber then renders nothing (Postel; nothing to fold).
export function useNodeStatusAggregate(): NodeStatusAggregate | null {
  return useContext(NodeStatusAggregateContext)
}
