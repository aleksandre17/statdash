# Expression System — @geostat/expr

> Pure TypeScript. Zero deps. JSON-serializable logic.
> Full spec: `docs/EXPRESSION_SYSTEM.md`

---

## Why a Separate Package

```
engine/expr/     @geostat/expr    — zero deps (expression only)
      ↑ used by
engine/core/   interpretSpec · evalDerived (data + expr)
engine/react/    renderNode (visibleWhen evaluation)
src/               config files (Expr types in DataSpec, NodeBase, ViewParams)

Future: server-side Constructor validation imports only @geostat/expr
```

---

## Core Types

```ts
// Scalar value universe
type DimVal = string | number | boolean | null

// Where values come from — always resolves to DimVal (ISP contract)
type ExprRef =
  | { $ctx:     string }   // scope.dims[key]     — filter param (user selection)
  | { $derived: string }   // scope.derived[key]  — evalDerived() output
  | { $row:     string }   // scope.row?.[key]    — inside collection op ONLY
                           // outside collection op: scope.row = undefined → returns null (never throws)
  | { $literal: DimVal }   // literal scalar (explicit, unambiguous)

// Array reference — for collection op 'list' field only (ISP: separate from ExprRef)
//   ExprRef → DimVal   (scalar, evalExpr<T> stays clean)
//   ListRef → DataRow[] (array, collection context only — separate contract by design)
type ListRef =
  | { $rows: true }   // scope.rows — current rendered rows (DataRow[])
  // Extension path: | { $ctx: string }  when DimVal gains array variant (multi-select)

// Anything that resolves to a value
type ExprVal = Expr | ExprRef | DimVal

// Discriminated union — composable expression language
type Expr =
  // Comparison
  | { op: 'eq';  left: ExprVal; right: ExprVal }
  | { op: 'ne';  left: ExprVal; right: ExprVal }
  | { op: 'gt';  left: ExprVal; right: ExprVal }
  | { op: 'lt';  left: ExprVal; right: ExprVal }
  | { op: 'gte'; left: ExprVal; right: ExprVal }
  | { op: 'lte'; left: ExprVal; right: ExprVal }
  | { op: 'in';  left: ExprVal; right: ExprVal[] }
  | { op: 'nin'; left: ExprVal; right: ExprVal[] }
  | { op: 'null';   value: ExprVal }
  | { op: 'exists'; value: ExprVal }

  // Logic
  | { op: 'and'; exprs: Expr[] }
  | { op: 'or';  exprs: Expr[] }
  | { op: 'not'; expr:  Expr }
  | { op: 'if';  cond: Expr; then: ExprVal; else?: ExprVal }

  // String
  | { op: 'template';   tmpl: string }   // '{time} · მლნ ₾'
  | { op: 'concat';     values: ExprVal[] }
  | { op: 'startsWith'; left: ExprVal; right: string }
  | { op: 'includes';   left: ExprVal; right: string }

  // Math
  | { op: 'add'; left: ExprVal; right: ExprVal }
  | { op: 'sub'; left: ExprVal; right: ExprVal }
  | { op: 'mul'; left: ExprVal; right: ExprVal }
  | { op: 'div'; left: ExprVal; right: ExprVal }
  | { op: 'mod'; left: ExprVal; right: ExprVal }

  // Lookup
  | { op: 'get'; ref: ExprRef; path: string }   // deep path: 'address.city'
  | { op: 'coalesce'; values: ExprVal[] }        // first non-null

  // Collection — list: ListRef (NOT ExprRef — ISP: array ≠ scalar, separate contracts)
  // Each iteration binds scope.row → $row refs resolve to current row's fields
  | { op: 'some';   list: ListRef; expr: Expr }
  | { op: 'every';  list: ListRef; expr: Expr }
  | { op: 'filter'; list: ListRef; expr: Expr }
  | { op: 'count';  list: ListRef }
  | { op: 'map';    list: ListRef; expr: ExprVal }

  // tree-field / map-field → NOT here
  // Data-access ops → @geostat/engine DeriveEntry
  // evalExpr is pure — it never fetches. engine resolves DataSpec.
```

---

## DeriveMap vs NodeDeriveMap vs DeriveEntry — disambiguation (I-1)

> **Critical layering.** Three related but distinct types across two packages. Confusing them = wrong layer dependency.

```
@geostat/expr   DeriveMap     = Array<{ key; expr: ExprVal }>
                               — pure expressions only. No data access.
                               — used in: FilterSchemaInput.derive, DataSpecBase.derive

@geostat/engine DeriveEntry   = ExprVal | DataLookupOp
                               — ExprVal: delegates to @geostat/expr evalExpr
                               — DataLookupOp: engine resolves via interpretSpec

@geostat/engine NodeDeriveMap = Array<{ key; expr: DeriveEntry }>
                               — superset of DeriveMap. Only on NodeBase.derive.
                               — engine.evalDerived() handles both entry types.
```

**Why separated?**

Grafana: Variables (pure config) vs Panel queries (data fetch) — strict layer separation.
`@geostat/expr` has zero data-access capability by design. It evaluates expressions in a scope.
`@geostat/engine` builds on top — adds DataLookupOp which calls interpretSpec internally.

```ts
// ✅ FilterSchemaInput.derive — DeriveMap (pure, no data access)
derive: [
  { key: 'isYearMode', expr: { op: 'eq', left: { $ctx: 'mode' }, right: 'year' } }
]

// ✅ NodeBase.derive — NodeDeriveMap (engine-level, may include DataLookupOp)
derive: [
  { key: 'isYearMode',     expr: { op: 'eq', left: { $ctx: 'mode' }, right: 'year' } },
  { key: 'currentGeoLabel', expr: {             // ← DataLookupOp (engine only)
      op:   'map-field',
      data: { type: 'query', storeId: 'geo-ref' },
      ref:  { $ctx: 'geo' },
      field: 'label',
  }},
]

// ❌ Wrong — DataLookupOp in FilterSchemaInput.derive:
//   FilterSchemaInput.derive = DeriveMap (pure only).
//   Constructor stores filter schema as JSON — data access ops don't belong there.
```

**Quick reference:**

| Type | Package | Where used | DataLookupOp? |
|---|---|---|---|
| `DeriveMap` | @geostat/expr | FilterSchema.derive, DataSpecBase.derive | ❌ |
| `DeriveEntry` | @geostat/engine | element type of NodeDeriveMap | ✅ |
| `NodeDeriveMap` | @geostat/engine | NodeBase.derive | ✅ |

---

## DeriveMap

```ts
// Array — NOT Record (explicit order, JSON-safe, Constructor-safe)
type DeriveMap = Array<{ key: string; expr: ExprVal }>

// Each entry may reference $derived values from EARLIER entries only.
// Array order = evaluation order (no implicit JS key ordering surprises).
// Constructor writes this as a JSON array → stable.

// Example:
const derive: DeriveMap = [
  { key: 'isYearMode',  expr: { op: 'eq', left: { $ctx: 'mode' }, right: 'year' } },
  { key: 'activeLabel', expr: {
      op: 'if',
      cond: { $derived: 'isYearMode' },   // references entry above ✅
      then: { op: 'template', tmpl: '{time} · მლნ ₾' },
      else: { op: 'template', tmpl: '{timeFrom}–{timeTo} · მლნ ₾' },
  }},
]
```

---

## ExprScope — evaluation context

```ts
interface ExprScope {
  dims:    Record<string, DimVal>    // filter params — user selections (from defineFilters)
  derived: Record<string, DimVal>    // engine evalDerived() output
  rows?:   DataRow[]                 // for collection ops
  row?:    DataRow                   // current row in per-row eval
  // store: DataStore — REMOVED (no circular dep between expr and engine)
}
```

---

## evalExpr — single entry point

```ts
function evalExpr<T = DimVal>(expr: ExprVal, scope: ExprScope): T

// Dispatch rules:
// DimVal literal           → return as-is
// ExprRef { $ctx }         → scope.dims[key]
// ExprRef { $derived }     → scope.derived[key]
// ExprRef { $row }         → scope.row?.[key]
// ExprRef { $literal }     → value
// Expr { op: 'eq', ... }   → comparison.ts
// Expr { op: 'if', ... }   → logic.ts
// Expr { op: 'template' }  → template.ts ('{time}' → scope.dims['time'])
// ...

// Type-safe:
evalExpr<boolean>(node.visibleWhen, scope)   // TypeScript → boolean
evalExpr<string>(view.subtitle, scope)        // TypeScript → string
```

---

## evalDerived — @geostat/expr (pure exprs only)

```ts
function evalDerived(
  derive:    DeriveMap,
  baseScope: Pick<ExprScope, 'dims' | 'derived'>
): Record<string, DimVal>

// Evaluates entries in array order.
// Each entry: evalExpr(entry.expr, { dims, derived: accumulated })
// Returns complete derived record.
// NOTE: pure ExprVal only — tree-field/map-field handled by @geostat/engine.evalDerived()
```

---

## engine.evalDerived — @geostat/engine (ExprVal + DataLookupOp)

```ts
// DeriveEntry = ExprVal | DataLookupOp
// DataLookupOp (engine-level, NOT @geostat/expr):
type DataLookupOp =
  | { op: 'tree-field'; data: DataSpec; ref: ExprVal; field: string; fallback?: DimVal }
  | { op: 'map-field';  data: DataSpec; ref: ExprVal; field: string; fallback?: DimVal }

// engine.evalDerived handles both:
// DataLookupOp → interpretSpec(op.data, ctx, stores) → lookup field in result
// ExprVal      → evalExpr (@geostat/expr)
// Entries evaluated in declaration order (same array ordering guarantee)
```

---

## Where Expr Is Used

```ts
// NodeBase.visibleWhen / enabledWhen → evalExpr<boolean>
// ViewParams.subtitle → evalExpr<string>
// ViewParams.hero / defaultOpen / noCollapse / exportable → evalExpr<boolean>
// DataSpec.filter values → evalExpr(v, scope) per entry
// DataSpec.sort.field → evalExpr
// DataSpec.derive → DeriveMap → evalExpr per entry (post-fetch row-level derived fields)
// FilterSchemaInput.derive → DeriveMap → evalExpr per entry (filter context derived values)
// ParamDef.defaultValue → evalExpr
// ParamDef.enabledWhen → evalExpr<boolean>
// FilterBarSpec.crossValidate.expr → evalExpr<boolean>
// FilterBarSpec.crossValidate.message → evalExpr<string>
// DeriveMap entries → evalExpr per entry
```

---

## Native → Expr Translation

```ts
// ── VISIBILITY ──
// Native:
if (selectedSectionId === 'production-account') { show() }

// Expr:
visibleWhen: { op: 'eq', left: { $derived: 'selectedSectionId' }, right: 'production-account' }

// ── TERNARY VALUE ──
// Native:
const subtitle = mode === 'year' ? `${time} · მლნ ₾` : `${from}–${to} · მლნ ₾`

// Expr:
subtitle: { op: 'if',
  cond: { op: 'eq', left: { $ctx: 'mode' }, right: 'year' },
  then: { op: 'template', tmpl: '{time} · მლნ ₾' },
  else: { op: 'template', tmpl: '{timeFrom}–{timeTo} · მლნ ₾' },
}

// ── DATA FILTER ──
// Native:
rows.filter(r => r.account === account && r.measure === measure)

// Expr (in DataSpec.filter):
filter: {
  account: { $ctx: 'account' },
  measure: { $ctx: 'measure' },
}

// ── COMPOUND CONDITION ──
// Native:
if (mode === 'year' && (region === 'tbilisi' || region === 'kutaisi')) { }

// Expr:
visibleWhen: { op: 'and', exprs: [
  { op: 'eq', left: { $ctx: 'mode' }, right: 'year' },
  { op: 'or', exprs: [
    { op: 'eq', left: { $ctx: 'region' }, right: 'tbilisi' },
    { op: 'eq', left: { $ctx: 'region' }, right: 'kutaisi' },
  ]},
]}
```

---

## DimVal ⊆ ExprVal — plain values are valid expressions (H-8)

```ts
// ExprVal = Expr | ExprRef | DimVal
// DimVal  = string | number | boolean | null
//
// Plain scalars are valid ExprVal — no wrapping required:

// ✅ All of these are valid ExprVal:
visibleWhen: true             // boolean literal
view: { defaultOpen: true }   // boolean
view: { subtitle: '2023 · GDP' }   // string literal
data: { dims: { geo: 'GE' } }      // string literal as filter value
derive: [{ key: 'x', expr: 42 }]   // number literal

// ✅ The same fields also accept expressions:
view: { subtitle: { op: 'template', tmpl: '{time} · მლნ ₾' } }   // Expr
view: { subtitle: { $ctx: 'year' } }                               // ExprRef

// evalExpr dispatch:
//   DimVal literal      → return as-is (no evaluation needed)
//   ExprRef { $ctx }    → scope.dims[key]
//   Expr { op: ... }    → evaluate recursively
//
// Rule: a field typed ExprVal accepts the SIMPLEST form that works.
//   Don't wrap: { $literal: true } when plain true works.
//   { $literal: v } is explicit but redundant for DimVal — use it only for disambiguation.
```

---

## $row — per-row evaluation in collection ops (H-2)

`$row` is **only valid inside collection ops** (`some`, `every`, `filter`, `map`).
It refers to the current item in the list being iterated.

```ts
// Collection ops — list: ListRef (array), $row binds per-iteration:
{ op: 'filter'; list: ListRef; expr: Expr }
{ op: 'some';   list: ListRef; expr: Expr }
{ op: 'every';  list: ListRef; expr: Expr }
{ op: 'map';    list: ListRef; expr: ExprVal }
{ op: 'count';  list: ListRef }

// Example — filter rows where value > 0:
{
  op:   'filter',
  list: { $rows: true },           // scope.rows — the DataRow[] in scope
  expr: { op: 'gt', left: { $row: 'value' }, right: 0 }
  //                     ↑ binds to current row's 'value' field
}

// Example — some row has preliminary status:
{
  op:   'some',
  list: { $rows: true },
  expr: { op: 'eq', left: { $row: 'status' }, right: 'P' }
}
```

**`{ $rows: true }` — why not `{ $ctx: 'rows' }`:**
```
{ $ctx: 'rows' } would return DimVal — ExprRef contract is scalar-only.
{ $rows: true }  is ListRef — purpose-built for DataRow[] (ISP: separate return type).
ExprRef stays scalar-clean (DimVal only). evalExpr<T> stays generic without dual dispatch.
```

**Flat-only design boundary:**
```
DataRow values are DimVal scalars (string | number | boolean | null).
A row field cannot itself be a DataRow[].
→ Nested collection ops (iterating a row's field as a sub-list) are structurally impossible.
→ This is a design boundary, not a missing feature.
If you need cross-list logic: use separate nodes or derive the result via DataLookupOp.
```

**Evaluation timing:**
```
$ctx     → resolved once per renderNode() call (from scope.dims)
$derived → resolved once per renderNode() call (from scope.derived)
$row     → resolved per item inside collection ops ONLY
            outside collection op: scope.row = undefined → evalExpr returns null (never throws)
```

**Out-of-collection `$row` guard:**
```ts
// evalExpr implementation:
case '$row':
  if (!scope.row) return null   // safe: returns null, never throws
  return scope.row[ref.$row] ?? null
```

---

## Circular Reference Guard — DeriveMap (H-2)

DeriveMap entries are evaluated **in array order**. A forward reference (entry K references entry K+1) is a user error.

```ts
// ✅ Correct — references only earlier entries:
derive: [
  { key: 'isYearMode', expr: { op: 'eq', left: { $ctx: 'mode' }, right: 'year' } },
  { key: 'label',      expr: { op: 'if', cond: { $derived: 'isYearMode' }, then: 'year', else: 'range' } },
  //                                              ↑ defined in entry 0 ✅
]

// ❌ Wrong — forward reference:
derive: [
  { key: 'label', expr: { op: 'if', cond: { $derived: 'isYearMode' }, then: 'year', else: 'range' } },
  //                                         ↑ not yet evaluated — returns undefined
  { key: 'isYearMode', expr: { op: 'eq', left: { $ctx: 'mode' }, right: 'year' } },
]

// evalDerived guard:
// { $derived: key } where key not yet in accumulated → returns undefined (not throw)
// Why not throw: Constructor may generate derives; fail-safe > crash
```

**Rule:** Array order = evaluation order. Each entry may only reference `$derived` values from **earlier entries** in the same array.

### Cycle behavior — NOT stack overflow, but silent wrong values (K-5)

```ts
// Apparent cycle — evalDerived is iterative (not recursive), so no stack overflow:
derive: [
  { key: 'a', expr: { $derived: 'b' } },  // b not yet evaluated → undefined
  { key: 'b', expr: { $derived: 'a' } },  // a = undefined → b = undefined
]
// Result: { a: undefined, b: undefined } — wrong values, not a crash.
// evalDerived evaluates entries in declaration order, accumulates results.
// A reference to an unevaluated key = undefined (same as forward reference, H-2).

// WHY document this:
//   Constructor may generate DeriveMap entries from a GUI form — accidental ordering bugs.
//   The failure mode is SILENT (undefined propagates, no error thrown).
//   "My derived value is always undefined" → first check: is the order correct? is there a cycle?
```

**Contract: DeriveMap must be a DAG (Directed Acyclic Graph).**

```
Not for safety   — iterative eval never loops.
But for correctness — cycles produce undefined cascade (wrong values, no error).
```

**evalDerived itself:** does NOT detect cycles. Fail-safe by design (undefined, not throw).
Detection belongs at authoring time — two layers:

### Layer 1 — `validateDeriveMap` (authoring gate, `@geostat/expr`)

```ts
interface DeriveOrderError {
  key:           string     // entry whose expr contains the bad reference
  referencedKey: string     // the $derived key that caused the problem
  reason:        'forward-ref' | 'circular'
}

function validateDeriveMap(derive: DeriveMap): DeriveOrderError[]
// Returns [] if valid DAG. Non-empty = authoring bug.
// Topological analysis — no runtime cost.
```

**Usage contexts:**
```ts
// Constructor — block save:
const errors = validateDeriveMap(node.derive)
if (errors.length) {
  throw new ValidationError(`derive: ${errors[0].reason} between '${errors[0].key}' → '${errors[0].referencedKey}'`)
}

// Tests — assert config correctness:
expect(validateDeriveMap(myPageConfig.children[0].derive)).toEqual([])

// CI config lint — run on all feature page configs before deploy
```

### Layer 2 — dev-mode warning in `evalDerived`

```ts
// production: fail-safe unchanged (undefined, no throw)
// development: warn when $derived key not yet in accumulated
if (process.env.NODE_ENV !== 'production' && !(refKey in accumulated)) {
  console.warn(
    `[evalDerived] forward reference: '${refKey}' not yet evaluated when resolving '${entry.key}'. ` +
    `Check derive array order or run validateDeriveMap().`
  )
}
```

**Constructor responsibility:** Before saving, call `validateDeriveMap()`. Cycle detected → save blocked, message shown to user. Reorder fix: Constructor can auto-sort via topological sort if no cycle.

---

## Execution Order in Engine

```
① defineFilters() → scope.dims = { mode: 'year', account: 'B1G', ... }

② per node in renderNode():

   a. node.derive → evalNodeDerive()
                     DataLookupOp → interpretSpec → lookup
                     ExprVal      → evalExpr (@geostat/expr)
                   ctx = { ...ctx, derived, scope: { ...ctx.scope, derived } }
                   //                       ↑ scope.derived synced immediately

   b. evalExpr<boolean>(node.visibleWhen, ctx.scope) → false: skip node entirely
      // scope.rows = PARENT's rows here (node.data not yet resolved — by design)
      // collection ops in visibleWhen iterate the parent context rows, not this node's data

   c. interpretSpec(node.data, ctx) → InterpretResult
       filter/dims values: evalExpr(v, scope) per entry
       ctx = { ...ctx, rows, scope: { ...ctx.scope, rows } }
       //                    ↑ scope.rows synced — THIS node's resolved rows from here on
       // 'blocked'/'empty' → rows=[], scope.rows=[], EmptyState shown

   d. evalViewParams(node.view, ctx.scope) → ctx.view (plain scalars)
      // scope.rows = THIS node's rows ✅
      // view.exportable: { op:'gt', left:{op:'count',list:{$rows:true}}, right:0 }
      //   → counts this node's rows correctly

   e. renderNode(child, ctx) per child → ChildrenArg
      // child inherits ctx — child's scope.rows starts as THIS node's rows
      // child will overwrite scope.rows at its own step c

   f. renderer(node, ctx, children) → ReactNode
      // ctx.scope.rows = THIS node's rows ✅
      // renderer may pass ctx.scope to evalExpr — collection ops work correctly
```

**Why scope must be synced at both steps a and c:**
```
If only ctx.rows is updated (not ctx.scope.rows):
  evalViewParams(view, ctx.scope) → scope.rows = [] (base) → count = 0 → exportable = false (wrong)
  renderer passes ctx.scope to evalExpr → collection ops see [] (wrong)

scope is derived state of ctx. Every spread that updates ctx.rows or ctx.derived
MUST also update ctx.scope — same spread, no separate step.
```

---

## Why Not Alternatives

> Moved from `docs/EXPRESSION_SYSTEM.md`.

| Alternative | Problem |
|-------------|---------|
| JS eval / Function() | Security · not JSON · Constructor ვერ გენერირებს |
| Template strings `"{{ mode === 'year' }}"` | Parser needed · XSS risk · not type-safe |
| Named guards `{ guard: 'isYearMode' }` | Functions → not JSON · config not self-contained |
| JSONLogic library | `{ "var": "x" }` less readable · no TS discriminated union · no custom ops |
| SQL WHERE string | String parsing · no TypeScript inference · no tree-field op |
| **@geostat/expr** | ✅ JSON · ✅ type-safe · ✅ composable · ✅ Constructor-ready · ✅ isolated |

---

## Testing — Concrete Examples

Pure functions → trivial to test, zero mocking needed:

```ts
evalExpr({ op: 'eq', left: { $ctx: 'mode' }, right: 'year' }, {
  dims: { mode: 'year' }, derived: {}
})
// → true

evalExpr({ op: 'if',
  cond: { op: 'eq', left: { $ctx: 'mode' }, right: 'year' },
  then: { op: 'template', tmpl: '{time} · მლნ ₾' },
  else: 'range mode',
}, { dims: { mode: 'year', time: 2023 }, derived: {} })
// → '2023 · მლნ ₾'

evalDerived({
  isYearMode: { op: 'eq', left: { $ctx: 'mode' }, right: 'year' },
  label:      { op: 'template', tmpl: '{time} · მლნ ₾' },
}, { dims: { mode: 'year', time: 2023 }, derived: {} })
// → { isYearMode: true, label: '2023 · მლნ ₾' }

// tree-field → @geostat/engine.evalDerived() — tested separately (requires store mock)
```

---

## Performance — collection ops on large row sets

Collection ops iterate `scope.rows` synchronously. Three layers prevent this from being expensive.

### Layer 1 — Render gate (biggest win)

`SiteRenderer` wraps `engine.renderNode` in `useMemo([page.id, ctx])`.
`engine.renderNode` is pure — same `ctx` reference → same ReactNode tree → skip re-evaluation.

```ts
// engine/react/src/page/SiteRenderer.tsx
const baseCtx = useMemo(() => buildCtx(theme, stores, filters.ctx.dims, page), [
  theme, stores, filters.ctx.dims, page.id, page.storeKey,
])

return useMemo(
  () => engine.renderNode(page, baseCtx),
  [page, baseCtx],   // ← skips entirely when ctx unchanged
)
```

Result: unrelated parent re-renders = **0** collection op evaluations.
Filter change = O(nodes × rows) — runs only when dims or rows actually change.

### Layer 2 — Allocation gate

`evalExpr` **does not cache the scope reference**. Collection op impls exploit this:

```ts
// engine/expr/src/collection.ts
// ❌ N allocations: rows.some(row => evalFn(expr, { ...scope, row }))
// ✅ 1 allocation:
const inner: ExprScope = { ...scope, row: undefined }
rows.some(row => { inner.row = row; return evalFn(expr, inner) as boolean })
```

10k rows × collection op: **10k GC objects → 1 GC object**.

### Layer 3 — ctx stability (makes Layer 1 effective)

`useMemo([ctx])` is useless if `ctx` is a new object on every render.
Each field must produce a stable reference when its input hasn't changed:

```
stores  → SiteProvider creates once — session-stable ✅
dims    → useFilters memoizes by URL string — same URL → same object ✅
theme   → ThemeProvider receives a constant — same reference ✅
```

If `useFilters` returns a new `dims` object every render (e.g. `{ mode: 'year' }` inline),
`baseCtx` is a new object every render → `useMemo` misses every time → Layer 1 does nothing.

### Numbers (Geostat realistic ceiling)

| scenario | rows/node | nodes | collection ops/node | total evals |
|---|---|---|---|---|
| GDP page | 40 | 8 | 2 | 640 |
| Accounts page | 500 | 15 | 2 | 15,000 |
| Regional breakdown | 1,500 | 12 | 3 | 54,000 |
| Worst case (10k) | 10,000 | 15 | 2 | 300,000 |

At ~100M simple boolean ops/sec in V8: worst case = **~3ms per filter change**.
With Layer 1: that 3ms only runs when user actually changes a filter. Not on every render.

Full reference implementation: `examples/performance.md`
