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

import { Fragment }                from 'react'
import type { ReactNode }          from 'react'
import { useExtensions }           from './extensions/useExtensions'
import { PANEL_TITLE_BADGE }       from './extensions/points'
import { resolvePreliminary }      from './resolvePreliminary'
import type { NodeBase, RenderContext } from './types'

/**
 * Resolve PANEL_TITLE_BADGE contributions for a panel into a single renderable
 * node. Returns `undefined` (not an empty fragment) when no contributor fires,
 * so callers can guard with a plain `&&`.
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
  const badges = useExtensions(ctx.extensions, PANEL_TITLE_BADGE, {
    nodeType,
    nodeId:      def.id,
    preliminary: resolvePreliminary(def, ctx),
  })
  return badges.length > 0
    ? <>{badges.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</>
    : undefined
}
