// ── renderNode — engine dispatch entry point ────────────────────────────
//
//  Pipeline (Builder.io/Grafana 8-step pattern + 4 new steps):
//    0.   migrate        — version mismatch → forward-migrate def
//    0.5. visibleWhen    — engine-level visibility gate (Gap 3: DRY)
//    1.   validate       — fail fast with ValidationError list
//    1.5. middleware.before — RenderContext transformation (Gap 10: AOP)
//    2.   resolveRows    — interpretSpec + transforms → ctx.rows
//    2.5. node vars      — evaluate node.vars → merge into ctx.vars (Gap 7)
//    3.   view + cascade — view · fieldConfig · eventBus propagation
//    4.   shell lookup   — nodeRegistry.get(type, variant)
//    5.   children       — lazy proxy + SlotDef-driven named slots (Gap 1+2)
//    6.   ErrorBoundary  — per-node crash isolation (per-slice ErrorFallback)
//    7.   Suspense       — skeleton fallback (Phase 2: async data via use())
//    7.5. middleware.after — element wrapping (Gap 10: AOP)
//
//  Key properties:
//    Zero if/switch on node.type — engine is agnostic.
//    rendered[] is a lazy Proxy — renderNode deferred until first array access.
//    slots record — named slot access for multi-slot nodes (Builder.io pattern).
//    New type: register 1 slice → renders. No engine change.
//

import { createElement, Fragment, Suspense, type ReactNode } from 'react'
import { evalVisibility }                from '@geostat/engine'
import type { NodeDef, RenderContext, ChildrenArg, NodeBase, SlotChildren, VarMap } from './types'
import { nodeRegistry }                  from './register-all'
import { skeletonRegistry }              from './skeletonRegistry'
import { resolveNodeRows }               from './resolveNodeRows'
import { NodeErrorBoundary }             from './NodeErrorBoundary'
import { WrapStyleContext }              from './wrapStyleContext'
import { middlewareRegistry }            from './middleware/registry'
import { evalVarMap }                    from './evalVarMap'

type U = NodeBase & Record<string, unknown>

function toSlot(el: ReactNode, key: string | number, pos?: string): ReactNode {
  return !pos || pos === 'flow'
    ? createElement(Fragment, { key }, el)
    : createElement('div', { key, className: `slot slot--${pos}` }, el)
}

// ── Lazy array proxy — defers renderNode calls until first access ─────────
//
//  Shells using rendered[i], rendered.map(), rendered.filter() get the same
//  output as before — but renderNode() is called on FIRST access per index,
//  not upfront. TabsShell calling renderChild(activeTab) renders only that tab.
//
function makeLazyRendered(
  length: number,
  getAt:  (i: number) => ReactNode,
): ReactNode[] {
  return new Proxy([] as ReactNode[], {
    get(_target, prop) {
      if (prop === 'length')        return length
      if (prop === Symbol.iterator) return function*() { for (let i = 0; i < length; i++) yield getAt(i) }
      if (typeof prop !== 'string') return undefined
      const idx = Number(prop)
      if (!isNaN(idx) && idx >= 0)  return getAt(idx)
      const all = () => Array.from({ length }, (_, i) => getAt(i))
      if (prop === 'map')       return (fn: (v: ReactNode, i: number, a: ReactNode[]) => unknown) => all().map(fn)
      if (prop === 'filter')    return (fn: (v: ReactNode, i: number, a: ReactNode[]) => boolean) => all().filter(fn)
      if (prop === 'forEach')   return (fn: (v: ReactNode, i: number, a: ReactNode[]) => void) => all().forEach(fn)
      if (prop === 'reduce')    return (fn: (acc: unknown, v: ReactNode, i: number, a: ReactNode[]) => unknown, init?: unknown) => all().reduce(fn, init)
      if (prop === 'findIndex') return (fn: (v: ReactNode, i: number, a: ReactNode[]) => boolean) => all().findIndex(fn)
      if (prop === 'some')      return (fn: (v: ReactNode, i: number, a: ReactNode[]) => boolean) => all().some(fn)
      if (prop === 'every')     return (fn: (v: ReactNode, i: number, a: ReactNode[]) => boolean) => all().every(fn)
      if (prop === 'indexOf')   return (v: ReactNode) => all().indexOf(v)
      if (prop === 'includes')  return (v: ReactNode) => all().includes(v)
      return undefined
    },
  })
}

// ── step 0: migrate — forward-migrate def when version is behind ──────────
function maybeMigrate(node: NodeBase, type: string, variant: string): NodeBase {
  const migrateFn = nodeRegistry.getMigrate(type, variant)
  if (!migrateFn) return node

  const meta    = nodeRegistry.getMeta(type, variant)
  const current = meta?.version ?? 1
  const stored  = (node as unknown as Record<string, unknown>)['_version'] as number | undefined ?? 1
  if (stored >= current) return node

  return migrateFn(node as unknown as Record<string, unknown>, stored)
}

// ── step 1: validate — render validation errors instead of crashing ───────
function renderValidationErrors(
  errors: { field: string; message: string; level: string }[],
  node:   NodeBase,
): ReactNode {
  const errs = errors.filter(e => e.level === 'error')
  if (!errs.length) return null
  return createElement(
    'div',
    { className: 'node-error node-error--validation' },
    createElement('div', { className: 'node-error__icon' }, '⚠'),
    createElement('p',   { className: 'node-error__title' }, `Invalid config: ${node.type}`),
    ...errs.map((e, i) =>
      createElement('p', { key: i, className: 'node-error__body' }, `${e.field}: ${e.message}`)
    ),
  )
}

// ── step 5 helper: build a named SlotChildren from a raw NodeBase array ───
function makeSlotChildren(items: NodeBase[], ctxR: RenderContext): SlotChildren {
  const cache: ReactNode[] = []
  return {
    defs:        items as NodeDef[],
    renderChild: (i) => {
      if (cache[i] === undefined) cache[i] = renderNode(items[i], ctxR)
      return cache[i]
    },
  }
}

// ── main render pipeline ─────────────────────────────────────────────────

export function renderNode(node: NodeBase, ctx: RenderContext): ReactNode {
  const type    = node.type
  const variant = node.variant ?? 'default'

  // 0. Migration — forward-migrate stored def when version is behind
  const migrated = maybeMigrate(node, type, variant)

  // 0.5. visibleWhen — engine-level gate (Gap 3: removed from individual shells)
  if (migrated.view?.visibleWhen) {
    if (!evalVisibility(migrated.view.visibleWhen, ctx.filterParams, ctx.mode.current))
      return null
  }

  // 1. Validation — fail fast with informative error (warnings allowed through)
  const validateFn = nodeRegistry.getValidate(type, variant)
  if (validateFn) {
    const errors = validateFn(migrated as NodeDef)
    if (errors?.length) {
      const blocking = renderValidationErrors(errors, migrated)
      if (blocking) return blocking
    }
  }

  // 1.5. Middleware before — transform ctx before shell resolution
  const mws    = middlewareRegistry.all()
  let ctxM: RenderContext = ctx
  for (const mw of mws) if (mw.before) ctxM = mw.before(migrated, ctxM)

  // 2. node.storeKey cascade — nearest override wins for this node AND its descendants.
  //    pageStoreKey is the CSS-cascade variable resolveStore reads (resolveNodeRows.ts:19);
  //    renderNode previously never updated it from node.storeKey, so a section with
  //    storeKey:'accounts' inside a gdp page silently resolved the gdp store (gap #15/#23).
  //    Setting it on ctxM here fixes this node's resolution and threads to children.
  if (migrated.storeKey && migrated.storeKey !== ctxM.pageStoreKey) {
    ctxM = { ...ctxM, pageStoreKey: migrated.storeKey }
  }

  // 2.x Resolve data rows (includes TransformStep pipeline in resolveNodeRows)
  const rows = resolveNodeRows(migrated, ctxM)

  // 2.5. Node-level vars (Gap 7) — evaluate migrated.vars with node's filter context
  const nodeVarMap = (migrated as U)['vars'] as VarMap | undefined
  if (nodeVarMap) {
    const nodeVars = evalVarMap(nodeVarMap, ctxM)
    ctxM = { ...ctxM, vars: { ...ctxM.vars, ...nodeVars } }
  }

  // 3. Propagate view + cascade fieldConfig + inject rows
  const nodeFc = (migrated as U)['fieldConfig'] as import('@geostat/engine').FieldConfig | undefined
  ctxM = {
    ...ctxM,
    rows,
    ...(migrated.view  ? { view:        migrated.view  } : {}),
    ...(nodeFc         ? { fieldConfig: nodeFc         } : {}),
  }

  // 4. Shell lookup — zero branching on type
  const shell = nodeRegistry.get(type, variant)
  if (!shell) return null

  // ── 5. Children dispatch — lazy rendered proxy + SlotDef-driven slots ─────
  //
  //  Primary slot (backward compat):
  //    Reads node.children ?? node.items with transparent-node expansion.
  //    rendered[] is a lazy Proxy — renderNode deferred to first access.
  //    renderChild(i) uses the same lazy cache.
  //
  //  Named slots (Gap 1 — Builder.io multi-slot):
  //    Populated from SlotDef registry (getSlots). Each slot uses its own
  //    lazy cache. Shells opt-in via children.slots['name'].renderChild(i).
  //
  const raw: NodeBase[] = (migrated as U)['children'] as NodeBase[]
    ?? (migrated as U)['items']    as NodeBase[]
    ?? []

  // Expand transparent wrapper nodes into a flat list of { node, styles }
  type ExpandedItem = { node: NodeBase; key: string | number; pos?: string; styles: unknown | null }
  const expanded: ExpandedItem[] = []

  raw.forEach((c, i) => {
    const u    = c as U
    const cVar = (u['variant'] as string | undefined) ?? 'default'
    if (!nodeRegistry.isTransparent(c.type, cVar)) {
      expanded.push({ node: c, key: (u['id'] as string | undefined) ?? i, pos: c.view?.position, styles: null })
      return
    }
    const styles = u['styles'] ?? null
    ;((u['children'] as NodeBase[] | undefined) ?? []).forEach((wc, j) => {
      const wu = wc as U
      expanded.push({ node: wc, key: (wu['id'] as string | undefined) ?? `${i}.${j}`, pos: wc.view?.position, styles })
    })
  })

  // Lazy render cache shared between rendered[] proxy and renderChild()
  const renderCache: ReactNode[] = []
  function computeAt(i: number): ReactNode {
    if (renderCache[i] === undefined) {
      const { node: c, key, pos, styles } = expanded[i]
      let el = renderNode(c, ctxM)
      el = el == null ? null : toSlot(el, key, pos)
      if (styles != null && el != null)
        el = createElement(WrapStyleContext.Provider, { value: styles }, el)
      renderCache[i] = el
    }
    return renderCache[i]
  }

  const rendered    = makeLazyRendered(expanded.length, computeAt)
  const childDefs   = expanded.map(e => e.node as NodeDef)

  // Named slots via SlotDef (Gap 1 — multi-slot nodes)
  const slotDefs = nodeRegistry.getSlots(type, variant)
  const slots: Record<string, SlotChildren> = {}
  if (slotDefs) {
    for (const [slotName, slotDef] of Object.entries(slotDefs)) {
      const slotRaw  = (migrated as U)[slotDef.field]
      const slotItems: NodeBase[] = Array.isArray(slotRaw) ? slotRaw as NodeBase[]
                                  : slotRaw ? [slotRaw as NodeBase] : []
      slots[slotName] = makeSlotChildren(slotItems, ctxM)
    }
  }

  const childrenArg: ChildrenArg = {
    defs:        childDefs,
    rendered,
    renderChild: (i: number) => computeAt(i),
    slots,
  }

  // 6–7. ErrorBoundary (per-slice fallback) + Suspense (skeleton)
  const skeletonFn    = skeletonRegistry.get(type, variant)
  const fallback      = skeletonFn ? skeletonFn(migrated, ctxM) : null
  const errorFallback = nodeRegistry.getErrorFallback(type, variant)

  const wrapped = createElement(
    Suspense,
    { fallback },
    createElement(NodeErrorBoundary, {
      node:     migrated,
      fallback: errorFallback,
      children: shell(migrated as NodeDef, ctxM, childrenArg),
    }),
  )

  // 7.5. Middleware after — wrap element (e.g. edit-mode overlay, analytics)
  if (mws.length === 0) return wrapped
  let element: ReactNode = wrapped
  for (let i = mws.length - 1; i >= 0; i--)
    if (mws[i].after) element = mws[i].after!(element, migrated, ctxM) ?? element
  return element
}