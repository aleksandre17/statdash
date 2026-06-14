
# Testing Strategy

> Priority = production risk. Test what breaks silently, not what's easy to test.
> Reference: ONS/Eurostat publish test coverage requirements for data pipelines.

---

## Risk Matrix

| Layer | Risk | Why |
|---|---|---|
| `interpretSpec` | **CRITICAL** | Wrong data → wrong statistics published. Silent failure. |
| `FilterSchema` / `defineFilters` | **HIGH** | Wrong ctx shape → all downstream data wrong. |
| `evalExpr` | **MEDIUM** | Pure function, easy to unit test, catches expression bugs |
| `engine.evalDerived` | **MEDIUM** | DataLookupOp has side effects (store query) |
| `fromSDMX` | **HIGH** | Adapter corruption = all data wrong at boundary |
| Shell components | **LOW** | Visual regression, not data correctness |
| NodeRenderer | **LOW** | Dispatch-only, trivially testable |

---

## Priority 1: interpretSpec Tests (CRITICAL)

Test every DataSpec type with controlled store data:

```ts
describe('interpretSpec', () => {
  const store = createStaticStore([
    { time: 2020, indicator: 'B1G', geo: 'GE', value: 100, side: 'R', isCarryForward: 0 },
    { time: 2021, indicator: 'B1G', geo: 'GE', value: 120, side: 'R', isCarryForward: 0 },
    { time: 2022, indicator: 'B1G', geo: 'GE', value: 150, side: 'R', isCarryForward: 0 },
    // carry-forward entry — must be filtered
    { time: 2021, indicator: 'B1G', geo: 'GE', value: 120, side: 'R', isCarryForward: 1 },
  ])

  const ctx: SectionContext = {
    timeMode: 'year',
    dims: { time: 2022, geo: 'GE' },
  }

  it('query — filters by indicator', () => {
    const rows = interpretSpec({ type: 'query', indicator: 'B1G' }, ctx, store)
    expect(rows).toHaveLength(3) // 3 years, carry-forward excluded
    expect(rows.every(r => r.indicator === 'B1G')).toBe(true)
  })

  it('timeseries — sorted ascending by time', () => {
    const rows = interpretSpec({ type: 'timeseries', indicator: 'B1G' }, ctx, store)
    expect(rows.map(r => r.time)).toEqual([2020, 2021, 2022])
  })

  it('growth — computes YoY correctly', () => {
    const rows = interpretSpec({ type: 'growth', indicator: 'B1G', base: 'yoy' }, ctx, store)
    expect(rows[1].growth).toBeCloseTo(20, 1) // (120-100)/100 * 100 = 20%
    expect(rows[2].growth).toBeCloseTo(25, 1) // (150-120)/120 * 100 = 25%
  })

  it('by-mode — routes to correct spec by timeMode', () => {
    const spec = {
      type: 'by-mode' as const,
      year:  { type: 'query', indicator: 'B1G' },
      range: { type: 'timeseries', indicator: 'B1G' },
    }
    const yearRows  = interpretSpec(spec, { ...ctx, timeMode: 'year' }, store)
    const rangeRows = interpretSpec(spec, { ...ctx, timeMode: 'range' }, store)
    expect(yearRows).not.toEqual(rangeRows) // different spec branches
  })
})
```

**Fixtures:** Use controlled static stores, not production data. Test edge cases:
- Empty store → returns `[]` (not error)
- All values `null` → returns rows with `value: null`
- Single data point → no growth calculation
- `isCarryForward: 1` entries → excluded from all queries

---

## Priority 2: FilterSchema / defineFilters Tests (HIGH)

```ts
describe('defineFilters', () => {
  it('produces ctx.dims from filter values', () => {
    const schema = defineFilters({
      bars: {
        main: {
          position: 'sticky',
          filters: {
            time:  { type: 'year-select', default: 2023, range: [2000, 2024] },
            geo:   { type: 'select', options: ['GE', 'GE-TB'], default: 'GE' },
          }
        }
      }
    })
    expect(schema.ctx.dims).toEqual({ time: 2023, geo: 'GE' })
    expect(schema.ctx.timeMode).toBe('year')
  })

  it('derive — evaluates in order', () => {
    const schema = defineFilters({
      bars: { main: { position: 'sticky', filters: {
        time: { type: 'year-select', default: 2023, range: [2000, 2024] },
      }}},
      derive: [
        { key: 'isYearMode', expr: { op: 'eq', left: { $ctx: 'timeMode' }, right: 'year' } },
        { key: 'label',      expr: { op: 'if', cond: { $derived: 'isYearMode' }, then: 'year', else: 'range' } },
      ]
    })
    expect(schema.derived.isYearMode).toBe(true)
    expect(schema.derived.label).toBe('year')
  })

  it('crossValidate — emits error when invalid', () => {
    const schema = defineFilters({
      bars: { main: { position: 'sticky', filters: {
        timeFrom: { type: 'year-select', default: 2024, range: [2000, 2024] },
        timeTo:   { type: 'year-select', default: 2020, range: [2000, 2024] },
      }}},
      crossValidate: [
        {
          keys: ['timeFrom', 'timeTo'],
          validate: (from, to) => (from as number) <= (to as number) || 'timeFrom must be ≤ timeTo',
        }
      ]
    })
    expect(schema.errors).toContainEqual(expect.objectContaining({ key: 'crossValidate' }))
  })
})
```

---

## Priority 3: evalExpr Tests (MEDIUM — pure function, trivial)

```ts
describe('evalExpr', () => {
  const scope = {
    ctx:     { mode: 'year', time: 2023 },
    derived: { isYearMode: true },
  }

  it('eq — compares ctx value', () => {
    expect(evalExpr({ op: 'eq', left: { $ctx: 'mode' }, right: 'year' }, scope)).toBe(true)
    expect(evalExpr({ op: 'eq', left: { $ctx: 'mode' }, right: 'range' }, scope)).toBe(false)
  })

  it('if — branches correctly', () => {
    const expr = { op: 'if', cond: { $derived: 'isYearMode' }, then: 'year-label', else: 'range-label' }
    expect(evalExpr(expr, scope)).toBe('year-label')
  })

  it('template — substitutes ctx values', () => {
    expect(evalExpr({ op: 'template', tmpl: '{time} · მლნ ₾' }, scope)).toBe('2023 · მლნ ₾')
  })

  it('and/or — short-circuits', () => {
    expect(evalExpr({ op: 'and', exprs: [true, false] }, scope)).toBe(false)
    expect(evalExpr({ op: 'or',  exprs: [false, true] }, scope)).toBe(true)
  })
})
```

**No mocking needed.** Pure function = straightforward unit tests.

---

## Priority 4: fromSDMX Adapter Tests (HIGH)

```ts
describe('fromSDMX', () => {
  it('converts SDMX-JSON to Observation[]', () => {
    const response = {
      data: { observations: [
        { time: 2023, geo: 'GE', value: 178837.28, status: 'A',
          dims: { indicator: 'P1', account: 'production', side: 'R' } }
      ]}
    }
    const obs = fromSDMX(response)
    expect(obs[0]).toMatchObject({
      time: 2023, value: 178837.28, indicator: 'P1', account: 'production', side: 'R',
    })
  })

  it('Phase 1: CODE_MAP normalizes codes', () => {
    const obs = fromSDMX({ data: { observations: [
      { time: 2023, value: 100, status: 'A', dims: { indicator: 'B1g' } }
    ]}})
    expect(obs[0].indicator).toBe('B1G') // normalized
  })

  it('Phase 1: isCarryForward computed correctly', () => {
    // isBalancing + side R + seqPos > 0 → isCarryForward: 1
    // (Phase 2: backend sends this directly)
  })
})
```

---

## engine.evalDerived with DataLookupOp (store mock needed)

```ts
describe('engine.evalDerived — DataLookupOp', () => {
  it('tree-field — resolves value from hierarchical data', async () => {
    const mockStore = createMockStore([
      { id: 'B1G', sectionId: 'production-account' },
      { id: 'D1',  sectionId: 'income-account' },
    ])
    const result = await evalDerived({
      selectedSectionId: {
        op:   'tree-field',
        data: { type: 'query', storeId: 'accounts', indicator: 'ACCOUNT_TREE' },
        ref:  { $ctx: 'account' },
        field: 'sectionId',
        fallback: null,
      }
    }, { dims: { account: 'B1G' }, stores: { accounts: mockStore } })

    expect(result.selectedSectionId).toBe('production-account')
  })
})
```

---

## Test Infrastructure

```
engine/expr/src/__tests__/       — evalExpr, evalDerived (pure)
engine/core/src/__tests__/     — interpretSpec, fromSDMX (with fixtures)
engine/react/src/__tests__/      — renderNode (render tests, minimal)
src/__tests__/                     — integration: filter → data → render
```

**Fixtures location:** `engine/core/src/__tests__/fixtures/`
- `nationalAccounts.fixture.ts` — static Observation[] for accounts
- `gdp.fixture.ts` — static GDP data
- `sdmxResponse.fixture.ts` — raw SDMX-JSON payloads

**No MSW in unit tests.** MSW = integration/E2E only. Unit tests use static stores.

---

## What NOT to Test

| Skip | Why |
|---|---|
| Shell visual layout | Snapshot tests break on every style change |
| CSS class names | Implementation detail |
| ThemeProvider wiring | Trust React context |
| NavItem rendering | Integration concern |

---

## Priority 5: Integration Tests — filter → data → render (G-9)

> **ONS/Eurostat standard:** integration tests cover the full vertical slice.
> Filter state changes → correct data queried → correct output rendered.
> These catch bugs that unit tests miss (wrong ctx wiring, stale closures, render divergence).

```ts
// src/__tests__/integration/gdp-filter-change.test.tsx
//
// Tests the full slice: URL param → useFilters → ctx.dims → interpretSpec → rows → render
// No MSW in this test — uses static store (fast, deterministic, no network)

import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter }              from 'react-router-dom'
import { SiteProvider }              from '@geostat/react'
import { FilterProvider }            from '@geostat/react'
import { ThemeProvider }             from '@geostat/react'
import { PageRendererInner }         from '@geostat/react'
import { createStaticStore }         from '@geostat/engine'
import { gdpPage }                   from '../features/gdp/gdp.config'
import { DEFAULT_THEME }             from '../app/theme'

const store = createStaticStore([
  { time: 2022, indicator: 'B1G', geo: 'GE', value: 48732, side: 'R', isCarryForward: 0 },
  { time: 2023, indicator: 'B1G', geo: 'GE', value: 52100, side: 'R', isCarryForward: 0 },
])

function renderPage(initialUrl = '/gdp?time=2022&geo=GE') {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <ThemeProvider theme={DEFAULT_THEME}>
        <SiteProvider stores={{ gdp: store }} nav={[]}>
          <FilterProvider>
            <PageRendererInner page={gdpPage} />
          </FilterProvider>
        </SiteProvider>
      </ThemeProvider>
    </MemoryRouter>
  )
}

describe('GDP page — filter → data → render', () => {
  it('renders correct value for time=2022', () => {
    renderPage('/gdp?time=2022&geo=GE')
    // KPI strip or table should show 48732 (not 52100)
    expect(screen.getByText(/48[\s,.]?732/)).toBeInTheDocument()
  })

  it('filter change → URL update → re-render with new data', async () => {
    renderPage('/gdp?time=2022&geo=GE')

    // User changes year filter
    fireEvent.change(screen.getByRole('combobox', { name: /წელი/i }), {
      target: { value: '2023' },
    })

    // Value should update without page reload
    expect(await screen.findByText(/52[\s,.]?100/)).toBeInTheDocument()
  })

  it('empty state shown when no rows match', () => {
    renderPage('/gdp?time=1900&geo=GE')    // no data for 1900
    expect(screen.getByText(/მონაცემი არ მოიძებნა/)).toBeInTheDocument()
  })
})
```

### Lighter integration: functional slice (no DOM)

```ts
// When you only need to verify data correctness, skip rendering entirely:
//   filter → ctx → interpretSpec → rows (pure, no React)
//   Much faster. Catch wrong data before visual tests.

it('filter ctx flows to interpretSpec correctly', () => {
  const schema = defineFilters({
    bars: { main: { position: 'sticky', filters: {
      time: { type: 'year-select', defaultValue: 2023 },
      geo:  { type: 'select', options: [{ value: 'GE', label: 'საქართველო' }], defaultValue: 'GE' },
    }}}
  })
  const ctx = schema.ctx    // { timeMode: 'year', dims: { time: 2023, geo: 'GE' } }

  const rows = interpretSpec(
    { type: 'timeseries', indicator: 'B1G' },
    ctx,
    store,
  )

  expect(rows.every(r => r.geo === 'GE')).toBe(true)
  expect(rows.map(r => r.time)).toContain(2023)
})
```

**Rule:** Functional slices run in unit test suites. DOM integration tests run in `src/__tests__/integration/`. No MSW in either — reserve MSW for E2E / Playwright.

---

## nodeRegistry — module singleton: test isolation (K-7)

> **Grafana:** plugin registry is a module-level singleton — explicitly noted in plugin docs.
> Tests that call `nodeRegistry.register()` without cleanup → test pollution: later tests see unexpected types.

```ts
// nodeRegistry is exported as a singleton from @geostat/react:
//   export const nodeRegistry = new NodeRegistry()
//
// Every register() call mutates shared state.
// If test A registers 'custom-node' and test B doesn't → test B may still see it.

// ✅ Solution — clear registry before tests that register custom types:
beforeEach(() => {
  nodeRegistry.clear()   // removes all registered types
  // Re-register built-ins needed for the test:
  nodeRegistry.register('section', SectionRenderer)
  nodeRegistry.register('kpi-strip', KpiStripRenderer)
})

// Alternative — isolated engine instance per test file:
// If nodeRegistry.clear() is too broad (clears built-ins registered in setupEngine.ts),
// create a fresh NodeRegistry per test:
const testRegistry = new NodeRegistry()
testRegistry.register('section', SectionRenderer)
const testEngine = createEngine(testRegistry)   // engine.extend() with test registry

// ✅ Integration tests that use PageRendererInner with setupEngine.ts:
//   setupEngine.ts calls nodeRegistry.register() — singleton pollution risk if tests run in same process.
//   Use --isolate flag in Vitest (separate worker per test file) to avoid cross-file pollution.
```

**Vitest config for isolation:**

```ts
// vitest.config.ts
export default {
  test: {
    isolate: true,   // each test file gets a fresh module registry
    // With isolate: true — nodeRegistry singleton is fresh per file.
    // Without isolate: registration from one file leaks into another.
  }
}
```

**Rule:** Tests that register node types MUST either:
1. Use `beforeEach(() => nodeRegistry.clear())` + re-register what they need, OR
2. Run in isolated worker (`isolate: true` in Vitest config).

**`nodeRegistry.clear()` must be documented as a test utility method** — not for production use.

---

## Testing Sequence (recommended order)

```
1. evalExpr       — zero deps, start here
2. evalDerived    — builds on evalExpr
3. fromSDMX       — boundary integrity
4. interpretSpec  — production risk, all DataSpec types
5. defineFilters  — ctx output, derive, crossValidate
6. renderNode     — dispatch correctness (not visual)
7. Integration    — filter → data → render (full slice, DOM)
   7a. Functional — filter → ctx → interpretSpec → rows (no DOM, fastest)
   7b. Component  — PageRendererInner with MemoryRouter (verifies wiring)
```

---

## Manual Smoke Tests — View Props & Layout

> Moved from `docs/TESTING.md`. Operational verification checklist.

### RowNode — Side-by-Side Layout

| test | expected |
|---|---|
| mode=year | 2 sections visible (production + expenditure), panel-row 2-col grid |
| mode=range | 2 sections visible (production-range + income-range), panel-row 2-col grid |
| responsive (< 1280px) | grid stacks vertically (1 column) |
| cols equal width | ორი panel-col თანაბარია (`flex: 1` ან `1fr`) |

### RowNode.view.visibleWhen

| test | expected |
|---|---|
| mode=year | row visible |
| mode=range | row entirely hidden |

### view.width — panel-col--w-* CSS

| config | expected class | context |
|---|---|---|
| `view.width: 'half'` | `panel-col panel-col--w-half` | standalone section: `width: 50%` |
| `view.width: 'third'` | `panel-col panel-col--w-third` | standalone section: `width: 33.33%` |
| `view.width: 'full'` | `panel-col panel-col--w-full` | in panel-row: `grid-column: 1/-1` |
| no width | `panel-col` | full width (default) |

### view.default — Initial Chart/Table State

| config | expected |
|---|---|
| `view.default: 'chart'` | section opens showing chart |
| `view.default: 'table'` | section opens showing table directly |

### view.toggle — Show/Hide Toggle Buttons

| config | expected |
|---|---|
| `view.toggle: true` + chart + table | toggle buttons visible in header |
| `view.toggle: false` + chart | no toggle buttons; chart always shown |
| section has chart but no table | toggle hidden |

### view.legend — Chart Legend Position

| config | expected |
|---|---|
| `view.legend: 'bottom'` | ApexCharts legend at bottom |
| `view.legend: 'right'` | legend moves to right side |
| `view.legend: 'none'` | no legend rendered |

Note: legend auto-hidden when only 1 series (`seriesCount > 1` rule).

### view.tooltip — Tooltip Behavior

| config | expected |
|---|---|
| `view.tooltip: 'multi'` | shared tooltip shows all series on hover |
| `view.tooltip: 'single'` | tooltip shows only hovered series |
| `view.tooltip: 'none'` | no tooltip on hover |

### view.visibleWhen — Conditional Rendering

| config | expected |
|---|---|
| `{ op: 'eq', param: 'mode', is: 'year' }` | visible in year mode, null in range |
| `{ op: 'eq', param: 'mode', is: 'range' }` | visible in range mode, null in year |

**Verify:** switch mode toggle in FilterBar → sections appear/disappear.

### Chart Pipeline — Legend/Tooltip Flow

`view.legend` → `SectionRenderer` → `ChartDef.legend` → `interpretChart` → `ChartOutput.legend` → `buildLegend()` → `apexAdapter` → ApexCharts.

### Performance Checklist

| check | method |
|---|---|
| No extra re-renders on filter change | React DevTools Profiler — only changed sections re-render |
| `useMemo` on `interpretSpec` | change filter → unchanged sections don't re-compute |
| `visibleWhen` null sections | DevTools → DOM — null sections generate no DOM nodes |
| `RowRenderer` null children filtered | year/range switch → panel-row has correct `--panel-cols` |

### Regression — Existing Pages

| page | check |
|---|---|
| GDP | both year/range sections render, KPIs visible, links footer |
| Accounts | sna-hero sections, detail sections collapse/expand |
| Regional | region selector works, growth sections toggle by mode |
| All pages | FilterBar sticky, chart/table toggle per section |

### Known Gaps

- `view.width: 'full'` inside `panel-row` — `grid-column: 1/-1` needs visual verification with a 2-col row
- `view.compact` — no section currently uses it; add to one section to verify
- `view.tooltip: 'single'` vs `'multi'` difference — needs side-by-side comparison
- TabNode `visibleWhen` — no config currently uses it; test with manual config snippet
