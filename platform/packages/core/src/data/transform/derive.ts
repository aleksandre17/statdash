// ── DeriveExpr evaluator + string formula parser ─────────────────────────────
//
//  Two entry-points for the `derive` TransformStep:
//    evalExpr     — tree evaluator (DeriveExpr → value)
//    applyDerive  — step handler (exported; consumed by pipeline.ts via steps.ts)
//
//  ExprParser implements a recursive-descent grammar for the string formula form:
//    Grammar (precedence low → high):
//      ternary    := or ('?' ternary ':' ternary)?
//      or         := and ('||' and)*
//      and        := comparison ('&&' comparison)*
//      comparison := additive (('==' | '!=' | '<' | '<=' | '>' | '>=') additive)?
//      additive   := unary (('+' | '-') unary)*
//      multiplicative := unary (('*' | '/') unary)*
//      unary      := ('!' | '-') unary | primary
//      primary    := '(' ternary ')' | field | number | 'string'
//

import type { RawRow, DeriveExpr, TransformStep } from './types'

// ── Expression evaluator ──────────────────────────────────────────────

function evalExpr(expr: DeriveExpr, row: RawRow): number | string {
  // num: coerce branch result to number for arithmetic / ordering / logical ops
  const num = (e: DeriveExpr): number => { const v = evalExpr(e, row); return typeof v === 'number' ? v : Number(v) || 0 }
  const bool = (e: DeriveExpr): boolean => num(e) !== 0

  switch (expr.op) {
    case 'field':   return (row[expr.field] ?? 0) as number | string
    case 'literal': return expr.value
    case 'add':     return num(expr.a) + num(expr.b)
    case 'sub':     return num(expr.a) - num(expr.b)
    case 'mul':     return num(expr.a) * num(expr.b)
    case 'div': {   const d = num(expr.b); return d !== 0 ? num(expr.a) / d : 0 }
    case 'abs':     return Math.abs(num(expr.a))
    case 'neg':     return -num(expr.a)
    case 'eq':      return evalExpr(expr.a, row) === evalExpr(expr.b, row) ? 1 : 0
    case 'neq':     return evalExpr(expr.a, row) !== evalExpr(expr.b, row) ? 1 : 0
    case 'gt':      return num(expr.a) >  num(expr.b) ? 1 : 0
    case 'gte':     return num(expr.a) >= num(expr.b) ? 1 : 0
    case 'lt':      return num(expr.a) <  num(expr.b) ? 1 : 0
    case 'lte':     return num(expr.a) <= num(expr.b) ? 1 : 0
    case 'and':     return bool(expr.a) && bool(expr.b) ? 1 : 0
    case 'or':      return bool(expr.a) || bool(expr.b) ? 1 : 0
    case 'not':     return bool(expr.a) ? 0 : 1
    case 'if':      return bool(expr.cond) ? evalExpr(expr.then, row) : evalExpr(expr.else, row)
  }
}

// ── String expression parser — recursive descent ──────────────────────

class ExprParser {
  private readonly tokens: string[]
  private pos = 0

  constructor(input: string) {
    // Tokenize: multi-char ops first, then string literals, numbers, identifiers, single chars
    this.tokens = input.match(/==|!=|<=|>=|&&|\|\||'[^']*'|\d+(?:\.\d+)?|[a-zA-Z_]\w*|[<>+\-*/()!?:]/g) ?? []
  }

  private peek(): string | undefined { return this.tokens[this.pos] }
  private consume(): string          { return this.tokens[this.pos++] }
  private expect(t: string): void {
    if (this.peek() !== t) throw new Error(`derive: expected '${t}', got '${this.peek() ?? 'end'}'`)
    this.consume()
  }

  parse(): DeriveExpr {
    const e = this.ternary()
    if (this.pos < this.tokens.length) throw new Error(`derive: unexpected '${this.peek()}'`)
    return e
  }

  private ternary(): DeriveExpr {
    const cond = this.or()
    if (this.peek() !== '?') return cond
    this.consume()
    const then = this.ternary()
    this.expect(':')
    return { op: 'if', cond, then, else: this.ternary() }
  }

  private or(): DeriveExpr {
    let l = this.and()
    while (this.peek() === '||') { this.consume(); l = { op: 'or', a: l, b: this.and() } }
    return l
  }

  private and(): DeriveExpr {
    let l = this.comparison()
    while (this.peek() === '&&') { this.consume(); l = { op: 'and', a: l, b: this.comparison() } }
    return l
  }

  private comparison(): DeriveExpr {
    const l = this.additive()
    const t = this.peek()
    if (t !== '==' && t !== '!=' && t !== '<' && t !== '<=' && t !== '>' && t !== '>=') return l
    this.consume()
    const r = this.additive()
    const op = t === '==' ? 'eq' as const : t === '!=' ? 'neq' as const
             : t === '<'  ? 'lt' as const : t === '<=' ? 'lte' as const
             : t === '>'  ? 'gt' as const :              'gte' as const
    return { op, a: l, b: r }
  }

  private additive(): DeriveExpr {
    let l = this.multiplicative()
    for (let t = this.peek(); t === '+' || t === '-'; t = this.peek()) {
      this.consume()
      l = { op: t === '+' ? 'add' : 'sub', a: l, b: this.multiplicative() }
    }
    return l
  }

  private multiplicative(): DeriveExpr {
    let l = this.unary()
    for (let t = this.peek(); t === '*' || t === '/'; t = this.peek()) {
      this.consume()
      l = { op: t === '*' ? 'mul' : 'div', a: l, b: this.unary() }
    }
    return l
  }

  private unary(): DeriveExpr {
    if (this.peek() === '!') { this.consume(); return { op: 'not', a: this.unary() } }
    if (this.peek() === '-') { this.consume(); return { op: 'neg', a: this.unary() } }
    return this.primary()
  }

  private primary(): DeriveExpr {
    const t = this.peek()
    if (t === undefined) throw new Error('derive: unexpected end of expression')
    if (t === '(') {
      this.consume()
      const e = this.ternary()
      this.expect(')')
      return e
    }
    if (/^\d/.test(t))    { this.consume(); return { op: 'literal', value: Number(t) } }
    if (t.startsWith("'")){ this.consume(); return { op: 'literal', value: t.slice(1, -1) } }
    if (/^[a-zA-Z_]/.test(t)) { this.consume(); return { op: 'field', field: t } }
    throw new Error(`derive: unexpected token '${t}'`)
  }
}

function parseDeriveExpr(input: string): DeriveExpr {
  return new ExprParser(input).parse()
}

export function applyDerive(rows: RawRow[], step: Extract<TransformStep, { op: 'derive' }>): RawRow[] {
  const target = step.as ?? step.name
  if (!target) throw new Error("derive: missing 'as' (or legacy 'name') field")
  const tree: DeriveExpr = typeof step.expr === 'string' ? parseDeriveExpr(step.expr) : step.expr
  return rows.map((row) => ({ ...row, [target]: evalExpr(tree, row) }))
}
