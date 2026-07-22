---
name: panel-substrate-presets
description: "ADR-049/050 substrate program — P2a un-bury (workbench kind-agnostic, band-item visibility, TrendField), P2b/R2 composed-preset primitive (presetRegistry), R3 skeleton restoration (page-kind gallery, starters-as-declarations). Consolidated distillate."
metadata:
  type: project
---

> Consolidated 2026-07-22 from 3 sibling files (p2a-substrate-unbury, composed-preset-primitive,
> skeleton-restore-r3). All still-current mechanism; extends ADR-038/041, no fifth grammar.

## P2a — three independent un-bury lanes
Each an additive FF ratchet, no engine object-model change.
- **DataWorkbench is KIND-AGNOSTIC.** `DataFacetField.tsx` `canWorkbench = !!escalation` (not
  gated on `spec.type`). `adoptOnOpen(spec)` (`dataFacetModel.ts`) adopts a bound spec of ANY
  kind intact; only `!spec` seeds a fresh pipeline. A kind the workbench can't shape shows a
  `MetricPalette` bind (converts to governed pipeline) instead of a dead room.
- **Band-item visibility** (kpi-strip only) — item `when` field type `object`→`'visibility'`
  dispatches to the existing `VisibilityField`/`VisibilityBuilder`. featured-slider items have NO
  `when` field.
- **TrendField** (genuinely new PropFieldType `'trend'`) — a discriminant selector
  (yoy/cagr/share/static/none) + the chosen variant's PropSchema through the generic Inspector
  (governed measure = enum-ref source:metrics).
- **Adding a PropFieldType has TWO forced consumers:** `PropSchemaForm.tsx` `FIELD_RENDERERS`
  (tsc-exhaustive) and `propSchemaToJsonSchema.ts` `typeDescriptor` (else the save-guard rejects
  an authored object). Changing an item field off object/array also requires regenerating
  `packages/contracts/schema/page-config.schema.json` (`pnpm gen:schema`) or
  `page-config-schema.fitness` drifts.

## P2b/R2 — the composed-preset primitive ("pick a whole, then tweak")
- `packages/react/src/engine/PresetRegistry.ts` — engine-resident, app-agnostic. `PresetDecl
  {id, label, icon?, category?, caps?, seed}` + recursive pure `NodeSeed {type, variant?, props?,
  data?, view?, children?}`. Sibling of `objectRegistry`, NOT a field on ObjectMeta.
- `apps/panel/src/canvas/insertNode.ts` `planPresetInserts` overlays `makeNode` recursively
  (props merged with seed.props; view merged not clobbered); childIds left EMPTY on every built
  node — parent↔child expressed only via each op's `parentId` (mirrors `planInserts`).
- Content = shell-registered (`apps/panel/src/canvas/canvasPresets.ts`, domain ids live above the
  arrow). Palette renders a `starters` band ahead of tiles.
- **Birth-defaults SSOT (root-cause of a real crash, 0102):** `planPresetInserts` applies
  `getDefaults(type)` recursively to every seed node. A node type whose render REQUIRES a field
  MUST seed it in `META.defaults` — that's the rule every creation path (palette drop, preset,
  hand-author) reads. (A chart with no `defaults.chartType` threw on `resolveChartType`'s
  unguarded `.$ctx` read once bound; fixed by declaring `defaults:{chartType:'bar',...}` on the
  chart meta.)
- **Gotcha:** a kpi-strip preset binds `items[].value.measure` PER-ITEM, never `node.data` — a
  stray `node.data` bind reroutes every sibling KPI through the wrong store.

## R3 — skeleton restoration (page-kind gallery + starters-as-declarations)
**Root-cause fact (settles recurring confusion):** `packages/react/src/engine/skeletonRegistry.ts`
is the Suspense LOADING-FALLBACK registry (Grafana panel-loading), NOT a page-template home. Page
KINDS live in `objectRegistry` (`sliceType:'page'`); page STARTERS live in `presetRegistry`.
- `objectRegistry.listByKind('page')` → inner-page/default, container-page/default,
  container-page/**landing** (a VARIANT), tab-page/default. `createPage({type, variant?})` uses
  the chosen entry.
- `CanvasPage.variant?` — new, symmetric to `CanvasNode.variant`, carried through the adapter only
  when present (byte-identical for default-variant pages).
- `features/templates/pageStarters.ts` = `PAGE_STARTERS: PresetDecl[]` (seed.type = a page kind);
  `isPageStarter` = `objectRegistry.has('page', seed.type)` — a GENERIC discriminator, no id list.
  Element palette excludes page-kind seeds via the same check.
- **Create-id lifecycle (settled):** two distinct ids — page IDENTITY (server-owned, from
  `POST /pages`) vs config ROOT-NODE id (must be non-empty, a node id like every child). Fix:
  `createPage` mints a provisional non-empty root id from the ONE node-id factory
  `canvas/nodeId.ts::newNodeId()`, used for both the save-guard check and `toApiPage`; server
  identity replaces it in storage. `toNodePageConfig` always emits `id: page.id` (faithful
  bijection, no omit-when-empty band-aid). **Known latent edge:** the create-version's persisted
  config carries the provisional id until first save reconciles it — `fromApiPage` derives
  `CanvasPage.id` from `config.root.id`, not `row.id`, so open-before-first-save could key under
  the provisional id. Self-heals on first save; not fixed.
- **Retype = FORK, not built** — changing an existing page's kind re-slots content across
  differing slot contracts (its own future slice).
