
# Next Priorities — Roadmap

> From CLAUDE.md. Ordered by impact on production quality.
> Architecture refactor is the foundation. These are the features that make it production-ready.

---

## Priority Queue

```
1. Error handling + empty states       ← UX-ზე ყველაზე visible
2. Loading skeletons                   ← ONS/Eurostat standard
3. Tests (interpretSpec + FilterSchema)← production risk
4. Per-indicator metadata              ← IMF standard
5. Performance memoization             ← scale
6. Accessibility verification          ← WCAG 2.1 AA
```

---

## #1: Error Handling + Empty States (HIGH IMPACT)

**Why first:** Users see these immediately. Empty white space = broken product.

### Error boundaries (section level)

```tsx
// Every Section must catch errors independently
// If one section fails → others still render

function GeostatSectionShell({ def, children }: SectionShellProps) {
  return (
    <ErrorBoundary
      fallback={<SectionError title={def.title} />}
    >
      {/* section content */}
    </ErrorBoundary>
  )
}

function SectionError({ title }: { title?: string }) {
  return (
    <section className="geostat-section geostat-section--error">
      <p className="section-error-message">
        {title ? `"${title}" — ` : ''}მონაცემი ვერ ჩაიტვირთა
      </p>
      <button onClick={() => window.location.reload()}>
        განახლება
      </button>
    </section>
  )
}
```

### Empty states (per DataSpec result)

```tsx
// interpretSpec returns [] → EmptyState component
{rows.length === 0 ? (
  <EmptyState
    icon="chart"
    title="მონაცემი არ მოიძებნა"
    description={buildEmptyDescription(spec, ctx)}
    // "2024 წლის მონაცემი ჯერ არ არის ხელმისაწვდომი"
  />
) : (
  <Chart rows={rows} />
)}
```

**Empty state messages should explain WHY (not just "no data"):**
- No data for this period → "X წლის მონაცემი ჯერ არ არის"
- Filter too restrictive → "სცადეთ განსხვავებული ფილტრი"
- API error → "მონაცემი ვერ ჩაიტვირთა · განახლება"

---

## #2: Loading Skeletons (ONS/Eurostat Standard) — J-6 corrected

**Why:** Data loads async. Without skeletons → layout shift → poor UX.

### Correct pattern — per-section Suspense (NOT isLoading prop)

```
❌ isLoading prop on SectionShellProps
   Shell receives isLoading: boolean → shell checks it → shows skeleton
   Problem: HttpDataStore throws Promise BEFORE shell renders.
            Shell never receives isLoading = true — it doesn't render at all.
            isLoading prop = impossible to receive via Suspense path.

✅ Per-section Suspense in engine
   Engine wraps each rendered node in <Suspense fallback={<SectionSkeleton />}>
   Shell only renders when data is ready — never needs isLoading prop.
```

```tsx
// engine.renderNode — per-node Suspense + ErrorBoundary wrapping:
return (
  <Suspense fallback={<NodeSkeleton type={node.type} />}>
    <NodeErrorBoundary node={node}>
      {this.nodes.render(node, enrichedCtx, children)}
    </NodeErrorBoundary>
  </Suspense>
)

// NodeSkeleton — picks shape by node type:
function NodeSkeleton({ type }: { type: string }) {
  if (type === 'section')   return <SectionSkeleton />
  if (type === 'kpi-strip') return <KpiStripSkeleton />
  if (type === 'filter-bar') return <FilterBarSkeleton />
  return <GenericSkeleton />
}

// SectionSkeleton — matches real section shape (no layout shift):
function SectionSkeleton() {
  return (
    <section className="geostat-section geostat-section--skeleton" aria-hidden="true">
      <div className="skeleton-line" style={{ width: '40%', height: 24 }} />
      <div className="skeleton-rect" style={{ height: 300, marginTop: 16 }} />
    </section>
  )
}

// Shell stays clean — no isLoading, no conditional:
function GeostatSectionShell({ def, children }: SectionShellProps) {
  return <section className="geostat-section">...</section>
  // data is always ready when shell renders — Suspense handles the rest
}
```

**ONS skeleton rules:**
1. Skeleton shape = final content shape (no layout shift)
2. No spinner alone (skeleton only, per ONS pattern)
3. Min display: 200ms — use `useTransition` or CSS `animation-delay` to avoid flash
4. KPI strip skeleton = same grid as real KPIs
5. Shell never needs `isLoading` prop — Suspense boundary handles loading state

---

## #3: Tests — interpretSpec + FilterSchema

**Why:** Silent data errors. See `architecture/13-testing-strategy.md` for full plan.

**Minimum test coverage before production:**

```
✅ interpretSpec — all DataSpec types (query, timeseries, growth, ratio-list, pivot, by-mode)
✅ isCarryForward filter — SNA deduplication correctness
✅ defineFilters — ctx.dims output from filter values
✅ evalExpr — all op types
✅ fromSDMX — boundary adapter integrity
```

---

## #4: Per-Indicator Metadata (IMF Standard)

**Why:** IMF Data Mapper standard — every indicator has label, unit, source, methodology.

```ts
// dim_indicator provides per-indicator metadata
interface IndicatorMeta {
  code:         string      // 'B1G'
  label_ka:     string      // 'მთლიანი დამატებული ღირებულება'
  label_en:     string      // 'Gross Domestic Product'
  unit:         string      // 'GEL millions'
  sna_ref:      string      // 'SNA 2008, §2.3'
  is_balancing: boolean     // balancing item = has special SNA meaning
  methodology:  string      // URL to methodology page
}
```

**UI impact:**
- Chart title = indicator label (not code)
- Table header = indicator label + unit
- Section subtitle = `view.subtitle` from metadata
- Methodology footer link = `meta.methodology`

---

## #5: Performance Memoization (Scale) — J-1 corrected

**Why:** Constructor Phase 2 = many nodes, re-renders on filter change.

### Where to memoize (Rule 3 applies)

```
engine.renderNode() — plain function, NOT React component → useMemo forbidden inside it
Shell components    — React components → useMemo / React.memo valid here
SiteRenderer        — React component → useMemo valid for stable baseRenderCtx
```

### Key memoization points

```ts
// 1. SiteRenderer — stabilize baseRenderCtx so all child shells don't re-render
//    (SiteRenderer IS a React component — useMemo valid here)
function PageRendererInner({ page }: { page: PageConfig }) {
  const store     = usePageStore(page.storeKey)
  const { ctx: sectionCtx, ... } = useFilterState(page.filterBar ?? EMPTY_FILTER_BAR)

  // ✅ Stable ctx — only recomputes when dims actually change
  const baseRenderCtx = useMemo(
    () => ({ sectionCtx, store, ... }),
    // stable primitive keys — NOT object refs (object refs change every render):
    [
      JSON.stringify(sectionCtx.dims),   // dims as stable string key
      sectionCtx.timeMode,               // primitive — stable
      page.id,                           // string — stable
    ]
  )
  return <InnerLayout>{engine.renderSlots(page, baseRenderCtx)}</InnerLayout>
}

// 2. Shell components — React.memo prevents re-render when parent re-renders
//    Shell only re-renders when its own props change (rows, def, view)
const GeostatSectionShell = React.memo(
  function GeostatSectionShell({ def, children }: SectionShellProps) {
    return <section>...</section>
  }
)

// 3. interpretSpec result — memoize in shell or renderer-wrapper component
//    (NOT inside engine.renderNode — that's a plain function, not React component)
//
//  ❌ Wrong — object ref unstable, memo never hits:
//    useMemo(() => interpretSpec(spec, ctx, store), [spec, ctx.dims, storeId])
//    spec is new object every render. ctx.dims is new object every render.
//
//  ✅ Correct — stable string keys derived from JSON-serializable values:
//    useMemo(() => interpretSpec(spec, ctx, store), [
//      JSON.stringify(spec),            // stable: spec is JSON-serializable
//      JSON.stringify(sectionCtx.dims), // stable: dims is Record<string,DimVal>
//      store,                           // same DataStore instance — ref stable
//    ])
```

**Memoization rule:** Memoize at data boundaries (dims → DataRow[]).
`interpretSpec` is pure — memoize the CALL SITE, not internals.
Stable keys = primitives or `JSON.stringify(jsonSerializableValue)` — never raw object refs.

---

## #6: Accessibility Verification (WCAG 2.1 AA)

**Why:** Legal requirement in Georgian public sector. ONS/Eurostat publish a11y statements.

### Verification checklist

```
□ Keyboard navigation — Tab through all filters, buttons, links
□ Screen reader — NVDA/VoiceOver reads chart as <figure><figcaption>
□ Color contrast — 4.5:1 text, 3:1 UI components (use axe DevTools)
□ Focus visible — :focus-visible ring on all interactive elements
□ Table headers — <th scope="col"> and <th scope="row">
□ ARIA roles — <nav>, <main>, <section aria-labelledby>
□ Dynamic regions — aria-live on filter results count
□ Modal focus trap — if any modal/drawer used
```

**Tools:**
- `axe DevTools` browser extension — automated WCAG check
- `eslint-plugin-jsx-a11y` — lint-time checks
- NVDA (Windows) / VoiceOver (Mac) — manual screen reader test

---

## #4b: Per-Indicator Metadata Flow — end-to-end (J-8)

> **IMF Data Mapper standard:** chart title = indicator label (not code). Unit in column header. Methodology link in footer.
> Metadata must flow from DB → DataRow → shell display without renderer fetching.

### Two patterns — choose by use case

**Pattern A: fromSDMX enriches rows at boundary (Phase 1)**
```ts
// fromSDMX joins obs with CODE_MAP at the boundary (already in Phase 1):
// obs.dims.indicator = 'B1g' → CODE_MAP['B1g'] = 'B1G'
// → row.indicator = 'B1G'

// Phase 1 — CODE_MAP also carries labels (temporary until Phase 2 backend):
const CODE_MAP: Record<string, { code: string; label_ka: string; unit: string }> = {
  'B1g': { code: 'B1G', label_ka: 'მთლიანი შიდა პროდუქტი', unit: 'მლნ ₾' },
  'P3':  { code: 'P3',  label_ka: 'საბოლოო მოხმარება',       unit: 'მლნ ₾' },
}

// fromSDMX enriches each row:
const row: DataRow = {
  indicator: 'B1G',
  label_ka:  'მთლიანი შიდა პროდუქტი',   // ← metadata on DataRow
  unit:      'მლნ ₾',
  value:     48732,
  time:      2023,
  geo:       'GE',
}

// Shell reads row.label_ka, row.unit directly — no extra fetch needed:
function GeostatChartShell({ def, output }: ChartShellProps) {
  // output.series[0].name = indicator label (from interpretChart → row.label_ka)
  return <ReactApexChart options={toApexOptions(output)} />
}
```

**Pattern B: DataLookupOp in NodeBase.derive (Phase 2 — metadata from separate store)**
```ts
// Phase 2: backend sends dim_indicator as a reference dataset
// Node config uses DataLookupOp to join:
{
  type: 'section',
  derive: [
    {
      key: 'indicatorLabel',
      expr: {
        op:      'map-field',
        data:    { type: 'query', storeId: 'indicator-meta' },  // metadata store
        ref:     { $ctx: 'indicator' },                          // current filter value
        field:   'label_ka',
        fallback: 'N/A',
      }
    }
  ],
  view: {
    subtitle: { $derived: 'indicatorLabel' },    // derived → view → shell title
  }
}
// Shell receives view.subtitle = 'მთლიანი შიდა პროდუქტი' (resolved scalar)
// Zero renderer code change — metadata injected via derive + view
```

**Rule:** Renderer NEVER fetches metadata. Metadata arrives via DataRow (Pattern A) or `$derived` (Pattern B). Shell reads `row.label_ka`, `def.view.subtitle`, `row.unit` — all resolved before shell renders.

---

## Architecture Prerequisite

**All 6 priorities require the new architecture to be in place first.**

```
Strangler Fig migration → then error handling (correct layer: Shell)
Strangler Fig migration → then skeletons (Shell controls loading state)
Strangler Fig migration → then tests (interpretSpec is pure, testable)
```

No point building skeletons in the wrong layer (old architecture).
Migration first → then these features in the correct place.

---

## Milestone Definition

| Priority | Done when |
|---|---|
| Error handling | Every section has ErrorBoundary. Every empty-data path shows EmptyState. |
| Loading skeletons | Every section shows SectionSkeleton during load. No layout shift. |
| Tests | interpretSpec + FilterSchema + evalExpr covered. CI green. |
| Metadata | Indicator labels/units shown in chart titles, table headers, methodology footer. |
| Memoization | Filter change → only affected sections re-render (not all). |
| A11y | axe DevTools: 0 critical violations. Keyboard navigation: all interactive elements. |
