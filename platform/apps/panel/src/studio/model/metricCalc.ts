// ── metricCalc — pure measure-algebra helpers for the calc / derived-metric editor ─
//
//  AR-49 M3.0 (SPEC-authoring-reconception-M3-pipeline §3). The "pick, never type"
//  discipline (Law 2) extended to DERIVED metrics: a Steward composes a governed
//  calc metric by picking OTHER governed metrics as operands + a small algebra
//  vocabulary — and these pure functions LOWER that composition to a
//  `ManifestMetricCalc{inputs, expr}` whose `expr` is a JSON `@statdash/expr` tree,
//  byte-identical to a hand-authored one. NEVER a function, never free-text, never a
//  second dialect (Law 2 / FF-CALC-EXPR-SANDBOXED) — the tree emits ONLY the same
//  whitelisted ops the LIVE runtime (`metric-calc.ts → evalExpr`) already evaluates.
//
//  No React, no store, no network — trivially testable (metricCalc.test.ts drives
//  these directly, incl. the live-compute proof through the real engine runtime).
//
import type { Expr, ExprVal } from '@statdash/expr'
import type { ManifestMetric, ManifestMetricCalc, ManifestMetricInput } from '@statdash/contracts'

// ── The whitelisted binary operators the visual builder emits ───────────────────
//  A closed subset of @statdash/expr's math ops — the statistics-grade algebra a
//  steward needs (ratio, sum, difference, scaling). The SSOT for BOTH the tree's
//  operator menu AND the formula-preview symbols (Law 8 — a new operator is one entry
//  here and every consumer follows; the editor never hardcodes an operator list).
export const CALC_OPS = ['add', 'sub', 'mul', 'div'] as const
export type CalcOp = (typeof CALC_OPS)[number]

/** Human-facing operator glyphs — the bracketed-formula preview + the tree menu. */
export const OP_SYMBOL: Record<string, string> = {
  add: '+', sub: '−', mul: '×', div: '÷', mod: 'mod',
}

/** True ⟺ a string is one of the whitelisted calc operators (sandbox guard). */
export function isCalcOp(op: string): op is CalcOp {
  return (CALC_OPS as readonly string[]).includes(op)
}

/** Reference an input by its scope name — the `$derived[<name>]` binding the runtime reads. */
export function inputRef(name: string): ExprVal {
  return { $derived: name }
}

// ── Template shapes — a governed algebra vocabulary (Law 8 capability catalog) ───
//  The non-programmer default path: pick a shape + assign operands → the `@statdash/
//  expr` tree is GENERATED (no tree editing, no formula typing). A new shape = a new
//  entry here, the editor unchanged (OCP). Each `build` emits a pure Expr tree 1:1
//  with what the runtime evaluates.
export interface CalcTemplate {
  id:       string
  label:    { ka: string; en: string }
  /** How many governed-metric operands the shape consumes (in input order a, b, …). */
  operands: number
  /** True ⟺ the shape also takes a scalar literal (e.g. weighted A × k). */
  literal?: boolean
  /** Build the whitelisted @statdash/expr tree from operand names (+ optional literal). */
  build:    (names: string[], literal?: number) => Expr
}

/** The template registry — sourced by the editor's shape picker (never a hardcoded list). */
export const CALC_TEMPLATES: readonly CalcTemplate[] = [
  {
    id: 'ratio', label: { ka: 'შეფარდება (A ÷ B)', en: 'Ratio (A ÷ B)' }, operands: 2,
    build: (n) => ({ op: 'div', left: inputRef(n[0]), right: inputRef(n[1]) }),
  },
  {
    id: 'percentage', label: { ka: 'პროცენტი (A ÷ B × 100)', en: 'Percentage (A ÷ B × 100)' }, operands: 2,
    build: (n) => ({ op: 'mul', left: { op: 'div', left: inputRef(n[0]), right: inputRef(n[1]) }, right: 100 }),
  },
  {
    id: 'difference', label: { ka: 'სხვაობა (A − B)', en: 'Difference (A − B)' }, operands: 2,
    build: (n) => ({ op: 'sub', left: inputRef(n[0]), right: inputRef(n[1]) }),
  },
  {
    id: 'sum', label: { ka: 'ჯამი (A + B)', en: 'Sum (A + B)' }, operands: 2,
    build: (n) => ({ op: 'add', left: inputRef(n[0]), right: inputRef(n[1]) }),
  },
  {
    id: 'scale', label: { ka: 'აწონილი (A × k)', en: 'Weighted (A × k)' }, operands: 1, literal: true,
    build: (n, k) => ({ op: 'mul', left: inputRef(n[0]), right: typeof k === 'number' ? k : 1 }),
  },
]

/** Look up a template descriptor by id. */
export function getCalcTemplate(id: string): CalcTemplate | undefined {
  return CALC_TEMPLATES.find((t) => t.id === id)
}

/**
 * Build a template's expr from an ORDERED list of input names (+ optional literal),
 * or null when there are too few operands to satisfy the shape (the editor then keeps
 * Save gated). Pure — the whole T1-recipe internals, exposed.
 */
export function buildTemplateExpr(templateId: string, orderedNames: string[], literal?: number): Expr | null {
  const t = getCalcTemplate(templateId)
  if (!t) return null
  if (orderedNames.length < t.operands) return null
  return t.build(orderedNames.slice(0, t.operands), literal)
}

// ── Input naming — sequential a, b, c … matching the A ÷ B template language ─────
const INPUT_ALPHABET = 'abcdefghijklmnopqrstuvwxyz'

/** The next unused single-letter input name given the names already in use. */
export function nextInputName(used: readonly string[]): string {
  for (const ch of INPUT_ALPHABET) if (!used.includes(ch)) return ch
  // Beyond 26 operands (never, for statistics-grade algebra) fall back to a1, a2, …
  let i = 1
  while (used.includes(`a${i}`)) i += 1
  return `a${i}`
}

/** An empty calc scaffold — no inputs, an unset expr (Save stays gated until valid). */
export function emptyCalc(): ManifestMetricCalc {
  return { inputs: {}, expr: 0 }
}

/** Ordered [name, input] pairs (Object insertion order is the operand order a, b, …). */
export function orderedInputs(calc: ManifestMetricCalc): Array<[string, ManifestMetricInput]> {
  return Object.entries(calc.inputs)
}

/**
 * Collect the distinct `$derived` input names referenced anywhere in an expr tree.
 * Used to validate that every referenced operand is a declared input (and to warn on
 * a declared-but-unused input). Generic structural walk — dialect-agnostic.
 */
export function collectInputRefs(expr: unknown): string[] {
  const out = new Set<string>()
  const walk = (n: unknown): void => {
    if (n == null || typeof n !== 'object') return
    if (Array.isArray(n)) { n.forEach(walk); return }
    const o = n as Record<string, unknown>
    if (typeof o['$derived'] === 'string') { out.add(o['$derived'] as string); return }
    for (const v of Object.values(o)) walk(v)
  }
  walk(expr)
  return [...out]
}

/**
 * Render an expr tree as a bracketed human formula — the WCAG text alternative for
 * the visual builder (spec §3.4, `aria-live`), e.g. `(GDP ÷ population)`. `labelOf`
 * maps an input name to its display label (falling back to the raw name). Pure.
 */
export function exprToFormula(expr: unknown, labelOf: (name: string) => string): string {
  if (expr == null) return '∅'
  if (typeof expr !== 'object') return String(expr)
  const o = expr as Record<string, unknown>
  if (typeof o['$derived'] === 'string') return labelOf(o['$derived'] as string)
  if ('$literal' in o) return String(o['$literal'])
  if (typeof o['$ctx'] === 'string') return `[${o['$ctx'] as string}]`
  if (typeof o['op'] === 'string') {
    const op = o['op'] as string
    const sym = OP_SYMBOL[op] ?? op
    if ('left' in o && 'right' in o) {
      return `(${exprToFormula(o['left'], labelOf)} ${sym} ${exprToFormula(o['right'], labelOf)})`
    }
    return `${op}(…)`
  }
  return '∅'
}

// ── Cycle detection — a calc metric may not depend on itself (FF-CALC-EDIT-SAFE) ─
//
//  A derived metric whose inputs reference other governed metrics forms a dependency
//  graph; a cycle (self-reference or a transitive loop) is un-resolvable at runtime
//  (`resolveMetricValue` would recurse forever). This pure predicate answers: given
//  the catalog + the draft's proposed inputs, would this metric participate in a cycle?

/** Extract the governed-metric ids a calc metric's inputs reference (raw codes ignored). */
function calcDeps(calc: ManifestMetricCalc | undefined, catalogIds: Set<string>): string[] {
  if (!calc) return []
  return Object.values(calc.inputs)
    .map((i) => i.measure)
    .filter((m) => catalogIds.has(m))
}

/**
 * True ⟺ registering a calc metric `draftId` with the given input measures would
 * create a dependency cycle over the current catalog (self-reference or a transitive
 * loop). Catches the direct self-reference (`a` reads `a`) and indirect loops
 * (`a` → `b` → `a`). Pure — draft + catalog in, boolean out.
 */
export function calcCreatesCycle(
  draftId:       string,
  inputMeasures: string[],
  catalog:       ManifestMetric[],
): boolean {
  const catalogIds = new Set(catalog.map((m) => m.id))
  catalogIds.add(draftId)

  // Adjacency: metric-id → the governed-metric ids it depends on. The draft's entry
  // OVERRIDES any existing catalog entry for the same id (we validate the NEW inputs).
  const adj = new Map<string, string[]>()
  for (const m of catalog) if (m.id !== draftId) adj.set(m.id, calcDeps(m.calc, catalogIds))
  adj.set(draftId, inputMeasures.filter((m) => catalogIds.has(m)))

  // Is draftId reachable from itself? (direct dep === draftId, or a transitive path back.)
  const seen = new Set<string>()
  const reaches = (from: string): boolean => {
    for (const dep of adj.get(from) ?? []) {
      if (dep === draftId) return true
      if (!seen.has(dep)) { seen.add(dep); if (reaches(dep)) return true }
    }
    return false
  }
  return reaches(draftId)
}
