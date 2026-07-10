// ── parseFormula — string formula → canonical Expr AST ───────────────────────
//
//  The ONE string surface for the ONE dialect. A recursive-descent compiler that
//  lowers an infix formula (the Vega-Lite `calculate` analogue) into a canonical
//  @statdash/expr `Expr` tree — NOT a second evaluator. There is exactly one AST
//  (`Expr`) and one evaluator (`evalExpr`); this file is a front-end that targets
//  that AST, so the string form loses no capability while the second dialect
//  (the former `DeriveExpr` AST + evaluator) is retired (AR-50 M5 convergence).
//
//  Grammar (precedence low → high):
//    ternary        := or ('?' ternary ':' ternary)?
//    or             := and ('||' and)*
//    and            := comparison ('&&' comparison)*
//    comparison     := additive (('==' | '!=' | '<' | '<=' | '>' | '>=') additive)?
//    additive       := multiplicative (('+' | '-') multiplicative)*
//    multiplicative := unary (('*' | '/') unary)*
//    unary          := ('!' | '-') unary | primary
//    primary        := '(' ternary ')' | identifier | number | 'string'
//
//  Bare identifiers resolve via the injectable `field` policy (default `{ $row }`),
//  so a caller (e.g. the derive transform step) can pin field semantics without
//  this parser knowing anything domain-specific — Law 1 (generic, no privileged
//  field names).
//

import type { Expr, ExprVal } from './types.ts'

// ── Options ────────────────────────────────────────────────────────────────────

export interface FormulaOptions {
  /**
   * How a bare identifier token lowers to a value reference. Default: a row-scoped
   * read `{ $row: id }` (Vega-Lite `datum.field` semantics). The derive step
   * overrides this to reproduce its `row[field] ?? 0` coercion via a `coalesce`.
   */
  field?: (id: string) => ExprVal
}

const defaultField = (id: string): ExprVal => ({ $row: id })

// ── Parser ───────────────────────────────────────────────────────────────────

class FormulaParser {
  private readonly tokens: string[]
  private pos = 0
  private readonly field: (id: string) => ExprVal

  constructor(input: string, opts?: FormulaOptions) {
    // Tokenize: multi-char ops first, then string literals, numbers, identifiers, single chars.
    this.tokens = input.match(/==|!=|<=|>=|&&|\|\||'[^']*'|\d+(?:\.\d+)?|[a-zA-Z_]\w*|[<>+\-*/()!?:]/g) ?? []
    this.field  = opts?.field ?? defaultField
  }

  private peek(): string | undefined { return this.tokens[this.pos] }
  private consume(): string          { return this.tokens[this.pos++] }
  private expect(t: string): void {
    if (this.peek() !== t) throw new Error(`parseFormula: expected '${t}', got '${this.peek() ?? 'end'}'`)
    this.consume()
  }

  parse(): Expr {
    const e = this.ternary()
    if (this.pos < this.tokens.length) throw new Error(`parseFormula: unexpected '${this.peek()}'`)
    // A bare primary (single field / literal) is a valid formula; wrap so the
    // return type stays Expr. `coalesce([v])` is an identity pass-through op.
    return isExprNode(e) ? e : { op: 'coalesce', values: [e] }
  }

  private ternary(): ExprVal {
    const cond = this.or()
    if (this.peek() !== '?') return cond
    this.consume()
    const then = this.ternary()
    this.expect(':')
    const els = this.ternary()
    // `if` requires an Expr condition; any ExprVal is valid at runtime (evalExpr
    // handles refs/literals), so coerce the type at this single boundary.
    return { op: 'if', cond: cond as Expr, then, else: els }
  }

  private or(): ExprVal {
    const first = this.and()
    if (this.peek() !== '||') return first
    const exprs: Expr[] = [first as Expr]
    while (this.peek() === '||') { this.consume(); exprs.push(this.and() as Expr) }
    return { op: 'or', exprs }
  }

  private and(): ExprVal {
    const first = this.comparison()
    if (this.peek() !== '&&') return first
    const exprs: Expr[] = [first as Expr]
    while (this.peek() === '&&') { this.consume(); exprs.push(this.comparison() as Expr) }
    return { op: 'and', exprs }
  }

  private comparison(): ExprVal {
    const left = this.additive()
    const t = this.peek()
    if (t !== '==' && t !== '!=' && t !== '<' && t !== '<=' && t !== '>' && t !== '>=') return left
    this.consume()
    const right = this.additive()
    const op = t === '==' ? 'eq' as const : t === '!=' ? 'ne' as const
             : t === '<'  ? 'lt' as const : t === '<=' ? 'lte' as const
             : t === '>'  ? 'gt' as const :              'gte' as const
    return { op, left, right }
  }

  private additive(): ExprVal {
    let left = this.multiplicative()
    for (let t = this.peek(); t === '+' || t === '-'; t = this.peek()) {
      this.consume()
      left = { op: t === '+' ? 'add' : 'sub', left, right: this.multiplicative() }
    }
    return left
  }

  private multiplicative(): ExprVal {
    let left = this.unary()
    for (let t = this.peek(); t === '*' || t === '/'; t = this.peek()) {
      this.consume()
      left = { op: t === '*' ? 'mul' : 'div', left, right: this.unary() }
    }
    return left
  }

  private unary(): ExprVal {
    if (this.peek() === '!') { this.consume(); return { op: 'not', expr: this.unary() as Expr } }
    if (this.peek() === '-') { this.consume(); return { op: 'neg', value: this.unary() } }
    return this.primary()
  }

  private primary(): ExprVal {
    const t = this.peek()
    if (t === undefined) throw new Error('parseFormula: unexpected end of expression')
    if (t === '(') {
      this.consume()
      const e = this.ternary()
      this.expect(')')
      return e
    }
    if (/^\d/.test(t))       { this.consume(); return { $literal: Number(t) } }
    if (t.startsWith("'"))   { this.consume(); return { $literal: t.slice(1, -1) } }
    if (/^[a-zA-Z_]/.test(t)){ this.consume(); return this.field(t) }
    throw new Error(`parseFormula: unexpected token '${t}'`)
  }
}

function isExprNode(v: ExprVal): v is Expr {
  return typeof v === 'object' && v !== null && 'op' in v
}

/**
 * Compile a string formula into the canonical `Expr` AST. Evaluate the result with
 * `evalExpr(ast, scope)`. Pure, zero-dep, JSON-serializable output.
 */
export function parseFormula(input: string, opts?: FormulaOptions): Expr {
  return new FormulaParser(input, opts).parse()
}
