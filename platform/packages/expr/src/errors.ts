export class ExprEvalError extends Error {
  readonly expr:  unknown
  readonly scope: unknown

  constructor(message: string, expr: unknown, scope: unknown) {
    super(message)
    this.name  = 'ExprEvalError'
    this.expr  = expr
    this.scope = scope
  }
}