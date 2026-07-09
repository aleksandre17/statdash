// ── manifest → registry adapters — the semantic-layer boot seam (platform SSOT) ─
//
//  The manifest-delivery mirror of the datasource flow: a boot reads the tenant's
//  semantic layer off the manifest (`manifest.metrics` / `manifest.dimensions`) and
//  registers each into the engine's process-global registry, so a DataSpec that
//  references a metric-id resolves through `resolveMeasureRef` to the underlying
//  code, and a governed-dimension picker resolves its label/default/whitelist.
//
//  WHERE THIS LIVES (Law 3 / Law 8): this is the layer that OWNS the engine types
//  (`MetricDef` / `DimensionDef`) AND may import the zero-dep wire mirrors
//  (`ManifestMetric` / `ManifestDimension` from @statdash/contracts, below the
//  arrow). It is therefore the correct home for the wire→engine REFINEMENT — a
//  reusable platform capability every boot (the geostat runner, the Constructor's
//  authoring boot) consumes, not a per-app fork. The api NEVER owns these engine
//  shapes (it projects the opaque wire blob); the refinement happens HERE.
//
//  Idempotent + last-write-wins per id (registerMetrics / registerDimensions
//  contract) so a re-boot or a manifest refetch re-registers the same catalog
//  without drift. Empty/absent ⇒ a no-op (Postel — the raw-code / raw-cube-member
//  status quo stays byte-identical, FF-RAW-CODE-IDENTICAL).
//
import type { ManifestMetric, ManifestDimension } from '@statdash/contracts'
import { registerMetrics }    from './metric'
import type { MetricDef }     from './metric'
import { registerDimensions } from './dimension'
import type { DimensionDef }  from './dimension'

// ── registerManifestMetrics — prime the metric registry from the manifest ──────
//
//  The manifest carries the wire shape `ManifestMetric` (opaque blob, owned by the
//  api projection); HERE — the consumer that owns the engine's `MetricDef` — we
//  REFINE it: the registry key is `id`, the rest is the def.

export function registerManifestMetrics(metrics: ManifestMetric[] | undefined): void {
  if (!metrics || metrics.length === 0) return
  const catalog: Record<string, MetricDef> = {}
  for (const m of metrics) {
    catalog[m.id] = {
      label:       m.label,
      // BASE vs CALCULATED metric (DC-01): exactly one of code/calc is present on
      // the wire. `code` ⇒ a direct measure; `calc` ⇒ the measure-algebra blob
      // whose `expr` is carried opaquely on the wire as JsonValue (contracts cannot
      // import @statdash/expr across the arrow) — refined to a real Expr HERE, the
      // layer that owns the engine type, exactly like the renderer-owned page blobs.
      ...(m.code        !== undefined ? { code:        m.code }        : {}),
      ...(m.calc        !== undefined ? { calc:        m.calc as unknown as MetricDef['calc'] } : {}),
      ...(m.unit        !== undefined ? { unit:        m.unit }        : {}),
      // `format` is a FormatKey on the wire (typed `string` because contracts cannot
      // import engine's FormatKey across the arrow); refined back to MetricDef['format']
      // HERE, the layer that owns the engine type — exactly like `calc`/`dims`.
      ...(m.format      !== undefined ? { format:      m.format as MetricDef['format'] } : {}),
      ...(m.methodology !== undefined ? { methodology: m.methodology } : {}),
      ...(m.dims        !== undefined ? { dims:        m.dims as MetricDef['dims'] } : {}),
      ...(m.dataSource  !== undefined ? { dataSource:  m.dataSource }  : {}),
    }
  }
  registerMetrics(catalog)
}

// ── registerManifestDimensions — prime the dimension registry from the manifest ─
//
//  The exact PEER of registerManifestMetrics (Law 1: dimensions are equal citizens
//  of the semantic layer). Registers each DimensionDef so a governed-dimension
//  picker resolves its label/default/whitelist while members still come FROM the
//  cube profile at runtime (Law 5 — never copied into config).

export function registerManifestDimensions(dimensions: ManifestDimension[] | undefined): void {
  if (!dimensions || dimensions.length === 0) return
  const catalog: Record<string, DimensionDef> = {}
  for (const d of dimensions) {
    catalog[d.id] = {
      code:  d.code,
      label: d.label,
      ...(d.conceptRole   !== undefined ? { conceptRole:   d.conceptRole }   : {}),
      ...(d.defaultMember !== undefined ? { defaultMember: d.defaultMember } : {}),
      ...(d.members       !== undefined ? { members:       d.members }       : {}),
      ...(d.description   !== undefined ? { description:   d.description }    : {}),
    }
  }
  registerDimensions(catalog)
}
