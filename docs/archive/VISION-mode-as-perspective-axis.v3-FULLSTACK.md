# VISION #3 — `perspective` axis, FULL-STACK (Constructor + API + end-to-end) — FINAL

> Companion to `VISION-mode-as-perspective-axis.v3.md` (the render/engine analysis) and `.v3-PLAN.md` (the engine Strangler phases + FF suite). Design-only — **zero code changed.**
> This doc extends the engine-only plan to the **two missing surfaces** — the Constructor/panel authoring surface (`apps/panel`) and the API provision/serve/validate surface (`apps/api` + `packages/contracts`) — plus the **end-to-end coherence** (one contract, the full data flow, the full-stack Strangler map, the competitor benchmark, the resolved residual).
> Ground-truth-verified against the live tree 2026-06-27. Where the engine plan's enumeration was incomplete for the api/contracts layer, this doc names the missed surfaces (the `SiteManifestContract.modes` site-scoped surface; the `mode-bar` node schema; the page-root `modeOrder` Inspector field; the coverage-gate's missing axis dimension).

---

## 0. Executive summary

1. **The contract is ONE, and it already has a home.** `PerspectiveAxis`/`PerspectiveDef`/`TimeBindingSpec` are pure JSON (Law 2). The engine plan puts the *type* in `packages/core/src/config/perspective-axis.ts` — correct for the renderer. But the **SSOT for a config shape shared by panel (author) + api (validate/serve) + engine (render) is `packages/contracts`** (the zero-dep layer `apps/api` is allowed to import; the arrow forbids api → core/react). **Resolution: the JSON-validatable shape lives in `packages/contracts` (JSON-Schema + a thin TS mirror); `packages/core` re-exports/refines it for the renderer.** This is exactly the `SiteManifestContract` / `ManifestMode` pattern already in the tree (`packages/contracts/src/manifest.ts`). No per-surface re-definition.

2. **The api/contracts layer has a System-A surface the engine plan never enumerated.** `SiteManifestContract.modes: ManifestMode[]` (`manifest.ts:27,70`) is **served by `GET /api/bootstrap`** from the `site_config.modes` key (`bootstrap/index.ts:94,269`), with `DEFAULT_MODES = []`. This is a **site-scoped** mode registry, distinct from the **page-scoped** `modeOrder`/`PerspectiveAxis`. The full-stack reframe must decide its fate (it survives, repurposed — §2.3 / §4).

3. **The Constructor authoring need splits cleanly into two seams that ALREADY EXIST**, plus one genuinely new page-level surface:
   - **Per-node `when: perspective-is`** → the existing recursive **`VisibilityBuilder`** (`features/visibility/`); we register the `perspective-*` leaf ops there (OCP, exactly how `mode-is`/`mode-in`/`mode-not` are registered today). The deleted `ByModeEditor` is *not replaced by another DataSpec editor* — its authoring need (per-mode data) becomes (a) a node `when` toggle + (b) a `scope.metric` picker on the perspective.
   - **`scope.metric` picker** → the semantic-layer MetricDef ref picker (R1), authored on the perspective row.
   - **NEW: a page-level "Perspectives" pane** — the genuinely new surface (the Power BI bookmark-pane / Tableau parameters analogue), replacing the page-root `modeOrder` JSON array field (`pageSchemaSource.ts:62`). This is the one new authoring organism; everything else is registration into existing seams.

4. **The Constructor coverage gate has a structural gap the reframe must close.** `coverage.fitness.test.ts` enumerates DataSpec / ParamDef / TransformOp / VisibilityOp — **it has NO axis dimension.** A page-level `PerspectiveAxis` is a renderer capability with no coverage assertion today. The full-stack design **adds a 5th coverage axis** (`PERSPECTIVE_SCOPE_KEYS` surfaced or allowlisted) so "the Constructor sees only what's registered" (Law 8) covers the perspective scope keys too — and the deferred `scope.*` keys (store/dims/blend/facet) become a *visible, shrinking* allowlist instead of silent gaps.

5. **Permalink-from-registry is served, not just rendered.** The engine plan derives the canonical URL from the `PerspectiveAxis` registry on the client. The api makes it a **served guarantee**: the bootstrap manifest carries the `PerspectiveAxis` per page, so the permalink param-names/defaults/elision are reproducible from the *served* config alone (Law 9 as a property of what the server ships, not a client convention). The `snapshot:'active'|'all-perspectives'` policy is part of the served axis, so SSR/export honour it server-side.

6. **The v3 residual is RESOLVED: `scope.metric` (registered MetricDef), not node-local `value.type`, is the canonical home — for full-stack reasons.** It is the only choice that is (a) authorable as a *pick* (Law 2, the semantic-layer metric picker already exists), (b) validatable server-side (a `MetricDef` ref resolves against the registry; a node-local measurement is opaque to the api), and (c) permalink/snapshot-coherent. Node-local `value.type` survives ONLY as the LOW-2 single-node override escape (never dual-encoded). See §6.

7. **Verdict: the FULL picture is complete and implementable.** One contract in `packages/contracts`; author in the panel via existing Visibility/Metric seams + one new Perspectives pane; validate + serve in the api via the config↔cube fitness extended + the bootstrap manifest; render in the engine per v3. The full-stack Strangler map (§5) extends P0…P-final so every phase is additive + fitness-locked + non-breaking across **all three** surfaces. Deferred doors (facet, multi-axis/compare, blend, multi-store) compose as additive `scope.*` keys with **zero rework** in any of the three surfaces (§7).

---

## 1. The end-to-end picture (one contract, the full data flow)

```
                      packages/contracts  ── PerspectiveAxis / PerspectiveDef (JSON-Schema + TS mirror)
                      (the ONE SSOT; arrow-importable by api AND, via re-export, by core/react)
                               │
        ┌──────────────────────┼───────────────────────────────────────────┐
        │ AUTHOR               │ VALIDATE + STORE + SERVE                    │ RENDER
        ▼                      ▼                                            ▼
   apps/panel             apps/api                                     packages/core + react
   ───────────            ────────                                     ─────────────────────
   Perspectives pane  →   POST /config/pages  (save)                   migratePageConfig (read)
   (new, page-level)        └ validate: perspective-contract fitness        │
   VisibilityBuilder        └ store: page_version.config JSON (verbatim)     ▼
   (perspective-is op)    GET /api/bootstrap  (serve)                   perspectiveRegistry
   MetricDef picker         └ pages[id].perspectiveAxis (verbatim)      ctx.perspectiveState
   (scope.metric)           └ permalink contract derivable from axis    evalVisibility(perspective-is)
        │                    └ snapshot policy honoured server-side     scope ctx by timeBinding/metric
        ▼                                                                    │
   author → PerspectiveAxis JSON ───────────────────────────────────────────┘
                               (round-trips byte-identical: author = stored = served = rendered)
```

**SSOT at each hop (no drift):**

| Fact | Single home | Everyone else |
|---|---|---|
| The `PerspectiveAxis`/`PerspectiveDef` **shape** | `packages/contracts` (JSON-Schema + TS) | panel imports for the form; api imports for validation; core re-exports/refines for render |
| The **default** perspective | `perspectives[0]` (array order) | nav-sort, permalink elision, ctx-init all read array order — no `default?` field (LOW-1) |
| The **active** perspective id (runtime) | `ctx.perspectiveState[param]` (URL-derived) | visibility, scoping, nav, permalink all read this one slot |
| The **URL surface** (param names/default/elision) | derived from the `PerspectiveAxis` registry (`permalinkParams`) | client URL writes + api-served permalink both derive from it |
| The **measurement** per perspective | `scope.metric` (a MetricDef ref) — perspective-wide; or node `value.type` — node-local override (never both) | KPI/data resolution reads the active scope; the api validates the ref |
| The **snapshot policy** | `perspectiveAxis.snapshot` (`'active'`\|`'all-perspectives'`) | SSR walkers + api export both read it |

**The arrow is respected.** `apps/api` imports `PerspectiveAxis` from `packages/contracts` only (it already imports `ModeDef`/`DatasourceInstanceConfig` from `@statdash/engine` for the manifest, which is structurally a contracts mirror — we make `PerspectiveAxis` a *first-class* contracts type so the api never reaches into core). `packages/core` re-exports the contracts type and adds the renderer-only refinements (`VisibilityExpr`, `TimeRef` are core types — so the *rich* `PerspectiveDef` with `when?: VisibilityExpr` lives in core, while contracts carries the JSON-Schema-validatable structural shape). The two are kept assignable, exactly as `ManifestMode` ⇄ `ModeDef` are today.

> **Contract-layering decision (the one subtlety):** `PerspectiveDef.when?: VisibilityExpr` and `timeBinding: { pick: TimeRef }` reference *core* types. Contracts is zero-dep and cannot import core. **Resolution: contracts carries the structural envelope** (`{ param: string; perspectives: { id; label; scope; when? }[]; snapshot? }` with `when`/`scope` typed as `JsonRecord` at the contract boundary, validated by JSON-Schema) — **core refines** `when` to `VisibilityExpr` and `scope.timeBinding` to `TimeBindingSpec`. This is the identical "renderer-owned blob typed opaque at the wire, refined by the consumer" pattern the manifest already uses for `pages`/`nav`. The api validates structure + ref-existence (it can resolve dim/metric/filter names without needing the `VisibilityExpr` evaluator); the engine validates semantics. No layer imports against the arrow.

---

## 2. Surface 1 — CONSTRUCTOR / PANEL authoring (`apps/panel`)

### 2.1 Field research — how the best builders author views/perspectives/state

| Product | Authoring model | What we steal | What we improve on |
|---|---|---|---|
| **Power BI — Bookmark pane** | A dockable pane lists named bookmarks; each *captures* current visibility/filter/selection state; "Update" re-captures; drag to reorder; bookmarks drive buttons/navigation. | The **dockable named-list pane with reorder** as the page-level IA home; the "active preview" (clicking a bookmark shows that state). | Bookmarks are **captured snapshots** (brittle: re-capture on any change). Our perspectives are **derived from state** (`perspective = f(state)`) — nothing to re-capture, no staleness. This is the core architectural win, surfaced in the UX as "edit the rule, not re-snapshot." |
| **Tableau — Parameters + Dashboard Actions** | A parameter is a typed named value (list/range); "show/hide" and field-swaps are driven by parameter-controlled calc fields + actions. | The **parameter = named axis** mental model; the **value list editor** (ordered options with labels). | Tableau scatters the logic across calc fields + actions (hard to see "what this parameter does"). Our `PerspectiveDef.scope` co-locates *all* per-perspective effects (timeBinding + metric + when) in one authorable object. |
| **Grafana — Dashboard variables** | A variables editor (name, type, query/custom options, default, multi/include-all); panels reference `$var`; repeat-by-variable = trellis. | The **variables-list editor UX** (the closest analogue to a "Perspectives" pane: add/edit/reorder named options with a default). The **repeat-by-variable** is our deferred `facet` door. | Grafana's variable is untyped-effect (just a value; the panel decides what it means). Our perspective carries its *effect* (`scope`) declaratively, so the author sees the consequence. |
| **Superset — Native filters + Tabs** | Native filters in a filter-bar with per-chart scoping; tabs partition a dashboard. | **Filter-scoping** (which charts a filter binds) — our deferred `filters[]` per-perspective scoping; **tabs** ≈ a perspective that shows/hides a node set (`when`). | Superset has no single "this view = these filters + these panels + this measure" object; it's emergent. Ours is one declarative axis. |
| **Looker — Explores/Models** | LookML defines explores (joins, dimensions, measures) in code; the UI consumes them. | The **measure-as-first-class** model → our `scope.metric` (MetricDef) is the LookML-measure analogue. | LookML is code (not non-coder-authorable). Ours is a pick from the registered MetricDefs. |
| **Retool / Appsmith** | Component `Hidden` is a JS-expression binding; named "states"/queries drive UI. | The **show-when condition builder** (Retool's hidden-expression) — already mirrored by our `VisibilityBuilder`. | Retool uses raw JS (`{{ }}`), not non-coder-safe. Ours is the sandboxed declarative `VisibilityExpr` (Law 2). |
| **Framer / Webflow — Variants / Visual states** | A component has named variants; switching a variant restyles; an interaction triggers a variant. | The **named-variant chip row** UX (a clean, minimal "which variant is active" switcher) for the *preview* of the active perspective. | Variants are presentation-only. Ours bind *data scope* (timeBinding/metric), not just style. |

**Convergent best-in-class primitive:** a **named, ordered list of states with a default, each carrying its declarative effect, edited in a dockable pane, with a live preview of the active one.** Power BI's pane IA + Grafana's variables-list editor + Tableau's typed-parameter model + Looker's first-class measure — **none of them unifies all four.** Our `PerspectiveAxis` does: it is the dockable ordered list (Power BI), with a default and reorder (Grafana), each entry carrying its full declarative effect (Tableau parameter + Looker measure) as one object, and `perspective = f(state)` means the preview is always live, never a stale snapshot (beats Power BI's capture model). **This is the meet-and-exceed.**

### 2.2 The "Perspectives" pane — the new page-level authoring surface

**Where it lives in the panel IA.** Today the page root is authored by the generic Inspector via `pageSchemaSource` (`pageSchema()` returns `frame` / `presentation.*` / **`modeOrder`** / `vars`, grouped into Layout / Presentation / **Modes** / Variables — `pageSchemaSource.ts:50-78`). The "Modes" group is the legacy seam. **The Perspectives pane replaces the "Modes" group** with a richer, dedicated page-level pane (the page-root Inspector keeps its generic fields; "Perspectives" becomes a first-class page-level pane, mirroring Power BI's docked Bookmark pane — not a single JSON-array field).

**The pane's structure (the organism):**

```
┌─ Perspectives (page-level pane) ──────────────────────────────┐
│  param: [ perspective        ]   (URL param name; default     │
│                                    'perspective')              │
│  snapshot: ( ● active  ○ all-perspectives )                   │
│                                                                │
│  ┌─ ⠿ year   (default)  [✎] [⋮] ────────────────────────┐    │   ← ordered, drag-reorder
│  │   label:      { ka: 'წლიური', en: 'Year' }            │    │     (perspectives[0] = default,
│  │   timeBinding: ◉ pin a year   ○ from/to window        │    │      shown as a 'default' chip)
│  │       pick:   {$ctx: year}    (cube-profile time ref)  │    │
│  │   metric:     (none — node-local)                      │    │
│  │   when:       perspective-is(year)  [default, editable]│    │
│  └────────────────────────────────────────────────────────┘    │
│  ┌─ ⠿ range            [✎] [⋮] ──────────────────────────┐    │
│  │   label:      { ka: 'დინამიკა', en: 'Range' }          │    │
│  │   timeBinding: ○ pin a year   ◉ from/to window         │    │
│  │       from:   {$ctx: fromYear}   to: {$ctx: toYear}    │    │
│  │   metric:     [ b1g-cagr ▾ ]   (MetricDef picker, R1)  │    │
│  │   when:       perspective-is(range) [default, editable]│    │
│  └────────────────────────────────────────────────────────┘    │
│  [ + Add perspective ]                                          │
│                                                                │
│  ── Preview ──  ( year | range )   ← active-perspective chip   │   ← live preview switcher
│     CanvasView renders with perspectiveState[param]=<chip>     │     (Framer variant-chip UX)
└────────────────────────────────────────────────────────────────┘
```

**Each control maps to an existing panel primitive (no parallel form engine):**

| Pane control | Reuses | Why |
|---|---|---|
| `param` text field | a plain Inspector string field | URL param name (pick-don't-type not needed; it's an identifier) |
| `snapshot` radio | a static-option select (like `frame` in `pageSchemaSource`) | closed 2-value enum |
| perspective list (add/edit/**reorder**/remove) | the **`filterSchemaModel` map⇄node[] adapter pattern** (`filterSchemaModel.ts`) — an ordered `PerspectiveDef[]` with a `key`-like `id`, projected to an orderable list, rebuilt preserving order | identical problem to bars/params: a list needs order + self-contained identity; reuse the proven lossless adapter |
| `label` (LocaleString) | the existing LocaleString field editor | same as every label in the tree |
| `timeBinding` (pin vs window) | a discriminated sub-form: a 2-option toggle + 1-or-2 **cube-profile time refs** (the `YearsField`/`$ctx` picker already in `data-layer/editors/YearsField.tsx`) | the year/from/to refs are exactly the cube-profile-bound time refs the data editors already pick |
| `metric` (scope.metric) | the **MetricDef picker** (semantic-layer R1) — a registry-driven select, *pick-don't-type* | a perspective-wide measurement is a named metric ref; the picker already exists for binding metrics to nodes |
| `when` (per-perspective override) | the **`VisibilityBuilder`** (`features/visibility/`), defaulting to `perspective-is(id)` | the same recursive condition builder; default is the identity gate, editable for the rare override |
| Preview chip row | a `CanvasView` mounted with `perspectiveState[param] = activeChip` (the G3 live-preview seam, `setupCanvasRegistry` + `useLivePreviewStores`) | the canvas already mounts the real renderer; setting one ctx slot drives the live preview — `perspective = f(state)` makes this trivially correct |

**The pane is schema-introspectable (Law 8 — Constructor sees only what's registered).** The pane's *fields* are driven by a `perspectiveSchemaSource` (the same `SchemaSource` port `pageSchemaSource`/`filterParamSchemaSource` implement), so adding a deferred `scope.*` key (e.g. `facet`) = the key gains a PropSchema in the engine perspective-scope registry → the field appears in the pane with zero pane-code edit (OCP). This is how the pane *grows* into the deferred doors without rework.

### 2.3 Replacing `ByModeEditor` — the authoring need, re-homed

The v3 plan **deletes** `ByModeEditor.tsx` + `.test.tsx` + the `DataSpecEditor` branch + the `by-mode` discriminant. `ByModeEditor` let an author write *a different DataSpec per ModeId* (a recursive per-mode data envelope). That need does NOT come back as another DataSpec editor — it **decomposes** into the two seams above:

- **"this node only shows in perspective X"** → author a `when: perspective-is(X)` in the node's `VisibilityBuilder` (already the V4 surface). No new editor.
- **"this node measures differently in perspective X"** → set the perspective's `scope.metric` (perspective-wide, the common case — the whole "range" perspective is CAGR) **or**, for a one-off node, the node's own `value.type` (LOW-2 node-local override). The MetricDef picker + the existing KPI/value editors cover both.

**Coverage-gate consequence (the structural fix #4).** Deleting `by-mode` requires editing `coverage.fitness.test.ts`: remove `'by-mode'` from `DATASPEC_EDITORS` (line 59) and from the `DATASPEC_DISCRIMINANTS` SSOT (`discriminant-manifest.ts:36`) — the `Exact<>` compile assertion forces both to move together (the gate cannot silently drift). **AND** add the new 5th coverage axis:

```
PERSPECTIVE_SCOPE_KEYS enumerated (from the engine perspective-scope registry)
   → each key surfaced (carries a PropSchema rendered in the Perspectives pane) OR allowlisted in COVERAGE_TODO.perspectiveScope
```

`timeBinding` + `metric` surfaced now; `store`/`dims`/`blend`/`facet` allowlisted (roadmap-keyed to multistore-D1 / D3-PLANNER / faceting-door) — a *visible, shrinking* list, exactly like `COVERAGE_TODO.dataSpecs`. This closes the gap that a page-level axis capability has no authorability assertion.

### 2.4 Round-trip (author → JSON → store → render → re-open identical)

The existing `roundtrip-dataspec.fitness.test.ts` (panel) + the engine `FF-VIEW-ROUNDTRIP` must extend to `PerspectiveAxis`:

- **`FF-PERSPECTIVE-ROUNDTRIP` (panel):** a `PerspectiveAxis` authored through the pane → serialized → re-loaded → the pane renders identically (the `filterSchemaModel`-style map/list⇄node adapter is the identity on untouched perspectives; reorder is the only mutation). The deleted `by-mode` round-trip case (`roundtrip-dataspec.fitness.test.ts:120,131-132,170`) is removed in the same change.
- **`FF-VIEW-ROUNDTRIP` (engine, already in the v3 suite):** the JSON survives `JSON.parse(JSON.stringify())`.
- The two together prove author = stored = rendered (the §1 data-flow invariant).

---

## 3. Surface 2 — API provisioning / serve / validate (`apps/api` + `packages/contracts`)

### 3.1 Storage contract

- **Page-scoped `PerspectiveAxis`** lives in the page config JSON (`config.page_version.config`), as a sibling of `filterSchema`/`children`/`modeOrder` — stored **verbatim** (the api is a pass-through for renderer-owned config; it does NOT own the inner shape, exactly as it does not own `children`). No new table, no new column — it rides the existing `page_version.config` blob. This is the 12-factor / SSOT-correct home: one config blob per page version, the perspective axis is part of it.
- **The shape's SSOT is `packages/contracts`** (§1): a JSON-Schema fragment `perspective-axis.schema.json` (referenced by `page-config.schema.json` where `modeOrder` is today, lines 169/253/337) + the structural TS mirror. The api validates against the JSON-Schema; the engine refines to the rich TS type.
- **The site-scoped `modes` surface is repurposed, not deleted (the missed-surface resolution).** `SiteManifestContract.modes` + `site_config.modes` are *site-wide registered mode descriptors* (label/icon/dataKey) — the wire mirror of `modeRegistry`/`perspectiveRegistry`. Under the reframe these become **the site-wide registered perspective *kinds*** (the label/icon for `year`/`range`/`compare` that every page's `PerspectiveDef` references by id). Rename in contracts: `ManifestMode` → `ManifestPerspectiveKind` (Postel-aliased — keep `modes` readable as a deprecated alias until the runner migrates), `site_config.modes` → `site_config.perspective_kinds`. **The page-level axis (which perspectives this page exposes, in what order, with what scope) is page config; the site-level kinds (the shared label/icon vocabulary) stay in the manifest.** This is the clean separation the engine plan's page-only view missed.

### 3.2 Validation-on-save / fitness (the perspective contract)

Extend the existing config↔cube fitness (`config-cube-contract.fitness.test.ts`) — which already walks every page config asserting *referenced data exists + is pinned* — with a **perspective-contract guard**. It runs on the same committed artifact and (as a route) on save:

| Check | Asserts | Class of defect killed |
|---|---|---|
| **FF-PERSPECTIVE-REFS-EXIST** | every `PerspectiveDef.scope.timeBinding.dim` is a real dimension of the page's cube (reuses the DSD the existing fitness already builds); every `scope.metric` is a registered `MetricDef`; every `when`/`filters[].ref` references a real dim/filter/perspective param | an axis that scopes a non-existent dim, or names an unregistered metric → renders wrong/empty (the same silent-wrongness class the config↔cube gate exists to kill) |
| **FF-NO-ORPHAN-PERSPECTIVE** | every `when: perspective-is(X)` in the page references an `X` declared in the page's `PerspectiveAxis.perspectives[]`; no perspective id is declared but referenced by no node and carries no scope (dead axis member) | a node gated on a perspective that doesn't exist (permanently invisible) — a silent authoring error |
| **FF-NO-PER-VIEW-DUPLICATION (server)** | the §3.2-LOW-2 rule, validated server-side: no node both inherits a `scope.metric` AND re-declares the same measurement via `value.type` | the dual-encoding smell the reframe exists to kill, caught at provision before it ships |
| **FF-PERMALINK-FROM-REGISTRY (server)** | the canonical URL params/default/elision are reproducible from the served `PerspectiveAxis` alone; `perspectives[0]` elides; round-trips losslessly | a permalink that can't be regenerated from served config → Law-9 hole |
| **FF-DEFAULT-IS-FIRST** | `perspectives.length >= 1`; no separate `default?` field (LOW-1 — one SSOT: array order) | two-SSOT default drift |

The guard is **generic over datasets/dims** (Law 1 — like the existing config↔cube gate, hardcoded to nothing about year/range). A new page with a new axis is covered the moment it declares `perspectiveAxis`.

### 3.3 Serve / bootstrap (DB → manifest → front)

- **The `PerspectiveAxis` flows as part of `pages[id]`** in `GET /api/bootstrap` (it is in the page config blob, served verbatim — `bootstrap/index.ts` step 3 `migratePageConfig` → `pages[id]`). **No new manifest field for the page axis** — it rides the page blob (correct: it is page-scoped config, and the manifest already treats page config as an opaque renderer-owned blob).
- **The site-scoped `perspective_kinds`** (the renamed `modes`) continue to be a top-level manifest field (`bootstrap/index.ts:269`), served from `site_config` — the shared label/icon vocabulary.
- **Permalink-from-registry as a SERVED guarantee.** Because the served `pages[id].perspectiveAxis` fully describes the URL surface (param names, `perspectives[0]` default, elision rule, `snapshot` policy), the **permalink contract is reproducible from what the server ships** — not invented by the client. Concretely: a `permalinkParams(perspectiveAxis, perspectiveState)` util (built in engine P4) is *fed by served config*; the api guarantees (via FF-PERMALINK-FROM-REGISTRY at provision) that every served axis yields a lossless, default-eliding permalink. Law 9 becomes a property of the served artifact.
- **Snapshot policy honoured server-side.** `perspectiveAxis.snapshot` is served; the SSR/export path (`apps/api` export surface + the engine SSR walkers, P-opt) reads it: `'active'` renders the active perspective (URL-determined); `'all-perspectives'` unions all perspectives for a self-contained bulletin/PDF (Law-9 completeness for offline artifacts). One served knob, two consumers (client SSR + server export), no second source.
- **Migration / forward-compat (already handled):** `migratePageConfig` is the lazy-migration seam (`bootstrap/index.ts:238`); the legacy `modeOrder`→`perspectiveAxis` desugar (engine P4) runs inside it, so un-migrated stored pages serve a derived axis (Strangler — old configs keep rendering). The schemaVersion forward-compat (skip-with-log) already protects the manifest read.

### 3.4 The api-side deletion / migration set (the surfaces the engine plan missed)

| # | Site | Disposition |
|---|---|---|
| A1 | `packages/contracts/src/manifest.ts:27,70` `ManifestMode` / `modes` | rename → `ManifestPerspectiveKind` / `perspectiveKinds`; Postel-alias `modes` readable until the runner migrates (expand-contract) |
| A2 | `apps/api/.../bootstrap/index.ts:94,269,DEFAULT_MODES` `site_config.modes` read | read `perspective_kinds` (fallback to `modes` — Postel); rename the `site_config` key in a versioned data migration |
| A3 | `packages/contracts/schema/page-config.schema.json:169,253,337` `modeOrder` (3 page-defs) | replace with `$ref: perspective-axis.schema.json` (NEW contracts JSON-Schema fragment) |
| A4 | `page-config.schema.json:436-451` `node_mode-bar__default` (the `mode-bar` node schema) | delete (the `mode-bar` node is deleted in engine P6); the axis is page-level, not a node |
| A5 | `config-cube-contract.fitness.test.ts` | extend with the §3.2 perspective-contract checks (same artifact walk) |
| A6 | `bootstrap-parity.fitness.test.ts` | extend: the manifest's `perspectiveKinds` + each page's served `perspectiveAxis` round-trip the DB→manifest projection |

> **Why these matter:** the engine plan's §4 enumerated 8 engine + 6 react + Constructor + 3 schema page-defs + provisioning JSON — but **not** the contracts `ManifestMode`/`modes` site surface, the `mode-bar` node schema, or the bootstrap serve path. A P-implementer following the engine plan alone would leave a live `modes` manifest field + a `mode-bar` node schema orphaned. This table closes that gap.

---

## 4. The site-scoped vs page-scoped split (the coherence subtlety, named)

The single most important full-stack insight the page-only engine view obscured:

- **Site-scoped** = *what perspective KINDS exist as a shared vocabulary* (id → label/icon/dataKey). Home: `site_config.perspective_kinds` → `SiteManifestContract.perspectiveKinds` → `perspectiveRegistry` (the engine singleton). This is the `modeRegistry` content today. It is the **registry** (Grafana `variableAdapters` analogue): a kind registers once, site-wide.
- **Page-scoped** = *which perspectives THIS page exposes, in what order, with what scope/when*. Home: `page.perspectiveAxis` (page config blob). This is the **instance** of the axis on a page.

A `PerspectiveDef.id` (page-scoped) references a registered kind (site-scoped) for its label/icon — exactly as a node `type` references a registered node kind. **This is the same registry↔instance split the whole platform already uses** (nodeRegistry ↔ page children; param-schema-registry ↔ filterSchema). Modelling it consistently means: the Perspectives pane's "kind" picker is *pick-don't-type from the registered kinds* (Law 8), and the api validates a page's perspective ids against the site's registered kinds. No new pattern — the existing registry discipline, applied to the axis.

---

## 5. Full-stack Strangler-Fig phase map

Each phase additive + fitness-locked + non-breaking across **panel + api + engine**. Extends the engine-plan phases (P0…P-final) with the panel/api work folded in per phase. "No phase leaves any of the three surfaces un-typecheckable" (the expand-contract ordering, HIGH-2, now spans contracts→api too).

| Phase | Engine (core/react) | Contracts + API | Panel (Constructor) | Gate |
|---|---|---|---|---|
| **P0** types + ADR + registry alias | `perspective-axis.ts` types; `modeRegistry`→`perspectiveRegistry` alias | **NEW `packages/contracts/.../perspective-axis.schema.json` + TS mirror** (the SSOT shape); `ManifestMode`→`ManifestPerspectiveKind` *alias* (additive) | — | typechecks; `perspectiveRegistry===modeRegistry`; FF-VIEW-SCOPE-DECLARATIVE + FF-VIEW-ROUNDTRIP stubs |
| **P-opt** ‖ perspective-aware SSR walkers | thread active id into walkers; `snapshot` knob | api export path reads `snapshot` | — | FF-SSR-WALKER-VIEW-AWARE |
| **P1** state slot + RELAX | `ctx.perspectiveState`; scope-ctx step; relax `ContextMapping.timeMode?` | — | — | FF-ONE-VIEW-NO-MACHINERY; FF-PERSPECTIVE-IS-PURE-FUNCTION |
| **P2** perspective-is ops + SSOT | `perspective-is/-in/-not` ops reading `perspectiveState[param]`; rewire all 6 mode-reading sites | — | **register `perspective-*` leaf schemas** → they auto-appear in `VisibilityBuilder` (OCP); migrate `mode-*` op labels (`VisibilityBuilder.tsx:35`, `visibilityFactory.ts:16,37-39`) to perspective; Postel-keep `mode-*` until P6 | FF-VIEW-AXIS-GENERIC; coverage gate still green (perspective ops surfaced) |
| **P3** delete `by-mode` (dead) | engine member/resolver/schema/catalog/manifest/metric-store | `page-config.schema.json` by-mode const | **delete `ByModeEditor`+test+export+`DataSpecEditor` branch; edit `coverage.fitness.test.ts` (`DATASPEC_EDITORS`/`COVERAGE_TODO`); `discriminant-manifest.ts:36`** | FF-NO-BYMODE-REMNANT (grep-zero across all 3 surfaces) |
| **P4** axis parser + legacy desugar + permalink + **coverage axis** | read `page.perspectiveAxis`; derive from legacy when absent; `permalinkParams` util; nav-sort by `perspectives[]` | **`config-cube-contract` perspective-contract checks (§3.2); FF-PERMALINK-FROM-REGISTRY server-side** | **NEW `perspectiveSchemaSource` + the 5th coverage axis `PERSPECTIVE_SCOPE_KEYS` (timeBinding/metric surfaced, rest allowlisted)** | FF-PERMALINK-FROM-REGISTRY; FF-PERSPECTIVE-REFS-EXIST; FF-NO-ORPHAN-PERSPECTIVE |
| **P5** migrate the 3 pages | — | **migrate `geostat.provisioning.json` 3 pages → `perspectiveAxis`; update `page-config.schema.json` 3 page-defs (`modeOrder`→`$ref perspective-axis`); delete `node_mode-bar` schema; `config-cube` + `bootstrap-parity` green** | — | FF-SNAPSHOT-VIEW-EQUIV (row-identical per perspective, all 3 pages) |
| **P6** delete System A | gate/`alwaysResolve`/`ctx.timeMode`/`KpiSpec.mode`/`applyEffects`/`mode-bar` handling/`mode-*` aliases | **`SiteManifestContract.modes` alias removed (runner migrated); `site_config.modes`→`perspective_kinds` data migration; `DEFAULT_MODES`→`DEFAULT_PERSPECTIVE_KINDS`** | remove `mode-*` op labels; remove `modeOrder` from `pageSchemaSource` (replaced by the Perspectives pane) | full suite green; FF-NO-BYMODE-REMNANT + no `mode`/`modeOrder`/`modes` remnant |
| **P-final** Constructor Perspectives pane | — | — | **the §2.2 page-level Perspectives pane** (the positive replacement for the deleted `ByModeEditor` authoring need); FF-PERSPECTIVE-ROUNDTRIP | FF-PERSPECTIVE-ROUNDTRIP (panel author⇄JSON⇄render) |

**Phase dependency:** P0→P1→P2 sequential. P3 anytime after P0. P4 needs P1+P2. P5 needs P4. P6 needs P5 + green. P-opt ‖ after P2. **P-final after P5** (needs the served axis + permalink). The panel P2 op-registration and P-final pane are the only net-new panel organisms; everything else is registration into existing seams.

---

## 6. The v3 residual — RESOLVED (`scope.metric` as registered MetricDef)

The v3 plan left one item for the user: are the range-perspective measurements (CAGR/share) registered `MetricDef`s (`scope.metric`, perspective-wide) or node-local `value.type`? Resolved here in the full-stack + semantic-layer + authoring context:

**Canonical = `scope.metric` (a registered `MetricDef` ref). Node-local `value.type` survives ONLY as the single-node override (LOW-2), never dual-encoded.** Three full-stack reasons decide it:

1. **Authorability (panel).** `scope.metric` is a *pick* from the registered MetricDefs — the picker already exists (semantic-layer R1), it is Law-2-clean (a ref, not authored measurement logic), and it co-locates the perspective's effect in one object the pane shows. A node-local `value.type` is authored per-node, scattering "what range means" across N nodes — the exact duplication the reframe kills. **Perspective-wide measurement → perspective-wide ref.**
2. **Validatability (api).** A `MetricDef` ref resolves against the registry → `FF-PERSPECTIVE-REFS-EXIST` can prove it on save. A node-local measurement is opaque to the api (it can't validate "is this CAGR correct"). Server-side contract enforcement *requires* the named-metric form.
3. **Permalink/snapshot coherence (end-to-end).** A perspective whose measurement is one named metric is a clean, regenerable unit; `'all-perspectives'` snapshot + permalink derivation both reason over `scope.metric` uniformly. Node-local measurements would have to be walked per-node to reconstruct what each perspective renders — leaky.

**The rule (FF-NO-PER-VIEW-DUPLICATION, dual-encoding guard, enforced panel + api):** a measurement difference is authored in exactly one place — `scope.metric` (perspective-wide default) **or** the node's `value.type` (single-node override of that default), **never both for the same node.** *Lean confirmed:* register-as-metric where the whole perspective shares it (the common case — the whole "range" perspective is CAGR); node-local only for a genuine one-off node that differs from its perspective's default.

**One residual the user must confirm (narrowed):** if any current range measurement is NOT yet a registered `MetricDef`, P5 either (a) **registers it as a MetricDef first** (preferred — perspective-wide, validatable, authorable) or (b) keeps that one node's measurement node-local (LOW-2 allows it; the FF forbids only *dual* encoding). The full-stack analysis makes (a) the strong default — the only open question is whether every CAGR/share the 3 geostat pages use is already a named metric in the shipped R1 registry, or whether P5 must register a few. *This is a data-inventory check, not an architecture decision.*

---

## 7. Competitor benchmark + foresight

The competitive meet-and-exceed table (Power BI / Tableau / Looker / Superset / Grafana / Retool vs the perspective axis) and the deferred-doors zero-rework foresight table (facet / scope.store / scope.blend / 2nd-axis composition + the flagged `'all-perspectives'` cross-product caveat) are extracted as a sibling concern: **`VISION-mode-as-perspective-axis.v3-FULLSTACK-BENCHMARK.md`**. Headline: no competitor unifies derived-not-captured + declarative data-scope-in-one-object + non-coder-authorable + generated/served permalink + server-side contract validation + N=1-free + registry↔instance split; the perspective axis is the union of their strengths because it is one declarative contract authored/validated/served/rendered through one SSOT. Every deferred door is an additive optional `scope.*` key (or a sibling axis) → constant, not linear, cost for the Nth axis (the generic `Record` container + registry↔instance split pre-empt the per-axis privileged-field debt).

---

## 8. Verdict — the FULL picture is complete and ready to implement

**COMPLETE across all three surfaces, end-to-end coherent, competitor-beating, future-proof.**

- **One contract** (`packages/contracts` JSON-Schema + TS mirror; core refines `when`/`scope`; api validates structure+refs; runner mirrors as `perspectiveKinds`) — no per-surface re-definition, the arrow respected.
- **Author** (panel): the per-node `when` → existing `VisibilityBuilder` (register `perspective-*` ops, OCP); `scope.metric` → existing MetricDef picker; ONE new page-level **Perspectives pane** (Power BI pane IA + Grafana variables-list + Tableau-parameter + Looker-measure, unified; `perspective = f(state)` makes the preview always-live, beating capture-based bookmarks). The `ByModeEditor` need decomposes into these — no replacement DataSpec editor. The coverage gate gains a **5th axis** so the axis capability is registered-and-asserted (Law 8).
- **Validate + serve** (api): the config↔cube fitness extended with the perspective-contract (refs-exist / no-orphan / no-dup / permalink-from-registry / default-is-first); the `PerspectiveAxis` served verbatim in `pages[id]`; the site-scoped `modes`→`perspectiveKinds` repurposed (the missed surface, resolved); permalink + snapshot a **served** guarantee (Law 9 as an artifact property).
- **Render** (engine): exactly the v3 plan.
- **Full-stack Strangler map** (§5): every phase additive + fitness-locked + non-breaking across panel+api+engine; the expand-contract ordering now spans contracts→api (the `ManifestMode` alias, the `site_config` data migration) so no surface is ever un-typecheckable.
- **Residual resolved** (§6): `scope.metric` (registered MetricDef) is canonical — authorable + validatable + permalink-coherent; node-local `value.type` is the single-node override only.

**The two genuinely-new full-stack findings the engine-only plan missed, now closed:** (1) the **site-scoped `SiteManifestContract.modes` + `site_config.modes` + bootstrap serve path** (repurposed to `perspectiveKinds`, the registry half of the registry↔instance split, §3.4/§4); (2) the **Constructor coverage gate's missing axis dimension** (the 5th `PERSPECTIVE_SCOPE_KEYS` coverage axis, §2.3). A P-implementer following the engine plan alone would have orphaned both.

**Final residual for the user (one, narrowed to a data check):** confirm whether every CAGR/share measurement the 3 geostat pages currently use is already a registered `MetricDef` in the shipped R1 semantic-layer registry. If yes, P5 maps each range perspective to `scope.metric` directly. If a few are not yet named metrics, P5 registers them first (preferred) or keeps those specific nodes node-local via `value.type` (LOW-2 permits it). This is a provisioning data-inventory step, not an architecture decision — everything architectural is decided and ground-truth-verified.

*Vision #3 FULL-STACK — the complete implementable picture. On your nod: P0 begins (engine types + contracts JSON-Schema/TS mirror + `ManifestPerspectiveKind` alias + ADR), in parallel with P-opt (perspective-aware SSR walkers). The panel op-registration (P2) and the Perspectives pane (P-final) are the only net-new panel organisms; everything else is registration into the existing Visibility / Metric / SchemaSource / config↔cube seams.*
