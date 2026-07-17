---
name: constructor-state
description: Current architecture of the Constructor (apps/panel) — the generic Inspector/SchemaSource seam, the registry pattern every authoring surface repeats, the Coverage Fitness gate, byte-identical invariants, and the standing gotchas that apply to any NEW authoring slice
metadata:
  type: project
---

Consolidated from the versioned build log (M2, C1/C2, V0–V7, Pfinal) of the Constructor MVP in
`apps/panel`. Git holds the phase-by-phase history; this is the durable shape + the gotchas that
recur on every new authoring slice.

## Architecture

**One generic `<Inspector>` serves every editor surface (OCP).** It consumes a `SchemaSource` port
(`getSchema(node) → PropSchema`) — new capability = new SchemaSource, Inspector itself never
changes. Sources registered so far, all mirroring the same shape: `nodeSchemaSource` (default,
`nodeRegistry.getSchema`), `chromeSchemaSource` (chrome slots), `transformStepSchemaSource`,
`filterParamSchemaSource`, `rowSpecSchemaSource`, `visibilityLeafSchemaSource`, `pageSchemaSource`
(page-root `PageConfigBase`), `perspectiveDefSchemaSource`/`perspectiveScopeSchemaSource`. Every
editor models its target as a `CanvasNode {type, props}` and writes back through `setAtPath`
(`inspector/showWhen`) — never a bespoke reducer.

**PropSchema vocabulary lives in `packages/core`** (`config/prop-schema.ts`), not react — a
TransformStep op is defined in core and the arrow forbids core→react. `packages/react/src/engine/
slice-meta.ts` re-exports it (needs BOTH `export type {X}` and `import type {X}` in the same file or
tsup DTS fails "Cannot find name X") so the ~73 `@statdash/react/engine` import sites stay
byte-identical.

**The registry pattern, repeated identically one rung at a time (op → param → rowspec → visibility
→ perspective-scope):** a discriminant-keyed registry in `packages/core/src/config/*-schemas.ts`
carries an authoring `PropSchema` per member; the registry is schema-ONLY (no handler — behavior/
render stays in react/plugins, the arrow forbids core owning it). `packages/core/src/index.ts`
side-effect-imports the schema file. Two variants: **single-shape** registries key on ONE constant
(`ROW_SPEC_KEY`) since the type isn't a union; **union** registries key on the discriminant
(`op`, `type`). Perspective scope and page `presentation.*` go one step further and
**auto-surface via registry enumeration** — `listPerspectiveScopeKeys()` / `listPresentationProjectors()`
are unioned and re-prefixed to dot-paths (`scope.*` / `presentation.*`) so a newly-registered
scope key or projector needs ZERO Inspector-side edit (Law 8).

**Coverage Fitness #1** (`apps/panel/src/features/data-layer/coverage.fitness.test.ts`) is the
north-star gate: it enumerates every discriminant from the ENGINE SSOT (`listTransformOps()`
runtime registry; `DATASPEC_DISCRIMINANTS`/`PARAMDEF_TYPES`/`VISIBILITY_OPS` — compile-time-exhaustive
tuples in `packages/core/src/config/discriminant-manifest.ts` via an `Exact<tuple,union>` type
assertion, so adding a union member without updating the tuple is a TYPE ERROR) and asserts each
member is authorable OR explicitly listed in `COVERAGE_TODO` (a surfaced-AND-allowlisted member also
fails — keeps the gap list honest). Current state: every category is EMPTY except two PERMANENT
entries — `transformOps.joinByField` (carries resolved `EngineRow[]`, not declaratively authorable)
and `dataSpecs.custom` (a code-resolver ref, JSON-only by design).

**Byte-identical mandate.** Every new authoring surface (drag-to-bind field wells, Cmd-K insert,
templates) must emit config IDENTICAL to what the pre-existing typed editor / hand-authored config
would produce — the UX is the improvement, never the output shape. Proven by fitness tests, not
convention: `canvasPageAdapter.test.ts` (`fromNodePageConfig(toNodePageConfig(x)) ≡ x` — the master
round-trip invariant every editor must keep green), `binding.test.ts` (field-wells chip→config ===
typed-editor output), `command/insertByteIdentity.fitness.test.ts` (palette-drop path === Cmd-K path
for every registered type), `templates.fitness.test.ts` (starters/generated pages pass
`validateConfig`+round-trip+`validatePageForSave`).

**Insert/move engine SSOT** (`store/constructor.pages.ts` `insertNodePatch`/`moveNodePatch` +
`canvas/insertNode.ts` `makeNode`/`nestAccepts`) is the ONE path every surface (palette drop, Outline
drag, Cmd-K, slash) mutates the flat store through. Container addressing: `parentId===pageId` ⇒ page
`nodeIds`, else ⇒ `node.childIds`. `moveNodePatch` refuses self/descendant nesting.

**Field-wells / Show-Me (Tableau pattern, `features/data-layer/fieldwells/` + `showme/`):**
`binding.ts` writes are the byte-identical HEART — `bindEncoding` writes a **bare string**
(`{...enc,[channel]:code}`), never a `ChannelDef`, or it diverges from `EncodingEditor.setChannel`.
Drag (dnd-kit) and pick→click both funnel through ONE `applyBind` (click-to-arm then click-target is
the keyboard/WCAG equivalent of drag).

**Templates/generate (`features/templates/`):** the gate a template must survive is the save-guard's
PER-NODE REQUIRED-field check (`save/saveGuard.ts` Check 3a), not just structural `validateConfig` —
`createPage` runs `assertSaveable` before the server write. Consequence: starters avoid
map/geograph/kpi-strip (their required fields — geoJsonUrl, kpi items — can't ship blank) and carry
NO `data` (author binds later via Show-Me, not fabricated codes). The data-first generator maps every
suggestion to a `chart` (chartType is its only required field) even for map/kpi-strip-shaped
suggestions.

**Page Inspector (`features/page-config/`):** authors `PageConfigBase` via the SAME generic
Inspector; `presentation.*` is registry-derived (not hand-listed). The page-root `type` (kind) is
not yet AUTHORED in the UI, but as of the AR-49 foundation fix it is CARRIED first-class and
losslessly — see [[project_panel_per_page_type]]. (Superseded: the adapter no longer hardwires
`inner-page` or discards the page `type`; `CanvasPage.type` is a required column and every
creation path sets it. `PageMeta` still excludes `type` — type is node-structural, from the page-
node union, never `PageConfigBase` — so `type` never double-sources into meta.)

**Perspectives pane (`features/perspectives/`):** `PerspectivesByParam` record⇄ordered-list adapter
(`perspectiveModel.ts`, mirrors `filterSchemaModel.ts`); `perspectives[0]` IS the default (one SSOT —
reorder changes the default). `when`/`available` are authored via the recursive `VisibilityBuilder`,
not scalar schema fields. **Live-canvas preview of the active perspective is NOT wired** — `CanvasView`
has no `perspectiveState` prop; the pane's preview chip-row is local-state-only. Wiring it needs a
`CanvasView → NodePageRenderer perspectiveState` seam (escalated, not forced).

**Methodology / data-integrity fieldset:** a SHARED PropSchema fragment
(`packages/plugins/panels/dataIntegritySchema.ts`) is spread into each data-panel's own schema
(ISP — layout nodes get no badge; NOT a NodeBase widen). Section `methodology.{note,source,
lastUpdated}` stays plain `string` (not LocaleString) to match the existing render-side data model
(byte-identity over the prompt's literal ask).

**Outline + Cmd-K (`outline/`, `command/`):** Outline is `role=tree`/`role=treeitem` (dnd `attributes`/
`listeners` spread FIRST, then role/tabIndex/aria override — reverse order is a TS2783 dup-prop
error). Cmd-K uses the `cmdk` dep (`Command.Dialog/Input/List/Group/Item/Empty`); a leading `/` in
the input narrows to insert-only (the "slash" feature, folded into the palette rather than a separate
inline editor).

## Standing gotchas (apply to ANY future Constructor authoring slice)

- **React Compiler / lint hard-errors, not style nits.** `useEffect`+`setState` to resync a controlled
  value is a HARD lint error ("Calling setState synchronously within an effect can trigger cascading
  renders") — use the render-time-reconcile pattern instead (`JsonDataField`'s `syncedJson`: track the
  canonical JSON of the last synced value in state; when the incoming value's canonical form differs,
  that's an OUTSIDE change and resets the draft; the user's own invalid-mid-typing draft is never
  clobbered because it's never emitted). Also drop a `useCallback` that trips "Compilation Skipped:
  existing memoization could not be preserved" — a plain inline fn lets the compiler memoize it.
- **MUI `<Select>` is not a native `<select>`** — tests must `mouseDown` then click the option, not
  `fireEvent.change`. `EnumRefField`'s native `<select>` DOES support `fireEvent.change`. Know which
  one you're driving.
- **`no-tenant-content.fitness` ALLOW-listing is REQUIRED for new bilingual authoring catalogs.**
  `packages/plugins/**/meta.ts` / `**/*Node.ts` are auto-exempt (catalog-class pattern match); a NEW
  bilingual catalog in `packages/core/src/config/*-schemas.ts` is NOT auto-exempt and needs an
  explicit entry in BOTH `ops/scripts/check-laws.sh` (`LAW4_CATALOG_ALLOW`) and
  `platform/tests/no-tenant-content.fitness.test.ts` (`ALLOW`). See [[project_i18n_label_and_law4_placement]].
- **Remount-to-reseed via `key={id ?? 'new'}`**, not `setState`-in-effect, when a form must reset on
  selection change.
- **`registerMigration` note:** irrelevant to Constructor editors directly but the round-trip fitness
  suite shares the migration chain — see the color/variant migrators in `../react-specialist/`
  memory if touching schema version bumps.

**Page-root `type` is DELIBERATELY not authored** — `canvasPageAdapter` hardwires the root to `inner-page` and strips `type` from meta to preserve the "meta-less page → no spurious meta" round-trip invariant (reconciled from twin).
