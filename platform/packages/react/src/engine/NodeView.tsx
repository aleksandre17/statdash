// ── NodeView — framework-level registry composition component ─────────────
//
//  Registry-as-composition (Service Locator), the JSX half. Mirrors Grafana's
//  <PanelRenderer type=… /> and Builder.io's <BuilderComponent />: you look a
//  node up BY NAME and get something directly renderable in JSX — no direct
//  import of the target shell, no manual pipeline wiring.
//
//    import { NodeView } from '@statdash/react/engine'
//
//    // inside ANY shell's render — compose a chart by name:
//    return <NodeView type="chart" def={myChartDef} ctx={ctx} />
//
//  Why route through renderNode (the full pipeline), not a bare shell call:
//    A composed node must be SELF-CONTAINED to honour least-astonishment. A
//    'chart' looked up by name has to fetch its own rows, run validate/migrate,
//    apply RBAC visibility, compute its viewState, and isolate its own crashes
//    (ErrorBoundary) + skeletons (Suspense) — exactly what renderNode does. A
//    bare shell(def, ctx, children) call would silently skip all of that and
//    render an empty/wrong node. So NodeView IS renderNode addressed by a
//    string type rather than by a pre-built NodeBase.
//
//  Type safety for the generic `def`:
//    Props are generic over K extends keyof NodeTypeMap. When K is a known node
//    type, `def` is required to be NodeTypeMap[K] (the exact shape) — full def
//    specificity, no `any`. For runtime-registered/unknown types, the string
//    fallback overload keeps it usable with the NodeBase contract. The `type`
//    literal and the `def.type` are reconciled below so the rendered NodeBase
//    always carries the looked-up type.
//
//  Relationship to nodeRegistry.getShell():
//    getShell(type) is the LOW-LEVEL half — returns the renderer for callers who
//    already hold a ChildrenArg and want to bypass the pipeline. NodeView is the
//    HIGH-LEVEL half for the 99% JSX case. Together they are Option D: one cheap
//    composition primitive at each altitude (Law 8: open for extension).
//
//  Law 3 (Clean Architecture): this lives in engine/react and is fully
//  app-agnostic — it knows only NodeTypeMap + the registry, never any Geostat
//  concrete node. New node types compose through it with zero change here.
//

import { type ReactNode }      from 'react'
import { renderNode }          from './renderNode'
import type { NodeBase, NodeTypeMap, RenderContext } from './types'

// ── Props ─────────────────────────────────────────────────────────────────
//
//  Generic over the registry's NodeTypeMap so `def` keeps its exact type.
//  `variant` is optional — the registry falls back to 'default' (get/getShell).
//
export type NodeViewProps<K extends keyof NodeTypeMap = keyof NodeTypeMap> = {
  /** Registered node type to look up by name (e.g. 'chart', 'section'). */
  type:     K
  /** Node config for the looked-up type. Typed to NodeTypeMap[K] — exact shape. */
  def:      NodeTypeMap[K]
  /** Render context (rows, filters, scope, eventBus…) — threaded into the pipeline. */
  ctx:      RenderContext
  /** Optional variant; falls back to 'default' when not registered. */
  variant?: string
}

/**
 * Look up a node shell by name from the registry and render it through the
 * full engine pipeline. The composing shell needs no direct import of the
 * target shell — this is the framework composition contract.
 *
 * Returns `null` when the type is not registered (renderNode's own contract),
 * so a composing shell degrades gracefully rather than crashing on a missing
 * capability (fail-soft at the composition seam; the node-level fail-fast for
 * malformed config still runs inside renderNode's validate step).
 */
export function NodeView<K extends keyof NodeTypeMap = keyof NodeTypeMap>(
  { type, def, ctx, variant }: NodeViewProps<K>,
): ReactNode {
  // Reconcile the addressed `type`/`variant` onto the NodeBase renderNode walks.
  // The `type` prop is the source of truth for the lookup; merge it (and variant
  // when given) so callers can pass a def authored without a redundant `type`.
  const node: NodeBase = {
    ...(def as unknown as NodeBase),
    type:    type as string,
    ...(variant !== undefined ? { variant } : {}),
  }
  return renderNode(node, ctx)
}
