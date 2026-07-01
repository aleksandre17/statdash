---
name: engine_dataspec_types
description: DataSpec discriminant type definitions for Constructor Panel UI
metadata:
  type: reference
  source: engine/core/src/config/section.ts
---

# DataSpec — 9 Discriminant Types

100% JSON-serializable. All are Constructor-ready (except `custom`).

## 1. `query` — Universal SDMX + Pipeline

```typescript
{
  type: 'query'
  query: ObsQuery              // SDMX observation query
  pipe?: TransformStep[]       // optional transform pipeline
  encoding: EncodingSpec       // maps fields to visual channels
  fromDim?: string; toDim?: string
}
```
Most flexible. Store.observe() + optional transform + encoding.

## 2. `row-list` — Explicit Rows

```typescript
{
  type: 'row-list'
  rows: RowSpec[]
}
```
RowSpec: `{ code, label?, color?, negate?, isTotal?, pctOf? }`
Year-mode shorthand for fixed row sets.

## 3. `timeseries` — Single Measure × Time Range

```typescript
{
  type: 'timeseries'
  code: string
  years: YearsSpec      // number[] | 'all'
  fromDim?: string; toDim?: string
}
```
Time-axis visualization. Each year → separate store query.

## 4. `growth` — Year-over-Year Growth Rates

```typescript
{
  type: 'growth'
  code: string | string[]     // single or array (pivot)
  years: YearsSpec            // number[] | 'all'
  fromDim?: string; toDim?: string
}
```
Computes (val[year] - val[year-1]) / val[year-1] × 100.

## 5. `ratio-list` — Measure / Denominator Pairs

```typescript
{
  type: 'ratio-list'
  pairs: Array<{ code, denom, label? }>
  pipe?: TransformStep[]
}
```
Each pair computes numerator / denominator × 100.

## 6. `by-mode` — Branch on Time Mode

```typescript
{
  type: 'by-mode'
  modes: Record<ModeId, DataSpec>
}
```
Dispatches to modes['year'] or modes['range']. Recursive.

## 7. `pivot` — Wide → Long Transform

```typescript
{
  type: 'pivot'
  rows: Record<string, DimVal>[]
  keyField: string
  valueFields: string[]
  colors?: Record<string, string>
}
```
Unpivots inline data. Shorthand for melt transform.

## 8. `transform` — Full Pipeline on Inline Data

```typescript
{
  type: 'transform'
  source: Record<string, DimVal>[]
  steps: TransformStep[]
  encoding: EncodingSpec
}
```
applyPipeline(source, steps) → encoding.

## 9. `custom` — Escape Hatch (Phase 1 only)

```typescript
{
  type: 'custom'
  fn: (ctx: SectionContext) => DataRow[]
}
```

⚠️ **Not Constructor-serializable** — function not JSON. Phase 2 avoids.
