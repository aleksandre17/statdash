---
name: project-panel-skeleton-restore-r3
description: ADR-050 R3 — page-kind gallery + starters-as-declarations; SkeletonRegistry is NOT the template home; page-root variant round-trip
metadata:
  type: project
---

ADR-050 R3 (skeleton restoration) — SKELETON = registered page-KIND × page-level PresetDecl.

**SkeletonRegistry root-cause (settles a recurring confusion):** `packages/react/src/engine/skeletonRegistry.ts` is the Suspense **loading-fallback** registry (Grafana panel-loading; `type::variant → SkeletonFn(node,ctx)=>ReactNode`). It is NOT a page-template/skeleton home. Page KINDS live in `objectRegistry` (fed by `registerSlice`, `sliceType:'page'`); page STARTERS live in R2's `presetRegistry`.

**Page-kind gallery:** `objectRegistry.listByKind('page')` → 4 entries: inner-page/default, container-page/default, container-page/**landing** (a VARIANT), tab-page/default. `PageBrowser.tsx` create form projects them as a radiogroup; `createPage({type, variant?})` uses the chosen entry — hardcoded `DEFAULT_PAGE_TYPE` REMOVED from the create path (still exists in `canvasPageAdapter.ts` as the kind-less-inbound round-trip backstop — legitimate, "not the sole path").

**Page-root variant round-trip (new):** landing is `container-page` + `variant:'landing'` — previously UNREPRESENTABLE (CanvasPage had no variant; to/fromNodePageConfig dropped it). Added `CanvasPage.variant?` (symmetric to CanvasNode.variant), `'variant'` in `PAGE_STRUCTURAL_KEYS`, emit/read in the adapter. Carried only when present ⇒ default-variant pages byte-identical to pre-R3.

**Starters-as-declarations:** `starterTemplates.ts` fixture DELETED. New `features/templates/pageStarters.ts` = `PAGE_STARTERS: PresetDecl[]` (seed.type = a page kind), `registerPageStarters()` (called in `setupCanvasRegistry`), `pageStarterList()` = `presetRegistry.list().filter(isPageStarter)`, `isPageStarter` = `objectRegistry.has('page', seed.type)` (GENERIC discriminator, no id list), `seedToPageConfig(seed)` (page-root peer of buildSeedInserts; flat node-body props; deterministic pre-order ids `${id}-${i}`). `TemplateGallery.tsx` reads `pageStarterList()` not the fixture. Element palette (`NodePalette.tsx` Starters band) EXCLUDES page-kind seeds via the same `objectRegistry.has('page',…)` check (page-roots are rootOnly so `acceptsInSelection` already rejected them — this is explicit belt-and-suspenders).

**Gates:** `skeletonRestoration.fitness.test.ts` = FF-SKELETON-CHOOSABLE + FF-STARTERS-ARE-DECLARATIONS. tsc EXIT 0; templates+adapter+preset+palette+placement+object-model suites green.

**Create-id lifecycle (root-caused + settled 2026-07-19):** the create path has TWO distinct ids and neither `id:""` nor an OMITTED id satisfies both gates —
- **page IDENTITY** = server-owned key, assigned by `POST /pages` and read back (`const {id} = await ...create()`) → becomes the store/lifecycle key.
- **config ROOT-NODE id** = a node id like every child; the emitted config must carry a NON-EMPTY one.
Two conflicting gates: SERVER `validateConfig` INVALID_ID rejects an EMPTY root id but accepts ABSENT; CLIENT C5 save-guard `validatePageForSave` round-trip rejects ABSENT (fromNodePageConfig synthesizes a fallback `'page'` id → toNodePageConfig re-emits `id:'page'` ≠ id-less input → identity fails). **First attempt (omit-when-empty `...(page.id?{id}:{})` in toNodePageConfig) fixed the 400 but BROKE the client save-guard** — caught only by the CONVERGED gate (scoped run missed it).
**Correct fix:** `createPage` mints a provisional NON-EMPTY root id from the ONE node-id factory `canvas/nodeId.ts` `newNodeId()` (`node-<base36>`, extracted SSOT — also now used by useCommandRunner/useCanvasController, killing 2 inline dupes; bound "no parallel id scheme"), used for BOTH `assertSaveable` + `toApiPage`; server identity then replaces it in the stored page. `toNodePageConfig` REVERTED to always emit `id: page.id` (faithful bijection — the root is a node like any other; band-aid gone). FF `templates.fitness.test.ts` › "create emission is API-valid" tightened to the TRUE invariant: models real create bytes (`{...page, id: newNodeId()}`), asserts non-empty root id + no INVALID_ID (server gate) + symmetric adapter round-trip (client gate).
**KNOWN latent edge (flagged, out of scope):** the create-VERSION persisted config carries the provisional root id until the first save reconciles it to the server identity; `fromApiPage` derives `CanvasPage.id` from `config.root.id` (not the authoritative `row.id`), so openPage-before-first-save would key the page under the provisional id ≠ server uuid. Complete fix = `fromApiPage` use `row.id` for identity (or server stamps config.id = page.id on insert). Not done here (panel-scoped card, self-heals on first save).

**Retype = FORK (NOT built, per brief):** changing an existing page's kind re-slots content across differing page-kind slot contracts (tab-page's TabPageSlots vs inner-page flat children) — non-trivial, its own slice. Reported, not guessed.

**R4 stays out of scope:** chrome-as-arranged-Parts (named-slot render, `sticky` unrendered) is R4.

Related: [[project_panel_composed_preset_primitive]] (R2 presetRegistry), [[project_panel_layout_assembly_r1]] (R1 floor), [[project_panel_per_page_type]] (CanvasPage.type first-class).
