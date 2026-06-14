import { Fragment, createElement } from 'react'
import type { NodeRenderer }       from '@geostat/react/engine'
import type { RepeatNode }         from './RepeatNode'

// ── RepeatShell — Builder.io RepeatData / Retool List pattern ────────────
//
//  Two modes (def.each takes priority over ctx.rows):
//    Static  (def.each): iterates plain JSON array — no DataSpec needed.
//    Dynamic (ctx.rows): iterates rows resolved from node.data DataSpec.
//
//  Per-item context injected into every child render:
//    ctx.vars[as]          = item object
//    ctx.vars[`${as}_k`]   = item[k]  (flat access — usable in templates)
//    ctx.sectionCtx.dims[as] = item.code  (so { $ctx: 'account' } resolves per item)
//    ctx.color             = item.color  (when present)
//
//  Uses children.defs + ctx.renderNode (NOT children.rendered) so that each
//  iteration gets its own isolated RenderContext — the key property of the
//  Repeat pattern.
//
export const RepeatShell: NodeRenderer<RepeatNode> = (def, ctx, children) => {
  const rawItems: Record<string, unknown>[] =
    def.each ?? (ctx.rows as unknown as Record<string, unknown>[]) ?? []

  if (rawItems.length === 0) return null

  return createElement(
    Fragment,
    null,
    rawItems.map((item, i) => {
      const itemKey = String(item['code'] ?? item['id'] ?? i)

      // Flat vars: account_code, account_label, account_color, …
      const flatVars: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(item)) {
        flatVars[`${def.as}_${k}`] = v
      }

      // Override dims[as] so { $ctx: 'account' } in child DataSpecs resolves to item.code
      const dims = item['code'] != null
        ? { ...ctx.sectionCtx.dims, [def.as]: item['code'] as string }
        : ctx.sectionCtx.dims

      return createElement(
        Fragment,
        { key: itemKey },
        children.defs.map((child, j) =>
          createElement(
            Fragment,
            { key: j },
            ctx.renderNode(child, {
              vars:       { ...ctx.vars, [def.as]: item, ...flatVars },
              sectionCtx: { ...ctx.sectionCtx, dims },
              ...(typeof item['color'] === 'string' ? { color: item['color'] } : {}),
            }),
          ),
        ),
      )
    }),
  )
}