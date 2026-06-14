# derive-map.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — DeriveMap patterns
 *
 * DeriveMap = Array<{ key: string; expr: ExprVal }>
 * Array (NOT Record) — explicit evaluation order, JSON-safe, Constructor-safe.
 *
 * Two levels:
 * 1. @geostat/expr evalDerived — pure ExprVal entries only
 * 2. @geostat/engine evalDerived — ExprVal + DataLookupOp (tree-field, map-field)
 */

import type { DeriveMap }      from '@geostat/expr'
import type { DeriveEntry }    from '@geostat/engine'

// ── Level 1: Pure ExprVal (@geostat/expr) ───────────────────────────────
// Used in: FilterSchemaInput.derive · FilterBarNode.derive
// Evaluator: evalDerived from @geostat/expr

const pureDeriveMap: DeriveMap = [
  // Step 1: compute boolean from ctx dim
  {
    key:  'isYearMode',
    expr: { op: 'eq', left: { $ctx: 'mode' }, right: 'year' },
  },

  // Step 2: references Step 1 ($derived: 'isYearMode')
  {
    key:  'activeLabel',
    expr: {
      op:   'if',
      cond: { $derived: 'isYearMode' },      // ✅ earlier entry
      then: { op: 'template', tmpl: '{time} · მლნ ₾ · SNA 2008' },
      else: { op: 'template', tmpl: '{timeFrom}–{timeTo} · მლნ ₾' },
    },
  },

  // Step 3: references Step 1 and ctx
  {
    key:  'periodDescription',
    expr: {
      op:   'if',
      cond: { $derived: 'isYearMode' },
      then: { op: 'concat', values: ['წელი: ', { $ctx: 'time' }] },
      else: { op: 'concat', values: [{ $ctx: 'timeFrom' }, '–', { $ctx: 'timeTo' }] },
    },
  },
]

// evalDerived(pureDeriveMap, { dims: { mode: 'year', time: 2023 }, derived: {} })
// → { isYearMode: true, activeLabel: '2023 · მლნ ₾ · SNA 2008', periodDescription: 'წელი: 2023' }


// ── Level 2: Engine DeriveEntry (ExprVal + DataLookupOp) ────────────────
// Used in: NodeBase.derive
// Evaluator: engine.evalDerived (handles both)

// node.derive = Record<string, DeriveEntry>
// (Note: node-level derive uses Record for now — may align with Array in future)

const nodeLevelDerive: Record<string, DeriveEntry> = {
  // Pure ExprVal entry — passed to evalExpr (@geostat/expr)
  isYearMode: { op: 'eq', left: { $ctx: 'mode' }, right: 'year' },

  // DataLookupOp — engine resolves DataSpec → lookup field
  // tree-field: walk hierarchical tree to find field value
  selectedSectionId: {
    op:       'tree-field',
    data:     { type: 'query', storeId: 'accounts', indicator: 'ACCOUNT_TREE' },
    ref:      { $ctx: 'account' },       // look up this value in tree
    field:    'sectionId',               // return this field from matched node
    fallback: null,                      // if not found
  },

  // map-field: flat key→value map lookup
  sectionLabel: {
    op:       'map-field',
    data:     { type: 'query', storeId: 'accounts', indicator: 'SECTION_LABELS' },
    ref:      { $derived: 'selectedSectionId' },  // uses result from above
    field:    'label',
    fallback: 'უცნობი სექცია',
  },
}

// engine.evalDerived(nodeLevelDerive, ctx):
// 1. isYearMode       → evalExpr(expr, scope) → true/false
// 2. selectedSectionId → interpretSpec(data, ctx) → find row where id = 'B1G' → row.sectionId
// 3. sectionLabel     → interpretSpec(data, ctx) → find row where id = 'production-account' → row.label
// → { isYearMode: true, selectedSectionId: 'production-account', sectionLabel: 'წარმოება' }
// Now: { $derived: 'selectedSectionId' } resolves to 'production-account' in all subsequent exprs


// ── JSON Serialization ────────────────────────────────────────────────────
// DeriveMap (pure) and engine DeriveEntry — both JSON-safe:

const jsonString = JSON.stringify(pureDeriveMap)
const parsed     = JSON.parse(jsonString)
// parsed is identical to pureDeriveMap — works in Phase 2 (DB storage)

const engineJsonString = JSON.stringify(nodeLevelDerive)
const engineParsed     = JSON.parse(engineJsonString)
// engineParsed is identical — DataLookupOp { op, data, ref, field } is plain JSON ✅


// ── Order Matters ─────────────────────────────────────────────────────────
// Array order = evaluation order. Reference only earlier entries via $derived.

const WRONG_ORDER: DeriveMap = [
  // ❌ References 'isYearMode' which is defined AFTER this entry
  { key: 'label', expr: { op: 'if', cond: { $derived: 'isYearMode' }, then: 'a', else: 'b' } },
  { key: 'isYearMode', expr: { op: 'eq', left: { $ctx: 'mode' }, right: 'year' } },
]
// → evalDerived returns { label: undefined/null, isYearMode: true }
// 'label' cannot access 'isYearMode' — it wasn't computed yet

const CORRECT_ORDER: DeriveMap = [
  { key: 'isYearMode', expr: { op: 'eq', left: { $ctx: 'mode' }, right: 'year' } },
  { key: 'label',      expr: { op: 'if', cond: { $derived: 'isYearMode' }, then: 'a', else: 'b' } },
]
// → { isYearMode: true, label: 'a' } ✅
```
