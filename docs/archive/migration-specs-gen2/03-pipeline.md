# Migration — Render Pipeline (resolveNodeRows + renderNode)

> Full 8-step renderNode pipeline. Files: `engine/react/src/engine/`

---

## resolveNodeRows — ②f

```ts
// engine/react/src/engine/resolveNodeRows.ts
// ❌ DEPRECATED: interpretSpec(node.data, ctx.sectionCtx, store) — 3-arg, ctx.sectionCtx, single store
// ✅ CANONICAL: 2-arg — ctx.stores used internally

export function resolveNodeRows(node: NodeBase, ctx: RenderContext): DataRow[] {
  if (!node.data) return ctx.rows      // no data → inherit parent rows (cascade)
  const result = interpretSpec(node.data, ctx)
  // InterpretResult:
  //   'ok'      → result.rows
  //   'blocked' → required dim is null → [] (sibling nodes unaffected)
  //   'empty'   → 'empty' contract + null → [] immediately
  return result.status === 'ok' ? result.rows : []
}
```

---

## renderNode — ②f (full 8-step pipeline)

```ts
// engine/react/src/engine/renderNode.ts
// ❌ DEPRECATED: rows = resolveNodeRows(node,ctx); ctxR = {...ctx, rows, view: node.view ?? ctx.view}
//    missing: storeKey cascade · derive · visibleWhen · scope sync · evalViewParams · child null filter · classifiers

export function renderNode(node: NodeBase, ctx: RenderContext): ReactNode {

  // 0. storeKey cascade — nearest ancestor wins (CSS cascade)
  //    pageStoreKey flows to all descendants via ctx spread
  if (node.storeKey) ctx = { ...ctx, pageStoreKey: node.storeKey }

  // 1. derive — per-node computed values
  //    runs BEFORE visibleWhen: derive values may feed into visibleWhen expression
  if (node.derive?.length) {
    const derived = evalNodeDerive(node.derive, ctx)
    ctx = { ...ctx, derived, scope: { ...ctx.scope, derived } }
  }

  // 2. visibleWhen — STRUCTURAL: false → null → excluded from parent ChildrenArg entirely
  //    no DOM artifact, no slot div, no EmptyState — subtree does not exist
  if (!evalExpr(node.visibleWhen ?? true, ctx.scope)) return null

  // 3. data resolution + classifiers/display cascade
  //    ❌ DEPRECATED: shells called resolveStore(ctx).classifiers — ISP violation
  //    ✅ CANONICAL: engine extracts once → ctx carries for all descendants
  const store = resolveStore(ctx)
  const rows  = resolveNodeRows(node, ctx)
  ctx = {
    ...ctx,
    rows,
    classifiers: store.classifiers ?? ctx.classifiers,   // cascade: inherit if no new store
    display:     store.display     ?? ctx.display,        // cascade: inherit if no new store
    scope: { ...ctx.scope, rows },
  }
  // Shell: resolveLabel(row['geo'], ctx.classifiers['geo'], ctx.locale, ctx.fallbackLocale)
  // Shell knows nothing about stores. ISP clean. ✅

  // 4. view params — ExprVals resolved to plain scalars
  //    scope.rows available (step 3 ran first)
  const view = evalViewParams(node.view, ctx.scope)
  ctx = { ...ctx, view }

  // 5–7. children — render + structural filter + ChildrenArg
  //    null (visibleWhen: false) excluded — shell iterates without null checks
  //    Invariant: defs.length === rendered.length, rendered contains no null
  const childDefs = (node as any).children ?? []
  const pairs = childDefs
    .map((c: NodeBase) => ({ def: c, node: renderNode(c, ctx) }))
    .filter((p: { node: ReactNode }) => p.node !== null)

  const children: ChildrenArg = {
    defs:        pairs.map((p) => p.def as NodeDef),
    rendered:    pairs.map((p) => p.node as ReactNode),
    renderChild: (i) => pairs[i].node as ReactNode,   // lazy — TabPageShell: only active tab
  }

  // 8. shell dispatch — zero if/switch
  const shell = nodeRegistry.get(node.type, node.variant ?? 'default')
  if (!shell) return null   // unregistered = invisible (not in Constructor palette)

  // skeleton: brand override → type default → engine generic
  const skeletonFn = ctx.theme.skeletons?.[node.type]
                  ?? nodeRegistry.getMeta(node.type)?.skeleton
  const fallback = skeletonFn
    ? skeletonFn({ type: node.type, layout: node.layout })
    : <div className={`node-skeleton node-skeleton--${node.type}`} />

  return (
    <Suspense fallback={fallback}>
      <NodeErrorBoundary>
        {shell(node as NodeDef, ctx, children)}
      </NodeErrorBoundary>
    </Suspense>
  )
}
```