// ── desugar — convenience DataSpec → primitive DataSpec [ADR R3] ──────
//
//  The DESUGARING layer of the data-reference model (adr_data_reference_
//  render_vision, R3 / fault line F-A). The DataSpec union carries a handful
//  of CONVENIENCE discriminants that are authoring affordances over the few
//  orthogonal primitives (`query` · `transform`). This module is
//  the single, pure rewrite that lowers a convenience spec to its EQUIVALENT
//  primitive form so the engine resolves ONE set of primitives.
//
//  Contract (FF-DESUGAR-EQUIV): for every spec it rewrites, the desugared
//  resolution is ROW-IDENTICAL (same rows, order, values, nulls, status) to
//  the prior bespoke resolver — proven by `desugar.fitness.test.ts`.
//
//  Strangler-Fig, partial by design: a convenience spec is desugared ONLY
//  when it is provably row-identical with the CURRENT transform op set. Specs
//  whose equivalence depends on a store-port primitive the pipe cannot express
//  are passed through UNCHANGED and keep their direct resolver (see the R3
//  gap report). desugar is total — every spec maps to a DataSpec (itself when
//  no rule applies).
//
//  Pure + JSON-serializable: no functions, no ctx/store access. The rewrite is
//  a value→value transform the Constructor never sees (the friendly per-type
//  editors are preserved; lowering happens at resolve time only).
//

import type { DataSpec, PointSeriesSpec, ResolvableSpec, PipelineSpec, PipeStep } from '../config/data-spec'
import type { DimVal }    from '../sdmx'
import { TIME_DIM }       from '../core/context'
import { effectiveYears, isDefaultGranularity } from '../core/time-dimension'

// ── pivot → transform + melt ──────────────────────────────────────────
//
//  `pivot` is the textbook sugar: its own resolver is "melt + shape", touches
//  no store, and is fully deterministic. The bespoke PivotResolver did:
//
//    melt({ idFields:[keyField], valueFields, seriesKey:'series', valueKey:'value' })
//    → per melted row: {
//        id:    `${label}::${series}`,   label = String(row[keyField] ?? ''),
//        label, series: String(row.series ?? ''),
//        value: Number(row.value ?? 0),
//        ...(colors[series] ? { color } : {}),
//      }
//
//  The equivalent primitive pipe (every step already exists, all pure):
//    1. melt                       — identical fold (same keys/defaults)
//    2. cast value → number        — Number(value ?? 0); melt already defaulted ?? 0
//    3. rename keyField → label    — carry the id column into `label`
//    4. cast label  → string       — String(...) coercion the resolver applied
//    5. cast series → string       — String(row.series ?? '') (melt sets series = field name,
//                                     already a string; cast is a row-identical no-op-shaped step)
//    6. concat [label, series] → id (sep '::')  — `${label}::${series}` (String-joined)
//    7. lookup color BY series      — adds `color` ONLY when colors[series] exists
//                                     (inline `from` map; absent ⇒ field omitted, matching
//                                      the resolver's conditional spread)
//
//  Field set after the pipe = { label, series, value, id, (color?) } — the same
//  set the resolver emitted (key insertion order differs, which no consumer reads:
//  encoding/table address fields by name). Rows, order, values, the color
//  presence/absence, and the id string are byte-identical.
//
function desugarPivot(spec: Extract<DataSpec, { type: 'pivot' }>): DataSpec {
  const { rows, keyField, valueFields, colors } = spec

  // colors: Record<series, color>  →  lookup `from`: Record<series, { color }>
  const colorFrom: Record<string, Record<string, DimVal | undefined>> = {}
  if (colors) for (const [series, color] of Object.entries(colors)) colorFrom[series] = { color }

  return {
    type:   'transform',
    source: rows,
    steps:  [
      { op: 'melt',   idFields: [keyField], valueFields, seriesKey: 'series', valueKey: 'value' },
      { op: 'cast',   fields: { value: 'number' } },
      { op: 'rename', fields: { [keyField]: 'label' } },
      { op: 'cast',   fields: { label: 'string', series: 'string' } },
      { op: 'concat', fields: ['label', 'series'], as: 'id', sep: '::' },
      ...(colors && Object.keys(colors).length > 0
        ? [{ op: 'lookup' as const, key: 'series', from: colorFrom, fields: ['color'] }]
        : []),
    ],
    // pivot rows feed straight into the renderer's encoder by field name, exactly
    // as the resolver's EngineRow[] did; the transform resolver returns the rows
    // untouched (no encoding stage in the resolver — that is the renderer boundary).
    encoding: { label: 'label', value: 'value', series: 'series', color: 'color' },
  }
}

// ── timeseries → point-series ─────────────────────────────────────────
//
//  `timeseries` is "single measure × time range": the bespoke TimeseriesResolver
//  enumerated the years, summed the OLAP cell at each pinned year, and normalized a
//  pct. valAt makes the pinned-cell read declarative, so the spec now lowers onto the
//  generic store-aware `point-series` primitive (over the time axis). EVERY piece maps
//  1:1 (FF-DESUGAR-EQUIV):
//    • coords  = effectiveYears (legacy `years` wins, else timeDimension.range, else
//                'all') — the SAME selection resolveYears consumed. 'all' ⇒ the
//                resolver's store-distinct enumeration (ascending), as before.
//    • clamp   = the legacy fromDim/toDim + timeDimension, folded by the SAME
//                effectiveBounds the resolver applied (clampYears). Omitted when none.
//    • value   = storeValAt default-sum ≡ storeVal(atTime); pct = |v|/max(|v|,1)×100.
//  No store/ctx access here — desugar stays a pure value→value rewrite (effectiveYears
//  reads only the spec; the year-distinct + clamp resolve in the resolver at read time).
//
function desugarTimeseries(spec: Extract<DataSpec, { type: 'timeseries' }>): PointSeriesSpec {
  const ps: PointSeriesSpec = {
    type:   'point-series',
    code:   spec.code,
    over:   TIME_DIM,
    coords: effectiveYears(spec),
  }
  if (spec.fromDim || spec.toDim || spec.timeDimension) {
    ps.clamp = { fromDim: spec.fromDim, toDim: spec.toDim, timeDimension: spec.timeDimension }
  }
  // GRAIN-G4: thread a NON-default (sub-annual) granularity into the point read's grain
  // on the enumerated axis (over = TIME_DIM). A default/absent grain forwards NOTHING —
  // storeValAt then stays on the byte-identical `val` path (annual is untouched, no
  // valAt port query / warm-key change). A sub-annual grain requests an LOD roll-up via
  // valAt when a grain-aware store + sub-annual data arrive (FF-GRANULARITY-ROLLS-UP).
  const gran = spec.timeDimension?.granularity
  if (!isDefaultGranularity(gran)) {
    ps.grain = { [TIME_DIM]: gran! }
  }
  return ps
}

// ── desugar — the single entry point ──────────────────────────────────
//
//  Lowers a convenience spec to its primitive equivalent. Total: any spec with
//  no rule (incl. all primitives) is returned UNCHANGED (same reference) so the
//  primitive path is allocation-free and provably untouched.
//
//  Called FIRST by interpretSpec + extractRequirements (one resolution path).
//
export function desugar(spec: DataSpec): ResolvableSpec {
  switch (spec.type) {
    // ADR-046 spine [W-P5a — the LIVE desugar switch]. The read path now lowers the
    // pipeline-SHAPED discriminants onto the ONE `pipeline` grammar. Stored configs are
    // NEVER rewritten — this runs at read/warm time only (expand-contract). Each reduces
    // to a `source` HEAD (steward ObsQuery / inline rows) + a pure tail, so the lowering
    // is byte-identical BY CONSTRUCTION: `query`/`transform` are proven row-identical by
    // FF-PIPELINE-EQUIV (rows) and their store-read contract is the SAME shared kernel
    // (queryRequirements / read-free); `pivot` is an inline-rows transform (desugarPivot)
    // lowered onto the spine, proven by the FF-DESUGAR-EQUIV pivot corpus.
    case 'query':
    case 'transform':
    case 'pivot':      return desugarToPipeline(spec)

    // NOT re-targeted in the LIVE switch (DU4a/b are capability + proof only — the emission flip
    // is a later gated step): `timeseries` stays on the store-aware `point-series` primitive here;
    // `growth`/`ratio-list` keep their direct resolvers. The value-cell `source` variant that lets
    // these fold onto the spine EXISTS (ADR-046 Addendum 4): `desugarToPipeline(timeseries)` (DU4a)
    // and `desugarToPipeline(growth-single-code)` (DU4b) produce it, proven byte-identical by the
    // FF-PIPELINE-EQUIV value-cell + growth corpora — but flipping this live switch to the spine is
    // deliberately deferred so the wave stays revert-clean. `ratio-list`/`row-list` (and multi-code
    // `growth`, via calc-metric browse) await their own folds (DU4c–d).
    case 'timeseries': return desugarTimeseries(spec)
    default:           return spec
  }
}

// ── desugarToPipeline — the ADR-046 spine lowering [SPEC §1.3] ─────────────────
//
//  Lowers a legacy DataSpec onto the ONE canonical `pipeline` grammar: a `source`
//  HEAD (the store-aware read) + the pure tail verbs. Pure value→value (no ctx/store)
//  — the Constructor never sees it (stored configs are NEVER rewritten; this runs at
//  read/proof time only — expand-contract).
//
//  W-P4 SCOPE: `query` and `transform` only (the two forms the workbench + corpus
//  exercise). It is DELIBERATELY NOT wired into the live `desugar()` above — the live
//  resolution path is UNCHANGED (FF-DESUGAR-EQUIV keeps query/transform as identity
//  primitives), so this wave is fully revert-clean. FF-PIPELINE-EQUIV proves that the
//  desugared pipeline extracts the IDENTICAL store-read contract; the ⛔ default-emission
//  flip (W-P5) makes the pipeline the emitted default and re-targets the convenience
//  specs (timeseries/growth/ratio-list/pivot). A spec with no rule here is returned
//  UNCHANGED (identity) so callers can map the whole corpus uniformly.
//
//  The mapping IS SPEC §1.3's table:
//    query      → [ source(obsQuery + clamp),        …query.pipe ]
//    transform  → [ source(inline rows),             …steps       ]
//    pivot      → [ source(inline rows),             …melt/cast/… ]   (via desugarPivot)
//    timeseries → [ source(over=TIME_DIM, code, …) ]                  (via desugarTimeseries)
//
//  DU4a FOLD (ADR-046 Addendum 4) — the value-cell `source` variant closes the W-P5a gap:
//  `timeseries` is a store-aware VALUE-CELL spec (per-coordinate `storeValAt` point read + a
//  `pct` row), which the `{metrics|query|rows}` heads cannot express (metrics emits the grain
//  shape, query emits RAW unsummed obs). The 4th variant — the internal `PointSeriesSpec`
//  hoisted to a `source` head (discriminated by `over`) — lets it fold: `desugarTimeseries`
//  produces the point-series, and this arm hoists it to the head verbatim, so the read is the
//  SAME PointSeriesResolver fan-out and the fold is byte-identical BY CONSTRUCTION.
//
//  DU4b FOLD (ADR-046 Addendum 4) — SINGLE-CODE `growth` folds onto the SAME value-cell head:
//  a `source(over=TIME_DIM, code, coords)` enumerate + a pure tail (window `lag` → prev, two
//  `derive`s composing YoY + sign-color via @statdash/expr, an `exists`+`filter` positional
//  first-period drop, a `select` to the single-code field set). Byte-identical to GrowthResolver
//  (FF-PIPELINE-EQUIV growth corpus). MULTI-CODE growth carries a per-code store meta read the
//  pure tail cannot reproduce → it folds via the calc-metric BROWSE path (Addendum 2), NOT here;
//  it returns identity → the direct GrowthResolver (DU3 fallback lane) until that fold is proven.
//
//  STILL on the DU3 fallback lane (not yet folded, DU4c–d): `ratio-list`/`row-list` (the
//  MEASURE-axis explicit-cells form of the value-cell variant). Each returns identity until proven.
//
export function desugarToPipeline(spec: DataSpec): DataSpec {
  switch (spec.type) {
    case 'query': {
      const hasClamp = spec.fromDim !== undefined || spec.toDim !== undefined || spec.timeDimension !== undefined
      const source: PipeStep = {
        op: 'source', query: spec.query,
        ...(hasClamp
          ? { clamp: { fromDim: spec.fromDim, toDim: spec.toDim, timeDimension: spec.timeDimension } }
          : {}),
      }
      const pipeline: PipelineSpec = {
        type: 'pipeline',
        pipe: [source, ...(spec.pipe ?? [])],
        encoding: spec.encoding,
      }
      return pipeline
    }
    case 'transform': {
      const pipeline: PipelineSpec = {
        type: 'pipeline',
        pipe: [{ op: 'source', rows: spec.source }, ...spec.steps],
        encoding: spec.encoding,
      }
      return pipeline
    }
    case 'pivot':
      // pivot IS an inline-rows transform (desugarPivot: melt + cast + rename + concat +
      // optional color lookup). Lower THAT transform onto the spine — the recursion hits the
      // `transform` case above → a `source(inline rows)` head + the pure melt/cast tail. Proven
      // row-identical by the FF-DESUGAR-EQUIV pivot corpus resolving through interpretSpec.
      return desugarToPipeline(desugarPivot(spec))
    case 'timeseries': {
      // ADR-046 Addendum 4 / ADR-051 DU4a — the KEYSTONE value-cell fold. `timeseries` IS the
      // point-series read desugarTimeseries already lowers to; hoist THAT point-series to a
      // value-cell `source` head (the same over/code/coords/clamp/grain fields, discriminated by
      // `over`), no tail. The head reconstitutes the IDENTICAL PointSeriesSpec in readSource and
      // delegates to the SAME PointSeriesResolver — so the fold is byte-identical BY CONSTRUCTION
      // (FF-PIPELINE-EQUIV value-cell corpus). Reuses desugarTimeseries verbatim, so the clamp +
      // sub-annual-grain logic (GRAIN-G4) is shared, never re-derived.
      const ps = desugarTimeseries(spec)
      const source: PipeStep = {
        op: 'source', over: ps.over, code: ps.code, coords: ps.coords,
        ...(ps.clamp ? { clamp: ps.clamp } : {}),
        ...(ps.grain ? { grain: ps.grain } : {}),
      }
      const pipeline: PipelineSpec = {
        type: 'pipeline',
        pipe: [source],
        encoding: { label: 'label', value: 'value' },
      }
      return pipeline
    }
    case 'growth': {
      // ADR-046 Addendum 4 / ADR-051 DU4b — SINGLE-CODE growth folds onto the value-cell spine.
      // The GrowthResolver (single-code) enumerates the clamped year series, reads a scalar
      // storeVal(atTime) per year, composes YoY over the ordered series with a sign-based color,
      // and DROPS the first period (years.slice(1)). Every piece maps to the value-cell `source`
      // head + the pure tail verbs — ONE grammar, no new op (Law 10):
      //   • source(over=TIME_DIM, code, coords=effectiveYears, clamp?) — the SAME per-year point
      //     read GrowthResolver's storeVal fan-out issues. NO grain is forwarded: GrowthResolver
      //     reads storeVal (never storeValAt-with-grain), so a sub-annual granularity is ignored
      //     here too — byte-identical value cells (this is the ONE divergence from the timeseries
      //     arm, which DOES forward grain; growth must not, so it does not reuse desugarTimeseries).
      //   • window(lag over value → _prev) — the previous-year value; the lag op OMITS the field on
      //     the first row of the partition (the honest "no predecessor" edge, no fabricated 0/null).
      //   • derive(value = '_prev ? ((value / _prev - 1) * 100) : 0') — the EXACT YoY formula via
      //     @statdash/expr (ONE dialect); the coalesce-to-0 field read reproduces `prev ?`.
      //   • derive(color = "value >= 0 ? '#00A896' : '#E76F51'") — the SAME sign→color rule.
      //   • derive(_hasPrev = exists(_prev)) + filter(_hasPrev) — a POSITIONAL first-period drop:
      //     desugar is pure (no store/ctx) so it cannot know the first year for 'all'; "keep the
      //     periods that HAVE a predecessor" drops exactly row 0 for BOTH explicit and 'all' coords
      //     — the byte-identical analogue of years.slice(1). (`exists` reads the RAW field via an
      //     object Expr, so a legitimate prev===0 is KEPT, never confused with the missing edge.)
      //   • select [id,label,value,color] — the exact single-code field set (drops pct/_scaffold).
      // MULTI-CODE growth is NOT folded here: its per-code storeObs label/color meta read is not
      // expressible by the pure tail (Add.4 routes it via the calc-metric browse path); it returns
      // IDENTITY → the direct GrowthResolver (DU3 fallback lane). Sequenced follow-up (see below).
      const codeArr = Array.isArray(spec.code) ? spec.code : [spec.code]
      if (codeArr.length !== 1) return spec        // multi-code / empty — stays on the direct resolver
      const code = codeArr[0]!

      const hasClamp = spec.fromDim !== undefined || spec.toDim !== undefined || spec.timeDimension !== undefined
      const gSource: PipeStep = {
        op: 'source', over: TIME_DIM, code, coords: effectiveYears(spec),
        ...(hasClamp
          ? { clamp: { fromDim: spec.fromDim, toDim: spec.toDim, timeDimension: spec.timeDimension } }
          : {}),
      }
      const pipeline: PipelineSpec = {
        type: 'pipeline',
        pipe: [
          gSource,
          { op: 'window', fn: 'lag', over: 'value', as: '_prev' },
          { op: 'derive', as: 'value',    expr: '_prev ? ((value / _prev - 1) * 100) : 0' },
          { op: 'derive', as: 'color',    expr: "value >= 0 ? '#00A896' : '#E76F51'" },
          { op: 'derive', as: '_hasPrev', expr: { op: 'exists', value: { $row: '_prev' } } },
          { op: 'filter', where: { _hasPrev: 1 } },
          { op: 'select', fields: ['id', 'label', 'value', 'color'] },
        ],
        encoding: { label: 'label', value: 'value' },
      }
      return pipeline
    }
    default:
      // ratio-list/row-list — the store-aware VALUE-CELL specs still on the DU3 fallback lane
      // (Add.4: the MEASURE-axis explicit-cells form of the variant, DU4c/d). ASSESSED
      // (engine-specialist, 2026-07-20): NEITHER folds byte-identically with the CURRENT value-cell
      // variant ({over,code,coords}) + the pure tail — ratio-list reads TWO cells per row (num + a
      // per-pair denom) and emits a `measure` field with no `pct`; row-list carries per-cell
      // negate/pctOf/isTotal + a store-META label/color enrichment read. Both need the explicit-cells
      // extension (`cells:{code,denom?,…}[]`), whose exact schema Add.4 leaves unspecified (the `…`)
      // → flagged for an architect design (ADR-046 Addendum 5), NOT improvised here (Law 8 / Law 10).
      // growth folds above (single-code; multi-code stays on its direct resolver). metric is already
      // a `source(metrics)` head by construction; each returns UNCHANGED (identity) → its direct resolver.
      return spec
  }
}
