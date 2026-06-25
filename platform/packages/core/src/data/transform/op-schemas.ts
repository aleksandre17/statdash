// ── op-schemas.ts — authoring PropSchema per TransformStep op [V1] ─────
//
//  Each built-in transform op declares the PropSchema the Constructor renders to
//  author a step of that op. The op CARRIES its schema (registered alongside its
//  handler in ./index.ts) — OCP: a new op = a new handler + a new schema, and it
//  becomes fully authorable with zero Constructor code. The panel's
//  PipelineBuilder feeds this schema to the SAME generic Inspector that renders
//  node/panel/chrome properties (no bespoke per-op form, no second form engine).
//
//  WHY core (not the panel): the schema is part of the op's contract (its editor
//  is as much a property of the op as its handler). Keeping it beside the op is
//  the SSOT; the arrow lets core host PropSchema (see config/prop-schema.ts).
//
//  CONTROL COVERAGE: scalar fields (string/number/boolean/select) render as
//  first-class typed controls. Fields whose value is a list or a map (e.g.
//  melt.idFields: string[], rename.fields: Record, aggregate.aggregations) use
//  a typed 'array'/'object' field — the Inspector renders a labeled, grouped
//  JSON sub-editor for them (a documented, bounded escape hatch SCOPED to one
//  sub-field, not the whole step). This is still schema-driven authoring: the op
//  declares the field, its type, its label, its group; only the leaf shape of a
//  collection is JSON. A future slice can promote any of these to a richer list
//  control by registering a new FieldControl — the Inspector body never changes.
//
import type { PropSchema } from '../../config/prop-schema'

const bi = (ka: string, en: string) => ({ ka, en })

// ── melt — wide → long ────────────────────────────────────────────────
export const meltSchema: PropSchema = [
  { field: 'idFields',    type: 'array',  label: bi('საიდენტიფიკაციო ველები', 'Id fields'),
    required: true },
  { field: 'valueFields', type: 'array',  label: bi('მნიშვნელობის ველები', 'Value fields'),
    required: true },
  { field: 'seriesKey',   type: 'string', label: bi('სერიის გასაღები', 'Series key') },
  { field: 'valueKey',    type: 'string', label: bi('მნიშვნელობის გასაღები', 'Value key') },
]

// ── rename — field-name normalization ─────────────────────────────────
export const renameSchema: PropSchema = [
  { field: 'fields', type: 'object', label: bi('სახელის ცვლილებები (ძველი → ახალი)', 'Renames (old → new)'),
    required: true },
]

// ── cast — type coercion ──────────────────────────────────────────────
export const castSchema: PropSchema = [
  { field: 'fields', type: 'object', label: bi('ტიპები (ველი → number/string)', 'Casts (field → number/string)'),
    required: true },
]

// ── concat — join field values into a new string field ────────────────
export const concatSchema: PropSchema = [
  { field: 'fields', type: 'array',  label: bi('წყარო ველები', 'Source fields'), required: true },
  { field: 'as',     type: 'string', label: bi('გამოსავალი ველი', 'Output field'), required: true },
  { field: 'sep',    type: 'string', label: bi('გამყოფი', 'Separator') },
]

// ── template — render a string template into a new field ──────────────
export const templateSchema: PropSchema = [
  { field: 'as',  type: 'string', label: bi('გამოსავალი ველი', 'Output field'), required: true },
  { field: 'tpl', type: 'string', label: bi('შაბლონი ({field})', 'Template ({field})'), required: true },
]

// ── addField — add a constant field to every row ──────────────────────
export const addFieldSchema: PropSchema = [
  { field: 'name',  type: 'string', label: bi('ველის სახელი', 'Field name'), required: true },
  { field: 'value', type: 'string', label: bi('მნიშვნელობა', 'Value'), required: true },
]

// ── select — projection (keep only listed fields) ─────────────────────
export const selectSchema: PropSchema = [
  { field: 'fields', type: 'array', label: bi('შესანახი ველები', 'Fields to keep'), required: true },
]

// ── aggregate — GROUP BY + reduce (multi-measure form) ────────────────
//  The op accepts two shapes; the authoring surface emits the explicit
//  groupBy/aggregations form (the more general one). The short by/measure form
//  still round-trips losslessly (it is not normalized away — see step adapter).
export const aggregateSchema: PropSchema = [
  { field: 'groupBy',      type: 'array',  label: bi('დაჯგუფება ველებით', 'Group by'), required: true },
  { field: 'aggregations', type: 'array',  label: bi('აგრეგაციები [{field,op,as?}]', 'Aggregations [{field,op,as?}]'),
    required: true },
]

// ── rollup — append aggregate ("totals") rows along one dim ───────────
const AGG_OPTIONS = [
  { value: 'sum',   label: bi('ჯამი', 'sum') },
  { value: 'avg',   label: bi('საშუალო', 'avg') },
  { value: 'min',   label: bi('მინ', 'min') },
  { value: 'max',   label: bi('მაქს', 'max') },
  { value: 'count', label: bi('რაოდ.', 'count') },
]

export const rollupSchema: PropSchema = [
  { field: 'dim',   type: 'string', label: bi('განზომილების სვეტი', 'Dimension column'), required: true },
  { field: 'as',    type: 'string', label: bi('როლაპის კოდი', 'Rollup code'), required: true },
  { field: 'of',    type: 'array',  label: bi('წევრები (* = ყველა)', 'Members (* = all)'), required: true },
  { field: 'agg',   type: 'string', label: bi('აგრეგატი', 'Aggregate'), options: AGG_OPTIONS, required: true },
  { field: 'field', type: 'string', label: bi('საზომი სვეტი', 'Measure column') },
]

// ── group — N-level hierarchy materializer ────────────────────────────
export const groupSchema: PropSchema = [
  { field: 'by',          type: 'array',  label: bi('დონეები [{field,inject?}]', 'Levels [{field,inject?}]'),
    required: true },
  { field: 'levelField',  type: 'string', label: bi('დონის ველი', 'Level field') },
  { field: 'parentField', type: 'string', label: bi('მშობლის ველი', 'Parent field') },
  { field: 'idPrefix',    type: 'string', label: bi('Id პრეფიქსი', 'Id prefix') },
]

// ── reduce — GROUP BY + collapse to one row per group ─────────────────
export const reduceSchema: PropSchema = [
  { field: 'fn',    type: 'string', label: bi('ფუნქცია', 'Function'), required: true, options: [
    { value: 'sum',   label: bi('ჯამი', 'sum') },
    { value: 'mean',  label: bi('საშუალო', 'mean') },
    { value: 'min',   label: bi('მინ', 'min') },
    { value: 'max',   label: bi('მაქს', 'max') },
    { value: 'count', label: bi('რაოდ.', 'count') },
    { value: 'first', label: bi('პირველი', 'first') },
    { value: 'last',  label: bi('ბოლო', 'last') },
  ] },
  { field: 'field', type: 'string', label: bi('საზომი სვეტი', 'Measure column'), required: true },
  { field: 'by',    type: 'array',  label: bi('დაჯგუფება (ცარიელი = მთლიანი)', 'Group by (empty = whole set)') },
  { field: 'as',    type: 'string', label: bi('გამოსავალი ველი', 'Output field') },
]

// ── window — running aggregation over an ordered series ───────────────
export const windowSchema: PropSchema = [
  { field: 'fn',   type: 'string', label: bi('ფანჯრის ფუნქცია', 'Window function'), required: true, options: [
    { value: 'movingAvg', label: bi('მცოცავი საშუალო', 'movingAvg') },
    { value: 'cumSum',    label: bi('კუმულატიური ჯამი', 'cumSum') },
    { value: 'lag',       label: bi('ლაგი', 'lag') },
    { value: 'diff',      label: bi('სხვაობა', 'diff') },
  ] },
  { field: 'over', type: 'string', label: bi('საზომი სვეტი', 'Measure column'), required: true },
  { field: 'by',   type: 'string', label: bi('გაყოფის გასაღები', 'Partition key') },
  { field: 'n',    type: 'number', label: bi('ფანჯრის ზომა (movingAvg)', 'Window size (movingAvg)') },
  { field: 'as',   type: 'string', label: bi('გამოსავალი ველი', 'Output field') },
]

// ── derive — compute a new field per row ──────────────────────────────
//  `expr` is EITHER a string formula ('value / total * 100') OR a DeriveExpr
//  tree. Authored as a string (the friendly form, ADR V1 "DeriveExpr formula
//  box"); a tree value still round-trips as a typed object sub-editor when
//  present. We surface the string control; the JSON tree is the advanced shape.
export const deriveSchema: PropSchema = [
  { field: 'as',   type: 'string', label: bi('გამოსავალი ველი', 'Output field'), required: true },
  { field: 'expr', type: 'string', label: bi('ფორმულა (value / total * 100)', 'Formula (value / total * 100)'),
    required: true },
]

// ── lookup — JOIN a codelist (Vega-Lite lookup) ───────────────────────
export const lookupSchema: PropSchema = [
  { field: 'key',    type: 'string', label: bi('გასაღების სვეტი', 'Key column'), required: true },
  { field: 'from',   type: 'object', label: bi('წყარო ({$d}/{$cl}/map)', 'Source ({$d}/{$cl}/map)'), required: true },
  { field: 'fields', type: 'array',  label: bi('ასაღები ველები', 'Fields to pick'), required: true },
  { field: 'rename', type: 'object', label: bi('სახელის ცვლილებები', 'Renames') },
]

// ── sort — multi-key stable sort ──────────────────────────────────────
//  `by` is EITHER a string (single field) OR an array of sort keys. Authored as
//  an array sub-editor (the general form); a bare-string value round-trips. A
//  companion `dir`/`using` applies only to the single-field string form.
export const sortSchema: PropSchema = [
  { field: 'by',  type: 'array',  label: bi('დახარისხების გასაღებები', 'Sort keys'), required: true },
  { field: 'dir', type: 'string', label: bi('მიმართულება (ერთ-ველიანი)', 'Direction (single-field)'), options: [
    { value: 'asc',  label: bi('ზრდადი ↑', 'asc ↑') },
    { value: 'desc', label: bi('კლებადი ↓', 'desc ↓') },
  ] },
]

// ── filter — keep rows where every condition holds (AND) ──────────────
export const filterSchema: PropSchema = [
  { field: 'where', type: 'object', label: bi('პირობები (ველი → მნიშვნელობა)', 'Conditions (field → value)'),
    required: true },
]

// ── blend — declarative cross-store enrichment lookup ─────────────────
//  The Constructor-authorable front-door for joinByField: it NAMES a secondary
//  store + an ObsQuery (resolved in the react binding layer where the manifest
//  lives) rather than baking pre-resolved rows into config. `from` is a typed
//  object sub-editor ({ storeKey, query, encoding? }) — the secondary-source
//  declaration; `by` is the shared GENERIC dim key (Law 1); `mode` maps onto
//  joinByField. This schema is what closes the joinByField coverage gap — the
//  step is pure data (Law 2), so it round-trips and is non-programmer authorable.
export const blendSchema: PropSchema = [
  { field: 'from',   type: 'object', label: bi('მეორე წყარო ({storeKey,query,encoding?})', 'Secondary source ({storeKey,query,encoding?})'),
    required: true },
  { field: 'by',     type: 'string', label: bi('საერთო განზომილება', 'Shared dimension'), required: true },
  { field: 'mode',   type: 'string', label: bi('შეერთების რეჟიმი', 'Join mode'), options: [
    { value: 'left',  label: bi('მარცხენა (ნაგულისხმევი)', 'left (default)') },
    { value: 'inner', label: bi('შიდა', 'inner') },
    { value: 'outer', label: bi('გარე', 'outer') },
  ] },
  { field: 'fields', type: 'array',  label: bi('ასაღები ველები (ცარიელი = ყველა)', 'Fields to merge (empty = all)') },
  { field: 'rename', type: 'object', label: bi('სახელის ცვლილებები', 'Renames') },
]

// ── join — SQL LEFT JOIN against an array source ──────────────────────
export const joinSchema: PropSchema = [
  { field: 'with',    type: 'object', label: bi('წყარო ({$cl}/{$d}/inline)', 'Source ({$cl}/{$d}/inline)'),
    required: true },
  { field: 'on',      type: 'string', label: bi('მარცხენა გასაღები', 'Left key'), required: true },
  { field: 'onRight', type: 'string', label: bi('მარჯვენა გასაღები', 'Right key') },
  { field: 'fields',  type: 'array',  label: bi('კოპირებადი ველები', 'Fields to copy') },
  { field: 'rename',  type: 'object', label: bi('სახელის ცვლილებები', 'Renames') },
]
