// ── registerSlice — hub: dispatches a RegistrableSlice to the right registry ─
//
//  Three registry branches, discriminated by META.sliceType:
//    'node'    → nodeRegistry + skeletonRegistry + i18next (if META.i18n)
//    'chrome'  → chromeRegistry
//    'control' → filterControlRegistry
//
//  Called once per slice in setupRegistrations.ts.
//  Not called from slice files — side-effect registration anti-pattern.
//
import i18next, { type i18n as I18nInstance }       from 'i18next'
import type { ReactNode }                           from 'react'
import { registerNodeType }                         from '@statdash/engine'
import { nodeRegistry }                              from './register-all'
import { chromeRegistry }                           from './chromeRegistry'
import { filterControlRegistry }                    from './filterControlRegistry'
import type { FilterControlSlice }                  from './filterControlRegistry'
import { skeletonRegistry }                         from './skeletonRegistry'
import type { SkeletonFn }                          from './skeletonRegistry'
import { nodeSchemaWithVariants }                   from './variant-meta'
import type {
  NodeRenderer,
  NodeBase,
  NodeDef,
  NodeSliceMeta,
  PageSliceMeta,
  PanelSliceMeta,
  ChromeSliceMeta,
  ValidationError,
}                                                   from './types'

/** Union of all node-tier META shapes — node, page, and panel slices. */
type AnyNodeSliceMeta = NodeSliceMeta | PageSliceMeta | PanelSliceMeta

/**
 * Register a slice's UI-string catalog into i18next under `namespace` (AR-37).
 * ONE seam for every slice kind — node/panel/page key on `META.type`, chrome on
 * `META.slot` — so `useT(namespace)` resolves shell chrome for the active locale
 * instead of a hardcoded literal. addResources is idempotent (safe to re-run).
 */
function registerSliceI18n(namespace: string, i18n: Record<string, Record<string, string>>): void {
  const i18nInstance: I18nInstance =
      ((i18next as unknown) as { default?: I18nInstance }).default ?? (i18next as I18nInstance)
  Object.entries(i18n).forEach(([locale, translations]) =>
      i18nInstance.addResources(locale, namespace, translations),
  )
}

export interface NodeSliceExport {
  Shell:          NodeRenderer
  Skeleton?:      SkeletonFn
  /** Per-node crash UI — NodeErrorBoundary uses this instead of the generic fallback. */
  ErrorFallback?: (props: { node: NodeBase; error: Error }) => ReactNode
  /** Runtime validation called before rendering — fail fast, informative error. */
  validate?:      (def: NodeDef) => ValidationError[] | null
  /** Forward migration — called when stored def._version < META.version. */
  migrate?:       (old: Record<string, unknown>, from: number) => NodeBase
  META:           AnyNodeSliceMeta
}

export interface ChromeSliceExport {
  Shell: () => ReactNode
  META:  ChromeSliceMeta
}

export type RegistrableSlice =
  | NodeSliceExport
  | ChromeSliceExport
  | FilterControlSlice

export function registerSlice(mod: RegistrableSlice): void {
  const { sliceType } = mod.META
  if (sliceType === 'node' || sliceType === 'page' || sliceType === 'panel') {
    const m = mod.META as AnyNodeSliceMeta
    const s = mod as NodeSliceExport
    nodeRegistry.register(m.type, m.variant ?? 'default', s.Shell, {
      label:           m.label,
      icon:            m.icon,
      category:        m.category,
      // A slice's DECLARED variants (NodeSliceMeta.variants) join its authored
      // PropSchema as `variants.<name>` PropFields, so they reach the Constructor
      // Inspector + generatePageConfigSchema with ZERO generator edits (the same
      // way presentationPropSchema folds into the page-base fields). Mirrors how
      // resolveVariants projects them to data-attrs at render — declare → author →
      // validate → render, one declaration in META driving the whole chain. The
      // emit-schema build tool routes through the SAME nodeSchemaWithVariants SSOT.
      schema:          nodeSchemaWithVariants(m.schema, 'variants' in m ? m.variants : undefined),
      preview:         m.preview,
      transparent:     'transparent'     in m ? m.transparent     : undefined,
      canHaveChildren: 'canHaveChildren' in m ? m.canHaveChildren : undefined,
      singleton:       'singleton'       in m ? m.singleton       : undefined,
      rootOnly:        'rootOnly'        in m ? m.rootOnly        : undefined,
      version:         m.version,
      defaults:        m.defaults,
      slots:           'slots' in m ? m.slots : undefined,
      caps:            'caps'  in m ? m.caps  : undefined,
      navContribution: 'navContribution' in m ? m.navContribution : undefined,
      groups:          m.groups,
      validate:        s.validate,
      migrate:         s.migrate,
      errorFallback:   s.ErrorFallback,
    })
    // Inject the placeable type into the engine's derived node-type set (ADR §7.3):
    // the react nodeRegistry stays authoritative; the engine learns the SET so
    // validateConfig's `type ∈ known set` check (fail-open until populated) activates.
    registerNodeType(m.type)
    if (s.Skeleton) {
      skeletonRegistry.register(m.type, m.variant ?? 'default', s.Skeleton)
    }
    if (m.i18n) registerSliceI18n(m.type, m.i18n)
  } else if (sliceType === 'chrome') {
    const m = mod.META as ChromeSliceMeta
    chromeRegistry.register(m.slot, m.key, (mod as ChromeSliceExport).Shell, m)
    // Chrome i18n was previously dropped (only node/panel registered it) — a real
    // ISP/symmetry gap that forced chrome shells to hardcode aria/labels. Register
    // under the slot namespace so `useT(slot)` works (AR-37 P1).
    if (m.i18n) registerSliceI18n(m.slot, m.i18n)
  } else if (sliceType === 'control') {
    const m = mod.META as FilterControlSlice['META']
    filterControlRegistry.register(mod as unknown as FilterControlSlice)
    // Control i18n completes the slice-kind symmetry (node/panel/page + chrome
    // already register their catalogs). Registered under the controlType namespace
    // so a filter control resolves its connector words / aria via useT(controlType)
    // instead of a hardcoded literal (AR-37 P1).
    if (m.i18n) registerSliceI18n(m.controlType, m.i18n)
  }
}