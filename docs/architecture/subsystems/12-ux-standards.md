
# UX Standards — ONS / Eurostat / IMF / World Bank

> Our UX is not custom. It follows tested patterns from leading statistical organizations.
> "Clarity over cleverness" — ONS principle #1.

---

## Page Anatomy — ONS/Eurostat Standard

```
┌─────────────────────────────────────────────────────┐
│  PageHeader                                         │
│  title · subtitle · last updated · methodology link │
├─────────────────────────────────────────────────────┤
│  FilterBar (sticky-top)                             │
│  time · geo · mode · derived filters                │
├─────────────────────────────────────────────────────┤
│  KPI Strip                                         │
│  key metrics at a glance (3–5 values)              │
├─────────────────────────────────────────────────────┤
│  Section 1 (expanded by default)                   │
│  [Chart ↔ Table toggle]   [Export]                 │
├─────────────────────────────────────────────────────┤
│  Section 2 (collapsed by default) ▶                │
│  ...                                               │
├─────────────────────────────────────────────────────┤
│  Methodology footer                                │
│  source · revision note · reference                │
└─────────────────────────────────────────────────────┘
```

**Progressive disclosure:**
```
KPI strip → chart → table → methodology
```

Users see summary first. Details on demand. Secondary sections collapsed.

---

## Principle 1: Clarity Over Cleverness (ONS)

> "Data must be understood, not wondered at."

- Every chart has a clear title and unit
- Every table column has a header and unit
- No decorative elements that compete with data
- Color encodes meaning (not decoration) — and never only color (WCAG)
- Labels on critical data points (not just legend)

**Anti-patterns:**
- Animated transitions that distract from data changes
- "Smart" chart types users don't recognize (radar, treemap without explanation)
- Truncated labels without tooltip fallback

---

## Principle 2: Data Integrity (IMF/Eurostat)

Every data display must include:

| Element | Purpose | Implementation |
|---|---|---|
| `OBS_STATUS` badge | Marks preliminary/estimated data | `obs_status === 'P'` → "წინასწარი" badge |
| Last updated date | Trust and freshness | `dim_time.is_preliminary` → footer note |
| Methodology link | IMF standard: always cite method | `view.methodologyUrl` → footer link |
| Revision note | When data was revised | `view.revisionNote?` → inline alert |
| Source citation | Geostat / SNA 2008 / ESA 2010 | Section footer |

**Preliminary data rule:**
```ts
// ✅ Show badge when any visible row has obs_status === 'P'
const hasPreliminary = rows.some(r => r.status === 'P')
{hasPreliminary && <Badge variant="warning">წინასწარი მონაცემი</Badge>}
```

---

## Principle 3: Accessibility — WCAG 2.1 AA

**Required for every component:**

| Requirement | Implementation |
|---|---|
| Semantic HTML | `<section>`, `<table>`, `<nav>`, `<header>` — not `<div>` everywhere |
| ARIA labels | `aria-label` on buttons without text, `aria-live` on dynamic regions |
| Keyboard navigation | All interactive elements reachable with Tab, Enter/Space |
| No color-only information | Color + icon + text for status (not color alone) |
| Focus visible | CSS `:focus-visible` ring on all interactive elements |
| Table headers | `<th scope="col">` / `<th scope="row">` |
| Chart alt text | `<figure><figcaption>` describing the chart content |

**Color contrast:** Minimum 4.5:1 (text), 3:1 (UI components).

```tsx
// ✅ WCAG-correct toggle
<div role="group" aria-label="ჩვენების ტიპი">
  <button aria-pressed={showChart} onClick={() => setShowChart(true)}>
    <BarChartIcon aria-hidden="true" />
    გრაფიკი
  </button>
  <button aria-pressed={!showChart} onClick={() => setShowChart(false)}>
    <TableIcon aria-hidden="true" />
    ცხრილი
  </button>
</div>
```

---

## Principle 4: Export (Eurostat/World Bank) — G-10

Every section with data must have export capability. Formats: Excel (primary), CSV, PNG (chart).

### Export function — Phase 1 stub, Phase 2 real

```ts
// engine/core/src/export/exportRows.ts
//
//  Phase 1: stub — button exists, keyboard-accessible, logs intent
//  Phase 2: real xlsx/csv — swap implementation, zero call-site changes

export type ExportFormat = 'xlsx' | 'csv' | 'png'

export function exportRows(
  rows:     DataRow[],
  format:   ExportFormat,
  filename: string,
): void {
  if (rows.length === 0) {
    console.warn('[Export] no data to export')
    return
  }

  // Phase 1 stub — replace body in Phase 2:
  console.warn(`[Export] stub — ${format} "${filename}" (${rows.length} rows)`)

  // Phase 2 implementation (xlsx example):
  // import { utils, writeFile } from 'xlsx'
  // const ws = utils.json_to_sheet(rows)
  // const wb = utils.book_new()
  // utils.book_append_sheet(wb, ws, 'data')
  // writeFile(wb, `${filename}.xlsx`)
}
```

### Section shell — export button wiring

```tsx
// GeostatSectionShell — export button triggered from shell
// Shell has ctx.rows (via SectionRenderer) — passes directly to exportRows()

function GeostatSectionShell({ def, view, rows, children }: SectionShellProps) {
  const title = def.title ?? 'data'

  return (
    <section className="geostat-section">
      <div className="section-header">
        <h2>{def.title}</h2>
        {view.exportable && (
          <div className="section-actions" role="group" aria-label="ექსპორტი">
            <button
              onClick={() => exportRows(rows, 'xlsx', title)}
              aria-label={`${title} — Excel-ში გადმოწერა`}
            >
              Excel
            </button>
            <button
              onClick={() => exportRows(rows, 'csv', title)}
              aria-label={`${title} — CSV-ში გადმოწერა`}
            >
              CSV
            </button>
          </div>
        )}
      </div>
      {children}
    </section>
  )
}
```

### Config — per-section export control

```ts
// Section node config — Constructor sets this per section
{
  type: 'section',
  title: 'მშპ — წარმოების მეთოდი',
  view: {
    exportable: true,         // shows Excel + CSV buttons
    // exportable: false      // hides export (methodology sections, etc.)
  },
  data: { type: 'timeseries', indicator: 'B1G' },
}
```

**Phase 1 → Phase 2 upgrade path:**
- Phase 1: `exportRows()` body = stub (console.warn). Button renders and is keyboard-accessible.
- Phase 2: Replace `exportRows()` body — real xlsx/csv. Zero call-site changes (button, wiring, config untouched).
- PNG export: handled separately by chart shell via `chart.dataURI()` (ApexCharts built-in).

---

## Principle 5: URL = Permalink

**Every filter state must be in the URL.** This is a non-negotiable.

```ts
// ✅ URL encodes full filter state
/gdp?time=2023&geo=GE&mode=year

// useFilters() — reads from URL, writes to URL
const { ctx, bars } = useFilters(schema)
// ctx.dims is always derived from URL params
```

**Why:** Users share URLs with colleagues. "I saw this data yesterday" is meaningless without a permalink. Eurostat, ONS, and World Bank all use URL-encoded filter state.

---

## Principle 6: Loading States (ONS/Eurostat Standard)

**Every data-dependent section must have a skeleton state.**

```tsx
// Pattern: skeleton matches the shape of real content
{isLoading ? (
  <section className="geostat-section">
    <div className="section-header skeleton-line" style={{ width: '40%' }} />
    <div className="section-chart skeleton-rect" style={{ height: 300 }} />
  </section>
) : (
  <GeostatSectionShell def={def} children={children} />
)}
```

**Rules:**
- Skeleton shape = final content shape (no layout shift)
- No spinner alone (skeleton only)
- Min display: 200ms (avoid flash for fast loads)

---

## Principle 7: Empty States

**Every list, table, chart must handle zero rows.**

```tsx
// ✅ Informative empty state
{rows.length === 0 ? (
  <EmptyState
    icon="chart"
    title="მონაცემი არ მოიძებნა"
    description="სცადეთ სხვა პერიოდი ან რეგიონი"
  />
) : (
  <Chart rows={rows} />
)}
```

**Rules:**
- Empty state explains WHY (no filter match, no data for period, etc.)
- Suggests what to do (change filter, expand date range)
- Never show a blank white space

---

## Page Types and Their Shells

| Node Type | Shell | Primary UX Pattern |
|---|---|---|
| `inner-page` | `GeostatInnerPageShell` | PageHeader + FilterBar + content |
| `tab-page` | `GeostatTabPageShell` | Tab navigation + inner page per tab |
| `container-page` | `GeostatContainerPageShell` | Grid layout, span-based columns |
| `section` | `GeostatSectionShell` | Chart/Table toggle + Export + collapse |
| `filter-bar` | `GeostatFilterBarShell` | Sticky bar, filter chips, reset |
| `kpi-strip` | `GeostatKpiCard` | KPI cards with trend arrows |
| `chart` | `GeostatChartShell` | ApexCharts wrapper + accessibility |
| `table` | `GeostatTableShell` | Sortable, paginated, keyboard nav |

---

## Reference: ONS/Eurostat UX Patterns We Follow

| Pattern | Source | Our Implementation |
|---|---|---|
| Sticky filter bar | ONS | `layout: { position: 'sticky-top' }` |
| KPI strip above chart | Eurostat | `kpi-strip` node before section |
| Chart/Table toggle | ONS, Eurostat | `GeostatSectionShell` toggle |
| Preliminary badge | IMF | `obs_status === 'P'` → badge |
| Progressive disclosure | ONS | collapsed secondary sections |
| Permalink | Eurostat, World Bank | `useFilters` → URL state |
| Export per section | World Bank, Eurostat | `view.exportable: true` |
| Methodology footer | IMF | `view.methodologyUrl` |
