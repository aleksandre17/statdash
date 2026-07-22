// ── @statdash/engine — Spec authoring-contract catalog (ADR-049 P1) ────────────
//
//  The SELF-DESCRIBING registry of every DataSpec bind-kind. Promoted from a
//  metadata stub to a full AUTHORING CONTRACT (ADR-049 §P1 — "the binding axis
//  gets its port"): beside its label/description, each kind now DECLARES how it is
//  authored, so the Constructor composes it GENERICALLY — no `switch (spec.type)`
//  in the panel, no per-kind editor import in a composer. A new bind-kind = ONE
//  declaration here (+ optionally one registered editor), zero composer edits.
//
//  Each kind declares:
//    • make()      — the default factory (a pure, React-free `DataSpec` seed; this
//                    absorbs the panel's old `defaultSpec` switch, re-homing concept
//                    ownership to the engine and restoring the dependency arrow).
//    • ONE OF:
//        schema    — a PropSchema rendered through the SAME generic Inspector every
//                    node/param/transform-step uses (the SchemaSource port precedent).
//        editorKey — a string key resolving a genuinely-rich React editor the panel
//                    registers at boot (the value-mapping/thresholds boot idiom). The
//                    KEY is pure/engine-side; the editor stays in the panel (arrow).
//
//  Invariant (FF-DATASPEC-AUTHORING-COMPLETE): every kind resolves to schema-or-editor.
//  Pattern: Self-Describing Module (same as ops-catalog in @statdash/expr).
//
import type { DataSpec }     from './config/data-spec'
import type { PropSchema }   from './config/prop-schema'
import type { CapabilityId } from './capabilities'

export type SpecField = {
  key:         string
  label:       { ka: string; en: string }
  description: { ka: string; en: string }
  required:    boolean
  type:        string   // human-readable hint: 'ObsQuery' | 'RowSpec[]' | 'string' | etc.
}

/**
 * The SERIALIZABLE face of a bind-kind's authoring contract — pure data, no
 * functions. This is exactly what the Constructor's app manifest (`describeApp`)
 * emits, so it round-trips through JSON losslessly (Law 2: config is declarative,
 * no functions in the manifest). The runtime `make` factory lives on
 * `SpecDescriptor` (below), NOT here — a default-seed factory is engine RUNTIME
 * behaviour the editor calls, never config, so it must never reach the manifest.
 */
export type SpecManifestEntry = {
  label:            { ka: string; en: string }
  description:      { ka: string; en: string }
  constructorReady: boolean   // false = has fn field, Constructor cannot generate
  fields:           SpecField[]
  example:          string
  /**
   * The AUTHORING CAPABILITIES this kind REQUIRES to be edited without loss (DESIGN-0104
   * §2·C2 · E1). A surface (the three-pane workbench, a dedicated editor) may author this
   * kind only when it PROVIDES every id here — workbench admissibility + editor parity are
   * DERIVED from this set, never hand-gated (`workbenchCapabilities.ts` / the parity
   * fitness). Enumerated FROM the dedicated editor's real contract; the vocabulary is
   * `./capabilities` (Constructor-visible via `specManifest()`).
   */
  capabilities:     CapabilityId[]
  /** Authoring surface #1 — a PropSchema rendered by the generic Inspector. */
  schema?:          PropSchema
  /** Authoring surface #2 — a boot-registered rich editor, resolved by this key. */
  editorKey?:       string
}

/**
 * The RUNTIME authoring contract for a bind-kind: the serializable descriptor
 * PLUS the `make` factory the editor calls to seed a default spec. `make` is the
 * one non-serializable field — it is deliberately absent from `SpecManifestEntry`
 * so the emitted manifest is function-free BY CONSTRUCTION (see `specManifest`).
 */
export type SpecDescriptor = SpecManifestEntry & {
  /** Default factory — a pure `DataSpec` seed the picker emits on kind selection. */
  make:             () => DataSpec
}

/**
 * The authoring contract for a bind-kind, or undefined if the kind is unknown.
 * The ONE resolver the panel's generic DataSpec composer reads — it dispatches on
 * `schema` (Inspector path) vs `editorKey` (registered editor) with NO per-type
 * branch of its own (ADR-049 P1 / FF-NO-DATASPEC-SWITCH).
 */
export function resolveSpecAuthoring(type: string): SpecDescriptor | undefined {
  return SPEC_CATALOG[type]
}

/**
 * The function-free projection of `SPEC_CATALOG` for the JSON app manifest (Law 2).
 * Strips each kind's runtime `make` factory BY CONSTRUCTION — the returned objects
 * carry only data fields (`SpecManifestEntry`), so `describeApp()`'s output
 * round-trips through JSON losslessly. `make` stays available at runtime via
 * `resolveSpecAuthoring` / `SPEC_CATALOG` (the editor's default-seed path).
 */
export function specManifest(): Record<string, SpecManifestEntry> {
  return Object.fromEntries(
    Object.entries(SPEC_CATALOG).map(([type, { make: _make, ...entry }]) => [type, entry]),
  )
}

/**
 * The AUTHORING CAPABILITIES a catalog kind REQUIRES (DESIGN-0104 §2·C2 · E1) — the engine
 * face of the Capability Matrix. Empty for an unknown kind (note `pipeline` is the workbench's
 * NATIVE shape, not an authoring-catalog kind — its requirement is declared panel-side beside
 * the workbench that owns it, see `workbenchCapabilities.ts`). Callers that DERIVE admissibility
 * must fail-closed on an empty result rather than admit an undeclared kind (the regression lock).
 */
export function capabilitiesFor(type: string): readonly CapabilityId[] {
  return SPEC_CATALOG[type]?.capabilities ?? []
}

export const SPEC_CATALOG: Record<string, SpecDescriptor> = {

  'query': {
    label:            { ka: 'მოთხოვნა',      en: 'Query' },
    description:      {
      ka: 'ObsQuery + pipeline + EncodingSpec. უნივერსალური: ნებისმიერი განზომილება, ნებისმიერი სტორი.',
      en: 'ObsQuery + transform pipeline + EncodingSpec. Universal: any dimension, any store.',
    },
    constructorReady: true,
    fields: [
      { key: 'query',    label: { ka: 'SDMX მოთხოვნა', en: 'SDMX Query'  }, description: { ka: 'ObsQuery ობიექტი (code, dims, years...)',              en: 'ObsQuery object (code, dims, years...)' },              required: true,  type: 'ObsQuery'       },
      { key: 'pipe',     label: { ka: 'პაიპლაინი',     en: 'Pipeline'    }, description: { ka: 'TransformStep[] — sort, filter, group, melt და სხვ.',  en: 'TransformStep[] — sort, filter, group, melt, etc.' },    required: false, type: 'TransformStep[]' },
      { key: 'encoding', label: { ka: 'ენკოდინგი',     en: 'Encoding'    }, description: { ka: 'EncodingSpec — x, y, color, label სვეტების ბეჭდვა.',   en: 'EncodingSpec — maps fields to x, y, color, label.' },    required: true,  type: 'EncodingSpec'    },
      { key: 'fromDim',  label: { ka: 'საწყისი განზ.', en: 'From Dim'   }, description: { ka: 'განზომილება, საიდანაც იწყება სვლა (time range pivot).', en: 'Dimension to pivot from (time range use).' },            required: false, type: 'string'          },
      { key: 'toDim',    label: { ka: 'საბოლოო განზ.', en: 'To Dim'     }, description: { ka: 'განზომილება, რომლამდეც სვლა.',                          en: 'Dimension to pivot to.' },                                required: false, type: 'string'          },
      { key: 'timeDimension', label: { ka: 'დროის განზომილება', en: 'Time Dimension' }, description: { ka: 'პირველკლასიანი დროის ცნება { dim, range, granularity? } — fromDim/toDim-ის canonical ფორმა.', en: 'First-class time concept { dim, range, granularity? } — canonical form of fromDim/toDim (Cube.dev timeDimensions).' }, required: false, type: 'TimeDimensionSpec' },
    ],
    example: '{ "type": "query", "query": { "code": "GDP", "dims": { "geo": { "$ctx": "geo" } }, "years": { "$ctx": "year" } }, "encoding": { "x": "time", "y": "value" } }',
    capabilities: ['head.source.pick', 'head.filter-builder', 'encoding.edit', 'raw-json.write'],
    make:      () => ({ type: 'query', query: { measure: [] }, pipe: [], encoding: { label: 'label' } }),
    editorKey: 'query',
  },

  'row-list': {
    label:            { ka: 'სტრიქონების სია', en: 'Row List' },
    description:      {
      ka: 'ცალსახა RowSpec[] — მოსახერხებელი მოკლე ჩანაწერი წლის რეჟიმის სექციებისთვის.',
      en: 'Explicit RowSpec[] — convenient shorthand for year-mode sections.',
    },
    constructorReady: true,
    fields: [
      { key: 'rows', label: { ka: 'სტრიქონები', en: 'Rows' }, description: { ka: 'RowSpec[] — code, label, color, negate, isTotal, pctOf.', en: 'RowSpec[] — code, label, color, negate, isTotal, pctOf.' }, required: true, type: 'RowSpec[]' },
    ],
    example: '{ "type": "row-list", "rows": [{ "code": "GDP", "label": "მშპ" }, { "code": "EXP", "label": "ექსპორტი" }] }',
    capabilities: ['row-list.rows.edit'],
    make:      () => ({ type: 'row-list', rows: [] }),
    editorKey: 'row-list',
  },

  'timeseries': {
    label:            { ka: 'დროითი მწკრივი', en: 'Timeseries' },
    description:      {
      ka: 'ერთი მაჩვენებელი × დროის დიაპაზონი.',
      en: 'Single measure across a time range.',
    },
    constructorReady: true,
    fields: [
      { key: 'code',    label: { ka: 'მაჩვენებელი',    en: 'Code'     }, description: { ka: 'ინდიკატორის კოდი.',                           en: 'Indicator code.' },                        required: true,  type: 'string'   },
      { key: 'years',   label: { ka: 'წლები',          en: 'Years'    }, description: { ka: 'YearsSpec — number[] ან "all".',              en: 'YearsSpec — number[] or "all".' },         required: true,  type: 'YearsSpec' },
      { key: 'fromDim', label: { ka: 'საწყისი განზ.', en: 'From Dim' }, description: { ka: 'განზომილება, საიდანაც იწყება სვლა.', en: 'Dimension to pivot from.' },        required: false, type: 'string'   },
      { key: 'toDim',   label: { ka: 'საბოლოო განზ.', en: 'To Dim'   }, description: { ka: 'განზომილება, რომლამდეც სვლა.',        en: 'Dimension to pivot to.' },          required: false, type: 'string'   },
      { key: 'timeDimension', label: { ka: 'დროის განზომილება', en: 'Time Dimension' }, description: { ka: 'პირველკლასიანი დროის ცნება { dim, range, granularity? }.', en: 'First-class time concept { dim, range, granularity? } (folds years + fromDim/toDim).' }, required: false, type: 'TimeDimensionSpec' },
    ],
    example: '{ "type": "timeseries", "code": "GDP", "years": [2015, 2016, 2017, 2018, 2019, 2020] }',
    capabilities: ['head.measure-code.edit', 'head.years.edit'],
    make:      () => ({ type: 'timeseries', code: '', years: 'all' }),
    editorKey: 'timeseries',
  },

  'growth': {
    label:            { ka: 'ზრდის ტემპი',   en: 'Growth' },
    description:      {
      ka: 'წინა წელთან ზრდის ტემპი (YoY). Multi-code → Pivot ცხრილი.',
      en: 'Year-over-year growth rates. Multi-code → pivot table.',
    },
    constructorReady: true,
    fields: [
      { key: 'code',    label: { ka: 'კოდი/კოდები',  en: 'Code(s)'  }, description: { ka: 'ერთი ან მრავალი ინდიკატორის კოდი.',      en: 'Single or multiple indicator codes.' },    required: true,  type: 'string | string[]' },
      { key: 'years',   label: { ka: 'წლები',        en: 'Years'    }, description: { ka: 'YearsSpec — number[] ან "all".',          en: 'YearsSpec — number[] or "all".' },         required: true,  type: 'YearsSpec'         },
      { key: 'fromDim', label: { ka: 'საწყისი განზ.',en: 'From Dim' }, description: { ka: 'განზომილება, საიდანაც იწყება სვლა.', en: 'Dimension to pivot from.' },        required: false, type: 'string'            },
      { key: 'toDim',   label: { ka: 'საბოლოო განზ.',en: 'To Dim'   }, description: { ka: 'განზომილება, რომლამდეც სვლა.',        en: 'Dimension to pivot to.' },          required: false, type: 'string'            },
      { key: 'timeDimension', label: { ka: 'დროის განზომილება', en: 'Time Dimension' }, description: { ka: 'პირველკლასიანი დროის ცნება { dim, range, granularity? }.', en: 'First-class time concept { dim, range, granularity? } (folds years + fromDim/toDim).' }, required: false, type: 'TimeDimensionSpec' },
    ],
    example: '{ "type": "growth", "code": ["GDP", "EXP", "IMP"], "years": "all" }',
    capabilities: ['head.measure-code.edit', 'head.years.edit', 'growth.single-multi.toggle'],
    make:      () => ({ type: 'growth', code: '', years: 'all' }),
    editorKey: 'growth',
  },

  'ratio-list': {
    label:            { ka: 'კოეფიციენტების სია', en: 'Ratio List' },
    description:      {
      ka: 'ყოველი სტრიქონი = მაჩვენებელი / მნიშვნელი × 100.',
      en: 'Each row = measure / denominator × 100.',
    },
    constructorReady: true,
    fields: [
      { key: 'pairs', label: { ka: 'წყვილები', en: 'Pairs' }, description: { ka: 'pairs[] — { code, denom, label? }.', en: 'pairs[] — { code, denom, label? }.' }, required: true,  type: '{ code: string; denom: string; label?: string }[]' },
      { key: 'pipe',  label: { ka: 'პაიპლაინი', en: 'Pipeline' }, description: { ka: 'TransformStep[] — sort, filter, group...', en: 'Optional TransformStep[] applied after ratio computation.' }, required: false, type: 'TransformStep[]' },
    ],
    example: '{ "type": "ratio-list", "pairs": [{ "code": "EXP", "denom": "GDP", "label": "ექსპორტი/მშპ" }] }',
    capabilities: ['ratio-list.pairs.edit'],
    make:   () => ({ type: 'ratio-list', pairs: [] }),
    // SCHEMA arm (ADR-049 P1 step 4): `pairs` is a structured array (itemSchema) —
    // it renders editably through the generic Inspector's nested ArrayOf control, so
    // ratio-list needs NO bespoke editor. (timeseries/growth stay editorKey until a
    // `years` / mode-toggle FieldControl lands — their leaves would else regress to a
    // read-only glance; the ADR's deferred "FieldControls absorb sub-modalities" pass.)
    schema: [
      { field: 'pairs', type: 'array', required: true,
        label: { ka: 'წყვილები', en: 'Pairs' },
        itemSchema: [
          { field: 'code',  type: 'string', required: true, label: { ka: 'კოდი',              en: 'Code'         } },
          { field: 'denom', type: 'string', required: true, label: { ka: 'მნიშვნელი',          en: 'Denominator'  } },
          { field: 'label', type: 'string',                 label: { ka: 'ეტიკეტი (არჩევითი)', en: 'Label (opt.)' } },
        ] },
    ],
  },

  'pivot': {
    label:            { ka: 'პივოტი',   en: 'Pivot' },
    description:      {
      ka: 'Wide→Long შემოკლება (transform + melt-ის სინტაქსური შაქარი).',
      en: 'Wide→long shorthand (sugar for transform + melt).',
    },
    constructorReady: true,
    fields: [
      { key: 'rows',        label: { ka: 'სტრიქონები',        en: 'Rows'         }, description: { ka: 'Record<string, DimVal>[] — სტატიკური მონაცემები.', en: 'Static row data as Record<string, DimVal>[].' }, required: true,  type: 'Record<string, DimVal>[]' },
      { key: 'keyField',    label: { ka: 'გასაღების სვეტი',   en: 'Key Field'    }, description: { ka: 'სვეტი, რომელიც გახდება გასაღები.',                 en: 'Column that becomes the key.' },                 required: true,  type: 'string'                  },
      { key: 'valueFields', label: { ka: 'მნიშვნელის სვეტები', en: 'Value Fields' }, description: { ka: 'მნიშვნელის სვეტების მასივი.',                     en: 'Array of value column names.' },                 required: true,  type: 'string[]'                },
      { key: 'colors',      label: { ka: 'ფერები',             en: 'Colors'       }, description: { ka: 'Record<string, string> — სერიის ფერები.',          en: 'Optional color map per series key.' },            required: false, type: 'Record<string, string>'  },
    ],
    example: '{ "type": "pivot", "rows": [{ "label": "ექსპორტი", "2022": 45, "2023": 48 }], "keyField": "label", "valueFields": ["2022", "2023"] }',
    capabilities: ['pivot.rows.edit', 'pivot.key-field.edit', 'pivot.value-fields.edit', 'pivot.colors.edit'],
    make:      () => ({ type: 'pivot', rows: [], keyField: '', valueFields: [] }),
    editorKey: 'pivot',
  },

  'transform': {
    label:            { ka: 'ტრანსფორმაცია', en: 'Transform' },
    description:      {
      ka: 'სრული დეკლარაციული pipeline (Vega-Lite transform ანალოგი) სტატიკური source-ით.',
      en: 'Full declarative pipeline (Vega-Lite transform analogue) with a static source.',
    },
    constructorReady: true,
    fields: [
      { key: 'source',   label: { ka: 'წყარო',     en: 'Source'   }, description: { ka: 'სტატიკური სტრიქონები Record<string, DimVal>[].', en: 'Static source rows as Record<string, DimVal>[].' }, required: true, type: 'Record<string, DimVal>[]' },
      { key: 'steps',    label: { ka: 'ნაბიჯები',  en: 'Steps'    }, description: { ka: 'TransformStep[] — sort, filter, group, melt და სხვ.', en: 'TransformStep[] — sort, filter, group, melt, etc.' }, required: true, type: 'TransformStep[]' },
      { key: 'encoding', label: { ka: 'ენკოდინგი', en: 'Encoding' }, description: { ka: 'EncodingSpec — x, y, color, label სვეტების ბეჭდვა.', en: 'EncodingSpec — maps fields to x, y, color, label.' }, required: true, type: 'EncodingSpec' },
    ],
    example: '{ "type": "transform", "source": [...], "steps": [{ "op": "sort", "by": "value", "dir": "desc" }], "encoding": { "x": "label", "y": "value" } }',
    capabilities: ['transform.source.edit', 'pipeline.steps.edit', 'encoding.edit'],
    make:      () => ({ type: 'transform', source: [], steps: [], encoding: { label: 'label' } }),
    editorKey: 'transform',
  },

  'metric': {
    label:            { ka: 'მეტრიკა (სემანტიკური)', en: 'Metric (semantic)' },
    description:      {
      ka: 'მართული მეტრიკ(ებ)ი × გენერიკ grain (by/time). Metric-first: აირჩიე არსებითი სახელი, არა query. Cube/dbt-SL query-ფორმა, SDMX-ნატიური.',
      en: 'Governed metric(s) × a generic grain (by/time). Metric-first: pick nouns, not a query. The Cube/dbt-SL query shape, SDMX-native.',
    },
    constructorReady: true,
    fields: [
      { key: 'metrics', label: { ka: 'მეტრიკები',  en: 'Metrics' }, description: { ka: 'MetricRef[] — მართული მეტრიკ(ებ)ის id-ები (ან raw code). თითო სერია.', en: 'MetricRef[] — governed metric ids (or raw codes). One series each.' }, required: true,  type: 'MetricRef[]' },
      { key: 'by',      label: { ka: 'დაჯგუფება',   en: 'By (grain)' }, description: { ka: 'string[] — გენერიკ grain-ღერძები (Law 1). ცარიელი ⇒ სკალარი.',       en: 'string[] — generic grain axes (Law 1). Empty ⇒ a scalar per metric.' }, required: false, type: 'string[]' },
      { key: 'time',    label: { ka: 'დრო',         en: 'Time' }, description: { ka: 'TimeDimensionSpec — პირველკლასიანი დროის grain { dim, range?, granularity? }.', en: 'TimeDimensionSpec — first-class time grain { dim, range?, granularity? }.' }, required: false, type: 'TimeDimensionSpec' },
      { key: 'where',   label: { ka: 'ფილტრი',      en: 'Where' }, description: { ka: 'Partial<Record<dim, DimVal>> — კოორდინატის დაფიქსირება (Law 1).',        en: 'Partial<Record<dim, DimVal>> — pin the read coordinate (Law 1).' }, required: false, type: 'Partial<Record<string, DimVal>>' },
    ],
    example: '{ "type": "metric", "metrics": ["gdp_per_capita"], "time": { "dim": "time" } }',
    capabilities: ['metric.refs.edit', 'metric.grain.edit'],
    make:      () => ({ type: 'metric', metrics: [] }),
    editorKey: 'metric',
  },

}
