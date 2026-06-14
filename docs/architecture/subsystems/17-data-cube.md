# 17. Data Cube — Multi-Dimensional Model

> **Canonical location.** Moved here from `docs/data-cube.md`.
> Related: [05-data-pipeline.md](05-data-pipeline.md) · [06-expression-system.md](06-expression-system.md) · [11-backend-standards.md](11-backend-standards.md)

---

## პრობლემა

სტატისტიკური data — N-განზომილებიანი სივრცე:

```
{ indicator } × { time } × { geography } × { breakdown } × { unit } × { vintage }
```

ნებისმიერ dimension-ს hardcode-ი ჰქვია — სხვა განზომილება = type change.
სწორი მოდელი: **dimension key = data, not a type field**.

---

## SDMX DSD — observation = cube-ის ერთი წერტილი

```
Dimension 1: INDICATOR   (B1G, D1, P5...)
Dimension 2: TIME_PERIOD (2020, 2021Q1...)
Dimension 3: REF_AREA    (GE, GE-TB, GE-AJ...)
Dimension 4: BREAKDOWN   (sector, age, gender...)
Attribute 1: UNIT_MULT   (millions, thousands...)
Attribute 2: OBS_STATUS  (P=preliminary, F=final, R=revised)
Measure:     OBS_VALUE   (the number)
```

---

## ჩვენი გადაწყვეტა — უკვე სრულად განხორციელებული

`CubeQuery` (hardcoded dims) ნაცვლად — `ObsQuery` (open dims).
ახალი SDMX განზომილება = **zero type change**.

```ts
// ❌ hardcoded fields — ყოველი ახალი dim = type change:
interface CubeQuery {
  geo?:       string | string[]
  breakdown?: string
  vintage?:   string
}

// ✅ ObsQuery — dimension-agnostic (all-types.ts):
interface ObsQuery {
  indicators?: string[]
  dims?:       Record<string, string | string[]>  // open — any SDMX dimension key
  timeRange?:  [number, number]
}
```

`DataSpecBase.dims` — ExprVal expressions resolved at runtime:

```ts
// geo, breakdown, vintage — all handled the same way, no special cases:
dims: {
  geo:        { $ctx: 'geo' },            // from filter selection
  BREAKDOWN:  { $ctx: 'sector' },         // from filter selection
  OBS_STATUS: { $literal: 'F' },          // final observations only
}
```

---

## "ერთი spec → table + chart" — უკვე გვაქვს

`EncodingSpec` (query + encoding in one type) ნაცვლად — `DataSpec + ChartDef` separation.
ერთი `SectionNode.data` → chart + table children inherited.

```ts
// ❌ EncodingSpec — აერთიანებს data + display (SoC violation):
interface EncodingSpec {
  query:    CubeQuery
  encoding: { label: 'geo' | 'breakdown' | ... }  // hardcoded to CubeQuery keys
}

// ✅ ჩვენი pattern — separated, open:
{
  type: 'section',
  data: { type: 'row-list', indicators: ['B1G', 'D1', 'P3'] },   // WHAT — once
  children: [
    { type: 'chart', layout: { role: 'chart' },
      def: { type: 'bar', encoding: { x: { field: 'indicator' }, y: { field: 'value' } } } },
    { type: 'table', layout: { role: 'table' } },
  ]
}
// chart + table — same data, different view. კოდი არ სჭირდება.
```

`FieldEncoding.field: string` — open, any DataRow field. `keyof CubeQuery` არ სჭირდება.

---

## გეოგრაფიული + Breakdown განზომილება

```ts
// regional comparison — dims-ში geo, hardcode-ი არ არსებობს:
{
  type: 'row-list',
  indicators: ['B1G'],
  dims: { geo: { $ctx: 'geo' } },     // resolved from filter at runtime
}

// breakdown by sector — BREAKDOWN dim key, not a named field:
{
  type: 'row-list',
  indicators: ['B1G'],
  dims: {
    geo:       { $ctx: 'geo' },
    BREAKDOWN: { $ctx: 'sector' },
  },
}
```

---

## Vintage / OBS_STATUS

`DataSpecBase.dims` ან `DataSpecBase.filter` — ორივე მუშაობს:

```ts
// dims: pre-fetch — store returns only matching obs:
dims: { OBS_STATUS: { $literal: 'F' } }    // final only at query level

// filter: post-fetch — row filter after DataRow[] returned:
filter: { isCarryForward: 0 }              // SNA dedup (CLAUDE.md non-negotiable)
```

Rule: `isCarryForward: 0` filter-ში (**CLAUDE.md non-negotiable**). `OBS_STATUS` dims-ში თუ backend-ი მხარდაჭერს, filter-ში — თუ client-side dedup სჭირდება.

---

## Migration — სადღეისოდ

```
ეტაპი 1 ✅  indicator × time          ObsQuery.indicators + timeRange
ეტაპი 2 ✅  + geography               ObsQuery.dims: { geo: ... }
ეტაპი 3 ✅  + breakdown               ObsQuery.dims: { BREAKDOWN: ... }
ეტაპი 4 ✅  encoding: table + chart   SectionNode.data + ChartDef.encoding
ეტაპი 5 ✅  vintage / OBS_STATUS      DataSpecBase.dims / filter (open keys)
```

ყველა ეტაპი დასრულებულია. `CubeQuery` / `EncodingSpec` ცალკე type-ებად **არ საჭიროებს** — `ObsQuery` + `DataSpec` + `ChartDef` უკვე უფრო generic გადაწყვეტაა.

---

## Reference

**SDMX** — ISO 17369. Dimension keys = strings. No named fields per dimension.
**Vega-Lite** — `data + encoding` separate. `field: string` — open. Our `ChartDef` mirrors this.
**Tidy Data** (Hadley Wickham, 2014) — each observation = one row. `DataRow = Record<string, DimVal>`.
**OLAP / Data Cube** (Gray, 1997) — roll-up, drill-down, slice, dice — all via `ObsQuery.dims` filters.