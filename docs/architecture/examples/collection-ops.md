# collection-ops.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — Collection ops: some · every · filter · count · map
 *
 * Demonstrates:
 * - ListRef { $rows: true } — the only array reference type (ISP: separate from ExprRef)
 * - $row inside collection op — binds to current DataRow per iteration
 * - $row outside collection op — scope.row = undefined → null (never throws)
 * - All five collection ops with real Geostat use cases
 * - Syntactic nesting (collection inside collection's expr) — what works and why
 * - Flat-only boundary — DataRow values are DimVal scalars, no sub-arrays
 *
 * ISP contract:
 *   ExprRef → DimVal   (scalar always — evalExpr<T> stays clean and generic)
 *   ListRef → DataRow[] (array always — separate contract, separate type)
 *
 * Why { $rows: true } and not { $ctx: 'rows' }:
 *   { $ctx: 'rows' } resolves via ExprRef → scope.dims['rows'] → DimVal (scalar).
 *   scope.dims holds filter params (year, geo…), never arrays.
 *   { $rows: true } resolves via ListRef → scope.rows → DataRow[] directly.
 */

import type { Expr, ExprVal, ListRef }       from '@geostat/expr'
import type { NodeDeriveMap }                from '@geostat/engine'
import type { SectionNode, InnerPageNode }   from '@geostat/react'


// ═══════════════════════════════════════════════════════════════════════════
// ListRef — the only entry point to DataRow[]
// ═══════════════════════════════════════════════════════════════════════════

// Current variant — only source for collection ops:
const rowsRef: ListRef = { $rows: true }
// Resolves to: scope.rows — the DataRow[] bound by the engine before renderer runs.
// scope.rows = interpretSpec(node.data, ctx).rows  (renderNode step 3)
// Collection op iterates this list. Each iteration: scope.row = rows[i].

// Extension path (Phase 2 — when multi-select dims carry string[]):
//   | { $ctx: string }   // scope.dims[key] as string[] — no breaking change to existing ops


// ═══════════════════════════════════════════════════════════════════════════
// 'some' — true if at least one row satisfies expr
// ═══════════════════════════════════════════════════════════════════════════

// Use case: preliminary badge — any row in the dataset is marked status='P'
const hasPreliminaryData: Expr = {
  op:   'some',
  list: { $rows: true },
  expr: { op: 'eq', left: { $row: 'status' }, right: 'P' },
  //                              ↑ $row binds to each DataRow in scope.rows
}

// Use case: any indicator has a null value (data gap exists)
const hasDataGap: Expr = {
  op:   'some',
  list: { $rows: true },
  expr: { op: 'null', value: { $row: 'value' } },
}

// Use case: any row's year > current ctx year (future projection present)
const hasFutureProjection: Expr = {
  op:   'some',
  list: { $rows: true },
  expr: { op: 'gt', left: { $row: 'time' }, right: { $ctx: 'time' } },
  //                                                   ↑ $ctx still resolves from scope.dims
}

// Page config: show preliminary badge section only when data contains prelim rows
const kpiSectionWithBadge: SectionNode = {
  type:        'section',
  data:        { type: 'row-list', indicators: ['B1G', 'P3', 'P51G'] },
  view:        { subtitle: 'მიმდინარე ფასებში, მლნ ₾' },
  visibleWhen: { op: 'ne', left: { $ctx: 'geo' }, right: null },
  children: [
    { type: 'kpi-strip', layout: { role: 'panel' } },

    // Preliminary notice — visible only when some row has status='P'
    {
      type:        'section',
      visibleWhen: hasPreliminaryData,
      children:    [{ type: 'table', layout: { role: 'notice' } }],
    },
  ],
}


// ═══════════════════════════════════════════════════════════════════════════
// 'every' — true only if ALL rows satisfy expr
// ═══════════════════════════════════════════════════════════════════════════

// Use case: all rows are confirmed (no preliminary) — safe to show as final
const allDataConfirmed: Expr = {
  op:   'every',
  list: { $rows: true },
  expr: { op: 'ne', left: { $row: 'status' }, right: 'P' },
}

// Use case: all rows belong to same indicator (single-indicator section assertion)
const allSameIndicator: Expr = {
  op:   'every',
  list: { $rows: true },
  expr: { op: 'eq', left: { $row: 'indicator' }, right: { $ctx: 'indicator' } },
}

// Use case: all values are positive (safe to use logarithmic scale)
const allPositive: Expr = {
  op:   'every',
  list: { $rows: true },
  expr: { op: 'gt', left: { $row: 'value' }, right: 0 },
}


// ═══════════════════════════════════════════════════════════════════════════
// 'count' — number of rows in list (no expr — counts all)
// ═══════════════════════════════════════════════════════════════════════════

// Use case: show table only when more than one row (single row = kpi only)
const hasMultipleRows: Expr = {
  op:   'gt',
  left: { op: 'count', list: { $rows: true } },
  right: 1,
}

// Use case: show export button only when data is present
const hasAnyData: Expr = {
  op:   'gt',
  left: { op: 'count', list: { $rows: true } },
  right: 0,
}

const tableSection: SectionNode = {
  type:        'section',
  visibleWhen: hasMultipleRows,   // hide when dataset collapses to one row
  data:        { type: 'timeseries', indicator: 'B1G' },
  view:        { exportable: hasAnyData },
  children:    [{ type: 'table', layout: { role: 'table' } }],
}


// ═══════════════════════════════════════════════════════════════════════════
// 'filter' — returns DataRow[] subset where expr is true
// ═══════════════════════════════════════════════════════════════════════════
//
// Note: 'filter' result is DataRow[] — used as input to further collection ops,
// not as an ExprVal on its own. Combine with 'count' or 'some' for scalar result.

// Use case: total row count (count has no 'expr' — counts all rows unconditionally)
const totalRowCount: Expr = {
  op:   'count',
  list: { $rows: true },
}

// 'count' accepts no 'expr' field — it counts the entire list.
// To count a SUBSET: 'filter' op produces DataRow[] at runtime, but ListRef
// at type level only has { $rows: true }. The filter result cannot be passed
// as ListRef directly — there is no { $filtered: Expr } ListRef variant.
//
// ✅ Correct approach for subset counting: DeriveMap entry (two sequential steps):
//   Step 1: some/every boolean assertion → derive a boolean flag
//   Step 2: use that flag in visibleWhen or view fields
// See 'deriveWithFilter' below for the pattern.

// Use case: filter in DeriveMap — build a named sub-result
// 'filter' is most useful in NodeDeriveMap: derive a filtered view, then use it in visibleWhen
const deriveWithFilter: NodeDeriveMap = [
  // Step 1: boolean — does the dataset contain any growth data?
  {
    key:  'hasGrowthData',
    expr: {
      op:   'some',
      list: { $rows: true },
      expr: { op: 'ne', left: { $row: 'indicator' }, right: null },
    },
  },

  // Step 2: does any row show negative growth (contraction)?
  {
    key:  'hasContraction',
    expr: {
      op:   'some',
      list: { $rows: true },
      expr: { op: 'lt', left: { $row: 'value' }, right: 0 },
    },
  },

  // Step 3: derived label — uses $derived from steps above
  {
    key:  'growthSummary',
    expr: {
      op:   'if',
      cond: { $derived: 'hasContraction' },
      then: 'შეიცავს კლებას',
      else: { op: 'if',
        cond: { $derived: 'hasGrowthData' },
        then: 'ზრდის ტენდენცია',
        else: 'მონაცემი არ არის',
      },
    },
  },
]


// ═══════════════════════════════════════════════════════════════════════════
// 'map' — transforms each row to ExprVal (returns DimVal[] at runtime)
// ═══════════════════════════════════════════════════════════════════════════
//
// 'map' result is DimVal[] at runtime — useful in 'in' / 'nin' checks.
// Combine with 'in' to check if a ctx dim is in the set of row values.

// Use case: is the current 'geo' one of the geos present in the dataset?
const currentGeoInData: Expr = {
  op:    'in',
  left:  { $ctx: 'geo' },
  right: [
    // right: ExprVal[] — can include map result inline? No.
    // 'map' at runtime returns DimVal[] but type ExprVal[] means each element is ExprVal.
    // For 'in' with dynamic row data → use DeriveMap + DataLookupOp instead.
    // See derive-map.ts for DataLookupOp (map-field) pattern.
    'GE-TB', 'GE-KA', 'GE-AJ',   // ← static fallback for illustration
  ],
}

// Use case: extract all geo codes from rows for downstream logic (DeriveMap)
// This pattern: map extracts a field, then 'in' checks membership.
// Both ops in same DeriveMap — sequential, no nesting needed.
const deriveGeoCodes: NodeDeriveMap = [
  // Step 1: is the current geo represented in the dataset at all?
  {
    key:  'currentGeoInRows',
    expr: {
      op:   'some',
      list: { $rows: true },
      expr: { op: 'eq', left: { $row: 'geo' }, right: { $ctx: 'geo' } },
    },
  },

  // Step 2: are there multiple distinct geos (multi-region breakdown)?
  {
    key:  'isMultiGeo',
    expr: {
      op:   'some',
      list: { $rows: true },
      expr: { op: 'ne', left: { $row: 'geo' }, right: { $ctx: 'geo' } },
      // "some row has a different geo than the current selection" → multi-geo data
    },
  },
]


// ═══════════════════════════════════════════════════════════════════════════
// $row outside collection op → null (never throws)
// ═══════════════════════════════════════════════════════════════════════════

// $row is only meaningful inside a collection op body.
// Used outside → scope.row = undefined → evalExpr returns null.

// ❌ Wrong — $row at top level of visibleWhen (outside any collection op):
const wrongUsage: ExprVal = { $row: 'status' }
// evalExpr({ $row: 'status' }, scope):
//   scope.row = undefined (not inside a collection op)
//   → returns null
//   → if used as visibleWhen: null → falsy → node hidden (silently wrong, not a crash)

// ✅ Correct — $row inside collection op body:
const correctUsage: Expr = {
  op:   'some',
  list: { $rows: true },
  expr: { op: 'eq', left: { $row: 'status' }, right: 'P' },
  //                              ↑ $row valid here — scope.row bound per iteration
}

// evalExpr guard (implementation):
//   case '$row':
//     if (!scope.row) return null   // safe: null, not throw
//     return scope.row[ref.$row] ?? null


// ═══════════════════════════════════════════════════════════════════════════
// Syntactic nesting — collection op inside another collection op's expr
// ═══════════════════════════════════════════════════════════════════════════
//
// TypeScript allows it — Expr union is recursive, expr: Expr accepts any Expr.
// But: both levels share the same scope.rows (no sub-list scoping mechanism).
// The outer iteration binds scope.row; the inner op iterates scope.rows again.
// Practical use is limited — see flat-only boundary below.

// Syntactically valid — outer 'some' contains inner 'every':
const syntacticNesting: Expr = {
  op:   'some',
  list: { $rows: true },   // outer iterates scope.rows → scope.row = each row
  expr: {
    op:   'every',
    list: { $rows: true }, // inner ALSO iterates scope.rows (same list — not a sub-list)
    expr: {
      // $row here binds to the INNER iteration's current row.
      // There is no way to reference the OUTER $row from inside the inner op.
      op: 'ne', left: { $row: 'value' }, right: null,
    },
  },
}
// What this actually does:
//   For EACH row in scope.rows (outer):
//     Check: is EVERY row in scope.rows (inner) non-null?
// → inner result is the same for every outer iteration (constant)
// → semantically equivalent to just: every(scope.rows, r => r.value != null)
// Use the simpler form directly. Nesting adds no value here.

// ✅ Simpler equivalent — no nesting needed:
const simplerEquivalent: Expr = {
  op:   'every',
  list: { $rows: true },
  expr: { op: 'ne', left: { $row: 'value' }, right: null },
}


// ═══════════════════════════════════════════════════════════════════════════
// FLAT-ONLY BOUNDARY — why nested sub-arrays are structurally impossible
// ═══════════════════════════════════════════════════════════════════════════
//
// DataRow = Record<string, DimVal>
// DimVal  = string | number | boolean | null
//
// A DataRow field CANNOT be a DataRow[].
// There is no { $row: 'items' } → DataRow[] path.
// ListRef only has { $rows: true } — there is no { $rowField: string } variant.
//
// This is a DESIGN BOUNDARY, not a missing feature:
//   SQL result sets are flat.  SDMX observations are flat.
//   Geostat data model: one row = one observation (indicator × time × geo × dims).
//   Hierarchical / nested data → use DataLookupOp (tree-field) or separate DataSpec.
//
// If you need sub-list logic:
//   Option A: DataLookupOp 'tree-field' → walks a hierarchy stored in a separate dataset.
//   Option B: Two separate DeriveMap entries — one per concept, sequential.
//   Option C: Two separate SectionNodes — each with its own DataSpec.

// ❌ Structurally impossible — no type for this:
// {
//   op:   'some',
//   list: { $rows: true },              // outer: iterates scope.rows
//   expr: {
//     op:   'some',
//     list: { $rowField: 'children' },   // ← does not exist, DataRow has no array fields
//     expr: { op: 'eq', left: { $row: 'code' }, right: 'B1G' }
//   }
// }

// ✅ What to do instead — DataLookupOp for hierarchical data:
// (see derive-map.ts for full DataLookupOp examples)
const hierarchicalDerive: NodeDeriveMap = [
  {
    key: 'parentSectionLabel',
    expr: {
      op:       'tree-field',
      data:     { type: 'query', storeId: 'accounts', indicator: 'ACCOUNT_TREE' },
      ref:      { $ctx: 'account' },   // find node where key = geo dim value
      field:    'label',
      fallback: null,
    },
  },
]


// ═══════════════════════════════════════════════════════════════════════════
// Full page example — collection ops driving real visibility logic
// ═══════════════════════════════════════════════════════════════════════════

export const ACCOUNTS_PAGE: InnerPageNode = {
  id:       'accounts',
  type:     'inner-page',
  title:    'ეროვნული ანგარიშები',
  storeKey: 'accounts',

  // Node-level derive — engine evaluates before any child sees ctx
  derive: [
    // Is any row preliminary?
    {
      key:  'hasPreliminary',
      expr: {
        op:   'some',
        list: { $rows: true },
        expr: { op: 'eq', left: { $row: 'status' }, right: 'P' },
      },
    },
    // Is the dataset multi-sector (color channel grouping makes sense)?
    // True when at least one row has a sector code other than the total 'S1'.
    {
      key:  'isMultiSector',
      expr: {
        op:   'some',
        list: { $rows: true },
        expr: { op: 'ne', left: { $row: 'sector' }, right: 'S1' },
      },
    },
    // Are all values for the selected year present (no gaps)?
    {
      key:  'yearDataComplete',
      expr: {
        op:   'every',
        list: { $rows: true },
        expr: {
          op:   'and',
          exprs: [
            { op: 'ne',   left: { $row: 'value' }, right: null },
            { op: 'eq',   left: { $row: 'time' },  right: { $ctx: 'time' } },
          ],
        },
      },
    },
  ],

  children: [
    {
      type:     'filter-bar',
      layout:   { position: 'sticky-top' },
      bars:     {},
    },

    // KPI strip — always shown (when geo is set)
    {
      type:        'section',
      visibleWhen: { op: 'ne', left: { $ctx: 'geo' }, right: null },
      data:        { type: 'row-list', indicators: ['B1G', 'D1', 'P51G', 'B8G'] },
      view:        { exportable: true },
      children:    [{ type: 'kpi-strip', layout: { role: 'panel' } }],
    },

    // Preliminary notice — appears only when hasPreliminary is true
    {
      type:        'section',
      visibleWhen: { $derived: 'hasPreliminary' },
      children:    [{ type: 'table', layout: { role: 'notice', span: 'full' } }],
    },

    // Main timeseries — shown when data is present
    {
      type: 'section',
      data: { type: 'timeseries', indicator: 'B1G', dims: { geo: { $ctx: 'geo' } } },
      view: {
        subtitle:    { op: 'template', tmpl: '{time} · მლნ ₾' },
        exportable:  { op: 'gt', left: { op: 'count', list: { $rows: true } }, right: 0 },
        defaultOpen: true,
      },
      children: [
        { type: 'chart', layout: { role: 'chart' } },
        { type: 'table', layout: { role: 'table' } },
      ],
    },

    // Sector breakdown — only when multi-sector data exists
    {
      type:        'section',
      visibleWhen: { $derived: 'isMultiSector' },
      data:        { type: 'pivot', indicator: 'B1G', rows: 'time', cols: 'sector' },
      view:        { noCollapse: false, defaultOpen: false },
      children: [
        { type: 'chart', layout: { role: 'chart' } },
        { type: 'table', layout: { role: 'table' } },
      ],
    },
  ],
}
```
