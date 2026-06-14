
# Key Success Rules — Technical Non-Negotiables

> Rules derived from: architectural decisions, memory (past bugs/fixes), CLAUDE.md constraints.
> Each rule has a Why and a How to apply. Knowing why lets you judge edge cases.

---

## Rule 1: Generic Over Concrete

> "ალგორითმი არ უნდა იცნობდეს ვისთვის მუშაობს."
> "Abstract the algorithm when the language doesn't provide it generically."

**The pattern:**

```ts
// ✅ Generic core + thin boundary wrapper
function groupBySpan<T>(items: T[], getSpan: (item: T) => SpanValue): T[][] { ... }

// Boundary: knows the concrete type, calls generic core
const columns = groupBySpan(sectionDefs, d => d.layout?.span ?? 'full')
```

```ts
// ❌ Algorithm tied to concrete type
function groupSectionsBySpan(sections: SectionDef[]): SectionDef[][] { ... }
// → cannot reuse for ContainerPageNode children, NavItem[] grouping, etc.
```

**Standard operations don't need wrapping:**

```ts
// ✅ Language already provides these generically
items.filter(d => d.layout?.visible !== false)
items.sort((a, b) => (a.layout?.order ?? 0) - (b.layout?.order ?? 0))

// ❌ Wrapper around standard operation (unnecessary abstraction)
function filterBy<T>(items: T[], predicate: (item: T) => boolean): T[] {
  return items.filter(predicate) // just use .filter() directly
}
```

**Why:** Code reused in 3 contexts vs code written for one. Generic = extensible by definition.

**How to apply:** Before writing any algorithm, ask "could this work on `T` instead of the concrete type?" If yes → make it generic. Concrete type knowledge stays at the call site (boundary).

---

## Rule 2: Vite .ts / .tsx Same-Basename Trap

> **CRITICAL: Runtime crash. Silent in TypeScript. Hard to debug.**

**The problem:**

```
engine/react/src/engine/
  SectionRenderer.ts    ← tsc resolves this (prefers .ts)
  SectionRenderer.tsx   ← Vite resolves this (prefers .tsx)
```

`tsc --noEmit` passes with 0 errors.
Vite serves the `.tsx` file. `import { SectionRenderer } from './SectionRenderer'` → resolves to different file than TypeScript thinks. Runtime crash or silent wrong-file import.

**Rule:** Every file in this project must have a **unique basename**.

```ts
// ❌ Dangerous
SectionRenderer.ts
SectionRenderer.tsx

// ✅ Safe
SectionRenderer.ts       // pure logic
SectionRendererView.tsx  // React component (different name)
```

**Why:** tsc module resolution and Vite module resolution differ on `.ts` vs `.tsx` priority. This caused a production bug. The only fix is unique filenames.

**How to apply:** When creating any `.tsx` file, grep the directory for the same name with `.ts`. If found → rename one before creating.

---

## Rule 3: Renderer Hooks Rule (Component Wrapper Pattern)

> "NodeRenderer is a plain function. It is NOT a React component. Hooks are forbidden in it."

**The rule:**

```ts
// ✅ NodeRenderer: plain function, no hooks
export const SectionRenderer: NodeRenderer<SectionNode> = (def, ctx, children) => {
  const Shell = ctx.theme.shells['section'] ?? DEFAULT_THEME.shells['section']!
  return <Shell def={def} children={children} />
  // Shell is a React component — it CAN use hooks
}

// ❌ WRONG — hooks in NodeRenderer
export const SectionRenderer: NodeRenderer<SectionNode> = (def, ctx, children) => {
  const [open, setOpen] = useState(true)  // ← Rules of Hooks violated
  const { data } = useStoreQuery(...)     // ← rules of hooks violated
  return <section>...</section>
}
```

**When you need hooks in rendering logic:**

```ts
// Component wrapper pattern — escape hatch
export const CustomRenderer: NodeRenderer<CustomNode> = (def, ctx) => {
  // Delegate to inner component that CAN use hooks
  return <CustomControl def={def} stores={ctx.stores} dims={ctx.dims} />
}

function CustomControl({ def, stores, dims }) {
  const { data } = useStoreQuery(stores, def.storeId, { ... }) // ✅ valid here
  if (data.isLoading) return <Skeleton />
  return <Chart rows={data.rows} />
}
```

**Why:** `renderNode()` in the engine calls `renderer(def, ctx, children)` as a plain function — not as a React render. React's Rules of Hooks (only call hooks inside React component renders) are violated, causing React to throw in production.

**How to apply:** Hooks = Shell or inner component. Never in NodeRenderer function body.

---

## Rule 4: ColumnDef.footer — Per-Column, Not Per-Table

> "Footer logic belongs to the column definition, not to a table-level boolean."

**The rule:**

```ts
// ✅ Per-column footer — works for heterogeneous data
const columns: ColumnDef[] = [
  { key: 'label', header: 'ჩვენება', footer: undefined },
  { key: 'value', header: 'მნიშვნელობა', footer: 'sum' },
  { key: 'pct',   header: '%', footer: 'avg' },
]

// ❌ Homogeneous assumption — only works if ALL columns have same footer type
const tableConfig = {
  showFooter: true,  // → applies sum to every column
  footerType: 'sum'
}
```

**Why:** Real statistical tables have mixed columns (label | number | percent | note). A table-level footer flag can only handle homogeneous data. Per-column gives exact control.

**How to apply:** Any new table-like component → `ColumnDef` array with optional `footer` per column.

---

## Rule 5: extra_dims JSONB — No Hardcoded Dimension Columns

> "Never add a new column to `observation` for a new dimension."

**The rule:**

```sql
-- ✅ Hybrid schema: common dims → physical columns, rare → extra_dims JSONB
CREATE TABLE observation (
  time_period  INT,
  geo_code     VARCHAR(20),     -- common → physical (indexed separately)
  obs_value    DECIMAL(20,6),
  extra_dims   JSONB            -- {"indicator":"P1","account":"production","side":"R"}
);

-- ❌ WRONG: new dimension → new column
ALTER TABLE observation ADD COLUMN sector_code VARCHAR(20);  -- never do this
```

**Why:** Different datasets have different dimensions. Kimball star schema with JSONB extension = Eurostat/IMF pattern. Adding columns per-dimension = schema explosion. `extra_dims` JSONB + GIN index handles arbitrary dims efficiently.

**How to apply:** When a new dataset has a new dimension → it goes in `extra_dims`. Physical columns only for: `time_period`, `geo_code`, `obs_value`, `obs_status`, `dataset_code`.

---

## Rule 6: isCarryForward — Filter, Not Side Deduplication

> "Deduplicate SNA double-entry by `isCarryForward: 0`, not by `side: 'U'`."

**The rule:**

```ts
// ✅ Correct SNA deduplication
const rows = store.getRows({ indicator: 'B1G' })
  .filter(r => r.isCarryForward === 0)  // removes carry-forward entries

// ❌ Wrong — side: 'U' doesn't mean duplicate
const rows = store.getRows({ indicator: 'B1G', side: 'R' }) // discards Uses side incorrectly
```

**Why:** SNA accounts have both Resources (R) and Uses (U) sides. Balancing items (B1G, B2G...) carry forward from one account to the next — those `isCarryForward: 1` entries ARE duplicates. Plain `side: 'U'` filtering removes valid Uses data.

**Phase 2 note:** `isCarryForward` field will be computed by backend and sent in SDMX-JSON. Phase 1: frontend computes it in `fromSDMX` adapter.

---

## Rule 7: JSON-Serializable Config (Phase 2 Readiness)

> "Every field in PageConfig, NodeDef, FilterSchema, NavItem must survive JSON.parse(JSON.stringify(x))."

**The test:**

```ts
// Run this mentally on every config value
JSON.parse(JSON.stringify(value)) // must equal value

// ✅ These pass
{ op: 'eq', left: { $ctx: 'mode' }, right: 'year' }    // ExprVal — JSON
Array<{ key: string; expr: ExprVal }>                   // DeriveMap — JSON
NavItem[]                                               // JSON
string | number | boolean | null                        // primitives — JSON

// ❌ These FAIL
(ctx) => ctx.dims['time']    // function — not JSON
<MyComponent />              // JSX — not JSON
new Date()                   // class instance — loses methods
```

**Why:** Phase 2 Constructor stores page configs in DB. Anything not JSON-serializable cannot be stored → cannot be edited by Constructor → breaks the entire Phase 2 goal.

**How to apply:** Every new config field → Phase 2 test. Functions → replace with ExprVal. Components → replace with type string + registry lookup.

**CI gate — enforce automatically, not by discipline alone (K-4):**

```ts
// engine/core/src/__tests__/json-serializability.test.ts
//
// Catch non-serializable config fields before they reach Phase 2.
// A manual rule ("think about it") was caught once by code review (I-4: store in FilterSchemaInput).
// This test makes it a compile-time + runtime gate.

import { gdpPage }      from '../../src/features/gdp/gdp.config'
import { accountsPage } from '../../src/features/accounts/accounts.config'

const ALL_CONFIGS = [gdpPage, accountsPage, /* ... */]

describe('JSON-serializability — Phase 2 gate', () => {
  it.each(ALL_CONFIGS)('$id survives JSON round-trip', (config) => {
    const roundTripped = JSON.parse(JSON.stringify(config))
    expect(roundTripped).toEqual(config)
    // If this fails: a field contains function, class instance, undefined, or circular ref.
    // Fix: replace with ExprVal (for logic) or type string + registry lookup (for components).
  })
})

// Additional guard — catches undefined fields silently dropped by JSON.stringify:
it('no undefined values in config fields', () => {
  const str = JSON.stringify(gdpPage)
  // undefined fields are DROPPED by JSON.stringify — round-trip gives different shape
  // This is caught by the .toEqual() above, but explicit message helps locate the field
  expect(str).not.toContain('"value":null,"key":undefined')
})
```

**Where to run:** as part of `engine/core` unit tests. Runs on every `tsc + vitest` CI pass.
**What it catches:** `store: DataStore`, `fn: () => ...`, `jsx: <Component />`, `date: new Date()` — all break silently without this gate.

---

## Summary Table

| Rule | One-liner |
|---|---|
| Generic over concrete | `groupBySpan<T>` not `groupSectionsBySpan` |
| Vite .ts/.tsx trap | Unique basenames — no same-name .ts and .tsx |
| Renderer hooks | Hooks in Shell / inner component only |
| ColumnDef.footer | Per-column, not per-table flag |
| extra_dims JSONB | No new physical columns for new dimensions |
| isCarryForward: 0 | SNA dedup = isCarryForward filter, not side filter |
| JSON-serializable | Every config field survives JSON round-trip |
