import type { NodeBase, NodeDef, SlotDef, PropSchema } from '@statdash/react/engine'

// ── RepeatNode — Builder.io RepeatData pattern ───────────────────────────
//
//  Two iteration modes:
//    1. Static: `each` — plain JSON array of objects, no DataSpec needed.
//       Each object's fields are flat-injected into ctx.vars as `${as}_${key}`
//       and its `code` (if present) is injected into ctx.sectionCtx.dims[as]
//       so that { $ctx: 'account' } in child DataSpecs resolves per item.
//    2. Dynamic: `data: DataSpec` — rows from a query, same injection via ctx.rows.
//
//  Usage (static):
//    { type: 'repeat', as: 'account',
//      each: [{ code: 'production', label: 'წარმოება', color: 'var(--color-accent)' }],
//      children: [{ type: 'section', title: '{account_label}', ... }] }
//
export interface RepeatNode extends NodeBase {
  type:     'repeat'
  as:       string                       // variable namespace: each item's keys injected as `${as}_${key}`
  each?:    Record<string, unknown>[]    // static items list (alternative to data: DataSpec)
  children: NodeDef[]
}

export const RepeatSchema: PropSchema = [
  { field: 'as',   type: 'string', label: { ka: 'ცვლადის სახელი', en: 'Variable name' }, required: true },
  { field: 'each', type: 'array',  label: { ka: 'სტატიკური სია',  en: 'Static list' } },
]

export const RepeatDefaults: Partial<RepeatNode> = {
  as: 'item',
}

export const RepeatSlots: Record<string, SlotDef> = {
  children: {
    field:    'children',
    label:    { ka: 'შაბლონი', en: 'Template' },
    multi:    true,
    accepts:  [],
  },
}

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'repeat': RepeatNode }
}