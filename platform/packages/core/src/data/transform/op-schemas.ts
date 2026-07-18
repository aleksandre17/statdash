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
//  ROLE (card 0087 · P-OFFER): every leaf field declares its authoring ROLE —
//  `field` (an input column) · `member` (a column's value) · `newName` (a produced
//  identifier) · `expr` (a formula) · `literal` (a constant/enum). The panel's ONE
//  generic TransformStepEditor PROJECTS role → offered control (FieldPicker /
//  MemberPicker / free text / the expr editor + live preview / typed input) — so a
//  new op is authorable, comprehensible and agnostic with zero panel code. Composite
//  fields (aggregate.aggregations, group.by) carry an `itemSchema` whose sub-fields
//  each declare their own role; the projector recurses. FF-ROLE-COVERAGE forbids a
//  leaf field shipping with no role decision.
//
import type { PropSchema } from '../../config/prop-schema'

const bi = (ka: string, en: string) => ({ ka, en })

// ── melt — wide → long ────────────────────────────────────────────────
export const meltSchema: PropSchema = [
  { field: 'idFields',    type: 'array',  role: 'field', label: bi('საიდენტიფიკაციო ველები', 'Id fields'),
    required: true },
  { field: 'valueFields', type: 'array',  role: 'field', label: bi('მნიშვნელობის ველები', 'Value fields'),
    required: true },
  { field: 'seriesKey',   type: 'string', role: 'newName', label: bi('სერიის გასაღები', 'Series key') },
  { field: 'valueKey',    type: 'string', role: 'newName', label: bi('მნიშვნელობის გასაღები', 'Value key') },
]

// ── rename — field-name normalization ─────────────────────────────────
//  `fields` is a map keyed by INPUT columns (old → new); role 'field' marks the
//  keying. The projector renders the map sub-editor (a bespoke follow-up can offer
//  keyed FieldPicker rows); for now the honest object control stands.
export const renameSchema: PropSchema = [
  { field: 'fields', type: 'object', role: 'field', label: bi('სახელის ცვლილებები (ძველი → ახალი)', 'Renames (old → new)'),
    required: true },
]

// ── cast — type coercion ──────────────────────────────────────────────
export const castSchema: PropSchema = [
  { field: 'fields', type: 'object', role: 'field', label: bi('ტიპები (ველი → number/string)', 'Casts (field → number/string)'),
    required: true },
]

// ── concat — join field values into a new string field ────────────────
export const concatSchema: PropSchema = [
  { field: 'fields', type: 'array',  role: 'field',   label: bi('წყარო ველები', 'Source fields'), required: true },
  { field: 'as',     type: 'string', role: 'newName', label: bi('გამოსავალი ველი', 'Output field'), required: true },
  { field: 'sep',    type: 'string', role: 'literal',  label: bi('გამყოფი', 'Separator') },
]

// ── template — render a string template into a new field ──────────────
//  `tpl` is an expr-class formula surface ({field} placeholders offered from the
//  input columns); role 'expr' projects the schema-aware editor + live preview.
export const templateSchema: PropSchema = [
  { field: 'as',  type: 'string', role: 'newName', label: bi('გამოსავალი ველი', 'Output field'), required: true },
  { field: 'tpl', type: 'string', role: 'expr',    label: bi('შაბლონი ({field})', 'Template ({field})'), required: true },
]

// ── addField — add a constant field to every row ──────────────────────
export const addFieldSchema: PropSchema = [
  { field: 'name',  type: 'string', role: 'newName', label: bi('ველის სახელი', 'Field name'), required: true },
  { field: 'value', type: 'string', role: 'literal',  label: bi('მნიშვნელობა', 'Value'), required: true },
]

// ── select — projection (keep only listed fields) ─────────────────────
export const selectSchema: PropSchema = [
  { field: 'fields', type: 'array', role: 'field', label: bi('შესანახი ველები', 'Fields to keep'), required: true },
]

// ── rollup — append aggregate ("totals") rows along one dim ───────────
//  The ONE canonical aggregation vocabulary (shared with `reduce`). `mean` is the
//  statistical-canon name for the arithmetic mean; the legacy `avg` still LOADS
//  (normalized to `mean` by canonAgg) but is no longer offered for new authoring.
const AGG_OPTIONS = [
  { value: 'sum',   label: bi('ჯამი', 'sum') },
  { value: 'mean',  label: bi('საშუალო', 'mean') },
  { value: 'min',   label: bi('მინ', 'min') },
  { value: 'max',   label: bi('მაქს', 'max') },
  { value: 'count', label: bi('რაოდ.', 'count') },
  { value: 'first', label: bi('პირველი', 'first') },
  { value: 'last',  label: bi('ბოლო', 'last') },
]

// ── aggregate — GROUP BY + reduce (multi-measure form) ────────────────
//  The op accepts two shapes; the authoring surface emits the explicit
//  groupBy/aggregations form (the more general one). The short by/measure form
//  still round-trips losslessly (it is not normalized away — see step adapter).
//  `aggregations` is a STRUCTURED list — its `itemSchema` gives each row a field
//  pick (the measure column), an op select (the reducer), and a produced name.
export const aggregateSchema: PropSchema = [
  { field: 'groupBy',      type: 'array',  role: 'field', label: bi('დაჯგუფება ველებით', 'Group by'), required: true },
  { field: 'aggregations', type: 'array',  label: bi('აგრეგაციები', 'Aggregations'), required: true,
    itemLabel: 'as',
    itemSchema: [
      { field: 'field', type: 'string', role: 'field',   label: bi('საზომი სვეტი', 'Measure column'), required: true },
      { field: 'op',    type: 'string', role: 'literal',  label: bi('აგრეგატი', 'Aggregate'), options: AGG_OPTIONS, required: true },
      { field: 'as',    type: 'string', role: 'newName', label: bi('გამოსავალი ველი', 'Output field') },
    ] },
]

export const rollupSchema: PropSchema = [
  { field: 'dim',   type: 'string', role: 'field',   label: bi('განზომილების სვეტი', 'Dimension column'), required: true },
  { field: 'as',    type: 'string', role: 'newName', label: bi('როლაპის კოდი', 'Rollup code'), required: true },
  { field: 'of',    type: 'array',  role: 'member',  memberOf: 'dim', label: bi('წევრები (* = ყველა)', 'Members (* = all)'), required: true },
  { field: 'agg',   type: 'string', role: 'literal',  label: bi('აგრეგატი', 'Aggregate'), options: AGG_OPTIONS, required: true },
  { field: 'field', type: 'string', role: 'field',   label: bi('საზომი სვეტი', 'Measure column') },
]

// ── group — N-level hierarchy materializer ────────────────────────────
export const groupSchema: PropSchema = [
  { field: 'by',          type: 'array',  label: bi('დონეები', 'Levels'), required: true,
    itemLabel: 'field',
    itemSchema: [
      { field: 'field',  type: 'string', role: 'field',   label: bi('ველი', 'Field'), required: true },
      { field: 'inject', type: 'object', role: 'literal',  label: bi('ინექცია', 'Inject') },
    ] },
  { field: 'levelField',  type: 'string', role: 'newName', label: bi('დონის ველი', 'Level field') },
  { field: 'parentField', type: 'string', role: 'newName', label: bi('მშობლის ველი', 'Parent field') },
  { field: 'idPrefix',    type: 'string', role: 'literal',  label: bi('Id პრეფიქსი', 'Id prefix') },
]

// ── reduce — GROUP BY + collapse to one row per group ─────────────────
export const reduceSchema: PropSchema = [
  { field: 'fn',    type: 'string', role: 'literal', label: bi('ფუნქცია', 'Function'), required: true, options: [
    { value: 'sum',   label: bi('ჯამი', 'sum') },
    { value: 'mean',  label: bi('საშუალო', 'mean') },
    { value: 'min',   label: bi('მინ', 'min') },
    { value: 'max',   label: bi('მაქს', 'max') },
    { value: 'count', label: bi('რაოდ.', 'count') },
    { value: 'first', label: bi('პირველი', 'first') },
    { value: 'last',  label: bi('ბოლო', 'last') },
  ] },
  { field: 'field', type: 'string', role: 'field',   label: bi('საზომი სვეტი', 'Measure column'), required: true },
  { field: 'by',    type: 'array',  role: 'field',   label: bi('დაჯგუფება (ცარიელი = მთლიანი)', 'Group by (empty = whole set)') },
  { field: 'as',    type: 'string', role: 'newName', label: bi('გამოსავალი ველი', 'Output field') },
]

// ── window — running aggregation over an ordered series ───────────────
export const windowSchema: PropSchema = [
  { field: 'fn',   type: 'string', role: 'literal', label: bi('ფანჯრის ფუნქცია', 'Window function'), required: true, options: [
    { value: 'movingAvg', label: bi('მცოცავი საშუალო', 'movingAvg') },
    { value: 'cumSum',    label: bi('კუმულატიური ჯამი', 'cumSum') },
    { value: 'lag',       label: bi('ლაგი', 'lag') },
    { value: 'diff',      label: bi('სხვაობა', 'diff') },
  ] },
  { field: 'over', type: 'string', role: 'field',   label: bi('საზომი სვეტი', 'Measure column'), required: true },
  { field: 'by',   type: 'string', role: 'field',   label: bi('გაყოფის გასაღები', 'Partition key') },
  { field: 'n',    type: 'number', role: 'literal',  label: bi('ფანჯრის ზომა (movingAvg)', 'Window size (movingAvg)') },
  { field: 'as',   type: 'string', role: 'newName', label: bi('გამოსავალი ველი', 'Output field') },
]

// ── derive — compute a new field per row ──────────────────────────────
//  `expr` is EITHER a string formula ('value / total * 100') OR a DeriveExpr
//  tree. Role 'expr' projects the schema-aware ExprAutocompleteInput (scope
//  extended by the input columns) + a live per-row preview through the ONE
//  evaluator (@statdash/expr) — the Power Query Custom Column moment.
export const deriveSchema: PropSchema = [
  { field: 'as',   type: 'string', role: 'newName', label: bi('გამოსავალი ველი', 'Output field'), required: true },
  { field: 'expr', type: 'string', role: 'expr',    label: bi('ფორმულა (value / total * 100)', 'Formula (value / total * 100)'),
    required: true },
]

// ── lookup — JOIN a codelist (Vega-Lite lookup) ───────────────────────
//  Bespoke LookupStepForm owns this op's editor; the roles are the declared offer
//  story for coverage + the generated-query nouns. `key` is an input column; `from`
//  is a secondary-source ref (literal); `fields`/`rename` name the JOINED source's
//  columns (new to the input) — free text (newName), never offered from input rows.
export const lookupSchema: PropSchema = [
  { field: 'key',    type: 'string', role: 'field',   label: bi('გასაღების სვეტი', 'Key column'), required: true },
  { field: 'from',   type: 'object', role: 'literal',  label: bi('წყარო ({$d}/{$cl}/map)', 'Source ({$d}/{$cl}/map)'), required: true },
  { field: 'fields', type: 'array',  role: 'newName', label: bi('ასაღები ველები', 'Fields to pick'), required: true },
  { field: 'rename', type: 'object', role: 'newName', label: bi('სახელის ცვლილებები', 'Renames') },
]

// ── sort — multi-key stable sort ──────────────────────────────────────
//  Bespoke SortStepForm owns the editor. `by` picks input columns; `dir` is a
//  literal enum.
export const sortSchema: PropSchema = [
  { field: 'by',  type: 'array',  role: 'field',   label: bi('დახარისხების გასაღებები', 'Sort keys'), required: true },
  { field: 'dir', type: 'string', role: 'literal', label: bi('მიმართულება (ერთ-ველიანი)', 'Direction (single-field)'), options: [
    { value: 'asc',  label: bi('ზრდადი ↑', 'asc ↑') },
    { value: 'desc', label: bi('კლებადი ↓', 'desc ↓') },
  ] },
]

// ── filter — keep rows where every condition holds (AND) ──────────────
//  Bespoke FilterStepForm owns the editor (the where-map of field→value, with the
//  MemberPicker + parity modes). `where` is keyed by input columns (role 'field').
export const filterSchema: PropSchema = [
  { field: 'where', type: 'object', role: 'field', label: bi('პირობები (ველი → მნიშვნელობა)', 'Conditions (field → value)'),
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
  { field: 'from',   type: 'object', role: 'literal', label: bi('მეორე წყარო ({storeKey,query,encoding?})', 'Secondary source ({storeKey,query,encoding?})'),
    required: true },
  { field: 'by',     type: 'string', role: 'field',   label: bi('საერთო განზომილება', 'Shared dimension'), required: true },
  { field: 'mode',   type: 'string', role: 'literal', label: bi('შეერთების რეჟიმი', 'Join mode'), options: [
    { value: 'left',  label: bi('მარცხენა (ნაგულისხმევი)', 'left (default)') },
    { value: 'inner', label: bi('შიდა', 'inner') },
    { value: 'outer', label: bi('გარე', 'outer') },
  ] },
  { field: 'fields', type: 'array',  role: 'newName', label: bi('ასაღები ველები (ცარიელი = ყველა)', 'Fields to merge (empty = all)') },
  { field: 'rename', type: 'object', role: 'newName', label: bi('სახელის ცვლილებები', 'Renames') },
]

// ── source — the store-aware pipeline HEAD [ADR-046 · SPEC §1.1] ──────
//  The Get verb. Its GOVERNED (author-plane) form is a metric picker + a generic
//  grain — the ONLY thing the author plane speaks (Law 4). `metrics` names governed
//  metric-ids (resolved through the SAME resolveMeasureRef seam); `by`/`where` are
//  generic dim keys (Law 1). The raw `query`/inline `rows` forms are steward-plane
//  advanced shapes (typed object sub-editors), not surfaced to the author. The actual
//  store read happens in the PipelineResolver (the head is stripped before the pure
//  tail runs); this schema is the Constructor's Get-step editor, projected via the
//  registry `category:'get'`.
export const sourceSchema: PropSchema = [
  { field: 'metrics', type: 'array',  role: 'literal', label: bi('მაჩვენებლები (გავერნებული)', 'Metrics (governed)'), required: true },
  { field: 'by',      type: 'array',  role: 'field',   label: bi('ჭრილი (განზომილებები)', 'Grain (dimensions)') },
  { field: 'where',   type: 'object', role: 'field',   label: bi('ფილტრი (განზ. → მნიშვნელობა)', 'Filter (dim → value)') },
]

// ── join — SQL LEFT JOIN against an array source ──────────────────────
export const joinSchema: PropSchema = [
  { field: 'with',    type: 'object', role: 'literal', label: bi('წყარო ({$cl}/{$d}/inline)', 'Source ({$cl}/{$d}/inline)'),
    required: true },
  { field: 'on',      type: 'string', role: 'field',   label: bi('მარცხენა გასაღები', 'Left key'), required: true },
  { field: 'onRight', type: 'string', role: 'newName', label: bi('მარჯვენა გასაღები', 'Right key') },
  { field: 'fields',  type: 'array',  role: 'newName', label: bi('კოპირებადი ველები', 'Fields to copy') },
  { field: 'rename',  type: 'object', role: 'newName', label: bi('სახელის ცვლილებები', 'Renames') },
]
