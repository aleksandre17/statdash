# 18. Classifier System + Pipe Operators

> Source-of-truth for the **dim metadata** + **transform pipeline** subsystems.
> Implemented in `engine/core/` during 2026-04 sessions; regional dataset
> migrated as the reference application. accounts + gdp pending.
>
> Pattern parity: SDMX Codelist · Cube.dev dimensions · LookML · dbt semantic ·
> Vega-Lite signals · Grafana transformations · MongoDB `$` operators.

---

## 1 — Why this exists

The previous design split dim metadata across **three** concerns:

| Concern | Old home | Problem |
|---|---|---|
| Codelist (which codes exist) | emergent from `Object.values(facts).map(o => o.dim)` | unreliable |
| Hierarchy (rollups) | `DimensionDef.rollups` w/ `includes: '*'` sentinel | engine read it |
| Display (label/color/order) | `DimensionDef.codes[code].meta` | engine read it |

Engine consequently knew Geostat-domain attributes (`label`, `color`,
`sectorOrder`, …). PRINCIPLE 1 violated ("ალგორითმი არ უნდა იცნობდეს ვისთვის").

**Fix:** SDMX Codelist pattern — one entry per code holds **structural** data
(code, parent) **and** open attribute bag (display, sortOrder, anything). The
engine reads only `code` + `parent`; everything else is ignored at the engine
level and consumed by configs declaratively.

---

## 2 — Classifier + Display shapes (split)

```ts
// engine/core/src/sdmx.ts

export interface ClassifierEntry {
  /** Stable business code — what consumers see at query boundary. */
  code:    DimVal
  /** Parent id (as map key) — optional; absent = root rollup. */
  parent?: DimVal
  /** Open bag for additional STRUCTURAL attrs only (isoCode, nutsLevel, …). */
  [attr: string]: DimVal | undefined
}

/** Classifier — STRUCTURAL codelist only. Keyed by surrogate id. */
export type Classifier = Record<string /*id*/, ClassifierEntry>

/**
 * DisplayMap — UI overlay for one dim. Keyed by the SAME id space as
 * the classifier (number/string id, NOT business code) — uniform with
 * `Classifier`. Engine NEVER reads this directly. `resolveDisplayRef`
 * joins it with the classifier (id → code) at `{ $d }` refs.
 *
 * Locale/theme swap = swap one DisplayMap; classifier untouched.
 */
export type DisplayMap = Record<string /*id*/, Record<string /*attr*/, DimVal | undefined>>

/** DataBundle — universal contract every dataset module exports. */
export interface DataBundle<F extends Observation = Observation> {
  facts:        readonly F[]
  classifiers?: Record<string, Classifier>
  display?:     Record<string, DisplayMap>
}
```

**Industry mapping (1:1):**

| Standard | Maps to |
|---|---|
| SDMX `<Codelist><Code id><Name xml:lang>…</Code></Codelist>` | classifier (Code+Parent) + display (localised Names) |
| Cube.dev `dimension: { name, sql }` + `meta: { title, color }` | same split |
| LookML `dimension { sql }` + `label`/`description` | same split |
| dbt semantic `dimensions: [{ name, type }]` + labels in metadata | same split |
| Power BI column model + format strings | structural + UI properties |

**Why split:** engine internals (`DimResolver`, fact matching) read **only**
classifier (`code`, `parent`). Display is a **consumer** concern — needed by
`lookup`/`source`/derive ops via the `{ $cl }` ref mechanism. Splitting:
- guarantees engine agnosticism by file boundary, not just discipline
- allows i18n swap (`display.ka` vs `display.en`) without classifier touch
- aligns with SDMX wire format (Codelist vs annotations) and Phase 2 DB shape
  (one structural table per dim + one JSONB column for display)

**Storage shape (regional example) — both classifier and display are id-keyed:**

```ts
// data/regional/raw.ts — TWO separate exports, same id space
export const REGIONAL_CLASSIFIERS: Record<'geo' | 'sector' | 'time', Classifier> = {
  geo:    { '0': { code: 'total' }, '1': { code: 'tbilisi', parent: 0 }, … },
  sector: { '0': { code: '_T'    }, '1': { code: 'AGRI',    parent: 0 }, … },
  time:   { '2010': { code: 2010 }, …, '2024': { code: 2024 } },
}

export const REGIONAL_DISPLAY: Record<'geo' | 'sector' | 'time', DisplayMap> = {
  geo: {
    '0':  { label: 'საქართველო სულ', color: '#1A365D' },
    '1':  { label: 'თბილისი',         color: '#0080BE' },
    …
  },
  sector: {
    '0': { label: 'სულ', fullLabel: 'სულ დამ. ღ.', color: '#1A365D', sectorOrder: -1 },
    '1': { label: 'სოფ. მეურ.', fullLabel: '…',     color: '#4CAF50', sectorOrder: 0 },
    …
  },
  time: {},   // no display attrs needed for time in regional
}
```

**Why id-keyed (not code-keyed):** uniform key space across `classifiers` and
`display`; renaming a code (SDMX revision) touches the classifier entry only —
display stays valid. Locale swap (i18n) writes a parallel id-keyed map. No
data structure asymmetry between the two halves of the bundle.

**No more static `REGIONAL_TIME_CATALOGUE`** — consumers derive year ranges
on demand via `codesOf(REGIONAL_CLASSIFIERS.time)` (engine helper). One
source of truth (the classifier); zero duplication.

---

## 3 — Surrogate keys in facts (Kimball star schema)

Facts table carries **surrogate ids**, not natural codes. This decouples the
fact table from SDMX codelist versioning, mirrors PostgreSQL/BigQuery PK
conventions, and aligns with Constructor Phase 2 DB shape.

```ts
// data/regional/raw.ts
export interface RegionalFact {
  time:    number      // year (self-identifying; classifier id === code)
  geo:     number      // surrogate id → REGIONAL_CLASSIFIERS.geo
  sector:  number      // surrogate id → REGIONAL_CLASSIFIERS.sector
  measure: string      // codes for low-cardinality dims w/o classifier OK
  value:   number
}
```

**Boundary translation** happens inside `ExternalStore`:
- on entry — `ctx.dims['geo'] = 'tbilisi'` (code) → resolve to descendant **ids**
- on output — `obs.geo = 1` (id) → replace with code `'tbilisi'`

Pipelines, configs, and display dicts work in **codes** end-to-end. Storage
+ engine internals work in **ids**. Classic warehouse separation.

---

## 4 — Dim refs: `$cl` (structural) vs `$d` (display)

Configs reference dim data declaratively — engine resolves at apply time.
Pattern: Vega-Lite `{signal: 'name'}`, Grafana `$variable`, MongoDB `{$ref}`,
Cube.dev `${cube.dimension}`, dbt `{{ ref('model') }}`.

**Two refs, two purposes — explicit separation of concerns:**

```ts
/** STRUCTURAL ref — returns classifier entries (code, parent, structural attrs only). */
export interface ClassifierRef { $cl: string; view?: ClassifierView }

/** UI ref — returns display entries with `code` injected (label, color, etc.). */
export interface DisplayRef    { $d:  string; view?: ClassifierView }

export type DimRef         = ClassifierRef | DisplayRef
export type ClassifierView = 'byCode' | 'items' | 'leaves' | 'rollups'
```

| Ref | What you get | Use when |
|---|---|---|
| `{ $cl: 'geo' }` | classifier entries `{ code, parent?, …structural }` | hierarchy traversal, structural-only iteration |
| `{ $d: 'geo' }`  | display entries `{ code, label, color, … }` (code injected from map key) | UI: `lookup.from`, selectors, find/breadcrumbs |

`view` is shared semantics. For `$d`, the classifier (when present) drives
the structural filter (leaves vs rollups), but emitted entries carry display
attrs only — engine reads classifier + display from store and joins.

**Default view per consumer:**

| Consumer | Default `view` |
|---|---|
| `lookup.from` | `byCode` (code-keyed dict) |
| `InlineSource.items` | `items` (rollups first, then leaves) |
| `find` / `breadcrumbs` derive ops `source` | `items` |

**Examples (regional, current):**

```ts
// lookup — UI fields, use $d
{ op: 'lookup', key: 'geo', from: { $d: 'geo' }, fields: ['label', 'color'] }
{ op: 'lookup', key: 'sector', from: { $d: 'sector' }, fields: ['label', 'color', 'fullLabel'] }

// InlineSource — sector dropdown wants leaves + UI labels:
items: { $d: 'sector', view: 'leaves' },
valueField: 'code', labelField: 'fullLabel',

// find / breadcrumbs — match by code, extract UI field:
{ op: 'find',        source: { $d: 'geo' }, by: 'region', idField: 'code', field: 'color' }
{ op: 'breadcrumbs', source: { $d: 'geo' }, by: 'region', idField: 'code', labelField: 'label', … }

// $cl reserved for structural-only consumers (hierarchy traversal, future).
// In a multi-level cascade: { $cl: 'geo', view: 'rollups' } → entries with parent edges.
```

---

## 5 — Engine helpers

```ts
// engine/core/src/data/codelist.ts

/** code-keyed dict — { 'tbilisi': { code, parent, … }, … } */
export function codelistOf(c: Classifier): Record<string, ClassifierEntry>

/** array, rollups (non-leaves) first then leaves */
export function itemsOf(c: Classifier): ClassifierEntry[]

/** entries with NO children — true OLAP leaves; only these appear in facts */
export function leavesOf(c: Classifier): ClassifierEntry[]

/** entries with at least one child — virtual aggregates */
export function rollupsOf(c: Classifier): ClassifierEntry[]

/** all codes in classifier insertion order (replaces static *_CATALOGUE exports) */
export function codesOf(c: Classifier): DimVal[]

/** ref guards */
export function isClassifierRef(v: unknown): v is ClassifierRef
export function isDisplayRef(v: unknown):    v is DisplayRef
export function isDimRef(v: unknown):        v is DimRef

/**
 * resolveClassifierRef — STRUCTURAL ref → classifier entries (no display merge).
 * Unknown dim resolves to empty-of-shape.
 */
export function resolveClassifierRef(
  ref:         ClassifierRef,
  classifiers: Record<string, Classifier> | undefined,
  defaultView: ClassifierView,
): Record<string, ClassifierEntry> | ClassifierEntry[]

/**
 * resolveDisplayRef — UI ref → display entries with `code` injected.
 * Classifier (if present) supplies the structural view filter; display map
 * supplies the per-code attrs.
 */
export function resolveDisplayRef(
  ref:         DisplayRef,
  classifiers: Record<string, Classifier> | undefined,
  display:     Record<string, DisplayMap> | undefined,
  defaultView: ClassifierView,
): Record<string, Record<string, DimVal>> | Record<string, DimVal>[]

/** Dispatch helper — picks the right resolver for `$cl` or `$d`. */
export function resolveDimRef(ref, classifiers, display, defaultView)
```

`leavesOf`/`rollupsOf` use proper **OLAP semantics**: a leaf is an entry with
no children (computed via `parent`-edge transitive scan). Works for arbitrary
hierarchy depth.

`resolveClassifierRef` MERGES display onto classifier entries — consumers see
`{ code, parent, label, color, … }` as one record despite split storage.
Engine internals never call this; they read raw classifier directly.

`codesOf` replaces dataset-specific catalogue exports (e.g. `REGIONAL_TIME_CATALOGUE`).
Generic helper, any dim, any dataset.

---

## 6 — `DimResolver` — code↔id translation inside `ExternalStore`

Built once per dim from its classifier. Replaces the old `StaticSemantic.leaves()`
exactly, but works on classifier `parent` edges (no separate rollups concept).

```ts
class DimResolver {
  // code (string) → id (DimVal, preserved as number when classifier key parses)
  private codeToId: Map<string, DimVal>
  // id → code
  private idToCode: Map<string, DimVal>
  // id → all descendant ids (inclusive); for rollup expansion
  private descIds:  Map<string, string[]>

  /** code → set of leaf ids for filter match */
  leafIds(code: DimVal): DimVal[]

  /** id → code for output substitution */
  codeOf(id: DimVal): DimVal
}
```

`ExternalStore`:
- `val(code, ctx)` and `observe(query, ctx)` use `leafSet` (per-dim DimResolver)
  to expand each `ctx.dims[k]` to the matching leaf-id set, then compare facts.
- `observe()` post-maps each row through `toCodeView()` — replaces classifier-
  backed dim ids with their codes before returning.
- Dims **without** a classifier pass through unchanged (code = id).

**`DataStore` interface gains TWO fields:**
```ts
readonly classifiers?: Record<string, Classifier>   // structural (engine reads)
readonly display?:     Record<string, DisplayMap>   // UI overlay (engine ignores)
```
Engine-side resolvers consult both for `{ $cl }` ref resolution: classifier for
the structural skeleton, display for the merged UI attrs. Engine internals
(`val`, `observe`, `DimResolver`) read **only** classifier.

---

## 7 — Pipe operators (full op list)

`engine/core/src/data/transform.ts` — `TransformStep` discriminated union.
The DataSpec field is named **`pipe`** (proposal naming).

### 7.1 `rollup` — append aggregate row

```ts
| { op: 'rollup'
    dim:    string                         // dim column receiving rollup code
    as:     DimVal                         // rollup code value to inject
    of:     '*' | readonly DimVal[]        // members included
    agg:    'sum' | 'avg' | 'min' | 'max' | 'count'
    field?: string                         // measure col, default 'value'
  }
```

Cube/OLAP "totals row" pattern. For each group (= unique values of all
dims **except** `dim` and `field`), emits one new row with `dim = as` and
the aggregated measure. Original rows are kept (unlike `aggregate`, which
collapses).

```ts
{ op: 'rollup', dim: 'geo', as: 'total', of: '*', agg: 'sum' }
```

### 7.2 `aggregate` — collapsing GROUP BY (two shapes)

```ts
// Short form (single measure, common case):
| { op: 'aggregate'; by: string[]; measure: string; agg: AggOp; as?: string }

// Multi-measure form:
| { op: 'aggregate'; groupBy: string[]; aggregations: AggSpec[] }
```

Internally normalised. Vega-Lite analogue. Listed measures reduced; unlisted
dims aggregated over (collapsed).

```ts
{ op: 'aggregate', by: ['time', 'sector'], measure: 'value', agg: 'sum' }
```

### 7.3 `derive` — compute new field

```ts
| { op: 'derive'; as?: string; name?: string; expr: DeriveExpr | string }
```

`expr` accepts either:
- **string formula** — `'value / total * 100'` (parsed via shunting-yard)
  - tokens: identifiers, decimal numbers, `+ - * /`, parentheses
  - left-associative; standard precedence
- **JSON expression tree** — `{ op: 'mul', a: { op: 'field', field: 'x' }, b: { op: 'literal', value: 100 } }`

`as` is preferred output field (legacy `name` still accepted). Vega-Lite
`calculate` analogue.

### 7.4 `filter` — keep matching rows + CtxRef

```ts
| { op: 'filter'; where: Record<string, FilterValue> }
```

`FilterValue` = literal | array | `CtxRef`. Engine resolves `{ $ctx: 'time' }`
against `PipelineContext.section.dims` at apply time; empty/missing context
value → wildcard (clause skipped).

```ts
{ op: 'filter', where: { time: { $ctx: 'time' }, sector: ['AGRI', 'MANUF'] } }
```

### 7.5 `sort` — order rows + custom orderings

```ts
| { op: 'sort'
    by:     string
    dir?:   'asc' | 'desc'
    using?: readonly DimVal[]   // explicit code order
  }
```

Numeric/locale-aware default. `using` maps each row's `by` value to its index
in the array — rows with absent values go last.

```ts
{ op: 'sort', by: 'sector', using: ['AGRI', 'MANUF', 'CONST', 'TRADE'] }
```

### 7.6 `lookup` — code-keyed JOIN (dict)

```ts
| { op: 'lookup'
    key:     string
    from:    ClassifierRef | Record<string, Record<string, DimVal | undefined>>
    fields:  string[]
    rename?: Record<string, string>
  }
```

Vega-Lite lookup analogue. `from` accepts either an inline dict OR a `{ $cl }`
ref (engine resolves to `byCode` view).

```ts
{ op: 'lookup', key: 'geo', from: { $cl: 'geo' }, fields: ['label', 'color'] }
```

### 7.7 `join` — array-based LEFT JOIN

```ts
| { op: 'join'
    with:     ClassifierRef | readonly Record<string, unknown>[]
    on:       string         // join key on LEFT row
    onRight?: string         // join key on RIGHT (default: 'code' for $cl, else `on`)
    fields?:  string[]       // default: all right fields except onRight
    rename?:  Record<string, string>
  }
```

Generic SQL LEFT JOIN. Use `lookup` when the right side is already code-keyed
dict; use `join` when the right side is an array (classifier items, inline rows)
and you want generic key-based merging without listing every field.

```ts
{ op: 'join', with: { $cl: 'sector' }, on: 'sector' }
// merges every classifier attr (label, color, fullLabel, sectorOrder) onto each row
```

### 7.8 Existing ops (preserved)

`melt`, `rename`, `cast`, `addField`, `select` — unchanged from prior
implementation. All dataset-agnostic, pure functions of `(rows, step) → rows`.

---

## 8 — `PipelineContext`

```ts
export interface PipelineContext {
  /** Structural codelists consulted by `lookup`/`join`/`InlineSource` `{ $cl }` refs. */
  classifiers?: Record<string, Classifier>
  /** UI overlay merged onto classifier entries at ref resolution. */
  display?:     Record<string, DisplayMap>
  /** SectionContext consulted by `filter` CtxRefs (`{ $ctx: '…' }`). */
  section?:     SectionContext
}
```

Threaded through:
- `registry/resolvers.ts:QueryResolver` — `applyPipeline(rows, spec.pipe, { classifiers, display, section: ctx })`
- `data/resolve.ts:resolveYears/resolveOptions/resolveChips` — same shape
- `config/filter.ts:DeriveContext` (subset: classifiers + display) — passed by `useFilterState` from store

Always populated when running through the engine-level resolvers; never
constructed by app code directly.

---

## 9 — `InlineSource` (data source kind)

```ts
// engine/core/src/data/source.ts
export type InlineSource = {
  type:   'inline'
  items:  ClassifierRef | readonly Record<string, unknown>[]
  pipe?:  TransformStep[]
}
```

Used by `OptionsSource`, `ChipSource`, `YearsSource`. Eliminates cube queries
for selectors backed by classifier data:

```ts
// year-select — classifier is the authoritative year list, not the cube
years: { type: 'inline', items: { $cl: 'time' }, field: 'code' }

// sector dropdown — leaves only, sorted by classifier attr
options: {
  type:       'inline',
  items:      { $cl: 'sector', view: 'leaves' },
  pipe:       [{ op: 'sort', by: 'sectorOrder', dir: 'asc' }],
  valueField: 'code',
  labelField: 'fullLabel',
}
```

---

## 10 — Filter derive ops accept refs

`evalFilterDerive` (in `config/filter.ts`) accepts an optional `DeriveContext`
with `classifiers`. Two ops gain ref support + an `idField` parameter:

```ts
// find — match by classifier code instead of default 'id'
{ op: 'find', source: { $cl: 'geo' }, by: 'region', idField: 'code', field: 'color' }

// breadcrumbs — same
{ op: 'breadcrumbs', source: { $cl: 'geo' }, by: 'region', idField: 'code', labelField: 'label',
  prefix: [{ label: '…' }] }
```

`useFilterState(node, store?)` threads `store.classifiers` into `evalFilterDerive`.
`SiteRenderer.PageRendererInner` passes `store` (already obtained via
`usePageStore(page.storeKey)`).

---

## 11 — DataSpec field rename

Old: `transform?: TransformStep[]` on `'query'` DataSpec, on `QuerySource`,
`ApiSource`, `InlineSource`.

New: **`pipe?: TransformStep[]`** on all of the above.

`TransformStep` type name retained (renaming fanout would be churn for no
gain). The field is `pipe`; each entry is a transform step. Vega-Lite naming
collision avoided.

---

## 12 — Industry parity table

| Standard | Maps to |
|---|---|
| Vega-Lite `transform` (aggregate, filter, calculate, lookup, sort, fold) | full coverage |
| Grafana transformations (groupBy, calculateField, joinByField, organize, sortBy) | full coverage |
| Cube.dev measures + drillMembers | aggregate + rollup |
| Malloy `nest`, `group_by`, `aggregate` | aggregate + rollup + lookup |
| LookML `drill_fields`, `type`, `expression` | lookup + derive + sort using |
| SDMX HierarchicalCodelist | classifier `parent` edges |
| Cube.dev / LookML / dbt co-located dim definitions | merged display in classifier |
| MongoDB `$ref` operators | `{ $cl: 'dim' }` refs |
| Vega-Lite signals `{signal: 'x'}` | `{ $ctx: 'x' }` filter refs |

---

## 13 — Regional dataset = reference application

Migrated end-to-end as the canonical example for a future session:

| File | What it shows |
|---|---|
| `src/data/regional/raw.ts` | facts (surrogate ids) + classifiers (id → code+parent+attrs) |
| `src/data/regional/adapter.ts` | trivial typed identity (no enrichment) |
| `src/data/regional/store.ts` | `new ExternalStore(facts, { classifiers })` |
| `src/features/regional/regional.config.ts` | pipe ops: aggregate (short form), lookup with `{ $cl }`, sort |
| `src/features/regional/regional.filters.ts` | InlineSource with `{ $cl }` items, derive ops with `idField`, no imperative code |
| `scripts/regen-regional-raw.cjs` | regenerates raw.ts from xlsx; emits new merged shape |

`accounts` and `gdp` datasets **not yet migrated**. They currently denormalise
labels into observations (`label`, `accountLabel`, `accountColor` on every fact
row) — an instance of Interpretation A (anti-pattern). Migration target: split
into facts + classifiers + co-located display, same shape as regional.

---

## 14 — PRINCIPLES self-check (still passing)

| წესი | ✅ |
|---|---|
| engine არ იცის Geostat | ExternalStore reads `code`+`parent` only; classifier attrs are open bag |
| ალგორითმი ვისთვის | helpers + DimResolver + ref system are dataset-agnostic |
| open/generic | ClassifierEntry open attrs; `idField` configurable; `view` parametric |
| არ გააუარესო | tsc 0 errors after every step |
| JSON-first | configs zero imperative; refs are pure JSON |
| logic in renderer | derive/lookup/sort fully declarative |
| generic core + thin boundary | engine generic; store holds classifiers; config references |
| Constructor Phase 2 | `{ $cl: 'dim' }` + DB classifier table = Phase 2 DB shape |
| SDMX parity | `<Code id><Name><Parent><Annotation>` = `Classifier[id] = { code, parent?, ...attrs }` |

---

## 15 — Future session next-steps

1. **Migrate `accounts`** — same pattern as regional. Decouple SDMX wire format
   labels from observations; build `accountsClassifiers = { measure, account, side }`
   with co-located labels/colors.
2. **Migrate `gdp`** — same. Build `gdpClassifiers = { measure, approach }` with
   co-located labels/colors.
3. **Delete legacy fields** from observations after migration — `label`,
   `accountLabel`, `accountColor`, `approachLabel`, `approachColor`.
4. **Verify regional render parity** with prior implementation in dev server
   (visual regression check, not yet done by current session).
5. **Optional: cross-store `join`** — extend the `join` op with a `$store: 'gdp'`
   ref form for joining facts across datasets (Cube.dev cross-cube join).
6. **Constructor Phase 2 — backend codelist API** → `GET /api/classifiers/:dataset/:dim` →
   shape: `Record<id, ClassifierEntry>` (1:1 with `Classifier` type, JSON-safe).

---

## 16 — Cross-references

- `architecture/05-data-pipeline.md` — DataSpec union (incorporate `pipe?` field rename here)
- `architecture/17-data-cube.md` — multi-dim model (classifiers materialise the dim metadata layer)
- `architecture/11-backend-standards.md` — fromSDMX boundary (still the only format adapter)
- `architecture/15-constructor.md` — Phase 2 storage (`{ $cl }` refs serialise verbatim to DB)
- `engine/core.md` — public API (Classifier types + helpers exported here)
- `decisions/01-platform-analysis.md` — Vega-Lite/Grafana/Cube parity discussion