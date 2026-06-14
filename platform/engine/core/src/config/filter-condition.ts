// ── Filter Condition System ───────────────────────────────────────────────────
//
//  JSON-serializable visibility and enablement rules.
//  Powers showWhen / enableWhen on every ParamDef.
//  Evaluated against the current flat filter state: { [key]: rawString }.
//
//  Commercial equivalents:
//    Grafana   — "Hide Variable" condition (regex match on another variable)
//    AppSmith  — "Visible" binding: {{ currentUser.role === 'admin' }}
//    Builder.io — "Show If" component condition
//    Retool    — "Hidden" and "Disabled" computed properties
//
//  Design decision: value operands are always strings (URL-serialised form).
//  Callers use validators for typed semantics; conditions only compare raw strings.
//

export type Condition =
  | { eq:     string   }   // value === operand
  | { neq:    string   }   // value !== operand
  | { in:     string[] }   // operand array includes value
  | { nin:    string[] }   // operand array does not include value
  | { truthy: true     }   // Boolean(value) === true
  | { falsy:  true     }   // !value

/** Map of { filterKey: condition } — ALL conditions must hold (AND semantics). */
export type WhenMap = Record<string, string | Condition>

/** Evaluate a single condition against a raw string value. */
export function evalCondition(cond: string | Condition, val: string): boolean {
  if (typeof cond === 'string') return val === cond
  if ('eq'     in cond) return val === cond.eq
  if ('neq'    in cond) return val !== cond.neq
  if ('in'     in cond) return cond.in.includes(val)
  if ('nin'    in cond) return !cond.nin.includes(val)
  if ('truthy' in cond) return Boolean(val)
  if ('falsy'  in cond) return !val
  return true
}

/** Evaluate a WhenMap — true if ALL conditions pass. */
export function evalWhen(when: WhenMap, state: Record<string, string>): boolean {
  return Object.entries(when).every(([k, cond]) => evalCondition(cond, state[k] ?? ''))
}
