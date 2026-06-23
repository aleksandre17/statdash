import React, { Fragment, createElement } from 'react'
import { NodeView }                       from '@statdash/react/engine'
import type { NodeRenderer, RenderContext } from '@statdash/react/engine'
import type { RepeatNode }               from './RepeatNode'

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
//    item.color scoped via CSS --sc wrapper div (not injected into ctx.vars)
//
//  Uses children.defs + <NodeView> (NOT children.rendered) so that each
//  iteration gets its own isolated RenderContext — the key property of the
//  Repeat pattern. NodeView composes each child BY NAME through the full
//  engine pipeline; the per-iteration iterCtx supplies the isolated context.
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

      // Full per-iteration RenderContext. NodeView takes a complete ctx (it does
      // NOT merge a partial the way ctx.renderNode does), so we materialise the
      // merge here — the same shallow merge SiteRenderer applies for renderNode.
      const iterCtx: RenderContext = {
        ...ctx,
        vars: {
          ...ctx.vars,
          [def.as]: item,
          ...flatVars,
        },
        sectionCtx: { ...ctx.sectionCtx, dims },
      }

      // Scope CSS --sc per iteration when item carries a color.
      // Children read var(--sc) via cascade — no ctx.vars slot needed.
      //
      // Composed BY NAME via <NodeView>: each child renders through the full
      // engine pipeline with its own isolated iterCtx — no direct shell import,
      // no manual renderNode wiring. The Repeat pattern's key property (one
      // isolated RenderContext per iteration) is preserved by iterCtx above.
      const iterContent = createElement(
        Fragment,
        null,
        children.defs.map((child, j) =>
          // Dynamic composition by name: child is a runtime NodeDef union, so the
          // (type, def) correlation NodeView's generic wants is guaranteed by
          // construction but not provable to TS — cast at this composition seam.
          createElement(NodeView, { key: j, type: child.type, def: child, ctx: iterCtx } as Parameters<typeof NodeView>[0]),
        ),
      )

      return typeof item['color'] === 'string'
        ? createElement(
            'div',
            { key: itemKey, style: { '--sc': item['color'] as string } as React.CSSProperties },
            iterContent,
          )
        : createElement(Fragment, { key: itemKey }, iterContent)
    }),
  )
}