# ADR-050 — The Canonical Panel IA (one site-builder spine; every canonical engine capability MUST be projected)

**Status:** ACCEPTED (owner-blessed 2026-07-19 — "do what is standard, international, best, agnostic, conceptual", card `work/items/0102-canonical-panel-ia.md`).
**Extends (never forks):** ADR-038 (The Bounded Element Law — governing) · ADR-041 (The Part Grammar + one containment) · ADR-042 (tri-projection + Placement port) · ADR-049 (Assembly by Declaration — the binding axis + composed-preset primitive). **This ADR adds NO fifth grammar, touches NO engine object-model, and introduces NO new first-class entity.** It is a projection-restoration decision plus ONE confirmation of an already-decided primitive.
**Source of truth:** `docs/architecture/proposals/STUDY-canonical-panel-ia.md` (apex READ-ONLY study, decision-grade; reference-class table §1, code ground-truth §2, options §5, remedy §6). Aligns CLAUDE.md Law 2 (config declarative), Law 6 (root-cause), Law 7 (Strangler-Fig), Law 8/OCP, Law 10 (one containment grammar), Law 11 (Authoring Canon: data-first, canvas-never-lies).

---

## Context — "engine-canonical, projection-missing" is the disease

The owner's verdict is that the panel "fell out of the canon" and reads as chaos. The study's root-cause finding inverts the obvious hypothesis: **the engine object model already carries the entire site-builder spine — site params, page kinds with frames, chrome as ordered/regioned parts of a site-frame, one node tree, one binding port. What fell out is the *authoring projection*.** The chaos is not bad architecture; it is *un-projected* canonical capability. Concretely, at every level of the spine a canonical engine primitive exists and is registered, but the studio does not project it:

- **Skeleton choice is LOST as a projection.** Page kinds are registered `sliceType:'page'` slices — `container-page` (+ `landing` variant), `inner-page`, `tab-page` (`platform/packages/plugins/pages/meta.ts`), validated (`core/validation/config.ts:66`), with `CanvasPage.type` REQUIRED and lossless (`apps/panel/src/types/constructor.ts:133-148`). Yet every page is silently created as the hardcoded default — `type: DEFAULT_PAGE_TYPE` (`apps/panel/src/features/page-workflow/PageBrowser.tsx:89`, `canvas/canvasPageAdapter.ts:45` = `'inner-page'`) with an in-code confession that a chooser is owed. The registered frames are never offered, never shown, never retypeable. The owner's "the skeletons GOT LOST" is *literally* the code's state.
- **Chrome arrangement exists but projects as a raw number field.** The region + order + page-over-site override chain is reference-grade (`apps/panel/src/engine/resolveChrome.ts`, Grafana/Builder pattern) and chrome is already **sourced Parts of the site-frame** under the ONE `PartAddress` (ADR-041 R4/S6 — the separate chrome-selection species is already retired). But it projects as `order → NumberControl` in the inspector (`inspector/facets/chromeFacetModel.ts:56`). Typing "3" into an Order field is configuration, not arrangement — a modality defect, not a model defect.
- **Templates are fixtures, not declarations.** `TemplateGallery` reads a hand-committed panel-side array (`features/templates/starterTemplates.ts`) — outside every registry, invisible to capability discovery, inextensible by declaration, unaware of page KINDS, and predating ADR-049's decided `presetRegistry`. Two homes for "curated composed whole" is exactly the parallel-surface pattern the owner smells.
- **The IA projects feature boundaries, not the spine.** The rail is six peer surfaces (`studio/rail.ts:38-45` — Sources · Model · Add · Layers · Site · Style); `pages-site` mixes site params, nav, chrome and page management in one dock. An author cannot read `Site ⊃ Page ⊃ Section ⊃ Element` anywhere on screen — the reference class *is* that containment projection.
- **The floor is physically broken (0101).** Empty containers render 0px and refuse drops (`canvas/insertNode.ts:289` demotes children to siblings; no page-frame CSS containment). Until this lands no IA fix is credible — the PRIMARY gesture fails.

The reference class (WordPress FSE/Gutenberg, Webflow, Wix, Builder.io, Plasmic, Puck, Retool, Grafana, Framer) converges on ONE nested containment projected *as* the IA, a skeleton/template that is a site-level asset instantiated by pages, chrome that belongs to the skeleton and is *arranged not configured*, site-params with ONE home, and data as an isolated floor referenced by binding (study §1.2). We already have every one of these in the engine. We project none of them as a spine.

---

## Decision — THE canonical spine, and the ONE structural move

The panel's information architecture, authoring experience, and object model are **one nested containment, projected**:

```
DATA     (Sources → governed Model)        — the isolated floor; referenced ONLY via DataSpec binding
  ↓ binds
SITE     = SiteDef (params · nav · theme · dataSourceBindings)   — ONE settings home
  owns  SKELETON = registered page-KIND ('page' slice: frame + chrome-region defaults)
                   × page-level PresetDecl (curated seed: kind + chrome overrides + section scaffold)
  owns  CHROME   = ordered sourced Parts of the site-frame (region + order), ARRANGED visually,
                   defaulted at site level, overridable per page (resolveChrome chain — built)
    ↓ instantiates
PAGE     = CanvasPage { type: <skeleton kind>, meta (frame/chrome overrides), content tree }
    ↓ contains (ADR-041 Part grammar — the ONE containment)
SECTION ⊃ ELEMENT   — inserted as composed PRESETS (ADR-049 P2b), landing bound + pre-wired
    ↓ binds (ADR-049 P1 — the binding port, shipped)
DATASPEC → the governed Model → the Sources floor
    ↓
PUBLISH  (lifecycle terminal — ADR-044)
```

**The one structural move: `SKELETON = registered page-kind × page-level PresetDecl`.** A skeleton is not a new entity. It is the pairing of (a) an already-registered `sliceType:'page'` slice (the KIND — frame + chrome defaults) with (b) an ADR-049 `PresetDecl` whose `NodeSeed.type` is a page-root type (the curated TEMPLATE — kind + chrome overrides + section scaffold). This is a **generalization — in fact a confirmation — of ADR-049 P2b**: `NodeSeed.type` already admits "an existing registered node type," and page roots ARE registered types. Starters migrate from the fixture file to `presetRegistry`. No engine object-model change beyond what ADR-049 P2b already decided.

**Explicit foreclosure.** A separate "template-document" species — a second document type with its own editing canvas and its own residence (WordPress-FSE-style) — is **rejected and foreclosed**. It would be a fifth grammar in all but name, violating Law 10 / ADR-041 and the exact "new bridge for a new kind" ADR-038 forbids. Everything it would buy, `page-kind × PresetDecl` on the existing registries already gives us.

**The IA becomes the spine's projection.** The rail re-reads as `Data (Sources·Model) → Site → Compose (Add·Layers over the canvas) → Style → Publish`, where **Site** is ONE workspace containing site params + nav + chrome arrangement + the skeleton gallery + the page list — so "create a page" is performed *inside* Site as "instantiate a skeleton," the WordPress/Wix/Builder gesture. Every duplicate door dies (ONE-PLACE law).

**The governing invariant (this ADR's contribution to the canon):** **every canonical engine capability MUST be projected.** A capability that exists, registered, in the object model but is unreachable in the studio is a defect of the same class as the disease this ADR names — not an acceptable steady state. New guards (below) lock each projection so the gap cannot silently reopen.

---

## Why this, not the alternatives

Per ADR practice, ≥2 rejected alternatives (study §5):

**Option A — Projection restoration + skeleton-as-preset (ACCEPTED).** Restore the missing projection on the existing spine; confirm ADR-049 P2b's `NodeSeed` seeds page roots; migrate starters fixtures→declarations; give chrome a visual arrangement modality over the existing region/order chain; project the page-kind gallery; re-read the rail as the spine. *Trade-off (ISO 25010):* usability/learnability ++ and modifiability ++ for near-zero structural risk (no new object model, no stored-data one-way door); cost = sustained projection work across several surfaces, sequenced R1→R6. **It satisfies every canon test:** ONE containment (Law 10), config-declarative (Law 2 — skeletons/starters become registry declarations, not code/fixtures), agnostic (no privileged page/chrome species), and standards-aligned — it is precisely the mechanism the reference class converges on (WordPress template-parts, Wix masterPage, Puck `root`, Builder page-models, Webflow/Framer/Plasmic/Gutenberg components-as-chrome; study §1.1).

**Option B — A first-class Template ENTITY (separate template documents + a template editor). REJECTED.** Introduces a second document species, a second editing canvas, and a new residence — a fifth grammar in all but name (violates Law 10/ADR-041; the "new bridge for a new kind" ADR-038 forbids). Everything it buys is delivered by `page-kind × PresetDecl` on existing registries. Revisit ONLY if per-site *editable shared* templates with live inheritance (edit template → all pages update) becomes a real requirement — that is a symbol/instance problem, not a today problem.

**Option C — Rail/label re-grouping only (cosmetic IA fix, no skeleton restoration). REJECTED.** Symptom patch (Law 6). The chaos root is the un-projected middle of the spine; renaming six peers does not return the lost gesture ("pick a frame, get a site-shaped page"). The owner would be back in the circle within a month.

---

## The R1→R6 Strangler remedy (Law 7 — WIP=1, each phase shippable and walked live)

Ordered by (floor-first × felt-impact). Every phase extends, none forks. One phase closed live at a time.

| Phase | Scope | Seams it projects | Fitness gate | Live-walk DoD |
|---|---|---|---|---|
| **R1 — the floor: containment works** *(0101, in flight, decision-independent)* | Empty-container affordance (min-height + visible dropzone + `insertNode.ts:289` accepts empty nest-targets) · page-frame CSS containment · page-tab drives URL | `canvas/insertNode.ts:289`; `app-shell` overflow chain; page-tab→URL | `FF-EMPTY-CONTAINER-DROPPABLE` · `FF-PAGE-FRAME-CONTAINS` · `FF-PAGE-TAB-URL` | On :3013: drop an element into an empty container and it visibly receives it (no sibling-demotion); page tab reflects in the URL |
| **R2 — elements land whole** *(= ADR-049 P2b `presetRegistry`)* | `PresetRegistry` + palette "Starters/Recommended" band + 2–3 statistics-native presets, landing bound + pre-wired | `packages/react/src/engine/PresetRegistry.ts`; `planPresetInserts` in `insertNode.ts`; `NodePalette` projects `presetRegistry.list()` | ADR-049 `FF-PRESET-*` (band items are declarations; `planPresetInserts` = one history entry, V6-exact) | Drop a composed preset → it arrives bound and pre-wired, not a blank shell |
| **R3 — the skeleton restored** | (a) page-create projects `objectRegistry` page-kinds as the KIND gallery (kill hidden `DEFAULT_PAGE_TYPE`); (b) kind retypeable in the page inspector (the promised page-kind authoring); (c) migrate `starterTemplates.ts` fixtures → `PresetDecl`s with page-root seeds on `presetRegistry` — ONE gallery, declaration-fed, kind-aware | `PageBrowser.tsx:89`; page-kind slices (`plugins/pages/meta.ts`); `starterTemplates.ts` → `presetRegistry`; page-inspector retype | **`FF-SKELETON-CHOOSABLE`** (no page-creation path hardcodes a kind) · **`FF-STARTERS-ARE-DECLARATIONS`** (the fixture file is deleted) | Open Site → pick **Landing**/**Inner** skeleton from the gallery → page lands with its frame + chrome + section scaffold; retype an existing page's kind |
| **R4 — chrome is ARRANGED** | Visual arrangement projection over the existing `region/order` chain: chrome Parts draggable within/between regions on the canvas; inspector keeps the structural facet as the precise fallback; kill the raw `NumberControl` as the primary modality; page-over-site override surfaced honestly | `resolveChrome.ts` region/order; `chromeFacetModel.ts:56`; ADR-042 Placement port; nav `NavItem` D&D precedent | `FF-CHROME-ARRANGED-NOT-NUMBERED` (order is set by drag, not a number field, on the primary path) | Drag a header/nav/footer Part between regions on the canvas; the arranged order renders; per-page override reads honestly |
| **R5 — ONE Site home + the rail reads the spine** *(folds SPEC-studio-ia-canonical S5)* | Fold site params + nav + chrome arrangement + skeleton gallery + page list into ONE Site workspace; kill the duplicate doors; rail order `Data → Site → Add → Layers → Style` + Publish terminal | `studio/rail.ts:38-45`; `PagesSiteSurface.tsx`; BLUEPRINT-panel-canonical-relay ONE-PLACE ledger | `FF-RAIL-READS-THE-SPINE` · `FF-ONE-PLACE` (no duplicate site/brand/data-model/page-nav doors) | The rail reads as `Site ⊃ Page ⊃ Section ⊃ Element`; every site parameter has exactly one door |
| **R6 — data-floor polish** | The "beautiful data UI" curation pass on the already-structurally-canonical Sources/Model floor | Sources/Model surfaces (0082/0091/0099 track) | continuous (no new structural FF) | Upload → view → govern reads as one beautiful isolated floor |

**Why this order:** R1 unblocks the PRIMARY gesture and is already root-caused; R3 *stands on R2's registry* (restoring the skeleton before the preset primitive exists would re-create a second fixture home); R4/R5 are pure projection and safest last; R6 is continuous. **The proof the owner asked for** lands after R3: on :3013, open Site → pick the Landing or Inner skeleton → the page lands framed + chromed + scaffolded → drop a composed preset into an empty container that visibly receives it → it arrives bound. That is the reference class's first-five-minutes, produced entirely by declarations on our existing registries.

---

## Consequences + guards

**Positive.** One spine the author can read; skeletons choosable and retypeable; starters and templates are declarations on ONE registry (extensible by declaration, discoverable by capability); chrome arranged visually; site params behind ONE door; zero new grammar, zero stored-data one-way door (every phase is additive/revertible except the fixture-file deletion, which is code-only and git-revertible).

**Costs / trade-offs.** Sustained projection work across several surfaces (sequenced, WIP=1). Deferred: per-site editable-shared templates with live inheritance (the symbol/instance problem — out of scope, Option B territory). Multi-site remains YAGNI (`SiteDef` is single-site).

**The fitness functions that lock each projection** (protection-layer-first — landed as ratchets ahead of or alongside each phase): `FF-EMPTY-CONTAINER-DROPPABLE`, `FF-PAGE-FRAME-CONTAINS`, `FF-PAGE-TAB-URL` (R1) · ADR-049 `FF-PRESET-*` (R2) · **`FF-SKELETON-CHOOSABLE`**, **`FF-STARTERS-ARE-DECLARATIONS`** (R3) · `FF-CHROME-ARRANGED-NOT-NUMBERED` (R4) · `FF-RAIL-READS-THE-SPINE`, `FF-ONE-PLACE` (R5).

**The governing guard against recurrence.** This ADR raises the "engine-canonical, projection-missing" gap to a named, guarded invariant: **a canonical capability that exists in the object model but is unreachable in the studio is a defect.** `FF-SKELETON-CHOOSABLE` and `FF-STARTERS-ARE-DECLARATIONS` are its first two concrete enforcers (no creation path may hardcode a kind; no curated whole may live as a fixture outside the registry). Future capabilities land with their projection guard from day one — the disease cannot silently reopen.
