// ── derive step — routes through the ONE expression dialect [AR-50 M5] ───────
//
//  The `derive` TransformStep computes a new per-row field from a declarative
//  expression. It has ONE AST (`@statdash/expr`'s `Expr`) and ONE evaluator
//  (`evalExpr`) — the former in-house `DeriveExpr` AST + tree evaluator + string
//  parser (a SECOND dialect that lived alongside @statdash/expr, breaching the
//  "never a second dialect" invariant declared in data/metric-calc.ts) has been
//  retired. The string formula surface is preserved by @statdash/expr's
//  `parseFormula`, which compiles the infix form to the SAME canonical AST.
//
//  Field semantics: the legacy dialect read a bare identifier as `row[field] ?? 0`.
//  We reproduce that EXACTLY via the injectable field policy below — a bare
//  identifier lowers to `coalesce([{ $row }, 0])`, so a present field (incl. a
//  bilingual LocaleString cell) passes through and a missing field folds to 0.
//  This keeps the migration byte-identical for every stored config (proven by
//  derive-parity.fitness.test.ts).
//

import type { Expr, ExprVal } from '@statdash/expr'
import { parseFormula, evalExpr } from '@statdash/expr'
import type { DimVal } from '../../sdmx'
import type { RawRow, TransformStep, PipelineContext } from './types'

// ── Field policy — reproduce the legacy `row[field] ?? 0` read ─────────────────
//
//  `coalesce` is a null-check (first non-null), and `$row` yields null for a
//  missing/undefined cell — so `coalesce([{ $row: id }, 0])` is byte-identical to
//  the legacy `field` op's `row[id] ?? 0`. A present 0 / '' / false is returned
//  as-is (?? only falls through on null/undefined), matching the old dialect.
//
const deriveField = (id: string): ExprVal => ({
  op: 'coalesce',
  values: [{ $row: id }, { $literal: 0 }],
})

// ── compileDerive — string | Expr → canonical Expr (once per step) ─────────────
//
//  A string is the friendly infix surface (Vega-Lite `calculate` analogue); an
//  object is already the canonical `Expr` AST (the advanced/authored-JSON form).
//  Compiled ONCE outside the row loop — the AST is row-independent.
//
function compileDerive(expr: string | Expr): Expr {
  return typeof expr === 'string' ? parseFormula(expr, { field: deriveField }) : expr
}

// ── normalizeCell — preserve the derive step's number|string cell contract ─────
//
//  The legacy tree evaluator returned `number | string` only — never boolean, never
//  null (its `field` op folded missing → 0, its `div` folded ÷0 → 0). @statdash/expr
//  is generic (comparisons yield booleans; div-by-zero and missing refs yield null).
//  This boundary normalization keeps derived cells byte-identical to the old output:
//    boolean → 1 / 0   (the old 1/0 numeric truth values)
//    null    → 0       (old never emitted null; missing/÷0 folded to 0)
//  Strings and finite numbers pass through untouched.
//
function normalizeCell(v: unknown): DimVal {
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v === null || v === undefined) return 0
  return v as DimVal
}

export function applyDerive(
  rows: RawRow[],
  step: Extract<TransformStep, { op: 'derive' }>,
  ctx?: PipelineContext,
): RawRow[] {
  const target = step.as ?? step.name
  if (!target) throw new Error("derive: missing 'as' (or legacy 'name') field")

  const ast  = compileDerive(step.expr)
  const dims = ctx?.section?.dims ?? {}

  return rows.map((row) => ({
    ...row,
    // scope.row → bare-identifier reads; scope.dims → explicit `{ $ctx }` refs
    // (a forward capability — the string surface only emits row reads).
    [target]: normalizeCell(evalExpr(ast, { row, dims, derived: {} })),
  }))
}
