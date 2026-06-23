// ── Scalar value universe ──────────────────────────────────────────────────

export type DimVal = string | number | boolean | null

// Row shape within expression scope.
// @statdash/engine's DataRow (Record<string, DimVal> + typed fields) is structurally compatible.
export type ExprRow = Record<string, DimVal>

// ── References — where a value comes from ─────────────────────────────────

// ExprRef always resolves to a DimVal scalar (ISP contract — separate from ListRef).
export type ExprRef =
  | { $ctx:     string }   // scope.dims[key] — user-selected filter param
  | { $derived: string }   // scope.derived[key] — evalDerived() output
  | { $row:     string }   // scope.row?.[key] — inside collection op ONLY; null outside
  | { $literal: DimVal }   // explicit scalar literal (unambiguous, no type inference)

// Array reference — collection ops only (ISP: array ≠ scalar, separate contracts).
// ExprRef → DimVal. ListRef → ExprRow[]. Never mixed.
export type ListRef = { $rows: true }

// ── ExprVal — anything that resolves to a value ───────────────────────────

export type ExprVal = Expr | ExprRef | DimVal

// ── Expr — discriminated union, JSON-serializable, Constructor-safe ────────

export type Expr =
  // Comparison
  | { op: 'eq';      left: ExprVal;   right: ExprVal   }
  | { op: 'ne';      left: ExprVal;   right: ExprVal   }
  | { op: 'gt';      left: ExprVal;   right: ExprVal   }
  | { op: 'lt';      left: ExprVal;   right: ExprVal   }
  | { op: 'gte';     left: ExprVal;   right: ExprVal   }
  | { op: 'lte';     left: ExprVal;   right: ExprVal   }
  | { op: 'in';      left: ExprVal;   right: ExprVal[] }
  | { op: 'nin';     left: ExprVal;   right: ExprVal[] }
  | { op: 'null';    value: ExprVal                    }
  | { op: 'exists';  value: ExprVal                    }
  // Logic
  | { op: 'and'; exprs: Expr[]                                      }
  | { op: 'or';  exprs: Expr[]                                      }
  | { op: 'not'; expr:  Expr                                        }
  | { op: 'if';  cond: Expr; then: ExprVal; else?: ExprVal         }
  // String
  | { op: 'template';   tmpl: string                                }
  | { op: 'concat';     values: ExprVal[]                          }
  | { op: 'startsWith'; left: ExprVal; right: string               }
  | { op: 'includes';   left: ExprVal; right: string               }
  // Math
  | { op: 'add'; left: ExprVal; right: ExprVal }
  | { op: 'sub'; left: ExprVal; right: ExprVal }
  | { op: 'mul'; left: ExprVal; right: ExprVal }
  | { op: 'div'; left: ExprVal; right: ExprVal }
  | { op: 'mod'; left: ExprVal; right: ExprVal }
  // Lookup
  | { op: 'get';      ref: ExprRef; path: string }  // deep path: 'address.city'
  | { op: 'coalesce'; values: ExprVal[]           }  // first non-null
  // Collection — list: ListRef (ISP: array ≠ scalar, structurally separate)
  // Each iteration binds scope.row → { $row: key } resolves to current row field
  | { op: 'some';   list: ListRef; expr: Expr    }
  | { op: 'every';  list: ListRef; expr: Expr    }
  | { op: 'filter'; list: ListRef; expr: Expr    }
  | { op: 'count';  list: ListRef                }
  | { op: 'map';    list: ListRef; expr: ExprVal }

// ── Evaluation context ─────────────────────────────────────────────────────

export interface ExprScope {
  dims:    Record<string, DimVal>  // filter params — user selections (from defineFilters)
  derived: Record<string, DimVal>  // evalDerived() output
  rows?:   ExprRow[]               // DataRow[] for collection ops (scope.rows)
  row?:    ExprRow                 // current item in per-row iteration (collection op body only)
  ctx?:    unknown                 // injectable context for engine-registered ops (e.g. classifiers, display, raw)
}

// ── DeriveMap — pure expression derives, no data access ───────────────────

// Array (not Record) — explicit evaluation order, JSON-safe, Constructor-safe.
// Each entry may reference $derived values from EARLIER entries only.
export type DeriveMap = Array<{ key: string; expr: ExprVal }>