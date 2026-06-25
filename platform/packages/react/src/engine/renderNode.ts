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
import { evalVisibility, mergeScope, emitDiagnostic, diagWarning } from '@statdash/engine'
import type { ScopeOverride }            from '@statdash/engine'
import type { NodeDef, RenderContext, ChildrenArg, NodeBase, SlotChildren, VarMap } from './types'
import { nodeRegistry }                  from './register-all'
import { skeletonRegistry }              from './skeletonRegistry'
import { resolveNodeRows, resolveCompareRows, resolveStore, effectiveStoreKey } from './resolveNodeRows'
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
// ── Lazy-handled methods ────────────────────────────────────────────────────
//  These are intercepted BEFORE full materialisation:
//    length, Symbol.iterator, numeric index — single-node lazy access.
//    map, filter, forEach, reduce, findIndex, some, every, indexOf, includes
//      — call all() which iterates getAt(i) lazily per index (still lazy).
//
// ── Generic-fallback methods (full materialisation) ─────────────────────────
//  Any other Array.prototype string property (slice, find, flat, flatMap,
//  concat, join, at, sort, reverse, keys, entries, values, reduceRight,
//  lastIndexOf, findLast, findLastIndex, toSorted, toReversed, toSpliced,
//  with, fill, copyWithin, …) delegates to the fully-materialised array.
//  Callers see standard ReactNode[] behaviour; the tradeoff is that all nodes
//  are rendered on first call to any such method.
//
function makeLazyRendered(
  length: number,
  getAt:  (i: number) => ReactNode,
): ReactNode[] {
  // Materialise once and cache so repeated fallback calls don't re-render.
  let materialised: ReactNode[] | undefined
  const all = (): ReactNode[] => {
    if (!materialised) materialised = Array.from({ length }, (_, i) => getAt(i))
    return materialised
  }

  return new Proxy([] as ReactNode[], {
    get(_target, prop) {
      // ── length + iterator: single-node lazy ───────────────────────────────
      if (prop === 'length')        return length
      if (prop === Symbol.iterator) return function*() { for (let i = 0; i < length; i++) yield getAt(i) }

      // ── Non-string symbols fall through to undefined ──────────────────────
      if (typeof prop !== 'string') return undefined

      // ── Numeric index: single-node lazy ──────────────────────────────────
      const idx = Number(prop)
      if (!isNaN(idx) && idx >= 0)  return getAt(idx)

      // ── Explicitly lazy methods (avoid full materialisation) ──────────────
      if (prop === 'map')       return (fn: (v: ReactNode, i: number, a: ReactNode[]) => unknown) => all().map(fn)
      if (prop === 'filter')    return (fn: (v: ReactNode, i: number, a: ReactNode[]) => boolean) => all().filter(fn)
      if (prop === 'forEach')   return (fn: (v: ReactNode, i: number, a: ReactNode[]) => void) => all().forEach(fn)
      if (prop === 'reduce')    return (fn: (acc: unknown, v: ReactNode, i: number, a: ReactNode[]) => unknown, init?: unknown) => all().reduce(fn, init)
      if (prop === 'findIndex') return (fn: (v: ReactNode, i: number, a: ReactNode[]) => boolean) => all().findIndex(fn)
      if (prop === 'some')      return (fn: (v: ReactNode, i: number, a: ReactNode[]) => boolean) => all().some(fn)
      if (prop === 'every')     return (fn: (v: ReactNode, i: number, a: ReactNode[]) => boolean) => all().every(fn)
      if (prop === 'indexOf')   return (v: ReactNode) => all().indexOf(v)
      if (prop === 'includes')  return (v: ReactNode) => all().includes(v)

      // ── Generic fallback: any other Array.prototype property ──────────────
      //  Materialise the full array and delegate. Covers: slice, find, flat,
      //  flatMap, concat, join, at, sort, reverse, keys, entries, values,
      //  reduceRight, lastIndexOf, findLast, findLastIndex, toSorted,
      //  toReversed, toSpliced, with, fill, copyWithin, and future additions.
      if (prop in Array.prototype) {
        const mat = all()
        const val = (mat as unknown as Record<string, unknown>)[prop]
        return typeof val === 'function'
          ? (val as (...args: unknown[]) => unknown).bind(mat)
          : val
      }

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

// ── step 5 helper: slot-placement validation (non-blocking) ───────────────
//
//  The Constructor validates drops against SlotDef.accepts at DROP time
//  (CanvasOverlay). But a hand-authored or migrated JSON config never passes
//  through that gate — so an illegal placement (e.g. a `section` dropped inside
//  another `section`'s `children` slot, which only accepts chart/table/…) would
//  render silently with no signal. This closes that gap at RENDER time.
//
//  Contract (Postel's Law — liberal in what we accept):
//    • NON-BLOCKING. We WARN and still render the child. Slot rules are an
//      authoring guardrail, not a hard invariant; refusing to render would be a
//      worse failure mode than an unexpected-but-visible node.
//    • Only the PRIMARY slot (the field children/items actually came from) is
//      checked here. Named multi-slots are validated by their own SlotDef.field
//      lookup below; this primary check mirrors that.
//    • An absent or empty `accepts` list means "any type" — no warning.
//    • Emitted via emitDiagnostic so it lands on the same telemetry seam as
//      every other engine warning (app routes it to console/error-boundary).
//
function warnSlotPlacement(
  parentType: string,
  parentVariant: string,
  childType:  string,
  childKey:   string | number,
): void {
  const slots = nodeRegistry.getSlots(parentType, parentVariant)
  if (!slots) return
  // Primary slot = the one reading 'children' (fallback 'items'); that is the
  // slot the expanded[] list was built from in the main pipeline.
  const primary =
    Object.values(slots).find(s => s.field === 'children') ??
    Object.values(slots).find(s => s.field === 'items')
  if (!primary?.accepts || primary.accepts.length === 0) return
  if (primary.accepts.includes(childType)) return

  emitDiagnostic(diagWarning(
    'slot-placement',
    `Node type '${childType}' is not accepted by '${parentType}' slot '${primary.field}' ` +
    `(accepts: ${primary.accepts.join(', ')}). Rendering anyway.`,
    { path: `${parentType}.${primary.field}[${childKey}]`,
      context: { parentType, parentVariant, childType, accepts: primary.accepts } },
  ))
}

// ── main render pipeline ─────────────────────────────────────────────────

export function renderNode(node: NodeBase, ctx: RenderContext): ReactNode {
  const type    = node.type
  const variant = node.variant ?? 'default'

  // 0.−1. RBAC visibility gate [N41] — hide nodes the caller may not see.
  //  Runs FIRST (before migrate/validate/resolveRows) so an unauthorized node
  //  costs nothing to skip and never triggers data resolution it can't reveal.
  //  Auth is an app-tier concern (Law 3): engine/react reads ctx.auth, which
  //  the app tier injects; engine/core stays free of any user/role model.
  //  Absent/empty visibleToRoles ⇒ visible to all (anonymous included).
  const visibleToRoles = node.visibleToRoles
  if (visibleToRoles && visibleToRoles.length > 0) {
    const userRoles = ctx.auth?.roles ?? []
    const permitted = visibleToRoles.some(r => userRoles.includes(r))
    if (!permitted) return null
  }

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

  // 2. Effective-store cascade — nearest override wins for this node AND its descendants.
  //    pageStoreKey is the CSS-cascade variable resolveStore reads (resolveNodeRows.ts:19);
  //    renderNode previously never updated it from node.storeKey, so a section with
  //    storeKey:'accounts' inside a gdp page silently resolved the gdp store (gap #15/#23).
  //
  //    M1 — metric→store binding (Cube.dev `dataSource`). PRECEDENCE, documented:
  //      explicit node `storeKey`  >  metric `dataSource`  >  page `pageStoreKey`  >  'default'
  //    The middle tier is derived from the node's DataSpec: if the node sets NO
  //    explicit storeKey AND its spec references a metric that names a `dataSource`,
  //    that metric's store wins over the page default. specDataSource (core) walks
  //    the spec + resolves the metric ref through the SSOT seam, returning a plain
  //    storeKey string — the routing crosses the arrow as data (no core→react import).
  //    Byte-identical for every config without a metric-with-dataSource: the spec
  //    returns undefined ⇒ this falls through to today's node.storeKey-only behaviour.
  //    The precedence lives in effectiveStoreKey (resolveNodeRows.ts) — testable
  //    without a React render harness, locked by FF-METRIC-NAMES-STORE.
  const storeKey = effectiveStoreKey(migrated)
  if (storeKey && storeKey !== ctxM.pageStoreKey) {
    ctxM = { ...ctxM, pageStoreKey: storeKey }
  }

  // 2.x Resolve data rows (includes TransformStep pipeline in resolveNodeRows)
  const rows = resolveNodeRows(migrated, ctxM)

  // 2.y Compare wiring (N37) — resolve second dataset when view.scope.compare is set
  const viewScope = (migrated.view as { scope?: ScopeOverride } | undefined)?.scope
  if (viewScope?.compare) {
    const panelCtx = mergeScope(ctxM.sectionCtx, viewScope)
    const store    = resolveStore(ctxM)
    const result   = resolveCompareRows(migrated, panelCtx, viewScope.compare, store)
    ctxM = { ...ctxM, compareRows: result.compareRows, compareLabel: result.compareLabel }
  }

  // 2.5. Node-level vars (Gap 7) — evaluate migrated.vars with node's filter context
  const nodeVarMap = (migrated as U)['vars'] as VarMap | undefined
  if (nodeVarMap) {
    const nodeVars = evalVarMap(nodeVarMap, ctxM)
    ctxM = { ...ctxM, vars: { ...ctxM.vars, ...nodeVars } }
  }

  // 3. Propagate view + cascade fieldConfig + inject rows
  const nodeFc = (migrated as U)['fieldConfig'] as import('@statdash/engine').FieldConfig | undefined
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
      const key = (u['id'] as string | undefined) ?? i
      warnSlotPlacement(type, variant, c.type, key)  // Gap: render-time slot check
      expanded.push({ node: c, key, pos: c.view?.position, styles: null })
      return
    }
    const styles = u['styles'] ?? null
    ;((u['children'] as NodeBase[] | undefined) ?? []).forEach((wc, j) => {
      const wu  = wc as U
      const key = (wu['id'] as string | undefined) ?? `${i}.${j}`
      // Transparent wrappers (e.g. wrap) flatten into the parent slot, so the
      // grandchild is what effectively lands in parentType's primary slot.
      warnSlotPlacement(type, variant, wc.type, key)
      expanded.push({ node: wc, key, pos: wc.view?.position, styles })
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