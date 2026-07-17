# STUDY — The Authoring Canon: why the circle persists, and the program that breaks it

**Author:** the lead (Fable), personally — owner directive 2026-07-15 ("be critical, go in deep, see what I couldn't; lay a plan on our reference platforms' concepts that breaks this circle").
**Method:** first-principles read of the live code + **gesture-truth probes against the REAL running Studio (:3013, authenticated, real data)** — screenshots + DOM census in `work/authoring-truth/` (probe: `work/probe-authoring-truth.mjs`). Not a re-read of prior specs: everything below was verified with my own eyes on the running product.
**Relation to prior canon:** extends — does not fork — ADR-041 (Part grammar), ADR-042 (Triprojection + Placement), AR-49/50/51, SPEC-studio-ia-canonical. **Verdict up front: the object model HOLDS. The circle is no longer conceptual — it is a product-canon and delivery-discipline failure sitting ON TOP of a sound substrate.**

---

## 0. The owner's felt list, restated faithfully (2026-07-15)

1. Right dock is still wrong.
2. The canon is broken — "everything should probably start from raw data; right now it's stuffed in somewhere."
3. Working with metrics / the semantic layer from the panel is very hard.
4. Objects/nodes don't declare their contracts properly.
5. "We started many architectures and they didn't come out."
6. The canvas itself doesn't work properly.
7. Chrome and pages don't work.
8. Concepts aren't isolated — mixed together and hard-coupled, in code AND in UI.

## 1. Ground truth — what the live Studio actually shows (probed 2026-07-15)

| # | Live observation (my own probe, :3013) | Evidence |
|---|---|---|
| G1 | **The canvas lies by default.** Structural mode (the default) renders KPIs as literal `0 მლნ ₾ / 0% / 0.0%` and the chart section as an EMPTY white box. Flipping "ცოცხალი მონაცემები" brings real data (701 825 მლნ ₾; the regional table populates) — the pipe is alive; the default view is dead. | `03-studio.png`, probe `live-data.hasNonZero:true` |
| G2 | **Unbound elements render dishonest zeros even in LIVE mode.** A KPI card whose მეტრიკა select = "—" and coordinate "not set" paints `0%` — indistinguishable from a true zero. On a statistics platform this is a Law-9-class integrity breach *inside our own authoring tool*. | `04-node-selected.png` |
| G3 | **Unresolved template tokens leak to the author:** `საშუალო ნომინალური ზრდა ({spanFrom}–{spanTo})` renders with raw `{spanFrom}` braces on the canvas. | `03-studio.png`, live text dump |
| G4 | **The page inspector exposes the engine's plane to authors:** `ცვლადები [object] 10 fields · _mark · _xDim · _byDims · _selKey → Open` and `presentation.crumbs [object] 6 fields → Open` — raw-JSON escapes of AR-36/42 derive internals, at the same visual rank as "Title". Mixed-language labels ("Page color", "Breadcrumbs", "Open presentation.crumbs →" amid Georgian). | `03-studio.png`; `pageSchemaSource.ts:67` (`vars` = raw `object` field) |
| G5 | **The dock is a stacked form-wall, not a curated inspector.** ADR-042 D4 (facet tab-bar: Content · Style · Data · Interactions · Visibility) is NOT built — every applicable section stacks vertically; nested objects fall back to "N fields · … → Open" escapes (`ხილვადობა: 2 fields · op · perspective`). | `03/04-*.png` |
| G6 | **Chrome renders degenerate.** Chrome IS reachable (S6 live: `data-part-field=AppBanner/AppHeader/LocaleSwitcher/ThemeSwitcher/InnerSidebar` all anchored) — but the canvas paints the site header/footer as an unstyled cramped strip (social icons + KA/EN + theme toggle floating at canvas top). Reachable ≠ faithful. Chrome *manipulation* (reorder/enable via placePart, D6) is unbuilt. | probe `chrome-candidates`, `03-studio.png` |
| G7 | **The Manipulate axis is still missing on the canvas.** `moveNode` exists ONLY in the outline (`OutlineTree`); the canvas has insert-only; TWO drag transports coexist (native `dataTransfer` in `CanvasOverlay`/`NodePalette`; dnd-kit in data-layer/nav/outline). ADR-042 Slices 1–2 unbuilt. | grep census |
| G8 | **The data journey is inverted in EXPERIENCE.** Default lens on `/studio/model` = read-only Data Dictionary: `hasUpload:false` — raw-data onboarding sits behind Model → lens-flip → scroll (two levels deep; the owner's "stuffed in somewhere", verbatim confirmed). The Dictionary is a cul-de-sac: metrics are listed ("17 მეტრიკა · 11 ჯერ არ გამოიყენება") but cannot be dragged/bound to the canvas from there; DataFlowMap lives exiled in the full-screen workspace; existing page elements carry raw coordinate/DataSpec configs with the metric select EMPTY. | `07-model.png`, probe `model-surface` |
| G9 | **Duplicate perspective controls confuse the canvas:** the toolbar preview switch (წლიური\|დინამიკა) AND the page's own perspective-tab-bar node render side by side. | `03-studio.png` |
| G10 | **Dead/transitional strata linger in the shipped tree:** `FilterBarControlsBridge` (kept alive only by its own fitness test), `walkNodes` fallback, the two transports of G7. | grep census |
| G11 | **What does NOT fail:** boot is clean (0 console errors), selection works (node + band item + breadcrumb-bounded item inspector with a governed metric dropdown listing real metrics), pages exist and switch, S5 rail is live, the Part census is healthy (16 anchored parts incl. chrome). | probe logs |

## 2. Root diagnosis — six findings, one disease

### F1 · The canvas breaks the WYSIWYG covenant (owner #6)
Every reference canvas (Webflow, Framer, Builder.io, Power BI, Looker Studio) holds one covenant: **the canvas never lies**. Ours defaults to a mode that paints fake zeros and empty boxes (G1), renders unbound state as a plausible number (G2), and leaks template plumbing (G3). The owner reads this — correctly — as "the canvas doesn't work," even though the machinery underneath is alive.
**Root:** "structural default" was an engineering economy decision (request-volume fear) promoted into the author's default reality, plus a missing **honest-state grammar** (unbound/no-data/error as first-class rendered states).

### F2 · The inspector is a schema dump, not an authoring instrument (owner #1)
The generic-projection principle (ADR-038/041) is right and stays. But **projection ≠ presentation**: Figma/Webflow project one model too — through a curated IA (facet tabs, plane separation, iconography, i18n discipline). We render the PropSchema as a stacked wall with raw-object escape hatches, and we project the *system plane* (`vars` derive state, `presentation.crumbs`) into the *author plane* at equal rank (G4, G5).
**Root:** D4 unbuilt + a missing **plane taxonomy on PropSchema fields** (author-plane vs steward-plane vs system-plane) — the schema currently has no vocabulary to say "this field is not for this audience," so the generic dock can't hide what should be hidden. That is the real "contracts not declared properly" (owner #4): the contracts declare *shape* but not *audience/plane*.

### F3 · The data canon is architected but not LIVED (owner #2, #3)
The architecture already says exactly what the owner says: raw data at the front (AR-51/ADR-040), a governed semantic spine (AR-40/50), elements referencing governed handles (ADR-042 D5). **None of it is the lived journey:** onboarding is buried two levels deep (G8); the Dictionary can't bind to the canvas; the flow map is exiled; legacy element configs were never migrated onto metric handles, so authors meet raw `coordinate (dim→value)` editors with an empty metric select (G2/G8); `FF-DATA-BOUNDED` exists as a design intention, not a biting gate.
**Root:** D5 stalled at "mechanism shipped, adoption pending" — the exact "cathedral without a congregation" violation the craft doctrine names. The Strangler's second half (migrate the corpus, retire the old way) never ran.

### F4 · Chrome: reachable but not faithful, and not manipulable (owner #7)
G6. The canvas mounts chrome slices without the site's real frame context/styles → a degenerate strip. Faithfulness is a WYSIWYG property, same covenant as F1. Manipulate (D6) unbuilt.

### F5 · Manipulate never landed on the canvas (owner #6, #8 "hard couple in UI")
G7. One resolved architecture (ADR-042 D2), zero canvas delivery. The two-transport split IS the felt UI-coupling: the same gesture means different things on different surfaces.

### F6 · The disease under all five: DoD = "gate green," not "journey complete" (owner #5)
The registry counts **~12 concurrently open strata** (AR-42 P3+, AR-49 M2.3/M2.4/M3.1+, AR-50 M-SQ/M4/lifecycle, ADR-042 Slices 1–6, AR-51 registry, AR-37/38/39, MUI-exit, G10 dead code). Each stratum stops at "core seam proven + fitness green + follow-ups listed" and the team moves on; the surfaces stay unlit; the owner never FEELS a completion. Meanwhile verification ran against unit/fitness/mocked-e2e — no instrument ever walked the product as an author. **The circle is a portfolio pathology, not an architecture gap.** The object model was settled by ADR-041/042; what keeps regenerating the "we're circling" feeling is that no single author journey has ever been finished end-to-end and held.

## 3. The Canon (the ideology, stated once)

Benchmark hybrid — Power BI/Tableau (data-first onboarding, field wells) × Looker/dbt (the semantic layer governs every number) × Webflow/Framer/Figma (canvas honesty, curated contextual inspector) × Grafana (declared data contract + honest no-data states) × Notion/Gutenberg (insert ergonomics) — fused with what is uniquely ours (SDMX-grade governance + provenance). Four laws, product-level peers of CLAUDE.md's code laws:

- **C1 · Data first, always.** The platform's spine is `raw data → governed semantic model → bound elements → published pages`. Every surface makes this spine VISIBLE and every entry point starts on it. Raw onboarding is a front door, not a buried drawer. A number on any surface traces to a governed handle.
- **C2 · The canvas never lies.** Live/representative data by default; an unbound/no-data/error element renders a DECLARED honest state (never a fake 0, never a silent blank); no unresolved plumbing tokens; chrome renders faithful to the published site. WYSIWYG is a covenant, not a feature.
- **C3 · Projection with a plane.** Every surface stays a generic projection of declared contracts (ADR-038/041/042 — unchanged), AND every declared field carries its **plane** (author / steward / system). The author sees a curated facet-tabbed contract in their language; the steward sees the model plane; the system plane is machinery, projected to no one by default.
- **C4 · A journey is the unit of done.** Nothing is "done" at gate-green. The DoD of authoring work is a named end-to-end AUTHOR JOURNEY walked on the live product. The six canonical journeys: **J1** onboard raw data → published cube; **J2** define/govern a metric; **J3** compose a page from blocks; **J4** bind data to an element via governed nouns; **J5** restyle/rebrand (element→page→site→chrome); **J6** publish & verify public render. Each journey has a live Playwright walk (real stack, no mocks) as its fitness function — `FF-JOURNEY-J1..J6`.

## 4. The program — five waves, strict order, one-at-a-time (WIP = 1)

> **Portfolio rule (binding, F6's cure):** no NEW stratum opens until the wave in flight reaches journey-DoD. Existing open strata are either folded into a wave below or explicitly parked in the registry with a reason. Every wave ends DEPLOYED to :3013 + its journey walked + shown to the owner.

**W1 — The Honest Canvas (F1, F4-faithfulness, G3, G9).** Kill the lie: live-data becomes the default (structural stays as an opt-out perf mode with an explicit "preview off" veil — never zeros); an unbound/no-data element renders a designed honest state ("აუბმელი — აირჩიე მეტრიკა" affordance that OPENS the bind flow — the empty state becomes the door to J4); resolve/veil template tokens in canvas; chrome renders inside the real frame context (faithful header/sidebar/footer); fold the duplicate perspective controls into one. FFs: `FF-CANVAS-NEVER-LIES` (no rendered `0` from an unbound spec; no `{token}` in canvas text), `FF-CHROME-FAITHFUL` (canvas chrome ≡ runner chrome modulo authoring anchors). **Journey: J3 walked live.**
**W2 — The Semantic Spine, lived (F3).** Data-first front door (onboarding reachable in ONE intentful step from the shell, no lens-flip burial); Dictionary → canvas **drag-a-metric-to-bind** (the dictionary stops being a cul-de-sac; dnd-kit, same transport as W4); DataFlowMap embedded as the Data home's orientation (not exiled); **migrate the existing page corpus onto metric handles** (the stalled Strangler second half — every bindable element on live pages gets its governed ref; raw coordinate editors demote to steward plane); make `FF-DATA-BOUNDED` + `FF-AUTHOR-NO-QUERY` bite on the corpus. **Journeys: J1 + J2 + J4 walked live.**
**W3 — The Inspector as instrument (F2).** Build D4 (facet tab-bar derived from `facetRegistry`); add **plane** to PropSchema (`plane?: 'author'|'steward'|'system'`, default author — one additive field, OCP) and project by plane (system plane hidden; steward plane behind the lens); retire every raw-object escape in author plane (each becomes a typed sub-editor or moves plane — `vars`/`crumbs` are the first two); studio-chrome i18n completeness (no mixed-language labels — extend the locale-leak fitness to the Studio's own chrome). FFs: `FF-DOCK-IS-FACET-PROJECTION` (ADR-042), `FF-PLANE-PROJECTION` (no system-plane field reaches an author surface), locale-leak-studio. **Journey: J5 walked live.**
**W4 — Manipulate lands (F5) = ADR-042 Slices 1–2.** One dnd-kit transport (the owner-gated one-way flip), `placePart` on canvas + navigator + palette, keyboard move (Law 9). Deletes: native `dataTransfer` path, `walkNodes` fallback, `FilterBarControlsBridge` (G10 housekeeping rides this wave). FFs: ADR-042's manipulation suite. **Journey: J3 re-walked with restructuring.**
**W5 — Publish closes the loop (pages "don't work" residue).** J6: draft→publish→public-render walked live (panel → api → runner :3012/:3002 line), page create/rename/delete/nav-wire proven as gestures; the bottom page-strip and Pages surface reconciled to one model. FF: `FF-JOURNEY-J6`. **Journey: J6.**

**Explicitly parked (registry, with reason):** AR-49 M3.1+ (recipes), AR-50 M4/M5-lifecycle, AR-42 P3/P4, MUI→Radix exit, AR-51 adapter-registry generalization — all good architecture, none unblocks a canonical journey; they re-open one at a time AFTER W5.

## 5. What I am NOT proposing (refused alternatives)

1. **Another object-model reform.** ADR-041/042 are sound; the probe proves the substrate (parts anchored, selection bounded, chrome reachable). Re-opening them would BE the circle.
2. **A from-scratch Studio rewrite.** The shell/IA (S5) is canonical; the failures are default-mode, presentation-grammar, migration-debt, and sequencing — all Strangler-fixable on the live tree (Law 7).
3. **Big-bang "finish everything."** The cure for 12 open strata is not a 13th umbrella that contains them all — it is WIP=1 with journey-DoD, in the stated order.
4. **Dissolving the steward/author governance lens** to make data "easier." The lens is correct (Looker/Power BI canon); W2 makes the *journey* one step, not the *governance* zero steps.

## 6. Fitness delta (new gates only)

`FF-CANVAS-NEVER-LIES` · `FF-CHROME-FAITHFUL` · `FF-PLANE-PROJECTION` · `FF-JOURNEY-J1..J6` (live Playwright walks vs the real stack, the wave-closing gates) · locale-leak-studio. All ADR-041/042 suites stay green throughout.

## 7. Decision points for the owner

1. **Bless the Canon (C1–C4)** as product law (peer of CLAUDE.md laws; I recommend adding a one-line pointer as Law 11).
2. **Bless WIP=1 + the wave order** W1→W5 (this is the circle-breaker; I hold the line even when new ideas arrive mid-wave — they get registry cards, not build slots).
3. W4 contains the already-flagged **one-way transport flip** (ADR-042) — GO gate stands as written.
4. Live-data-by-default (W1) trades some API request volume for truth — I recommend paying it (debounce/cache already exist; G3.2 hardening folds into W1).
