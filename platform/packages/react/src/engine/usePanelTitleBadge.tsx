// ── usePanelTitleBadge — the panel-title badge seam (M-5 capability) ──────
//
//  Every data panel shell (chart / table / gauge / kpi-strip / …) needs the
//  SAME three-step ritual to surface PANEL_TITLE_BADGE contributions (first
//  use: the IMF/Eurostat/ONS "preliminary data" badge — Law 9 data integrity):
//
//    1. resolvePreliminary(def, ctx)  → the data-integrity signal
//    2. useExtensions(ctx.extensions, PANEL_TITLE_BADGE, host)  → ReactNode[]
//    3. fold the list into a single keyed fragment (or `undefined` when empty)
//
//  That ritual was copy-pasted verbatim across four panel shells. Promoting it
//  here makes "surface a panel title badge" a reusable capability the engine
//  owns once: a shell calls `usePanelTitleBadge(ctx, def, 'chart')` and renders
//  the result. A new badge contributor, or a new panel type that wants badges,
//  costs ZERO per-shell code — it consumes this hook.
//
//  Engine-layer placement is correct: the hook depends only on engine-layer
//  primitives (useExtensions / PANEL_TITLE_BADGE / resolvePreliminary / the
//  RenderContext), never on any plugin. The arrow stays clean — panels consume
//  the hook, nothing here reaches into a plugin.
//
//  AR-39 — consolidation via the NodeStatusContext seam: the SAME preliminary
//  signal is PUBLISHED upward to the nearest section scope. When a scope is
//  present the panel suppresses its local pill (the section renders ONE
//  consolidated indicator instead of N repeated ones); when there is NO scope
//  (standalone panel) it renders its own badge exactly as before (Postel). This
//  one change covers every panel that already consumes the hook — no per-shell
//  edit, no shotgun surgery.
//

import { Fragment }                from 'react'
import type { ReactNode }          from 'react'
import { useExtensions }           from './extensions/useExtensions'
import { PANEL_TITLE_BADGE }       from './extensions/points'
import { resolvePreliminary }      from './resolvePreliminary'
import { useReportNodeStatus }     from './NodeStatusContext'
import type { NodeBase, RenderContext } from './types'

/**
 * Resolve PANEL_TITLE_BADGE contributions for a panel into a single renderable
 * node. Returns `undefined` (not an empty fragment) when no contributor fires,
 * so callers can guard with a plain `&&`.
 *
 * Also PUBLISHES the panel's preliminary status to the nearest NodeStatusContext
 * scope (AR-39). Inside a section → the panel reports upward and renders NO local
 * pill (the section consolidates). Outside any section → renders its own badge.
 *
 * @param ctx      the panel's RenderContext (carries extensions + rows + store)
 * @param def      the panel node (read for `id` + the preliminary signal)
 * @param nodeType the panel's node type — the host discriminator contributors
 *                 match on (e.g. 'chart', 'table', 'gauge', 'kpi-strip')
 */
export function usePanelTitleBadge(
  ctx:      RenderContext,
  def:      NodeBase & { preliminary?: boolean },
  nodeType: string,
): ReactNode | undefined {
  const preliminary = resolvePreliminary(def, ctx)

  // Publish upward. `published` is true iff a section scope is present — then this
  // panel defers its pill to the section's single consolidated indicator.
  const published = useReportNodeStatus(def.id, { preliminary: preliminary === true })

  const badges = useExtensions(ctx.extensions, PANEL_TITLE_BADGE, {
    nodeType,
    nodeId:      def.id,
    preliminary,
  })

  if (published) return undefined
  return badges.length > 0
    ? <>{badges.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</>
    : undefined
}
