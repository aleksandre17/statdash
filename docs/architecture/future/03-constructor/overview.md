# Constructor / Panel

> Admin UI. ქმნის ნებისმიერ გვერდს კოდის გარეშე. JSON → DB → render.

---

## ცნობილი არქიტექტურა (15-constructor.md-დან)

```
nodeRegistry.list()         — type picker
nodeRegistry.getSchema()    — form rendering (JSON Schema)
engine.listTransforms()     — transform dropdown
GET /api/catalog            — dataset browser
GET /api/site-manifest      — pages + nav fetch
```

## Constructor flow

```
1. user picks node type → nodeRegistry.list()
2. user fills config form → JSON Schema or raw editor
3. user picks dataset → /api/catalog → DatasetEntry[]
4. Constructor builds DataSpec with href (no named store needed)
5. POST /api/pages → saved to DB
6. Frontend fetchSiteManifest() → rendered automatically
```

---

## Key architectural decision — schema access boundary

**კითხვა:** Constructor-ი `NodeRegistry.getSchema()` -ს პირდაპირ ელაპარაკება, თუ intermediate schema compilation step-ს გადის?

**Verdict: Option B — schema compilation step.** ✅ (confirmed this session)

```
Constructor UI → schemaCompiler.compile(type, meta) → ConstructorSchema → render form
```

**Why B:**
- Constructor depends on `ConstructorSchema` only — not on registry internals
- Adding a new `ConstructorSchema` field = zero nodeRegistry change
- Raw JSON Schema still available via `nodeRegistry.getSchema()` for JSON editor fallback
- `schemaCompiler` is a pure function (engine/core — zero React deps)

**Platform precedents:**
- Grafana: `PanelOptionsEditorRegistry` — compiled editor config, not raw schema
- Builder.io: each block has `inputs: Input[]` — compiled field list with UI hints
- Sanity CMS: `defineField({ name, type, title, group, hidden })` — compiled

---

## What was completed (this session — 2026-05-07 / 2026-05-09)

### ✅ docs/architecture/types/all-types.md — 4 targeted edits

1. **`ConstructorSchema` + `ConstructorFieldDef` interfaces** (after `NodeRegistryMeta`)
   - `fields: ConstructorFieldDef[]` — ordered, grouped, with UI hints
   - `groups?` — field grouping with optional `collapsed`
   - `preview?` — palette tile thumbnail path
   - `palette` — required: `{ label, icon?, category? }` — Constructor type picker entry
   - Rule documented: `JSON.parse(JSON.stringify(schema)) === schema` ✅

2. **`ParamDef` closed union → `ParamDefMap` augmentable interface**
   - Same pattern as `NodeTypeMap` — module augmentation
   - 6 entries: `hidden · year-select · range · select · multi-select · cascade`
   - `type ParamDef = ParamDefMap[keyof ParamDefMap]` — derived automatically
   - New control type: augment `ParamDefMap`, no engine changes ✅

3. **Per-key filter hooks** (TanStack Form pattern)
   - `useFilter<T>(key)` → `{ value, set, reset }` — replaces whole-context `useFilter()`
   - `useFilterContext()` — full context access when needed
   - `useFilterBars()` — bridge: `BarDef config → FilterBarSpec[] runtime`

4. **Filter Control Registry section** — complete rewrite
   - `FilterCodec<T>` — `toUrl · fromUrl · isEmpty · normalize`
   - `OptionsLoader` — `load(ctx: SectionContext): Promise<SelectOption[]>`
   - `FilterControlMeta` — with `schema?: ConstructorSchema` slot
   - `FilterControlProps<C>` — `filterKey + config` (no onChange)
   - `FilterControlSlice<T, C>` — `Shell + META + defaultValue + codec + validate? + formatValue? + editor?`
   - `DependencyGraph` — `DependencyNode[] + order (topological) + hasCycle`
   - `FilterControlRegistry` — `register(slice) · get(type) · list()`

### ✅ docs/architecture/examples/filter-control-registry.md — complete rewrite

All 6 slices fully implemented:
- `yearSelectSlice`, `selectSlice`, `multiSelectSlice`, `rangeSlice`, `cascadeSlice`, `hiddenSlice`
- `buildDependencyGraph()` — topological sort implementation
- `FilterBarShell` — uses `useFilterBars()`
- `FilterControlSlot` — handles `waitingFor` states (blocked dependencies)
- `CascadeShell` — uses `useFilterContext()` for SectionContext dims
- `editor?` slot — Phase 2 pattern documented in comments
- "Adding a new control type" — full workflow walkthrough
- Anti-patterns section — updated

### ✅ docs/architecture/examples/constructor-schema.md — NEW

Complete `ConstructorSchema` compilation reference:
- One `ConstructorSchema` per node type: `section · chart · table · kpi-strip · filter-bar`
- One `ConstructorSchema` per filter control: `year-select · cascade · select · multi-select · range`
- `buildConstructorPalette()` — unified palette from all registries
- `schemaCompilerPhase1()` — Phase 1 identity compiler (returns meta.schema directly)
- Phase 1 → Phase 2 migration documented (zero breaking changes)
- `editor?` slot — Phase 2 Constructor config panel pattern documented
- `DependencyGraph` layer — all registries unified

### ✅ .claude/commands/principles.md — NEW skill

Invokable as `/principles`. Contains:
- Core mindset + 8 non-negotiable rules
- Platform baseline (Grafana · Builder.io · Eurostat · ONS · Kimball…)
- Agnosticism layers diagram
- Separation of concerns
- Migration discipline (Strangler Fig)
- Strict anti-pattern list

---

## Architecture decisions locked in

| Decision | Chosen | Reason |
|---|---|---|
| Schema boundary | Option B (schemaCompiler) | Constructor depends on ConstructorSchema only |
| ParamDef extensibility | ParamDefMap (module augment) | Same as NodeTypeMap — add types without engine changes |
| Filter hooks | per-key `useFilter<T>(key)` | TanStack Form pattern — no unnecessary re-renders |
| FilterCodec | includes `normalize()` | Type safety — normalize before any comparison |
| OptionsLoader | `load(ctx: SectionContext)` | ctx → parent-driven cascade queries |
| editor? slot | on FilterControlSlice (not META) | META = pure JSON; editor = React dep → different layers |
| DependencyGraph | topological sort | formal — cycle detection built in |
| registry.list() | returns FilterControlMeta[] | Constructor palette introspection |

---

## TODO — still open

### Phase 2 — Constructor UI (not started)

- [ ] UI framework decision (React? same codebase as app? separate bundle?)
- [ ] Page builder UX (drag & drop? form-based? hybrid?)
- [ ] `schemaCompiler.compile()` full implementation (engine/core)
  - Derives fields from JSON Schema enum → type: 'select' options
  - Merges meta.constructorHints (field groups, conditional display)
  - Marks required fields from JSON Schema required[]
- [ ] `constructorHints` formal interface in `NodeRegistryMeta`
  - `fieldGroups`, `conditionalFields`, `fieldOrder`
- [ ] Live preview strategy
  - iframe of actual app render? or separate preview renderer?
  - Grafana: panel renders in preview iframe — same engine, different container
- [ ] `ConstructorEditorProps<T>` interface (for editor? slot implementations)
- [ ] Nav item editor (separate node type or Constructor sidebar?)
- [ ] Permissions / roles (who can publish vs draft?)
- [ ] Versioning / draft vs published pages
- [ ] `GET /api/catalog` backend contract (DSD → DatasetEntry[] pre-processing)
- [ ] ChromeRegistry → Constructor (AppHeader variant picker)

### Immediate next (before Constructor UI)

- [ ] **TimeMode architecture** — year / range / compare: needs best-solution design in new 4-layer arch
  - Documented in: `memory/project_timemode_work.md`
  - Current state: works but not properly placed in architecture
- [ ] Error handling + empty states (CLAUDE.md Next Priority #1)
- [ ] Loading skeletons (CLAUDE.md Next Priority #2)
- [ ] Tests: `interpretSpec` + `FilterSchema` (CLAUDE.md Next Priority #3)

---

## File map — Constructor-related

```
docs/architecture/
  examples/
    constructor-registry.ts       ← nodeRegistry.list() + data catalog lifecycle
    constructor-schema.ts         ← ConstructorSchema compilation (NEW)
    filter-control-registry.tsx   ← all 6 FilterControlSlices + DependencyGraph
  types/
    all-types.ts                  ← ConstructorSchema · ParamDefMap · FilterControlRegistry
  architecture/
    15-constructor.md             ← original architecture spec
  future/
    03-constructor/
      overview.md                 ← this file
      editor-slot-impl.tsx        ← Phase 2: editor? slot per control type (NEW)
    04-dep-graph/
      dep-graph-impl.md           ← dependsOn + blocking + topological sort (NEW)
    05-async-options/
      async-options-impl.md       ← useAsyncOptions hook + optionsQuery (NEW)
```