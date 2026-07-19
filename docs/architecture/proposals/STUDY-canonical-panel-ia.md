# STUDY — The Canonical Panel IA: one site-builder object-model spine

**Card:** `work/items/0102-canonical-panel-ia.md` · **Status:** DECISION-GRADE (2026-07-19, platform-architect@fable, READ-ONLY apex study) · **Owner decision required** (§7).
**Extends, never forks:** ADR-038 (bounded element) · ADR-041 (part grammar / one containment) · ADR-042 (tri-projection + placement port) · ADR-049 (assembly by declaration). **No fifth grammar is proposed anywhere in this document.**
**Method honesty:** reference-class extraction is expert distillation (no live web), cross-checked against `docs/architecture/BENCHMARK-REFERENCE-PLATFORMS.md` Part II; every claim about OUR code is file:line-cited from today's tree.

---

## 0. The one-paragraph verdict

The owner is right that the panel "fell out of the canon," but the fall is not where the lead hypothesis put it. **The engine object model already carries the entire site-builder spine** — site params, page kinds with frames, chrome as ordered/regioned parts of a site-frame, one node tree, one binding port. What fell out is the **authoring projection**: the studio projects six *peer feature-surfaces* (Sources · Model · Add · Layers · Site · Style) instead of the *nested containment spine* the reference class projects; and the middle level of that spine — the **page skeleton** — is genuinely LOST *as a projection*: page kinds exist and are registered (`sliceType:'page'`), but every page is silently created as the hardcoded default (`PageBrowser.tsx:89`), the template gallery is a panel-side fixture file rather than a registry declaration, and chrome arrangement exists in the engine (`resolveChrome.ts:6-10`) but projects as a raw number field (`chromeFacetModel.ts:56`). The remedy is therefore **projection restoration on the existing spine + ONE generalization of an already-decided primitive** (ADR-049's `PresetDecl` seeded at a page root), sequenced as a Strangler in §6 — not a new object model.

---

## 1. Reference-class concept extraction

### 1.1 The comparison table

Legend: **Tmpl/Skel** = is the page skeleton/template first-class? · **Chrome** = where header/nav/footer live · **Site-params** = where site-level canonicity lives · **Data** = where data lives relative to pages.

| Platform | Containment spine | Tmpl/Skel first-class? | Chrome | Site-params | Data |
|---|---|---|---|---|---|
| **WordPress FSE / Gutenberg** | Site ⊃ **Template** (front-page/single/archive) ⊃ **Template Parts** (header/footer) ⊃ Patterns (sections) ⊃ Blocks | **YES — the crispest in the field.** A page = content poured into a Template's content outlet; templates + template-parts are separately editable, reusable assets | **Template Parts** — first-class, ordered, editable on their own canvas, instantiated per template | Site Editor "Styles" (global styles/tokens) + Settings | Dynamic blocks bind to the content model; data is below blocks |
| **Webflow** | Site ⊃ Pages (static + **Collection-page templates**) ⊃ Sections ⊃ Elements; **Components/Symbols** reusable | **YES for CMS** (a Collection Page IS a template bound to a collection); static pages reuse header/footer via Components | A **Component** (Symbol) placed per page — chrome is an ordinary reusable element, not a separate species | Site Settings (domain, SEO, locales) + Site-wide styles/classes | CMS Collections — an isolated data floor with its own UI; bind via collection lists/fields |
| **Wix** | Site ⊃ **masterPage** ⊃ Pages ⊃ Sections ⊃ Elements | **YES via masterPage** — "shown on all pages" elements live on a master canvas, arranged visually | On the **masterPage** — first-class, canvas-arranged, per-page overridable | Site menu/params + Theme manager | Wix Data collections, isolated floor |
| **Builder.io** | Space ⊃ **Models** (page/section/data models) ⊃ Content entries ⊃ Blocks; Symbols | **YES as a Model** — a "page model" declares the skeleton contract (fields, targeting, URL pattern); entries instantiate it | Host-app owned (headless) — deliberately OUT of the builder | Space settings + design tokens | **Data models** — same registry as page models (one declaration grammar for pages AND data) |
| **Plasmic** | Project ⊃ Pages + **Components** ⊃ Slots ⊃ Elements | Partial — page templates via component-with-slots; slots = the outlet mechanism | A component with slots, placed per page | Project settings + style tokens | Data queries/integrations floor |
| **Puck** | `config{components, root}` ⊃ data tree; **slot-as-field** | **YES as `root`** — the root component IS the skeleton (wraps every page, owns chrome), one declaration | Inside `root` — chrome is the root component's own render, content = its slot | Host-owned | Host-owned (resolveData) |
| **Retool** | Org ⊃ App ⊃ Pages ⊃ **Frames** (Header/Sidebar/Main) ⊃ Containers ⊃ Components | App-level skeleton = the **Frame set** | **Frames** — first-class, canvas-editable regions | App + org settings | **Resources** — global, isolated, own UI; queries reference them |
| **Grafana** | Org ⊃ Folders ⊃ Dashboards ⊃ Rows ⊃ Panels; **Library panels** | Dashboard-as-JSON + library panels; no page-template layer (single-doc world) | Product-owned, not authorable | Org/dashboard settings + variables | **Data sources** — global registry, own config UI; per-panel query references |
| **Framer** | Site ⊃ Pages ⊃ Stacks/Frames ⊃ Components; CMS templates | CMS page templates; components for chrome | Component placed per page (sticky headers etc.) | Site settings | CMS floor |
| **Form.io / JSON-Forms** | Project ⊃ Forms ⊃ Components | n/a (single-doc) | n/a | Project settings | The form IS the data contract |

### 1.2 What the class converges on (the concept-set, not features)

1. **ONE nested containment, projected as the IA.** Every leader's left-hand navigation *reads as the spine*: you are always inside `Site → (Template) → Page → Section → Element`. No leader shows six peer surfaces whose relationship the author must infer. The IA **is** the containment projection.
2. **The skeleton/template is a SITE-LEVEL ASSET instantiated by pages** — between Site and Page, not a property hidden inside Page. Three mechanisms recur, all equivalent: a template document (WordPress), a master/root component with a content slot (Wix masterPage, Puck `root`), a model/contract entries instantiate (Builder). In ALL of them the skeleton is (a) choosable at page creation, (b) editable in its own right, (c) reusable across pages, (d) per-page overridable.
3. **Chrome belongs to the skeleton, and is ARRANGED, not configured.** Header/nav/footer are ordered, visually-manipulable parts of the template/master/frame (WP template parts, Wix master canvas, Retool Frames) — never a settings form with a numeric "order" field, and never a species outside the normal element grammar.
4. **Site-params have ONE home** (Site Settings / Space settings): identity, locales, domain, theme tokens, nav. One door.
5. **Data is an isolated floor with its own UI, referenced by binding** (Webflow CMS, Retool Resources, Grafana data sources, Builder data models) — the owner's instinct #1 is exactly the class canon. Builder.io goes furthest: **data models and page models sit in the same declaration registry** — one grammar for both.
6. **"Never start blank" via curated composed wholes** — starters/templates/symbols/library-panels are *config snapshots on a registry*, not code (this is ADR-049 P2b, already decided).

---

## 2. Our actual concepts (code ground truth)

### 2.1 What EXISTS — the spine is already in the object model

| Level | Where it lives | State |
|---|---|---|
| **Data floor** | Sources + Model as full-screen focus-views, rail-first (`studio/rail.ts:38-45`); one upload door (`studio/sources/oneUploadDoor.fitness.test.ts`, `CanonicalUpload.tsx`); governed semantic catalog (`studio/model/semanticCatalog.store.ts`); DataSpec authoring-contract registry LANDED (ADR-049 P1, `spec-catalog.ts`); workbench browse-grid (0099) | **BUILT + already canon-shaped** (0091/0082) |
| **Site** | `SiteDef` — name/locales/logo/**nav**/themeOverrides/dataSourceBindings/**chrome** (`types/constructor.ts:48-75`); mirrors engine `SiteManifest.chrome` exactly | **BUILT** (single-site; multi-site = YAGNI) |
| **Page kinds (the skeleton's lower half)** | Registered page-root slices `sliceType:'page'`: `container-page` (default + **landing** variant) · `inner-page` · `tab-page` (`plugins/pages/meta.ts:1-4`); validated (`core/validation/config.ts:66`); `CanvasPage.type` REQUIRED + lossless (`types/constructor.ts:133-148`); page-level `meta.frame/chrome/…` carried verbatim (`types/constructor.ts:119-131`) | **BUILT in engine + store** |
| **Chrome** | Chrome = **sourced Parts of the site-frame** under the ONE `PartAddress` (`types/constructor.ts:77-84`, `engine/siteFrame.ts`, ADR-041 R4/S6 — the separate chrome-selection species is already retired); regions with **ordered entries + page-over-site override chain** `variant/region/order/config` (`engine/resolveChrome.ts:6-10,79-82`); canvas-selectable via `PartAnchor` (`engine/ChromeRegion.tsx:11-18`) | **BUILT in engine** |
| **One tree + one insert engine** | Flat per-page node map + the single insert/move reducer pair all surfaces funnel through — "NO parallel tree model, NO second insert path" (`store/constructor.pages.ts:104-115`); V6 byte-identical insert | **BUILT** |
| **One type registry** | `objectRegistry` — node · **page template** · panel · chrome · control as ONE `ObjectMeta` spine, `listByKind('page')` ready (`engine/objectRegistry.ts:1-9,95-97`) | **BUILT** |
| **Templates (partial)** | `TemplateGallery` + `starterTemplates` — "never start blank", each starter a valid `NodePageConfig` fixture, structure-first, no smuggled codes (`features/templates/starterTemplates.ts:1-28`) | **BUILT but pre-canonical** (see 2.2-C) |
| **Publish** | Page lifecycle + `PageWorkflowBar`, publishable identity (ADR-044) | BUILT |

### 2.2 What is MIS-PROJECTED or LOST (the actual chaos)

- **(A) The skeleton choice is LOST.** Page creation hardcodes `type: DEFAULT_PAGE_TYPE` with an in-code confession — *"the author can retype it via the page Inspector once page-kind authoring lands"* (`features/page-workflow/PageBrowser.tsx:86-94`, `canvasPageAdapter.ts:45`). The registered page kinds (landing frame vs inner frame vs tab frame — the site's FRAMES) are never offered, never shown, never retypeable. The owner's phrase "the skeletons GOT LOST" is *literally* the code's state: they exist, registered, and are unreachable.
- **(B) Chrome arrangement exists but projects as a number field.** The engine's region+order chain is reference-grade (Grafana/Builder pattern, `resolveChrome.ts` header cites it), and the structural facet IS authorable — but as `variant/region → Select, order → NumberControl` in the inspector (`inspector/facets/chromeFacetModel.ts:47,54-56`). Typing "3" into an Order field is configuration, not arrangement. The owner's "chrome has no ordering" is a **modality** defect (no visual/drag projection), not a model defect.
- **(C) Templates are fixtures, not declarations.** `starterTemplates.ts` is a hand-committed panel-side array — outside every registry, invisible to capability discovery, inextensible by declaration, unaware of page KINDS (starters lay out content anatomy only; the frame/chrome axis of a skeleton is absent). It also predates ADR-049's `PresetRegistry` — i.e. we now have TWO homes for "curated composed whole" (starter fixtures + the decided preset primitive), which is exactly the parallel-surface pattern the owner smells.
- **(D) The IA projects feature boundaries, not the spine.** The rail = six peers (`rail.ts:38-45`); `pages-site` mixes site params, nav, chrome AND page management in one dock surface (`surfaces/PagesSiteSurface.tsx`); duplicate doors persist (site/brand ×2, data-model ×3, page-nav ×2 — `BLUEPRINT-panel-canonical-relay.md` ONE-PLACE ledger). An author cannot read "Site ⊃ Page ⊃ Section ⊃ Element" anywhere on screen.
- **(E) Containment is physically broken at the floor.** 0101 (root-caused): empty containers render 0px, refuse drops, the move-guard demotes children to siblings (`canvas/insertNode.ts:289`), and no page-frame CSS containment clamps content (`app-shell` chain all `overflow:visible`). Until this lands, no IA fix is credible — the PRIMARY gesture fails.
- **(F) Elements land as blank shells.** 0100-P2b (decided, not built): no composed-preset primitive in the palette yet.

---

## 3. Verdict along the owner's hierarchy (honored, then corrected)

| # | Owner's level | Verdict |
|---|---|---|
| 1 | **DATA — upload + view, isolated, beautiful** | **SOUND and largely BUILT** — this is the class canon (§1.2-5) and our Sources/Model floor already has it structurally (rail-first, one upload door, workbench grid, governed model). Remaining work is curation/polish, not architecture. **Keep as level 1.** |
| 2 | **SITE — create + params/canonicity** | **SOUND, needs ONE home.** `SiteDef` is complete; the defect is projection: params scattered across duplicate doors, and the site's most important assets — its SKELETONS — are not shown as belonging to it. |
| 3 | **PAGE + chrome + "skeletons got lost"** | **CORRECT diagnosis, one mis-factoring:** the skeleton is not a sub-concept of Page — the whole reference class puts it **between Site and Page** as a site-level asset pages instantiate (§1.2-2), and **chrome belongs to the skeleton** (§1.2-3), not to Page or Style. His "the page = the site's skeletons/frames" intuition is exactly right; the hierarchy just needs the skeleton lifted one level. |
| 5 | **"the rest = logical continuations"** | Two of them are real, named levels the class treats as first-class: **Section/Element (with composed presets/symbols — 0100-P2b)** and **Binding** (P1, done), then **Publish**. |

**Corrected canonical hierarchy:** `DATA → SITE → SKELETON → PAGE → SECTION/ELEMENT (+preset) → BINDING → PUBLISH`.

**Lead hypothesis adjudication:** CONFIRMED in effect — the panel does run parallel concept-surfaces with no projected spine, and the page-skeleton is the missing middle. CORRECTED in mechanism — the skeleton is **not absent from the object model** (page kinds + frames + chrome-part regions are built and registered); it is **unprojected** (hidden default, no chooser, no gallery of kinds) and **unregistered as curated assets** (starters are fixtures). The remedy is projection + one registry generalization — NOT a new first-class entity, which would fork the grammar (§5 Option B).

---

## 4. THE canonical spine for our panel

One sentence: **a site is a tree of declarations, and the studio is that tree's projection.**

```
DATA  (Sources → governed Model)                        — the isolated floor; referenced only via DataSpec binding
  ↓ binds
SITE   = SiteDef (params · nav · theme · data-bindings) — ONE settings home
  owns  SKELETONS = page-KIND (registered 'page' slice: frame + chrome-region defaults)
                    × page-level PresetDecl (curated seed: kind + chrome overrides + section scaffold)
  owns  CHROME    = ordered sourced Parts of the site-frame (region + order), arranged visually,
                    defaulted at site level, overridable per page (resolveChrome chain — already built)
    ↓ instantiates
PAGE   = CanvasPage { type: <skeleton kind>, meta (frame/chrome overrides), content tree }
    ↓ contains (ADR-041 Part grammar — the ONE containment)
SECTION ⊃ ELEMENT — inserted as composed PRESETS (ADR-049 P2b), landing bound + pre-wired
    ↓ binds (ADR-049 P1 — the binding port, DONE)
DATASPEC → the governed model → the sources floor
    ↓
PUBLISH (lifecycle terminal — ADR-044)
```

**How each level lands as a declaration on the EXISTING machinery (zero new grammar):**

| Level | Declaration | Machinery (existing) |
|---|---|---|
| Data kind | `SPEC_CATALOG` authoring contract | ADR-049 P1 — shipped |
| Site | `SiteDef` (already serialized to config API) | store Layer 2 — shipped |
| **Skeleton** | **(a)** a registered `sliceType:'page'` slice = the KIND (frame + chrome defaults) — shipped, unprojected; **(b)** a `PresetDecl` whose `seed.type` is a page-root type = the curated TEMPLATE | **ONE generalization of ADR-049 P2b:** `NodeSeed.type` already admits "an EXISTING registered node type" — page roots ARE registered types. A skeleton is a preset. Starters migrate from fixture file to `presetRegistry`. |
| Chrome | `ChromeSlotConfig{variant, region, order}` on site + page override | `resolveChrome` — shipped; needs a **visual arrangement projection** (ADR-042 placement port modality, same drag grammar as nav `NavItem` D&D) |
| Page | `CanvasPage` (kind REQUIRED, lossless) | shipped; needs the **kind chooser + retype** projection |
| Section/Element | `ObjectMeta` + `PresetDecl` | ADR-038 + ADR-049 P2b |
| Binding | `DataSpec` via the P1 registry | shipped |

**And the IA becomes the spine's projection** (this is BLUEPRINT-panel-canonical-relay Step 1, refined): the rail reads `Data (Sources·Model) → Site → Compose (Add·Layers over the canvas) → Style → Publish(top-right terminal)`, where **Site** is ONE workspace containing site params + nav + chrome arrangement + **the skeleton gallery** + the page list — so "create a page" is performed *inside* Site as "instantiate a skeleton," exactly the WordPress/Wix/Builder gesture. Every duplicate door dies (ONE-PLACE law).

---

## 5. Options (≥2 rejected, per ADR practice)

**Option A — Projection restoration + skeleton-as-preset (RECOMMENDED).** Everything in §4: no engine object-model change beyond the already-decided ADR-049 P2b, whose `NodeSeed` is generalized (or simply *confirmed* — the type already permits it) to seed page roots. Starters migrate fixtures→declarations. Chrome gets a visual arrangement modality over the existing region/order chain. Page creation projects the kind gallery. Rail re-reads as the spine.
*Trade-off (ISO 25010):* usability/learnability ++ and modifiability ++ for near-zero structural risk; cost = sustained projection work across several surfaces (sequenced §6).

**Option B — A first-class Template ENTITY (WordPress-FSE-style separate template documents + template editor).** REJECTED: introduces a second document species + a second editing canvas + a new residence — a fifth grammar in all but name (violates Law 10/ADR-041; the exact "new bridge for a new kind" ADR-038 forbids). Everything it buys, Option A gets from `page-kind × PresetDecl` on existing registries. Revisit ONLY if per-site *editable shared* templates-with-live-inheritance (edit template → all pages update) become a real requirement — that is a symbol/instance problem (benchmark N1), not a today problem.

**Option C — Rail/label re-grouping only (cosmetic IA fix, no skeleton restoration).** REJECTED: symptom patch (Law 6). The chaos root is the unprojected middle of the spine; renaming six peers doesn't give the author the lost gesture ("pick a frame, get a site-shaped page"). The owner would be back in the circle within a month.

---

## 6. Strangler remedy sequence (Law 7 — each phase shippable, walked live, owner-shown)

Ordered by (floor-first × felt-impact); WIP=1; every phase extends, none forks.

| Phase | What | Rides on | Card |
|---|---|---|---|
| **R1 — the floor: containment works** | 0101 fix plan as root-caused: empty-container affordance (min-height + visible dropzone + `insertNode.ts:289` accepts empty nest-targets) · page-frame CSS containment · page-tab drives URL | ADR-041 (no grammar change — an authoring affordance) | **0101 (queued — becomes Phase 1 of THIS program)** |
| **R2 — elements land whole** | `PresetRegistry` + palette Starters band + 2–3 statistics-native element presets | ADR-049 P2b as designed (Q1–Q3 resolved) | **0100-P2b (slots in here)** |
| **R3 — the skeleton restored** | (a) page-create flow projects `objectRegistry.listByKind('page')` as the KIND gallery (kill the hidden `DEFAULT_PAGE_TYPE`); (b) kind retypeable in the page inspector (the promised "page-kind authoring"); (c) migrate `starterTemplates.ts` fixtures → `PresetDecl`s with page-root seeds on `presetRegistry` — ONE gallery, declaration-fed, kind-aware | R2's registry + `FF-PRESET-*` guards; new guard **FF-SKELETON-CHOOSABLE** (no page-creation path hardcodes a kind) + **FF-STARTERS-ARE-DECLARATIONS** (fixture file deleted) | new card |
| **R4 — chrome is ARRANGED** | Visual arrangement projection over the existing `region/order` chain: chrome parts draggable within/between regions on the canvas (site-frame parts are already selectable + anchored), inspector keeps the structural facet as the precise fallback; page-over-site override surfaced honestly | ADR-042 placement port + ADR-041 chrome-as-part (S6 done); nav D&D precedent (`SiteDef.nav`) | new card |
| **R5 — ONE Site home + the rail reads the spine** | Fold site params + nav + chrome arrangement + skeleton gallery + page list into ONE Site workspace; kill the duplicate doors; rail order `Data → Site → Add → Layers → Style` + Publish terminal | BLUEPRINT-panel-canonical-relay Step 1 (already specified) + SPEC-studio-ia-canonical S5 (owner sign-off flagged there — THIS study is the occasion to give it) | new card (absorbs blueprint Step 1) |
| **R6 — data-floor polish** | The "beautiful data UI" curation pass on Sources/Model (already structurally canonical) | 0082/0091/0099 | existing track |

**Why this order:** R1 unblocks the PRIMARY gesture (owner: "I can't even start") and is already root-caused; R2 is decided and R3 *stands on R2's registry* — restoring the skeleton before the preset primitive exists would re-create a second fixture home; R4/R5 are pure projection and safest last; R6 is continuous.

---

## 7. The owner decision

**D-0102-1 (near one-way door on foundation): adopt the corrected hierarchy + the skeleton model of §4** — skeleton = *registered page-kind × page-level PresetDecl*, never a separate template entity/document. This pins how every future template/starter/symbol is stored (registry declarations) and forecloses Option B's second canvas. Everything downstream (R3–R5) is reversible projection work; this naming is the door. **Recommendation: YES (Option A).**

**D-0102-2:** bless the R1→R6 sequence (specifically: 0101 = R1 first, 0100-P2b = R2, skeleton restoration = R3 immediately after — ahead of any further data-floor polish).

**D-0102-3 (carried over, now in context):** S5 rail-collapse / Site-workspace sign-off (SPEC-studio-ia-canonical flagged it high-visibility) — lands here as R5.

*The proof the owner asked for* ("show me we resemble a site-builder platform + a framework core"): after R3, the live gesture on :3013 is — open Site → pick the **Landing** or **Inner** skeleton from the gallery → the page lands with its frame + chrome + section scaffold → drop a composed preset into an empty container that visibly receives it → it arrives bound. That is Webflow/Wix/Builder's first-five-minutes experience, produced entirely by declarations on our existing registries — the framework core showing through the builder.
