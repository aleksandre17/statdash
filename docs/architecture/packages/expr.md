# @geostat/expr — Expression Evaluator

> Pure TypeScript. Zero dependencies. Isolated expression evaluation.
> Full spec: `docs/EXPRESSION_SYSTEM.md`

---

## Package Location

```
engine/expr/
  src/
    types.ts          — Expr · ExprRef · ExprVal · DimVal · DeriveMap · ExprScope
    eval.ts           — evalExpr<T>(expr, scope): T
    derive.ts         — evalDerived(map, scope): Record<string, DimVal>
    template.ts       — evalTemplate(tmpl, scope): string
    guards.ts         — isExpr() · isExprRef() · isDimVal()
    errors.ts         — ExprEvalError
    ops/
      comparison.ts   — eq · ne · gt · lt · gte · lte · in · nin · null · exists
      logic.ts        — and · or · not · if
      string.ts       — template · concat · startsWith · includes
      math.ts         — add · sub · mul · div · mod
      lookup.ts       — coalesce · get  (tree-field/map-field → NOT here)
      collection.ts   — some · every · filter · count · map
  index.ts
```

---

## Public API

```ts
// Types
export type { Expr, ExprRef, ExprVal, DimVal, DeriveMap, ExprScope }

// Evaluators
export { evalExpr }     // evalExpr<T>(expr: ExprVal, scope: ExprScope): T
export { evalDerived }  // evalDerived(map: DeriveMap, scope): Record<string, DimVal>
export { evalTemplate } // evalTemplate(tmpl: string, scope): string

// Type guards
export { isExpr, isExprRef, isDimVal }

// Error
export { ExprEvalError }
```

---

## Key Rules

```
✅ Pure functions — no side effects, no async
✅ Zero deps — importable anywhere including server-side (Constructor)
✅ tree-field/map-field → NOT in evalExpr (data-access → @geostat/engine)
✅ DeriveMap = Array<{ key, expr }> — ordered, not Record
✅ ExprScope.store — REMOVED (no circular dep)
✅ evalDerived: pure ExprVal entries only (DataLookupOp → engine.evalDerived)
```

---

## evalDerived Example

```ts
evalDerived([
  { key: 'isYearMode',  expr: { op: 'eq', left: { $ctx: 'mode' }, right: 'year' } },
  { key: 'activeLabel', expr: {
      op: 'if',
      cond: { $derived: 'isYearMode' },   // references earlier entry ✅
      then: { op: 'template', tmpl: '{time} · მლნ ₾' },
      else: { op: 'template', tmpl: '{timeFrom}–{timeTo} · მლნ ₾' },
  }},
], { dims: { mode: 'year', time: 2023 }, derived: {} })
// → { isYearMode: true, activeLabel: '2023 · მლნ ₾' }
```
