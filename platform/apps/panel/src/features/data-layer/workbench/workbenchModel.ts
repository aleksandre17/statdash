// ── workbenchModel — the canonical PIPELINE view the workbench operates on (W-P5b) ──
//
//  ADR-046 · SPEC §1/§3. The workbench speaks the ONE spine: the pipeline shape is
//  canonical INSIDE the surface, and BOTH accepted inputs flow through one code path —
//    • a native `pipeline` spec       → used as-is;
//    • a legacy `query` spec          → its DESUGARED view (`desugarToPipeline`, the
//                                        engine SSOT: a steward `source(query+clamp)`
//                                        head + the pure tail), so the rail/grid/query-
//                                        pane never branch on the discriminant.
//  Any WRITE emits `pipeline` (`fromWorkbenchModel`) — the ⛔ W-P5 emission flip. An
//  active edit of a legacy `query` therefore converts it to the spine (safe: desugar
//  makes query≡pipeline byte-identical at resolve time; stored configs are never batch-
//  rewritten — this is read-then-write on active authoring).
//
//  Pure + framework-free (no React, no store) — trivially testable, mirroring the
//  other data-layer pure models (binding.ts / generatedQuery.ts).
//
import type {
  DataSpec, DimVal, EncodingSpec, ObsQuery, PipelineSpec, PipeStep, SourceStep, TransformStep,
} from '@statdash/engine'
import { desugarToPipeline } from '@statdash/engine'
import { isWorkbenchAdmissible } from './workbenchCapabilities'

/** The governed (AUTHOR-plane) source head — a metric ref + a generic M2 grain. */
type GovernedHead = Extract<SourceStep, { metrics: MetricRefList }>
type MetricRefList = string[]

/** The canonical pipeline view: the store-aware `source` HEAD + the pure TAIL + encoding. */
export interface WorkbenchModel {
  head:     SourceStep
  tail:     TransformStep[]
  encoding: EncodingSpec
  /**
   * The BYTE-TRUE stored artifact this model was lowered from (D5 · card 0112 §R4 — the
   * dialect-honesty fix). Set by `toWorkbenchModel` from its input `spec` verbatim (never
   * reconstructed from head/tail/encoding, so a legacy `query`'s extra fields — fromDim/
   * toDim/timeDimension/rowLimit — are never silently dropped from the steward's "stored"
   * pane). Optional: an ad-hoc/from-scratch model (no prior persisted spec, e.g. the
   * bind-to-create lane) carries none — `describeStewardDetail` then treats the model's
   * own pipeline emission as the stored dialect (the two trivially coincide).
   */
  storedSpec?: DataSpec
}

/**
 * Whether the three-pane workbench can shape this spec — now DERIVED from the Capability
 * Matrix (DESIGN-0104 §2·C2 · E1), never a hand allow-list. `isWorkbenchAdmissible` answers
 * "does the workbench provide every capability this kind requires?"; today that yields exactly
 * `query | pipeline` (their required acts ⊆ the workbench core set), byte-identical to the old
 * hand gate — proven by `workbenchCapabilities.test.ts`. A future kind auto-admits when a
 * registered step editor provides its acts; this predicate is never hand-widened again.
 */
export function isWorkbenchShaped(spec: DataSpec | undefined): boolean {
  return !!spec && isWorkbenchAdmissible(spec.type)
}

/**
 * The LANE EMISSION FLIP (W0/Z8 — one-dialect hygiene). The three panes already emit
 * spine (`fromWorkbenchModel`); the Advanced/fallback lanes route their emits through
 * THIS helper so the in-session artifact matches what the API's normalize-on-write
 * seam will store (never a sugar `query` re-entering a page/spec doc from the escape
 * hatches — the leak-#3 class).
 *
 * Scope is DERIVED from the Capability Matrix, never a hand list: an emit lowers iff
 * the panes can GENUINELY AUTHOR the lowered artifact (`isWorkbenchShaped` — today
 * exactly `query`→spine and `pipeline`→identity). The DU4-protected dedicated-editor
 * kinds (timeseries/growth/pivot/transform + the U2-blocked kinds) emit UNCHANGED
 * in-session: lowering them per-keystroke would bypass their intact editors — the
 * exact Step A regression the DU4 trust-recovery correction reverted (see
 * `toWorkbenchModel` below). For those, the API seam (`normalizeSpecForRest`) remains
 * the at-rest enforcement, and D5's dialect-honesty marker declares the difference.
 * As kinds become pane-admissible (W1 simple views / E2a), this scope widens
 * AUTOMATICALLY — one predicate, no call-site divergence.
 */
export function lowerLaneEmission(spec: DataSpec): DataSpec {
  return isWorkbenchShaped(spec) ? desugarToPipeline(spec) : spec
}

/**
 * Lower an accepted spec to the canonical pipeline view — the ONE code path.
 *
 * The accept-list is exactly the kinds the three panes can GENUINELY AUTHOR: a native
 * `pipeline` (used as-is) and a legacy `query` (via its desugared steward-source view). Both
 * open the panes with a FULLY editable head (governed/steward/query source picker + grain) —
 * that is what "shape it as a pipeline" means.
 *
 * NARROWED back from Step A (ADR-051 DU4 · trust-recovery correction). Step A widened this
 * gate to "any kind `desugarToPipeline` can lower", conflating *the engine CAN fold it* with
 * *the author SHOULD edit it as a pipeline*. `timeseries` / single-code `growth` / `pivot` /
 * `transform` DO desugar to a pipeline, but the panes could only show their folded head
 * READ-ONLY (value-cell) or LOSSY (pivot→melt) — so opening them here silently BYPASSED their
 * intact dedicated editors (`TimeseriesEditor`/`GrowthEditor`/`PivotEditor`/`TransformEditor`)
 * and stripped author-editable fields (`code`/`years`, pivot rows/keyField/valueFields, inline
 * `source`, the single↔multi toggle). They now return `null` → the DU3 fallback lane, where
 * those editors give FULL editing. Re-admitting them to the three panes WITH full head-
 * authoring is a SEPARATE future wave, not this gate. (`ratio-list`/`row-list`/`metric` never
 * folded — they were always here.)
 *
 * Returns `null` for a spec the workbench does not shape — the caller declares that honestly
 * (the fallback lane's dedicated editor) rather than paint a broken/lossy surface (Law 11).
 */
export function toWorkbenchModel(spec: DataSpec | undefined): WorkbenchModel | null {
  if (!spec) return null
  // ONLY `pipeline` + `query` enter the three panes (`isWorkbenchShaped`). A native pipeline is
  // used as-is; a `query` is lowered through the engine SSOT `desugarToPipeline` to its steward
  // source head + pure tail. Every other kind routes to the fallback lane's dedicated editor.
  if (!isWorkbenchShaped(spec)) return null
  const pipeline: DataSpec = spec.type === 'pipeline' ? spec : desugarToPipeline(spec)
  if (pipeline.type !== 'pipeline') return null
  const head = pipeline.pipe[0]
  if (!head || head.op !== 'source') return null
  return {
    head:       head as SourceStep,
    tail:       pipeline.pipe.slice(1) as TransformStep[],
    encoding:   pipeline.encoding,
    storedSpec: spec,              // the artifact AS PERSISTED — byte-true, pre-desugar (D5)
  }
}

/** Serialize the canonical view back to a `pipeline` DataSpec (the emission flip). */
export function fromWorkbenchModel(m: WorkbenchModel): PipelineSpec {
  return { type: 'pipeline', pipe: [m.head, ...m.tail] as PipeStep[], encoding: m.encoding }
}

/** A SOURCE-ONLY pipeline (the head alone) — what the preview grid resolves for the
 *  browse rows, before the tail. The tail is prefix-run locally over these (E5). */
export function sourceOnlySpec(head: SourceStep, encoding: EncodingSpec): PipelineSpec {
  return { type: 'pipeline', pipe: [head], encoding }
}

/** The measure ref(s) a source head reads — governed metrics, a steward query's measure,
 *  or the value-cell head's single `code`. Drives the governed value-column label (never a
 *  raw code, Law 4) so the folded timeseries/growth grid resolves its measure honestly. */
export function sourceMeasure(head: SourceStep | undefined): string | string[] | undefined {
  if (!head) return undefined
  if ('metrics' in head) return head.metrics
  if ('query' in head) return head.query.measure
  if ('over' in head) return head.code          // value-cell (Add.4) — the enumerated measure code
  return undefined
}

/** The filter/grain dim KEYS the head pins (their governed labels are shown; the member
 *  VALUES never are). A governed head pins via `where`; a steward head via `query.filter`;
 *  a value-cell head enumerates `over` and pins fixed base coords in `at` (both are dim keys
 *  the author reads — the honest "what the rows are indexed by", never a member value). */
export function sourceGrainDims(head: SourceStep | undefined): string[] {
  if (!head) return []
  if ('metrics' in head) return Object.keys((head.where ?? {}) as Record<string, unknown>)
  if ('query' in head) return Object.keys(((head.query as ObsQuery).filter ?? {}) as Record<string, unknown>)
  if ('over' in head) return [head.over, ...Object.keys((head.at ?? {}) as Record<string, unknown>)]
  return []
}

// ── The value-cell head (Add.4 · timeseries + single-code growth fold) ─────────────
//
//  A folded `timeseries`/`growth` lowers to the value-cell `source` head
//  `{op:'source', over, code, coords}` — it ENUMERATES coordinates on `over` and reads a
//  scalar value per coordinate (delegated to PointSeriesResolver at resolve time). It is
//  READ-ONLY in the workbench Step A: the author SEES it honestly (real source + axis +
//  coords) and edits the TAIL; full head editing is a sequenced follow-up. The live grid
//  still resolves REAL rows through the engine (Law 11 — never a fake/blank head).

/** True when the head is a value-cell read (an enumerated `over` axis + a scalar `code`). */
export function isValueCellHead(head: SourceStep | undefined): head is Extract<SourceStep, { over: string }> {
  return !!head && 'over' in head
}

/** The value-cell head's honest read summary — the enumerated axis dim + its explicit
 *  coordinates (absent ⇒ the full distinct axis, `'all'`). The measure is `sourceMeasure`.
 *  Read-only display fodder for the Get card (Law 11 — the author sees exactly what is read). */
export function valueCellSummary(head: SourceStep | undefined):
  { over: string; coords: readonly DimVal[] | 'all' | undefined } | undefined {
  if (!isValueCellHead(head)) return undefined
  return { over: head.over, coords: head.coords }
}

/** Whether the head carries a bound read (a metric, a query measure, or inline rows). */
export function isHeadBound(head: SourceStep | undefined): boolean {
  const m = sourceMeasure(head)
  if (Array.isArray(m)) return m.length > 0
  if (m) return true
  return !!head && 'rows' in head
}

/** Set / append a governed metric on the head — the workbench Get metric picker's write.
 *  A governed head appends (multi-series, deduped); any other head becomes governed. */
export function withGovernedMetric(m: WorkbenchModel, metricId: string): WorkbenchModel {
  const head = m.head
  if ('metrics' in head) {
    const metrics = head.metrics.includes(metricId) ? head.metrics : [...head.metrics, metricId]
    return { ...m, head: { ...head, metrics } }
  }
  return { ...m, head: { op: 'source', metrics: [metricId] } }
}

// ── The governed head's READ-LEVEL grain (`where` pins) — «წაკითხვის არე» (card 0087) ─
//
//  The governed head carries a generic M2 grain (`by`/`time`/`where`, Law-1 generic,
//  identical to MetricSpec). `where` is the fixed-coordinate PIN surface: `{ time: 2020 }`
//  reads only 2020 (the old query editor's power, now OFFERED in the workbench). Scalar
//  DimVal per dim (the engine head type) — the AutoFilter single-member pick. Grain-∅ =
//  browse stays the default (ADR-046 Addendum 2 — an EMPTY grain is a meaningful state,
//  never force one). `by`/`time` are the ledgered grain axes the same surface will host.

/** True when the head is a GOVERNED metric read (an AUTHOR-plane grain surface). */
export function isGovernedHead(head: SourceStep | undefined): head is GovernedHead {
  return !!head && 'metrics' in head
}

/** The governed head's `where` pins (dim → single member). Empty ⇒ browse (no pin). */
export function governedWhere(head: SourceStep | undefined): Partial<Record<string, DimVal>> {
  return isGovernedHead(head) ? (head.where ?? {}) : {}
}

/** Set the governed head's `where` grain — the workbench read-area editor's write. An empty
 *  map drops the `where` key entirely (grain-∅ browse, never a lingering `{}`). */
export function withGovernedWhere(m: WorkbenchModel, where: Partial<Record<string, DimVal>>): WorkbenchModel {
  if (!isGovernedHead(m.head)) return m
  const next = { ...m.head } as GovernedHead
  if (Object.keys(where).length === 0) delete next.where
  else next.where = where
  return { ...m, head: next }
}

// ── The STEWARD raw-cube head (0084 · ADR-046 variant 2) ───────────────────────
//
//  A raw cube pick emits the EXISTING steward `source` head `{op:'source', query}` —
//  no new grammar (the variant lives in the engine). The browse grid then resolves the
//  head through the QueryResolver's storeObs (the same raw-observation read a legacy
//  `query` used), so the steward sees the cube's raw observations. Reachable ONLY behind
//  the steward lens (plane law, ADR-041 §PLANE) — the author never picks a raw cube.

/** True when the head is a STEWARD raw read (an ObsQuery), not a governed metric ref. */
export function isStewardHead(head: SourceStep | undefined): head is Extract<SourceStep, { query: ObsQuery }> {
  return !!head && 'query' in head
}

/** The raw measure code(s) a steward head reads — the promotion loop's `code`. */
export function stewardHeadMeasure(head: SourceStep | undefined): string | string[] | undefined {
  return isStewardHead(head) ? head.query.measure : undefined
}

/** Swap the head to a STEWARD raw-cube browse of `measures` — a FRESH source read (the
 *  tail is cleared: a new raw cube is a new table, its columns differ from the prior read).
 *  The write emits the steward `source(query)` variant (Law 1: `measure` is generic).
 *
 *  `storeKey` (0089 · ADR-046 Addendum 3) declares the cube's store HOME on the head so the
 *  browse reads the PICKED cube's OWN store, not the page's (the cross-cube lying-grid fix).
 *  Same routing vocabulary as the governed head (`MetricDef.dataSource`); the caller resolves
 *  it from the picked datasetCode via the session-source SSOT `storeKeyForDataset`. Optional:
 *  no storeKey ⇒ the head carries none and falls through to the page store (byte-identical to
 *  pre-0089 — no regression). */
export function withStewardCube(m: WorkbenchModel, measures: string[], storeKey?: string): WorkbenchModel {
  const measure: string | string[] = measures.length === 1 ? measures[0]! : measures
  const head: SourceStep = storeKey
    ? { op: 'source', query: { measure }, dataSource: storeKey }
    : { op: 'source', query: { measure } }
  return { ...m, head, tail: [] }
}

/**
 * Promote a steward raw head to a GOVERNED metric ref (E2 — the Looker/dbt promotion
 * loop). The head is REPLACED by `{op:'source', metrics:[metricId]}` (the tail + encoding
 * preserved). The invariant (FF-PROMOTE-ROUNDTRIP): when `metricId` is a BASE metric whose
 * `code` equals the raw head's `query.measure`, the governed head resolves BYTE-IDENTICALLY
 * to the raw head it replaced (a refactor, never a semantic change) — proven at the browse
 * seam (browseBaseMetric ≡ the steward obs read, ADR-046 Addendum 2).
 */
export function promoteHeadToMetric(m: WorkbenchModel, metricId: string): WorkbenchModel {
  return { ...m, head: { op: 'source', metrics: [metricId] } }
}
