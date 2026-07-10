# SPEC — AR-49 M4: Canonical Information Architecture for the Strata Studio

> **Milestone:** AR-49 M4 (IA canonical). **Scope:** `platform/apps/panel` only (apps-only; the dependency arrow `contracts←expr←core←charts←react←plugins←apps` is untouched — M0–M3 proved this is possible for the whole reconception). **One documented exception is flagged for coordination:** the *nested* half of Idea 3 (per-item PropSchema rendering) needs ONE additive engine PropField discriminant in `packages/react/engine` — an OCP-clean expand, sequenced like M3's growth-noun as a coordinated packages change, owner-gated (§6 D7). Everything else in this milestone is apps-only.
> **Author:** platform-architect (senior for declarative/config-driven/visual-builder platforms). Sole author of this canonical spec.
> **Status:** DESIGNED (this doc) — phased into reversible build waves for routing to build agents.
> **Predecessors:** `SPEC-authoring-reconception-vision.md` · `-M0` · `-M1` · `-M2` · `-M3-pipeline.md`. This milestone **reorganizes what exists into coherence** AND, per the owner's July-10 direction, **EXPANDS capability while making it MORE canonical** — the two are not in tension: every expansion below (page-type presets, full-config Inspector, canonical right dock, legible hierarchy) is a *projection of registries/graphs we already own*, so more power costs zero new dialect. YAGNI still governs *net-new surfaces*; IA rigor is maximal.
> **Governing law:** Law 7 (Architecture leads, code follows — Strangler-Fig): where the current Studio conflicts with this IA, the Studio migrates to the IA.
>
> **This revision folds in the owner's four July-10 ideas + one overarching doctrine (relayed by the lead):**
> - **Doctrine — "the tool leads; the user is never lost, never blocked"** → §1.5 (the spine tying the four ideas together).
> - **Idea 1 — page-type at creation** → §2.8 (data-driven page-type / template registry).
> - **Idea 2 — canonical hierarchy-respecting order ("chrome first")** → §2.9 (hierarchy made *visible*, non-blocking).
> - **Idea 3 — each node's FULL config from its interface** (the keystone) → §2.10 (schema-complete Inspector).
> - **Idea 4 — canonical right dock (no leftover empty space)** → §2.11 (contextual, fill-by-construction Inspector dock).
> Waves 7–10 (§4), fitness rows (§5), decisions D5–D9 (§6), and rejected alternatives 6–9 (§7) carry them. **Idea 6 — contextual relevance in every surface (context-aware Insert palette + drill-to-any-depth), the left-dock/canvas twin of Wave 7's right dock — is designed in the companion `SPEC-M4.1-contextual-authoring.md` (its own §4 fitness FF-PALETTE-CONTEXTUAL/FF-DRILL-ANY-DEPTH + §5 decision D-M4.1-A); it extends Wave 1 and Waves 7/10.**

---

## 0. Problem statement (from the live audit — three independent instruments agree)

The panel **boots clean** (0 console errors, 0 network failures). Every finding is IA / data-resolution / polish, never stability. The eight findings, restated as architecture defects:

| # | Finding | Root architectural defect |
|---|---------|---------------------------|
| 1 | No "home" — `activePageId=null` on boot though 5 pages exist; Canvas blank, Layers empty, dropdown blank, Save/Publish disabled, Inspector prints "No page selected" ×3 | **Nullable free state that must be imperatively set** — an invalid state ("pages exist, none active") is *representable*, so any missed/late/raced `setActivePage` strands the whole tool. Plus **no empty-state doctrine** (breakage is indistinguishable from emptiness). |
| 2 | Data vs Model incoherence — two surfaces render the same noun (governed metric) at **different fidelity** | **One noun, two divergent implementations** — DRY violation at the component level; no shared record component; provenance present in neither. |
| 3 | Insert reads as a debug list (bulleted `•` text chips, English headers in a KA UI) | **The palette discards the registry metadata it already has** (`NodeSliceMeta.icon/label-i18n/category`). It renders a lossy projection. |
| 4 | Surface prominence inverted vs maturity — roughest surfaces (Insert, Data) are default; polished ones (Model, Style) gated | **Prominence not aligned to maturity** — solved by (a) lifting Insert/Data quality and (b) a canonical, flow-ordered taxonomy. |
| 5 | The pipeline is invisible — define→bind→place never shown | **Three parallel lists with no cross-reference** — the governance graph is bidirectional in the data (`computeMetricImpact` exists) but unsurfaced. |
| 6 | Provenance structurally absent from Data (Law 9 in spirit) | Provenance IS modeled (`ManifestMetric.unit/code/methodology/description` + `MetadataPort`/`agency_scheme` AR-20) but **not projected into the authoring surface**. |
| 7 | Bilingual leakage + brand split (English structural labels; login says "Constructor / GeoStat", shell says "Strata") | **No panel-chrome language policy + two brand literals.** |
| 8 | Authoring has no feedback loop — authored metric persists but preview reads 0, raw tokens leak (`{time}`, `empty.title`) | **The authoring canvas does not run the runner's resolve seam** — "it works" is unfalsifiable. |

**Out of scope here (handled elsewhere — do NOT redesign):** theming/default-blue clash (ADR-021 MUI↔DTCG binding, solved-in-flight); Model dataset-picker React #31 crash (apps fix in flight); `PUT /api/config/site` metric-shape validation (api fix queued); the Compose|Data-model segmented switch + ⌘K command (already shipped this session — kept as-is).

---

## 1. Design theses (what makes this canonical, not merely tidy)

1. **Make illegal states unrepresentable** (Yaron Minsky / discriminated-union discipline). The entry-state bug is not fixed by a better imperative `setActivePage` — it is fixed by removing the class: the *effective* active page is **derived** (`activePageId ?? pages[0]?.id`), so "pages exist, none active" cannot occur.
2. **One record, many lenses** (SRP + role-is-lens). The governed metric has ONE presentation component; Author (consumer) and Steward (define) are *affordance lenses* over the same `<MetricCard>`, never two screens. This is the direct application of the project's `roleIsLens` invariant to the catalog.
3. **The registry is the SSOT of palette metadata** (OCP + capability-discovery). Icons, labels (i18n), descriptions, groups all come FROM `NodeSliceMeta`. The palette is a pure projection; a new slice = a new tile with zero palette code (Benchmark row 2 is already "None" severity — we are simply *consuming* metadata we already own).
4. **Provenance is first-class in the authoring surface, not just the runner** (Law 9). Source agency, SDMX code, unit, last-updated, methodology/preliminary badges appear where the author BINDS, not only where the reader reads.
5. **The pipeline is legible through the data's own bidirectional graph** — no tutorial surface (YAGNI). "Used in N places" (`computeMetricImpact`, already built) + a bind-from-block affordance make define→bind→place self-evident.
6. **One language policy, one brand** — every UI string localized (structural labels included), "Strata" everywhere, enforced by a fitness gate mirroring the existing `config-no-locale-leak` gate (AR-26/37).
7. **The tool leads; the author is never lost, never blocked** (§1.5 doctrine). Every surface, in every state, answers *"what can I do next?"* through contextual affordances (guided empty-states + CTAs, readiness signals, suggestions) — **guidance by affordance, never a wizard or a gate.** This is the formal successor to the deleted 3-step wizard: a wizard imposes temporal order and *blocks*; affordance-guidance imposes legibility and *suggests*. It is EXPAND-not-restrict — more capability, more organized.
8. **Everything the runner renders is authorable — and provably so** (Phase-2 invariant, made executable). Each element registers a COMPLETE PropSchema co-located with it as the SSOT (never runtime TS-reflection — types are erased); the Inspector is a pure generic renderer; a fitness gate asserts completeness. New element = register schema = fully authorable, Inspector unchanged (OCP / Law 8). This is Idea 3 stated as a law.

---

## 1.5. The Guided-Canvas doctrine (the spine — applied in every wave, not a wave of its own)

> Owner mandate (2026-07-10): *"Strata itself should proactively GUIDE and lead the user on what to do next"* — and, crucially, this is **NOT restriction; it is the opposite — EXPAND capability, but make it MORE canonical and MORE organized.**

**The rule.** At every point the Studio must make the *next best action* discoverable **by affordance**, and must **never block** the author from a legal action. Concretely, four affordance instruments (each a projection of state we already own, so none is a hand-authored tour that rots):

| Instrument | What it is | Derived from (already-owned SSOT) |
|-----------|-----------|-----------------------------------|
| **Guided empty-states + CTAs** | every empty region shows ONE state that names what to do and offers the button to do it | the `EmptyKind` discriminant (§2.1) |
| **Readiness signals** | non-blocking "still needed" dots/badges on pages, sections, the frame, metrics | the save-guard + required-regions (§2.8) + `computeMetricImpact` (usage) |
| **Suggestions** | fit-for-data "Recommended" palette section, suggest-the-chart, recommended-blocks per page type | the capability registry + cube profile (already live) + page-type presets (§2.8) |
| **A legible map** | the Navigator shows the whole hierarchy so the author orients instead of guessing | the outline/hierarchy model (§2.9) |

**The single hard boundary — the ONLY thing that may block.** *Structural impossibility*, never *workflow order*. You cannot bind a metric to a node whose container does not exist yet (already a mechanical no-op in `insertNodePatch`: unknown parent → no-op). That is the entire allowlist of "gates". Everything else is a *suggestion*: the author may insert anything, select anything, skip anything, in any order.

**Reconciliation with the deleted wizard (explicit, per the owner's guardrail).** The owner deleted the 3-step Data→Site→Pages wizard because it *conflated roles and forced temporal order*. This doctrine is its formal replacement: we keep the *intent* (the author is guided) and discard the *mechanism* (a blocking linear stepper). A soft-gate that says "you must finish the chrome before adding a section" would re-create the wizard and is **forbidden** (FF-NO-WORKFLOW-GATE, §5).

**Benchmark:** Notion (contextual empty doc + slash affordances, never a stepper) · Linear (empty-state CTAs + command palette + keyboard-first suggestions) · Framer (canvas legibility + insert affordances) · Figma (contextual right panel + assets). **Our-better:** every affordance is a *projection of the same registries/graph that drive rendering* (capability registry, metric-impact reverse index, save-guard readiness) — so guidance is self-maintaining and *fitness-checked*, not a tour to keep in sync. This is the quadrant no builder occupies: *statistics-grade governance* guiding a *non-programmer* without a query language and without a turnstile.

**"In no case worse than now" for the doctrine:** today the author is frequently *blocked-by-emptiness* (the null-home strands the whole tool, the 3× dead empty-states, the dead Inspector panel). Every instrument above strictly *removes* a dead-end. There is no state this doctrine makes more restrictive.

---

## 2. The canonical IA

### 2.1 Entry-state / "Home" doctrine

**The canonical first screen** = the **always-mounted live canvas** rendering the **effective active page**, with the rail's default surface open beside it, the Inspector showing a contextual hint (not an error), and the page tablist showing the active page selected.

Two structural moves:

**(a) Derived effective-active-page (kills finding #1 as a class).**
Introduce a single selector — the SSOT for "which page is live":

```
useEffectiveActivePageId() = activePageId ?? pages[0]?.id ?? null
useEffectiveActivePage()   = pages.find(p => p.id === effId) ?? null
```

Every consumer that today reads raw `activePageId` for *rendering* (StudioShell canvas gate, `useCanvasController`, the top-bar Select value, the bottom tablist `aria-selected`) reads the **derived** value. Raw `activePageId` remains the *write* target (explicit user selection still sets it); the derivation only supplies the fallback. Result: with ≥1 page there is ALWAYS a home, regardless of whether any imperative `setActivePage` fired, raced, or was cleared. The existing `setActivePage` calls (`api-actions.ts:112`, `App.tsx:85/101`) stay as an optimization, no longer as the sole guarantee.

> **Why derive rather than "fix the setter"?** The audit proves the imperative set is *already coded* yet the live boot still shows `null`. Whatever the specific miss (hydrate ordering, a `setPages` interaction, a StrictMode race, a live-payload shape), deriving removes every instance at once and forbids regression. This is the root-cause fix; patching one setter is a symptom patch (Law 6).

**(b) One empty-state doctrine (kills the 3× "No page selected").**
A single `<StudioEmptyState kind icon title body cta>` component with three canonical instances, chosen by an explicit discriminated `EmptyKind`, never rendered more than once per region:

| Kind | When | Message + CTA |
|------|------|---------------|
| `no-pages` | `pages.length === 0` (genuinely empty site) | "დაიწყეთ პირველი გვერდით / Start with your first page" → **primary CTA: Create page** |
| `page-blank` | active page, `nodeIds.length === 0` | "ჩასვით პირველი ბლოკი / Insert your first block" → CTA opens the Insert surface (teaches step ① of the pipeline) |
| `no-selection` | canvas has nodes, nothing selected (Inspector) | ONE quiet hint: "აირჩიეთ ბლოკი მის რედაქტირებლად / Select a block to edit it" — a hint, **never an error, never stacked** |

The Inspector (`RightDock`) renders `no-selection` **at most once**. The canvas renders `page-blank` or `no-pages`. The rule: an empty region shows exactly one guided, CTA-bearing state — the steward can always tell empty from broken.

**Benchmark:** Builder.io/Figma boot into the last-edited or first page; Notion opens a document; Framer opens the canvas — never a void. **Our-better:** the home is *guaranteed by derivation* (a fitness function, not a lifecycle hope), and the empty-states double as the pipeline's first lesson.

### 2.2 The one-catalog-two-lenses model (the sharpest fix)

**Principle:** ONE governed metric = ONE presentation component (`<MetricCard>`), rendered under two affordance lenses. Role is a lens over the SAME document (`roleIsLens.fitness.test.ts`), so the catalog obeys the same law.

**The shared record component — `<MetricCard>` (the SSOT):**

```
<MetricCard
  metric={ManifestMetric}
  lens="consumer" | "steward"
  provenance={ProvenanceView}     // resolved via MetadataPort join (see below)
  usage={{ blocks, pages }}       // computeMetricImpact reverse index (already built)
  onBind?  onEdit?  onDelete?     // affordances supplied per lens
/>
```

It renders, **in both lenses** (Law 9 — provenance is not steward-only):

- **Identity:** label (i18n `readCatalogLabel`), `id`, `code`/`sdmx-code`, `derived` badge when `calc` present.
- **Meaning:** `unit` (i18n), `description` (i18n) as an info-affordance/tooltip.
- **Provenance:** source **agency**, **last-updated** freshness, **methodology** link, **preliminary** badge — the ONS/IMF/Eurostat surface.
- **Governance:** **"used in N blocks across M pages"** (the reverse index).

**The two lenses differ ONLY in affordances (no duplicate markup):**

| | **Consumer lens** (Author · the *Data* surface) | **Steward lens** (the *Model* surface) |
|---|---|---|
| Read (identity/meaning/provenance/usage) | ✅ | ✅ |
| Bind (drag onto block · click-to-bind) | ✅ (`onBind`) | — |
| Author (edit · delete · new · blast-radius) | — | ✅ (`onEdit`/`onDelete` + impact preview) |
| Escape hatch (raw source/spec/query modeler) | — (FF-AUTHOR-NO-QUERY) | ✅ (relocated `DataModelingPanel`, below the catalog) |

`MetricPalette` (consumer) and `MetricCatalogManager` (steward) both **compose `<MetricCard>`** — the divergent-fidelity gap (finding #2) is closed at the component level, permanently, by a fitness gate that forbids a second metric-row markup.

**Provenance source (no new contract — Law 5, YAGNI):** `ManifestMetric` already carries `unit`, `code`, `methodology`, `description`. Agency + last-updated + preliminary live in the existing `MetadataPort` / `ProvenanceRecord` (`reference-metadata.ts`, `agency_scheme` AR-20), keyed by dataset code. The card resolves a `ProvenanceView` via a **thin apps-only resolver** that joins metric → its dataset(s) → provenance. If the client MetadataPort read is not yet wired, the card **degrades gracefully** to what `ManifestMetric` carries (unit/code/methodology/description) and simply omits agency/last-updated — never fabricates. (Wiring the agency/last-updated join is a small follow-up on the data track; the card's shape is ready for it.)

**Two rail entries, ONE card (a deliberate IA decision — see §6 D1):** Data (consumer, bind-focused) and Model (steward, define + modeler) remain **two rail slots**, unified at the *card* level. They are NOT merged into one entry, because Model also hosts the raw modeler escape hatch, which must never leak into the author's bind flow (FF-AUTHOR-NO-QUERY). The "two lenses" ARE the two rail entries; the anti-duplication is the shared card.

**Benchmark:** Looker Explore (consumer) vs LookML/Develop (steward) over one model; Metabase data-reference vs data-model admin; dbt docs catalog; Sigma dataset↔workbook. **Our-better:** the SAME card in both lenses, provenance first-class in *both* (most builders show provenance only to the modeler, or nowhere), role-as-lens (not a route/permission), and a governed *number*-level identity rather than a raw column.

### 2.3 Insert palette elevation

**Move:** render the registry metadata the palette already discards.

- `PaletteEntry` gains `icon` (from `NodeSliceMeta.icon`), `description` (i18n), and keeps `label` as an i18n `LocaleString` (resolved at the render seam, not pre-flattened to en/ka).
- `NodePalette` renders **icon-tile cards**: `[icon] Name — description`, grouped, uniform width (kills the ragged `•`-list).
- Group headings become **localized** via a `PALETTE_GROUP_LABELS: Record<groupKey, {ka,en}>` table (peer of `SURFACE_HEADINGS`), replacing the hardcoded English `"Recommended"/"Data panels"/"Layout"/"Content"`.
- `InsertSurface`'s section overlines (`ბლოკები`/`გარსი`) become i18n bags too.

The palette stays **registry-derived** (OCP): a new slice appears as a new tile with zero palette code; capability-gating + suggest-the-chart (already live) are preserved.

**Benchmark:** Builder.io / Webflow / Framer / Notion icon-tile palettes with name + description. **Our-better:** the tiles are a pure projection of the capability registry (not a hand-maintained catalog), already capability-gated to the active dataset and led by a fit-for-data "Recommended" section.

### 2.4 Pipeline legibility (define → bind → place)

No new surface (YAGNI). Make the existing bidirectional graph visible:

1. **Place → Bind (forward):** when a data-bindable block is selected, the Data surface / Inspector leads with an unmistakable **"① Bind a metric to fill this block"** affordance (elevate the existing `bindHint`), and the block's empty state on canvas says the same. Binding is a noun-pick from the catalog (§2.2).
2. **Bind → Define (backward):** every `<MetricCard>` shows **"used in N blocks across M pages"** — the `computeMetricImpact` reverse index, already built for the steward's blast-radius, now surfaced in BOTH lenses. The graph becomes navigable both ways.
3. **Ordinal cue:** the rail tooltips / surface headings carry a light ordinal — **Define · Bind · Place** (Model → Data → Insert) — a mnemonic, not a wizard. The `page-blank` empty-state spells it once: "① Insert a block → ② Bind a metric."

**Benchmark:** Retool add-component→bind-query→configure; Builder.io insert→bind-data-model. **Our-better:** step ② is a governed-noun pick (not a query), and "used in N places" makes the governance graph bidirectional and audit-aware.

### 2.5 Surface taxonomy & prominence (correct the inversion)

**Correction is two-pronged:** (a) raise Insert & Data quality (§2.3, §2.2) so their default-prominence is *earned*; (b) impose a canonical, verb-grouped, flow-ordered rail with visual clusters (Webflow/Framer rail-divider idiom).

**Canonical rail (Author / Compose lens), top→bottom, grouped:**

| Group | Surface | Verb | Notes |
|-------|---------|------|-------|
| **Build** | **Insert** | Add | elevated (§2.3); default landing surface |
| | **Layers** | Structure | the outline/Navigator, adjacent to Insert (the "build structure" pair) |
| **Data** | **Data** | Bind | consumer lens of the catalog, provenance-rich (§2.2) |
| **Design** | **Style** | Design | already a first-class rail entry — kept, not hidden |
| **Site** | **Pages & Site** | Settings | site-scope config |

**Steward / Data-model lens** adds, in the Data group: **Model** (Define) — the define half + the relocated modeler.

Dividers separate Build · Data · Design · Site. **Default surface** stays **Insert** (post-elevation) with the canvas as the true hero (always-mounted home). The Model/Style "gating" concern is largely already addressed: Style is a rail entry; Model is reached via the Framer-style Compose|Data-model segmented switch shipped this session (kept). The residual inversion was *roughness*, resolved by the quality waves.

**Benchmark:** Webflow (Add · Navigator · Style · Settings) · Framer (Insert · Layers · Assets). **Our-better:** the taxonomy maps 1:1 to the authoring flow AND to the pipeline verbs (Define·Bind·Place), and the steward's define surface joins the same Data cluster rather than living in a separate mode-world.

### 2.6 Bilingual + brand unification

**Language policy:** every UI string in the Studio chrome is localized, including *structural* labels (section overlines, palette group headings) and *node-type badges*. Structural labels use `{ka,en}` bags resolved at the render seam (as `RailEntry.label` already does). A fitness gate **FF-NO-UI-LOCALE-LEAK** scans the Studio surfaces for bare non-LocaleString UI strings — the panel-chrome peer of the `config-no-locale-leak` gate (AR-26/37). The gate is scoped to user-visible chrome (aria-labels, headings, tooltips, empty-states), not test/dev strings.

**Brand:** "Strata" everywhere. Retire the login wordmark **"Constructor / GeoStat Statistics Dashboard Platform" → "Strata"** (the shell already says Strata). FF-ONE-BRAND forbids the `Constructor`/`GeoStat` wordmark literal in the shipped chrome. (One-way-ish: needs the owner's final blessing of "Strata" as the product name — see §6 D2.)

**Benchmark:** every mature product = one name, one language policy. **Our-better:** the leak is *structurally* prevented by a fitness gate, not caught by review.

### 2.7 Authoring feedback loop (design intent — coordinated with the data-resolution track)

**The canonical "authored → verified" loop:** the author must SEE a real number before trusting a metric. Three design elements (the data-resolution *bug* is on the separate track; this is the IA/design intent that consumes its fix):

1. **Preview-at-the-noun:** each `<MetricCard>` carries an optional **"Preview value"** chip that resolves the metric against the live store (via the same `resolveMeasureRef` → DataStore seam the runner uses) and shows the current number — or an **honest** "no data for the current selection", **never a silent 0**. This closes the loop AT the catalog, independent of placing the metric on canvas — the "one number everywhere" promise made visible.
2. **Preview context on the Studio canvas:** the always-mounted canvas needs a live `SectionContext` + `DataStore` so bound blocks resolve (the M3.0 follow-up already names this seam: "numeric canvas live-preview needs a DataStore/SectionContext seam in Model surface"). The controller already carries `previewPerspectiveId`; bind it to a real store.
3. **No raw-token leak:** `{time}`, `{SPANFROM}–{SPANTO}`, `empty.title` are unresolved template/i18n placeholders rendering raw — the preview must run the runner's resolve seam. A leaking `empty.title` is a missing translation → the FF-NO-UI-LOCALE-LEAK gate + an honest "missing translation" fallback (never the raw key).

**Benchmark:** Tableau Prep live-preview · Retool live query preview · Looker Explore runs the query. **Our-better:** verification is at the **governed-noun** level (preview the metric, not just a chart), so "the number" is validated before it is placed.

### 2.8. Page-type at creation — the data-driven page-type registry (Idea 1)

**The move.** Page creation chooses a **page TYPE** (landing / inner-analytical / profile / … / blank), and the page starts from a **type-appropriate structure** — never a dead blank canvas. This is the canonical cure for the blank-canvas entry-state, designed *together with* the empty-state doctrine (§2.1): the `no-pages` and `page-blank` CTAs open this picker.

**Not a hardcoded enum — a registry of CONFIG DATA (Law 1 + Law 2).** A page type is a record, not a class:

```
interface PageTypePreset {              // pure data — Constructor-ready, serializable
  id:                 string            // extensible registry key (no privileged name — Law 1)
  name:               LocaleString
  description:        LocaleString
  icon:               string            // registry icon token (like NodeSliceMeta.icon)
  requiredRegions:    RegionSpec[]      // "a landing page needs a hero + a CTA band" — drives readiness (§1.5)
  recommendedBlocks:  NodeType[]        // suggestions surfaced in the palette's Recommended section
  perspectiveDefaults?: PerspectiveRef  // type-appropriate default lens
  starterConfig:      NodePageConfig    // the initial tree — a valid config the save-guard accepts
}
```

The named types are **seeded INSTANCES** of `pageTypeRegistry`, exactly as `STARTER_TEMPLATES` today seeds the gallery. **This is an extension of an existing seam, not a new one:** `features/templates/starterTemplates.ts` already models `StarterTemplate = { id, name, description, icon, config: NodePageConfig }` as committed config data flowing through `createFromTemplate` → the SAME `createPage` save-guard a hand-built page uses. Idea 1 = **lift `StarterTemplate` → `PageTypePreset`** by adding `requiredRegions`/`recommendedBlocks`/`perspectiveDefaults` (the type semantics), so the created page is not just pre-shaped but *type-aware* — the doctrine's readiness/suggestions know what a page of this type "still needs". **Compose the existing page-type slices — don't fork "what a page type is" (one-SSOT):** the *frame/chrome* half of a page type is **already registered** in `packages/plugins/pages/` as `sliceType:'page'` slices (`inner-page`, `container-page`, and a `container-page/landing` variant already carrying `frame:'landing'` + transparent chrome + slots). So a `PageTypePreset`'s **type identity** must *reference* a registered page-slice `{ type, variant }` (frame/chrome/slots derive from it; its `starterConfig` root already names it, `type:'inner-page'`), while only its **structure + semantics** (`starterConfig`/`requiredRegions`/`recommendedBlocks`) are new apps-side data — the preset composes the slice, never re-declares frame/chrome (else "landing" gets two definitions). Seeding: `landing`→`container-page/landing`, `inner-analytical`/`profile`→`inner-page` (`profile` earns a new page-slice *variant* only if its frame/chrome truly differ — else a pure structure preset, Law 1/YAGNI). The *type* stays in `plugins`, the *preset* in `apps` — one SSOT each.

**Guardrail (owner-mandated, non-negotiable): a `blank`/`other` preset is ALWAYS registered.** Creation is never *more* restrictive than today — the author can still start minimal. `blank` is just another registry record (Law 1: no privileged type, including no privileged "blank"). Today's gallery already offers starters + data-first generate; we keep both and add the type facet.

**Optional stored facet (expand-contract — flagged D6).** Whether the page persists its type (`page.meta.type`) is a scope call: storing it (additively, non-breaking) lets ongoing readiness reference it ("a landing page usually has a hero → still missing"); absent, the type is a *creation-time* preset only and readiness degrades gracefully. Recommend: additive optional `page.meta.type`, never required, parallel-change migration (stored pages that predate it are valid).

**Where it lands:** entry-state (§2.1) — the picker IS the `no-pages`/`page-blank` primary CTA. **Taxonomy:** creation surface, reachable from the Pages & Site rail slot and the empty-states.
**Apps-only build + fitness guard:** all apps-only (registry + gallery extension). **FF-PAGETYPE-DATA-DRIVEN** — every page type is a registry record; no hardcoded page-type enum/switch anywhere; a `blank` type is always present. **FF-PAGETYPE-VALID** — every preset's `starterConfig` passes the save-guard (mirrors the existing `templates.fitness.test.ts`).
**Benchmark:** Notion page/database templates · Webflow page types (static/CMS/commerce) · Framer page presets · Wix ADI · WordPress page templates · Builder.io content-model + starter. **Our-better:** the page type is *config data in an open registry* (a plugin can register a type with zero creation-flow code — OCP), it carries *required-regions* that feed the doctrine's readiness signals (leaders' templates are inert starting points; ours are living contracts), and it can be *data-first generated* from the bound cube (the existing generate path), so a statistics page starts filled, then is refined.

### 2.9. Canonical hierarchy made visible — non-blocking "chrome-first" (Idea 2)

**The reframe (per the lead's guardrail).** The page IS hierarchical — **frame/chrome → sections → nodes** — and a sensible authoring flow *follows* that top-down order. But a hard "you can't proceed until the chrome is done" would recreate the deleted wizard and could be *worse than now*. So we deliver the hierarchy as a **legible map + readiness + suggested order**, and **never lock the author out** (§1.5 doctrine).

**Three moves:**

1. **The whole hierarchy in one Navigator.** Extend `outline/OutlineTree` so the chrome/frame tier renders *above* the section/node tree — the author sees `Frame → [Header, Nav] → Section → [Chart, Table] → …` as one legible outline (Webflow Navigator / Figma layers / Framer legibility). Today chrome (`chromeRegistry` / `ChromeInspectorPanel`) and nodes (`outlineModel`) are separate mental models; unifying them in the Navigator makes the hierarchy *self-evident* without a stepper.
2. **Readiness signals, not gates.** Each tier carries a non-blocking "still needed" affordance derived from the save-guard + the page type's `requiredRegions` (§2.8): a section with no bound data shows a quiet "needs data" dot; the frame shows a completeness hint. These are *suggestions the author may ignore* — the doctrine's readiness instrument.
3. **Suggested default order via CTAs, never a turnstile.** The `page-blank` empty-state and the palette's Recommended section suggest the top-down path ("① frame → ② sections → ③ bind"), but insert/select/skip are unrestricted at all times.

**The ONLY permitted gate = structural impossibility (already mechanical).** `insertNodePatch`/`moveNodePatch` already no-op an unknown parent and refuse nesting a node into its own subtree — you literally cannot bind a metric to a node whose container does not exist. That class — *the target doesn't exist* — is the entire gate allowlist. Workflow-order gates are forbidden (FF-NO-WORKFLOW-GATE). This is the explicit reconciliation the lead asked for: **structural legibility, zero temporal blocking.**

**Where it lands:** the Navigator (`outline/`) + the rail taxonomy (§2.5, the Insert/Layers "build structure" pair). **Apps-only build + fitness guard:** all apps-only. **FF-NAVIGATOR-FULL-HIERARCHY** — the Navigator renders chrome + sections + nodes as one tree (no tier silently omitted). **FF-NO-WORKFLOW-GATE** — no code path disables/blocks insert or select on the basis of "an earlier tier is incomplete"; the only permitted refusal is a *structural* parent-missing / cyclic-nest no-op (enumerated allowlist). **FF-READINESS-DERIVED** — readiness badges are computed from the save-guard / required-regions, never hand-set literals.
**Benchmark:** Webflow Navigator · Figma layers · Framer layers. **Our-better:** the Navigator carries *governance-aware readiness* (needs-data / unbound-metric dots from the save-guard and impact index) that pure layer trees don't, and the hierarchy is *semantic* (frame → section → node) not just DOM nesting — while remaining strictly non-blocking.

### 2.10. Each node's FULL config from its interface — the schema-complete Inspector (Idea 3, the keystone)

**The architecture already exists — this milestone completes and *proves* it.** The Inspector (`inspector/Inspector.tsx`) is ALREADY a generic schema-renderer: it reads `schemaSource.getSchema(node)` → `nodeRegistry.getSchema(type, variant)` and renders the WHOLE property panel from the PropSchema, with dispatch open on both axes (type → registry schema; field → `fieldControlRegistry`). This is **Seam-2**, the panel's equivalent of Framer `addPropertyControls` / Builder.io `registerComponent` inputs / Storybook `argTypes` / JSON-Forms / Puck field defs. **Do not reinvent it — extend it.** The owner's refinement is exactly right and already the pattern: **not runtime TS-reflection** (interfaces are erased), but an *explicit, co-located PropSchema per element* as the SSOT (e.g. `HeroSchema` lives beside `interface HeroNode` in `HeroNode.ts`).

**The gap the audit found (named precisely — three layers):**

1. **No completeness gate at the top level.** Most slices *do* declare a schema field per editable interface field (Hero: `title`/`subtitle`/`cards` ✓). But *nothing pins it* — a new slice can ship a partial schema and silently drop props from the Inspector, and the Inspector even has a **dead-end empty-state** (`Inspector.tsx:148` — *"No property schema for `X` yet"*), which violates the doctrine (a dead panel).
2. **Nested / array items are opaque.** `HeroNode.cards: HeroCardDef[]` (each card has `title`/`sub`/`color`/`img`/`pageBg`) renders through a single opaque `array` control — the item's sub-fields have *no declared sub-schema*, so they are **not fully authorable**. This is the real completeness frontier, and it is *already a known gap* (the M0 follow-up: *"KPI inline per-item metric-ref needs core `itemSchema`"*).
3. **The dead panel** (layer 1's symptom) must become *impossible by construction*, not a friendlier message.

**The design — completeness as a two-tier fitness gate (`FF-SCHEMA-COMPLETE`):**

- **(a) Runtime completeness gate — EXTEND the existing guard, do NOT reinvent (Seam-2).** `packages/plugins/nodes/__tests__/schema-completeness.fitness.test.ts` ALREADY asserts every placeable meta has a *non-empty* schema (C0 fitness #1). Upgrade it *in place*, non-empty → interface-complete: cover every key in the meta's required `defaults` + every property in the emitted JSON Schema (`generatePageConfigSchema`/`propSchemaToJsonSchema`), keeping its `PURE_CONTAINERS` exempt-set idiom. This *kills the dead "no schema yet" panel by construction* — an incomplete placeable fails the build, so `Inspector.tsx`'s empty branch is unreachable.
- **(b) Compile-time 1:1 gate, co-located per element (apps-adjacent, ship now).** A type-level assertion beside each schema that the schema's field-set equals the *editable* keys of the element's interface (excluding `NodeBase` system fields + child-slot fields). Since interfaces are erased at runtime, completeness against the interface is checked at *compile* time — `type _Assert = AssertSchemaCovers<HeroNode, typeof HeroSchema>`. This is the owner's "aligned 1:1 with its interface as the single SSOT" made executable. A new editable field with no schema entry fails `tsc`.
- **(c) Nested item-schema — a visible, shrinking allowlist + ONE engine seam (coordinated, owner-gated D7).** Object/array fields whose item is an interface must declare an `itemSchema` (rendered as a nested form), OR be explicitly allowlisted as opaque-with-rationale (a `SCHEMA_TODO` set, exactly like `coverage.fitness`'s `COVERAGE_TODO`) — so nested completeness is a *forcing function, not a hope*. **Honest boundary:** rendering a nested item-schema needs an additive `object`/`array-of` PropField discriminant carrying `itemSchema` in `packages/react/engine` — this crosses the apps-only line. It is OCP-clean (new PropFieldType = new capability, Inspector interface unchanged — Law 8) and sequenced like M3's growth-noun as a *coordinated packages change* (§6 D7). Ship (a)+(b) now (apps-only); land (c) after the owner blesses the engine seam.

**Audit verdict to record:** top-level schema coverage is *good but ungated* (most slices are 1:1, silently); nested coverage is *incomplete and ungated* (array/object items are opaque). The completeness gate makes both *provable and non-regressing*, and cures the Inspector dead-panel defect from the audit.

**Where it lands:** the Inspector (extends §2.1's RightDock content + Seam-2). **Our-better:** the schema is co-located with the element as SSOT *and* compile-time-checked against the interface, so "everything the runner renders is authorable" is a *build gate*, not a claim — the Phase-2 invariant made executable, with the Inspector staying a pure OCP projection (new element = register schema = fully authorable, zero Inspector change).

### 2.11. The canonical right dock — no leftover empty space by construction (Idea 4)

**The confirmed defect.** `studio/RightDock.tsx` renders, when nothing is selected, a **fixed-height 160px empty island** and then *always* stacks `PageInspectorPanel` + `PerspectivesPane` + `FiltersDrawer` beneath dividers — producing the awkward right-side void the owner reported *and* the repeated empty-states (each always-mounted page pane prints its own "nothing here"). There is no tabbing, no fill, no collapse/resize.

**The canonical model — one dock, contextual, fill-by-construction:**

1. **Tri-context selection, one dock (kills the perpetual stack).** The dock renders exactly ONE context, chosen by what is selected:
   - **node selected** → the schema-driven Inspector (§2.10) fills the dock;
   - **chrome selected** → the chrome Inspector (same generic renderer, chrome source);
   - **nothing / canvas-background selected** → the **Page context** (the page config / perspectives / filters panes) — these move *out* of the always-stacked column into the Page context so they never pad the node Inspector with a void.
   A persistent **"Page"** affordance (a tab / the background-click target) keeps page-scope authoring one click away — **never hidden** (the "no worse than now" guardrail: today the page panes are always visible; they must stay reachable in one gesture).
2. **Schema-grouped tabs when a node is selected.** The node Inspector organizes into contextual sections — **Properties / Style / Data / Visibility** — **derived from the PropSchema's `group`s** (`PropertyGroup`, already modeled), not hardcoded (OCP: a slice that declares a new group gets a new tab for free). Accordion when few groups, tabs when many (the Figma/Framer hybrid).
3. **Fill by construction (leftover space made impossible).** The dock's content region is a flex-fill: it is EITHER a full schema form (scrolls) OR exactly ONE centered guided empty-state (`no-selection`, §2.1) that fills the height — **never** a short 160px island followed by a stacked remainder. Collapsible + resizable; when collapsed the **canvas reclaims the space** (no void possible).

**Where it lands:** the Inspector / RightDock (redesign of §2.1's dock + §2.10's content). **Ties to Idea 3:** node-selected → the schema-driven tabs fill the dock; **ties to §2.1:** reuses the single `no-selection` empty-state (retires the 3×).
**Apps-only build + fitness guard:** all apps-only. **FF-RIGHTDOCK-SINGLE-EMPTYSTATE** — the dock renders at most one empty-state (subsumes/extends FF-ONE-EMPTYSTATE). **FF-RIGHTDOCK-CONTEXTUAL** — page-scoped panes render only in the Page selection context, never stacked beneath the node Inspector. **FF-RIGHTDOCK-FILLS** — the dock content region is flex-fill with no fixed-height dead island (a layout-contract test / lint on the dock).
**Benchmark:** Framer / Figma / Webflow / Retool right panels — contextual tabbed sections (Properties/Style/Data), collapsible + resizable, ONE graceful empty-state, canvas breathes when collapsed. **Our-better:** the tabs are *derived from the schema's own groups* (not a fixed Properties/Style/Data triad — a stats block with a "Provenance" group gets a Provenance tab), and the single empty-state carries a *next-step CTA* (the doctrine), so even the "nothing selected" state leads rather than voids.

---

## 3. Benchmark table (problem → proven pattern → our-better)

| # | Problem | Proven pattern (who) | Our design — better/adapted for statistics-grade × non-programmer |
|---|---------|----------------------|-------------------------------------------------------------------|
| 1 | No home / null entry | Boot into first/last page (Builder.io, Figma, Notion, Framer) | Home **guaranteed by derivation** (`activePageId ?? pages[0]`), locked by FF-ALWAYS-A-HOME — a fitness function, not a lifecycle hope. Empty-states double as the pipeline's first lesson. |
| 2 | Data vs Model divergence | One model, two modes: Explore vs Develop (Looker); data-reference vs admin (Metabase); dbt docs | ONE `<MetricCard>`, two affordance lenses; provenance first-class in **both** (leaders show it only to the modeler); role-as-lens not a route. |
| 3 | Insert = debug list | Icon-tile palette w/ name+description (Builder.io, Webflow, Framer, Notion) | Tiles are a **pure projection of the capability registry** (OCP — new slice = new tile, no palette code), capability-gated + fit-for-data "Recommended". |
| 4 | Provenance absent | Data catalog w/ source/freshness (Looker, Metabase, Collibra); ONS/IMF/Eurostat integrity badges | Provenance in the **authoring** surface (agency/code/unit/updated/methodology/preliminary), resolved via existing MetadataPort — where the author BINDS, not only where the reader reads (Law 9). |
| 5 | Pipeline invisible | add→bind→configure choreography (Retool, Builder.io) | Bidirectional via the data's own graph: bind-from-block forward + "used in N places" backward (both already-built indexes), plus a Define·Bind·Place mnemonic — no tutorial surface. |
| 6 | Prominence inverted | Verb-grouped rail w/ dividers (Webflow Add·Navigator·Style·Settings; Framer Insert·Layers·Assets) | Canonical taxonomy mapping 1:1 to authoring flow AND pipeline verbs; the steward's Define joins the Data cluster, not a separate mode-world. |
| 7 | Bilingual leak + brand split | One name, one language policy (every mature product) | Leak **structurally prevented** by FF-NO-UI-LOCALE-LEAK (panel-chrome peer of AR-26/37 gate); one "Strata" brand, FF-ONE-BRAND. |
| 8 | No feedback loop | Live query/data preview (Tableau Prep, Retool, Looker Explore) | Preview at the **governed-noun** level (a "Preview value" chip resolving the real number, or honest no-data — never silent 0); "one number everywhere" made visible. |
| 9 | Dead blank-canvas entry (Idea 1) | Page templates/types (Notion, Webflow, Framer, Wix ADI, WordPress) | Page type = **config data in an open registry** (plugin can add a type, zero flow code — OCP); carries *required-regions* feeding readiness; can be *data-first generated* from the bound cube; a `blank` type always present. |
| 10 | Author loses the hierarchy / wizard blocks (Idea 2) | Navigator / layers (Webflow, Figma, Framer) | The WHOLE semantic hierarchy (frame→section→node) in one legible tree with *governance-aware readiness* (needs-data / unbound-metric dots), **strictly non-blocking** — the only refusal is structural impossibility. |
| 11 | Not everything is authorable (Idea 3) | Registered field defs (Framer addPropertyControls, Builder.io registerComponent, Storybook argTypes, JSON-Forms, Puck) | Schema co-located as SSOT + **compile-time 1:1 gate against the interface** + nested `itemSchema` with a shrinking allowlist — "everything the runner renders is authorable" is a *build gate*, Inspector stays a pure OCP projection. |
| 12 | Right-dock dead space / repeated empty-states (Idea 4) | Contextual tabbed right panel (Framer, Figma, Webflow, Retool) | Tabs *derived from the schema's own groups* (not a fixed triad); tri-context one-dock (node/chrome/Page) so page panes never pad a void; single empty-state *with a CTA*; fill-by-construction so leftover space is impossible. |

**The quadrant we uniquely occupy:** *statistics-grade (LookML/Malloy power, ONS/Eurostat integrity) AND non-programmer-authorable (Builder.io/Notion simplicity)*. Every "our-better" above is chosen to hold BOTH axes: provenance/governance rigor without a query language; a registry-driven palette without code; a derived home without lifecycle fragility.

---

## 4. Phased wave plan (impact ÷ effort — cheap keystones first)

All waves are **apps-only, reversible**, behind no new capability surface. Each is independently routable to a build agent.

### Wave 0 — Entry-state keystone (highest impact ÷ effort)
- **Scope:** derived `useEffectiveActivePageId/Page` selector; every *render* consumer reads it; one `<StudioEmptyState>` with the three `EmptyKind`s; kill the 3× "No page selected".
- **Files/areas:** `store/constructor.selectors.ts` (new selector), `studio/StudioShell.tsx`, `studio/useCanvasController.ts`, `studio/StudioTopBar.tsx` (Select value), the bottom tablist, `studio/RightDock` (single `no-selection`), new `studio/StudioEmptyState.tsx`.
- **Fitness guard:** **FF-ALWAYS-A-HOME** (`pages.length > 0 ⇒ effectiveActivePageId !== null`) · **FF-ONE-EMPTYSTATE** (no literal "No page selected"/"გვერდი არ არის არჩეული" appears more than once; empty regions render `<StudioEmptyState>`).
- **Risk:** low. Pure derivation + component extraction; no write-path change.

### Wave 1 — Insert palette elevation
- **Scope:** `PaletteEntry` carries `icon` + i18n `label` + i18n `description`; `NodePalette` renders icon-tiles; `PALETTE_GROUP_LABELS` i18n table; `InsertSurface` overlines i18n.
- **Files/areas:** `canvas/paletteEntries.ts`, `canvas/NodePalette.tsx`, `canvas/node-palette.css`, `studio/surfaces/InsertSurface.tsx`, new group-label table.
- **Fitness guard:** **FF-PALETTE-META-DRIVEN** (every tile's icon/label/description/group derive from registry meta; no hardcoded palette label/heading string).
- **Risk:** low-med. `NodePalette` has existing tests expecting the flat shape — preserve the flat fallback; add the tile render as the grouped path.

### Wave 2 — One-catalog-two-lenses (the sharpest IA fix)
- **Scope:** extract `<MetricCard lens>` as the SSOT record; `MetricPalette` (consumer) + `MetricCatalogManager` (steward) both compose it; resolve `ProvenanceView` via a thin MetadataPort join (graceful degrade); surface "used in N places" in both lenses.
- **Files/areas:** new `discovery/MetricCard.tsx`, `discovery/MetricPalette.tsx`, `studio/model/MetricCatalogManager.tsx`, new `discovery/provenanceView.ts` (apps-only resolver), reuse `studio/model/metricImpact.ts`.
- **Fitness guard:** **FF-ONE-METRIC-CARD** (both lenses import the same card; no second metric-row markup) · **FF-PROVENANCE-IN-BOTH-LENSES** (card renders source/code/unit/updated affordances under both lenses).
- **Risk:** med. Provenance join may lack a client wire — degrade to `ManifestMetric` fields, never fabricate; add agency/last-updated when the data-track wire lands.

### Wave 3 — Pipeline legibility
- **Scope:** surface "used in N places" on the card (rides Wave 2); elevate the bind-from-block affordance ("① Bind a metric"); Define·Bind·Place ordinal cues on rail tooltips/headings; `page-blank` empty-state teaches the pipeline.
- **Files/areas:** `discovery/MetricCard.tsx`, `studio/surfaces/DataSurface.tsx`, `studio/RightDock`/Inspector bind hint, `studio/rail.ts` (ordinal in headings), `StudioEmptyState`.
- **Fitness guard:** **FF-USAGE-COUNT-VISIBLE** (a bound metric's card shows its non-zero usage; an unused metric shows "0 / unused").
- **Risk:** low. Composition of already-built indexes.

### Wave 4 — Surface taxonomy reorder + dividers
- **Scope:** reorder `RAIL_ENTRIES` to the canonical taxonomy; add Build/Data/Design/Site divider groups; confirm default surface.
- **Files/areas:** `studio/rail.ts` (order + a `group` field per entry), `studio/ActivityRail.tsx` (divider render).
- **Fitness guard:** **FF-RAIL-CANONICAL-ORDER** (rail order + grouping match this spec's taxonomy).
- **Risk:** low. Pure reorg; do *after* Waves 1–2 so the elevated surfaces earn their prominence.

### Wave 5 — Bilingual + brand unification
- **Scope:** localize remaining structural labels + node-type badges; retire the login wordmark → "Strata"; add the leak gate.
- **Files/areas:** `features/auth/LoginForm.tsx`, `studio/surfaces/InsertSurface.tsx`, `canvas/NodePalette.tsx`/`paletteEntries.ts`, any node-type-badge component, new `studio/uiLocaleLeak.fitness.test.ts`.
- **Fitness guard:** **FF-NO-UI-LOCALE-LEAK** (no bare non-LocaleString user-visible chrome string) · **FF-ONE-BRAND** (no `Constructor`/`GeoStat` wordmark literal).
- **Risk:** low; the leak gate may enumerate many small strings — bounded to Studio chrome. **Blocked on owner brand confirmation (D2).**

### Wave 6 — Authoring feedback loop (sequence LAST; coordinate with data-resolution track)
- **Scope:** "Preview value" chip on `<MetricCard>` (resolve via `resolveMeasureRef`→DataStore, honest no-data); Studio-canvas preview `SectionContext`/`DataStore` seam; honest "missing translation" fallback for leaked template/i18n tokens.
- **Files/areas:** `discovery/MetricCard.tsx`, `studio/useCanvasController.ts` (preview store binding), `canvas/CanvasView` preview context, resolve-seam wiring.
- **Fitness guard:** **FF-PREVIEW-RESOLVES-OR-HONEST** (preview shows a real number OR an explicit no-data state, never a silent 0) · **FF-NO-RAW-TOKEN-LEAK** (no `{token}`/`key.path` renders raw in the preview).
- **Risk:** med-high. Depends on the data-resolution bug track (bug B, `PUT` validation) and the M3.0 canvas-preview follow-up. Land after those.

### Wave 7 — Canonical right dock (Idea 4)
- **Scope:** tri-context one-dock (node / chrome / Page); page-scoped panes move into the Page context (reachable via a persistent "Page" affordance); node Inspector organized into schema-group tabs; fill-by-construction (flex-fill, single centered empty-state); collapsible + resizable, canvas reclaims space when collapsed.
- **Files/areas:** `studio/RightDock.tsx` (the redesign), `inspector/Inspector.tsx` (group→tab organization), `features/page-config/PageInspectorPanel.tsx` + `features/perspectives` + `features/filters` (re-homed into the Page context), `studio/useCanvasController.ts` (background-select = Page context), `inspector/Inspector.css`/dock CSS.
- **Fitness guard:** **FF-RIGHTDOCK-SINGLE-EMPTYSTATE** · **FF-RIGHTDOCK-CONTEXTUAL** · **FF-RIGHTDOCK-FILLS**.
- **Risk:** med. Selection-context model is the sensitive part — keep page panes one gesture away (no-worse-than-now). Pairs naturally with Wave 0 (shares the empty-state doctrine).

### Wave 8 — Schema-completeness keystone (Idea 3, tiers a+b — plugins-schema-adjacent, additive)
- **Scope:** upgrade the EXISTING completeness guard non-empty→interface-complete (JSON-Schema + `defaults` oracle) — kills the dead "no schema yet" panel by construction; compile-time 1:1 per-element assertions (`AssertSchemaCovers`) co-located beside each slice's schema; nested `SCHEMA_TODO` allowlist (visible shrinking list, `coverage.fitness` idiom). Nested `itemSchema` *rendering* is tier (c) — deferred to the coordinated packages change (D7), NOT in this wave.
- **Files/areas:** EXTEND `packages/plugins/nodes/__tests__/schema-completeness.fitness.test.ts` (not a new apps test), a co-located `AssertSchemaCovers` type-assert per slice beside its schema in `packages/plugins/nodes/*/default/`, new `SCHEMA_TODO` registry; retire the `schema.length === 0` dead branch in `inspector/Inspector.tsx` (the one apps-side change).
- **Fitness guard:** **FF-SCHEMA-COMPLETE** (runtime non-empty + compile-time 1:1 + nested-allowlist shrinking).
- **Risk:** med. The compile-time 1:1 assertion may surface real top-level gaps in some slices — fixing them (adding the missing schema field) is the point. Tier (c) is packages-crossing and gated (D7).

### Wave 9 — Page-type registry (Idea 1)
- **Scope:** lift `StarterTemplate` → `PageTypePreset` (add `requiredRegions`/`recommendedBlocks`/`perspectiveDefaults`); seed landing / inner-analytical / profile / **blank** as registry records; wire the picker into the §2.1 `no-pages`/`page-blank` CTAs; optional additive `page.meta.type` (expand-contract) for ongoing readiness.
- **Files/areas:** `features/templates/starterTemplates.ts` → page-type presets, `features/templates/TemplateGallery.tsx` (type-aware), new `features/templates/pageTypeRegistry.ts`, the empty-state CTAs (`studio/StudioEmptyState.tsx` from Wave 0), `features/templates/templates.fitness.test.ts` (extend).
- **Fitness guard:** **FF-PAGETYPE-DATA-DRIVEN** (registry-driven, no enum/switch, `blank` always present) · **FF-PAGETYPE-VALID** (every preset's `starterConfig` passes the save-guard).
- **Risk:** low. Extends a proven seam (V7 templates); the guardrail `blank` keeps parity.

### Wave 10 — Hierarchy legibility (Idea 2)
- **Scope:** extend the Navigator to render chrome + sections + nodes as one tree; readiness signals derived from save-guard + `requiredRegions`; formalize the structural-only gate allowlist; suggested top-down order via CTAs (no turnstile).
- **Files/areas:** `outline/OutlineTree.tsx` + `outline/outlineModel.ts` (chrome tier), `outline/OutlineItem.tsx` (readiness badge), a readiness selector over the save-guard, `studio/StudioEmptyState.tsx` (suggested order).
- **Fitness guard:** **FF-NAVIGATOR-FULL-HIERARCHY** · **FF-NO-WORKFLOW-GATE** · **FF-READINESS-DERIVED**.
- **Risk:** low-med. Chrome↔node model unification in the outline is the main work; strictly additive and non-blocking.

**Recommended order:** 0 → 7 → 1 → 8 → 2 → 3 → 9 → 4 → 10 → 5 → 6. Rationale: Wave 0 (empty-state doctrine, the dominant failure) is the prerequisite for the right dock (7), the page-type CTAs (9), and the hierarchy suggestions (10). Wave 7 (right dock) rides Wave 0's empty-state and is high-impact polish the owner named directly. Wave 8 (schema-completeness) lands right after Wave 1's palette work so the newly-prominent Insert produces fully-authorable nodes. Wave 9 (page-type) needs Wave 0's CTAs. Wave 10 (hierarchy) needs Wave 9's `requiredRegions` for readiness. Waves 5–6 stay last (brand-gated / dependency-gated) as before. The **Guided-Canvas doctrine (§1.5) is not a wave** — it is applied *within* every wave (each empty-state, readiness badge, and CTA above is an instance of it).

---

## 5. Invariant → fitness-function map (each invariant is executable, not a comment)

| Invariant | Fitness function | Wave |
|-----------|------------------|------|
| Pages exist ⇒ a home is live | FF-ALWAYS-A-HOME | 0 |
| Empty ≠ broken; one guided empty-state per region | FF-ONE-EMPTYSTATE | 0 |
| Palette is a registry projection | FF-PALETTE-META-DRIVEN | 1 |
| One noun, one card | FF-ONE-METRIC-CARD | 2 |
| Provenance in both lenses (Law 9) | FF-PROVENANCE-IN-BOTH-LENSES | 2 |
| Governance graph is bidirectional | FF-USAGE-COUNT-VISIBLE | 3 |
| Canonical rail taxonomy | FF-RAIL-CANONICAL-ORDER | 4 |
| One language policy | FF-NO-UI-LOCALE-LEAK | 5 |
| One brand | FF-ONE-BRAND | 5 |
| Author sees a real result, honestly | FF-PREVIEW-RESOLVES-OR-HONEST · FF-NO-RAW-TOKEN-LEAK | 6 |
| Right dock fills, one context, one empty-state | FF-RIGHTDOCK-SINGLE-EMPTYSTATE · FF-RIGHTDOCK-CONTEXTUAL · FF-RIGHTDOCK-FILLS | 7 |
| Everything the runner renders is authorable | FF-SCHEMA-COMPLETE (runtime non-empty + compile-time 1:1 + nested-allowlist) | 8 (tiers a+b) · D7 (tier c) |
| Page creation is registry-driven, never blank | FF-PAGETYPE-DATA-DRIVEN · FF-PAGETYPE-VALID | 9 |
| Hierarchy is legible and never blocks | FF-NAVIGATOR-FULL-HIERARCHY · FF-NO-WORKFLOW-GATE · FF-READINESS-DERIVED | 10 |
| The tool leads (doctrine, cross-cutting) | *composite* — the above empty-state / readiness / CTA gates together assert "no dead-end, no block" | 0,7,9,10 |

Pre-existing invariants **preserved** (not touched): FF-ROLE-IS-LENS, FF-AUTHOR-NO-QUERY, FF-CANVAS-ALWAYS-HOME, FF-BIND-PARITY, FF-CHROME-TOKEN-DRIVEN, and the dependency-arrow ESLint gate.

---

## 6. Decisions that are one-way doors or need the owner

- **D1 — Two rail entries vs one merged catalog entry** (DECIDED by architect; flagged for visibility). Keep **Data (consumer) + Model (steward) as two rail slots, unified at the `<MetricCard>` level**. Rationale: Model hosts the raw-modeler escape hatch, which must never leak into the author's bind flow (FF-AUTHOR-NO-QUERY); one merged entry would either leak it or clutter. The card is the SRP anti-duplication unit; the two entries are the two lenses. Reversible.
- **D2 — Brand "Strata" as the final product name** (OWNER — mild one-way door: it becomes the login wordmark and public shell identity). The shell already says Strata; Wave 5 retires the "Constructor / GeoStat" login wordmark. Needs the owner's explicit "yes, Strata" before shipping the login change. (Already open from AR-49 M1.)
- **D3 — Provenance source of truth for agency/last-updated** (SCOPE call, not strictly one-way). Surface what `ManifestMetric` carries now (unit/code/methodology/description) + join agency/last-updated from the existing MetadataPort **when its client read is wired**. Recommendation: ship the card with graceful degradation now; never fabricate provenance. Confirm the MetadataPort client wire is on the data track.
- **D4 — Default landing surface** (UX call, reversible). Recommend **Insert** (post-elevation) with the canvas as hero. Alternative considered: land on **Layers** (structure-first) for an existing multi-page site. Reversible — a one-line default change.
- **D5 — Which page types to seed** (Idea 1 — DATA call, reversible). Recommend seeding **landing · inner-analytical · profile · blank**. Pure registry data; adding/removing/renaming a type is a data edit, no code. `blank` is mandatory (the parity guardrail). Owner may name additional types.
- **D6 — Persist page type as a stored facet?** (Idea 1 — mild schema-add, expand-contract). Recommend an **additive optional `page.meta.type`** so ongoing readiness (§2.9) can reference it; never required; parallel-change migration so pre-existing pages stay valid. Alternative: keep type as creation-time-only (readiness degrades gracefully). Reversible-ish (a stored field is a contract, so it enters versioning discipline).
- **D7 — Nested `itemSchema` PropField (Idea 3 tier c) — ONE additive engine seam** (crosses apps-only; **owner-gated one-way-ish**). Rendering a nested object/array item's sub-schema needs an additive `object`/`array-of` PropField discriminant carrying `itemSchema` in `packages/react/engine`. It is OCP-clean (new PropFieldType = new capability, Inspector interface unchanged — Law 8) and sequenced like M3's growth-noun as a coordinated packages change. **Recommendation:** ship Idea 3 tiers (a)+(b) apps-only now (runtime non-empty + compile-time 1:1); land tier (c) after the owner blesses the engine PropField addition. Until then, nested items stay in the `SCHEMA_TODO` allowlist (honest, visible, shrinking).
- **D8 — Right-dock selection-context model** (Idea 4 — UX call, reversible). Recommend **tri-context** (node / chrome / Page), where "nothing selected / canvas background" surfaces the **Page** context, with a persistent "Page" affordance so page-scope authoring is always one gesture away. Alternative: keep page panes always-visible (rejected — that IS the dead-space defect). Reversible.
- **D9 — Tabs vs accordion in the node Inspector** (Idea 4 — UX call, reversible). Recommend a **hybrid**: accordion when a node has few schema groups, tabs when many (Figma/Framer idiom). Tabs are *derived from the schema's `group`s*, not hardcoded, so this is purely a presentation threshold. Reversible.

---

## 7. Rejected alternatives (≥2, per ADR discipline)

1. **Fix the entry-state by hardening the imperative `setActivePage`** (guard the hydrate, add a boot effect that selects the first page). **Rejected:** the imperative set is *already coded* and the live boot still shows null — this is a symptom patch (Law 6). Derivation removes the whole class and forbids regression via a fitness function.
2. **Merge Data + Model into one rail entry that flips affordances by role.** **Rejected:** Model carries the raw-modeler escape hatch; a merged entry leaks query-modeling into the author lens (violates FF-AUTHOR-NO-QUERY) or clutters the bind flow. Unify at the card, not the entry (D1).
3. **Build a dedicated "Pipeline" tutorial/onboarding surface to teach define→bind→place.** **Rejected:** YAGNI + a new capability surface with no lasting consumer. The data's own bidirectional graph (bind-from-block + "used in N places") makes the pipeline self-evident without a surface to maintain.
4. **Duplicate the metric row into a richer "Data" variant and a "Model" variant** (fastest path to fidelity parity). **Rejected:** re-entrenches the DRY violation that IS finding #2; a shared card with lenses is the SRP-correct fix.
5. **Add source/agency/last-updated as new fields on `ManifestMetric`.** **Rejected:** provenance is already modeled in the MetadataPort/`agency_scheme` (AR-20, Law 5) — a second source of truth would fork provenance. Join, don't duplicate.
6. **Reflect TypeScript interfaces at runtime to drive the Inspector (Idea 3).** **Rejected:** TS types are *erased* at build — there is nothing to reflect at runtime. The owner's refinement is correct: register an explicit, co-located PropSchema as the SSOT and assert completeness *at compile time* (`AssertSchemaCovers`) + a runtime non-empty gate. Reflection would be both impossible and a hidden second source of truth.
7. **Hard "chrome-first" gate — block sections until the frame is done (Idea 2, literal reading).** **Rejected:** this re-creates the deleted 3-step wizard's blocking temporal order (the exact thing the owner discarded) and could be *worse than now*. We deliver the *intent* (top-down guidance) via a legible Navigator + readiness + suggested-order CTAs, and permit the ONLY structural gate (bind requires the container to exist — already mechanical). FF-NO-WORKFLOW-GATE forbids the wizard's return.
8. **Hardcode page types as a closed enum / `switch` at creation (Idea 1).** **Rejected:** violates Law 1 (no privileged names) and Law 2 (logic-in-config). Page types are seeded *instances* of an extensible registry of config data; a plugin adds a type with zero creation-flow code (OCP). The named types carry no privilege — even `blank` is just a record.
9. **Keep the page-scoped panes always-stacked in the right dock and just shrink the empty island (Idea 4).** **Rejected:** the perpetual stack IS the dead-space + repeated-empty-state defect; shrinking the island is a symptom patch (Law 6). The root fix is the tri-context one-dock with fill-by-construction — page panes live in the Page context, reachable in one gesture, never padding a node Inspector.

---

## 8. Capability-parity guarantee (nothing lost)

Every wave is a **relocation/projection**, not a deletion: the canvas, inspector, palette, outline, metric editor, blast-radius index, and the Compose|Data-model switch are all **kept and re-homed/rendered**, exactly as M1–M3 relocated the wizard's parts. The metric-authoring loop (`saveSemanticCatalog → registerManifestMetrics → live palette`) is untouched. The dependency arrow, the semantic-layer spine (one `resolveMeasureRef` path), role-is-lens, and Config-is-SSOT are all preserved. This milestone changes how the author *finds and understands* the tool, not what the tool *can produce*.

**The four July-10 ideas hold the same guarantee — each is EXPAND, never restrict, "in no case worse than now":**
- **Idea 1 (page-type):** the existing `blank`/generate options remain (mandatory `blank` guardrail); page types *add* type-appropriate starting structure. Strictly a superset of today's TemplateGallery.
- **Idea 2 (hierarchy):** purely additive legibility (a fuller Navigator + readiness dots + suggested order). FF-NO-WORKFLOW-GATE guarantees no new block is introduced — the only refusals are the structural no-ops that already exist.
- **Idea 3 (full config):** the Inspector *gains* completeness (nested items become authorable via D7) and *loses* only a dead-end (the "no schema yet" panel becomes unreachable). Every prop authorable today stays authorable; more become so.
- **Idea 4 (right dock):** the page-scoped panes are *re-homed into the Page context*, not removed — reachable in one gesture (persistent "Page" affordance). The dock gains fill + tabs + collapse; it loses only the void and the repeated empty-states.

The **Guided-Canvas doctrine (§1.5)** is the through-line: every change above removes a dead-end or a block and adds a next-step affordance, while the dependency arrow, config-is-data (Law 2), the semantic spine, role-is-lens, Law 9 provenance, and YAGNI-on-net-new-surfaces all stand. The single flagged boundary-crossing (Idea 3 tier c, D7) is an OCP-additive engine discriminant, owner-gated and sequenced like M3's growth-noun — the honest, documented exception.
