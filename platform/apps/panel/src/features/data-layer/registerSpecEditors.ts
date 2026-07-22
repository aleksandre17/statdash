// ── registerSpecEditors — boot-time DataSpec rich-editor registration (ADR-049 P1) ─
//
//  Side-effect registration, imported once at boot (App.tsx), mirroring the
//  value-mapping / thresholds FieldControl registration idiom. This is the SANCTIONED
//  place for per-kind editor imports (the registration boundary, like
//  setupCanvasRegistry for node types) — it keeps them OUT of the generic DataSpec
//  composer (DataSpecEditor), which resolves editors by key with no static import
//  (FF-NO-DATASPEC-SWITCH).
//
//  Each editorKey mirrors the value declared in the engine's SPEC_CATALOG. A kind
//  whose authoring surface is a `schema` (e.g. ratio-list) needs NO entry here — it
//  routes through the generic Inspector (specSchemaSource) instead.
//
//  Editors narrow the spec via their own Extract<DataSpec, …> prop type; the registry
//  is invoked only for the matching kind, so the widening cast to SpecEditor is sound
//  (the same discipline fieldControlRegistry uses for its heterogeneous controls).
//
import { registerSpecEditor, type SpecEditor } from './specEditorRegistry'
import { QuerySpecEditor }  from './editors/QuerySpecEditor'
import { TimeseriesEditor } from './editors/TimeseriesEditor'
import { GrowthEditor }     from './editors/GrowthEditor'
import { RowListEditor }    from './editors/rowlist/RowListEditor'
import { TransformEditor }  from './editors/TransformEditor'
import { PivotEditor }      from './editors/PivotEditor'
import { MetricSpecEditor } from './editors/MetricSpecEditor'

let registered = false

/**
 * Idempotently register the built-in rich DataSpec editors. Safe from boot + tests.
 *
 * Each `provides` DECLARES the authoring capabilities that editor delivers (DESIGN-0104 §2·C2
 * · E1), enumerated FROM the editor's real contract — the SAME set the kind REQUIRES in
 * `SPEC_CATALOG` (spec-catalog.ts). The parity fitness proves the two sides agree (no
 * requirement without a provider, no claim without a probe).
 */
export function registerSpecEditors(): void {
  if (registered) return
  registerSpecEditor('query',      QuerySpecEditor  as SpecEditor, ['head.source.pick', 'head.filter-builder', 'encoding.edit', 'raw-json.write'])
  registerSpecEditor('timeseries', TimeseriesEditor as SpecEditor, ['head.measure-code.edit', 'head.years.edit'])
  registerSpecEditor('growth',     GrowthEditor     as SpecEditor, ['head.measure-code.edit', 'head.years.edit', 'growth.single-multi.toggle'])
  registerSpecEditor('row-list',   RowListEditor    as SpecEditor, ['row-list.rows.edit'])
  registerSpecEditor('transform',  TransformEditor  as SpecEditor, ['transform.source.edit', 'pipeline.steps.edit', 'encoding.edit'])
  registerSpecEditor('pivot',      PivotEditor      as SpecEditor, ['pivot.rows.edit', 'pivot.key-field.edit', 'pivot.value-fields.edit', 'pivot.colors.edit'])
  registerSpecEditor('metric',     MetricSpecEditor as SpecEditor, ['metric.refs.edit', 'metric.grain.edit'])
  registered = true
}

// Self-register on import so a bare `import '.../registerSpecEditors'` wires it.
registerSpecEditors()
