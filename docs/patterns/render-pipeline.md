# Pattern: renderNode Pipeline

Full spec → `docs/plan/SYSTEM-PIPELINE-TREE.md`

## 8-Step Pipeline (per node)

```
1. lookup   nodeRegistry.get(node.type, node.variant ?? 'default') → Shell
2. inherit  storeKey, locale, fallback cascade from parent ctx
3. resolve  store = resolveStore(ctx) → rows = resolveNodeRows(node, ctx)
            ctx = { ...ctx, rows, classifiers: store.classifiers ?? ctx.classifiers,
                    display: store.display ?? ctx.display }
4. children renderNode() for each child → ChildrenArg { defs, rendered, renderChild }
5. render   Shell(node, ctx, children) → ReactNode
6. layout   applyLayout(result, node.layout)
7. visible  node.visibleWhen → evaluate → null if hidden
8. return
```

## resolveNodeRows

```ts
// 2-arg interpretSpec — NO ctx passing at definition time
function resolveNodeRows(node: NodeDef, ctx: RenderContext): EngineRow[] {
  if (!node.data) return ctx.rows        // inherit parent rows
  const store = resolveStore(ctx, node.storeKey)
  return interpretSpec(node.data, ctx.scope, store)
}
```

## ChildrenArg

```ts
interface ChildrenArg {
  defs:        NodeDef[]           // original child definitions
  rendered:    ReactNode[]         // all pre-rendered (CSS controls visibility — no remount)
  renderChild: (i: number) => ReactNode  // lazy: renders on demand (tab pattern)
}
```

## Anti-patterns

```ts
❌  interpretChart(chartDef, ctx.rows, ctx.sectionCtx)  // ctx.sectionCtx removed
✅  interpretChart(chartDef, ctx.rows)                   // rows already resolved by step 3

❌  shell accesses store directly for classifiers
✅  ctx.classifiers (injected at step 3)
```