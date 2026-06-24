// ── paramFactory — seed a fresh ParamNode of a chosen type [V0] ────────────────
//
//  Adding a control needs a minimal, VALID seed of the chosen ParamDef type — the
//  ParamNode analogue of nodeRegistry.getDefaults(type) for canvas nodes. Each
//  seed carries only the required scaffolding (a unique `key`, the discriminant,
//  and the minimal structural fields the renderer/validator expect); the author
//  fills the rest through the Inspector. Kept pure + data-only (no logic in the
//  produced value — Law 2: a seed is JSON-serializable, Constructor-ready).
//
//  OCP: a NEW ParamDef type that wants a richer seed adds a case here; an unlisted
//  type falls back to a bare { type, key } (still authorable — the Inspector fills
//  required fields, which validateField flags until set).
//
import type { ParamNode } from '@statdash/engine'
import { PARAMDEF_TYPES, type ParamDefType } from '@statdash/engine'

/** The selectable ParamDef types (the engine SSOT — the same set the gate enumerates). */
export const PARAM_TYPE_OPTIONS = PARAMDEF_TYPES

/** A short, collision-resistant param key (matches the node-id convention). */
function newParamKey(type: string): string {
  return `${type}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Seed a fresh ParamNode of `type` with a unique `key`. The minimal structural
 * fields are present so the renderer and validateField have something coherent to
 * work with; the author completes the control via the Inspector.
 */
export function makeParamNode(type: ParamDefType, key = newParamKey(type)): ParamNode {
  const base = { type, key } as const
  switch (type) {
    case 'hidden':       return { ...base, default: '' } as ParamNode
    case 'year-select':  return { ...base, default: '' } as ParamNode
    case 'cascade':      return { ...base, label: '', tree: [], default: '' } as ParamNode
    case 'select':       return { ...base, options: { type: 'static', items: [] }, default: '' } as ParamNode
    case 'range':        return { ...base, label: '', default: '' } as ParamNode
    case 'multi-select': return { ...base, label: '', options: { type: 'static', items: [] }, default: '' } as ParamNode
    case 'chip-select':  return { ...base, options: { type: 'static', items: [] }, default: '' } as ParamNode
    default:             return base as ParamNode
  }
}
