# SPEC — Authoring Reconception M1: The Studio Shell (dissolve the wizard, retire react-admin)

> **Status:** DESIGNED (bold proposal — owner sign-off pending) · **Author:** platform-architect (Opus) · **Date:** 2026-07-09
> **Milestone of:** AR-49 (`SPEC-authoring-reconception-vision.md`, owner-APPROVED). This is the **detailed design for M1 only.** M0 (semantic layer + Metric Palette) is BUILT and LIVE.
> **Registry:** AR-49 card (`ARCHITECTURE-REGISTRY.md` §B) — pointer/row-update appended.
> **Consumes / completes:** the vision's M1 scope (*dissolve the 3-step wizard + retire react-admin*), AR-10 (`describeApp()`/PropSchema Inspector), AR-11 (StyleField), AR-4 (style system), AR-13 (theme switch), the DTCG token SSOT (`packages/styles`).
> **Grounded against (read, in code):** `apps/panel/src/App.tsx` (react-admin `AdminContext` provider-only) · `features/wizard/{ConstructorWizard,WizardStepper}.tsx` + `steps/{DataStep,SiteStep,PageStep}.tsx` · the dead `<Resource>` fork (`features/{pages,sections}/*`, `features/datasources/Datasource{List,Edit,Create}.tsx`, `layout/{Layout,Menu,AppBar}.tsx`) · `providers/{dataProvider,i18nProvider}.ts` · `store/constructor.store.ts` (wizard slice) · `types/constructor.ts` (`WIZARD_STEPS`) · the canvas/inspector/discovery/command/outline subsystems · `packages/styles` (`tokens-catalog.ts`, `TOKENS_CATALOG`).
>
> **Scope discipline:** M1 is a **shell reframing + a dependency retirement.** It moves *no* engine code, changes *no* config schema, adds *no* new node type, and touches the arrow **not at all**. Every capability of the three steps is *relocated verbatim*, never rewritten (Strangler-Fig, Law 7). The one behavioral inversion is deliberate and is the whole point: **authoring is no longer an ordered waterfall.**

---

## 0. What M1 is, in one paragraph

M0 already turned the "Pages" step (`PageStep`) into a working **Governed Canvas** — a live WYSIWYG center with a block palette, a governed Metric Palette (bind-by-noun), an outline, a schema-driven Inspector, perspectives/filters/visibility/page-config panes, a ⌘K omnibar, and a draft→publish workflow bar. The problem M1 fixes is that this canvas is imprisoned as *step 3 of 3*, reachable only after an author walks a **Data → Site → Pages waterfall** that forces every author through a data-modeling gate before they can place a block. M1 **dissolves the wizard into a single persistent authoring surface — the "Studio"** — where the canvas is *always* the home and the three old steps become **ambient docks summoned from an activity rail**, never sequential gates. In the same milestone we make the **clean first Strangler cut**: retire the dead react-admin `<Resource>` CRUD fork and the `AdminContext`/`dataProvider`/`i18nProvider` provider layer it needs, replacing the one live thing it carried (`useNotify`) with our own `notify` port. The result is the shell the whole AR-49 vision assumed: one canvas, role-ready lenses, zero waterfall — and a panel that no longer drags a dormant framework it never uses.

---

## 1. Competitor deep-study — the AUTHORING SHELL specifically

The vision studied *paradigms* (content-first, define-vs-curate). M1 is about the **shell / information architecture** — how the authoring surface is physically organized. Different question, so a fresh, shell-specific study. For each: the **one shell idea worth taking**, then where we go **beyond**.

### Visual / web builders

| Platform | The one authoring-shell idea | Take it? |
|---|---|---|
| **Builder.io** | The **canvas is the permanent home**; data binding is a *right-rail concern invoked after placement*, never a gate before it. | **YES** — this is the anti-waterfall. Canvas-always-home is the M1 spine. |
| **Webflow** | An **icon activity-rail that swaps the left panel's content** (Add · Navigator · Pages · CMS · Assets · Settings) — one screen, many *summonable* left surfaces; nothing is a route you leave the canvas to reach. | **YES — the load-bearing IA borrow.** The activity-rail is exactly how three "steps" become three *docks* without a sequence. |
| **Framer** | A **persistent top bar** owns global context (breakpoint switcher, preview toggle, insert omnibar); the canvas below never changes identity. | **YES** — top-bar-owns-global-context; page/locale/perspective/preview live there. |
| **Notion** | **Zero chrome, slash-to-insert** — the document *is* the editor; every capability is progressive, summoned in place. | **PARTIAL** — we already have ⌘K/slash; we keep the omnibar but retain docks (a statistics dashboard needs a palette a prose doc does not). |
| **Plasmic** | An explicit **design ↔ interact mode toggle** on one artboard (edit vs test the live component). | **PARTIAL** — a preview/interact toggle in the top bar; not a full second mode in M1. |
| **tldraw** | **Selection-contextual panels** — the right inspector materializes only when something is selected; empty selection = empty rail. | **YES** — we already do this (Inspector on selection); formalize it as the right-dock contract. |
| **Puck / Craft.js** | The host **owns the shell**; the library owns only the render/field model. | **CONFIRMS our stance** — we own the shell; keep our canvas (vision §5). No lib supplies the shell. |
| **Retool** | Data/queries live in a **bottom drawer in the same screen**, not a separate route — build UI and data without leaving the surface. | **YES (as counter-shape)** — data belongs *beside* the canvas as a dock, not *before* it as a step. Reinforces re-homing DataStep. |

### BI / analytics authoring

| Platform | The one authoring-shell idea | Take it? |
|---|---|---|
| **Power BI** | A **left view-rail (Report · Data · Model)** — the define-vs-curate split surfaced as *icons on one shell*, not a wizard. | **YES — the closest analog to our role split.** Our Model lens (M2) becomes a rail entry, gated by the steward role. |
| **Tableau** | **Shelves + "Show Me"** — drop a field on a shelf, the tool proposes the mark. | **HAVE IT** — field-wells + `ShowMe` exist; M0 wired Show-Me to *governed metrics*. Keep. |
| **Sigma / Power BI / Tableau** | **Bottom page tabs** — multi-page is a tab strip, spreadsheet-familiar. | **YES (light)** — a bottom page strip + a top-bar page switcher; page ordering still driven by nav (SiteStep's job, re-homed). |
| **Metabase** | A **guided, progressive "ask a question" notebook** that hides SQL until you want it. | **DEFER to Model mode (M2)** — this is the steward's query-building on-ramp, not the author's path. |
| **Superset** | Chart-builder and dashboard-builder are **two separate tools** — you leave one to use the other. | **COUNTER-EXAMPLE — reject.** Never split the tool by artifact; building a chart and placing it is one flow on one canvas. This is *precisely* the wizard's sin at a different grain. |

### Synthesis — the shell the field converges on

The best authoring shells are **not wizards and not blank canvases**; they are a **single persistent surface** composed of five stable regions:

1. a **canvas that never changes identity** (Builder.io/Framer/tldraw),
2. a **left activity-rail that swaps summonable surfaces** (Webflow/Power BI/VS Code),
3. a **right dock that is selection-contextual** (tldraw/Puck/Plasmic),
4. a **persistent top bar owning global context + the insert omnibar** (Framer/Notion),
5. a **bottom page strip** (Sigma/Power BI/Tableau).

**Where we go BEYOND them (our statistics-grade, non-programmer, metric-first case):**

- **The left rail's first data surface is a governed *semantic* palette, not a raw field list.** Power BI's "Fields" pane and Tableau's shelves expose *columns*; we expose **governed metric nouns** (M0's Metric Palette) with unit/provenance. No BI shell has a metric-first left rail; no web builder has metrics at all.
- **Role is a lens on ONE canvas, not a separate tool or a scary view-swap.** Superset splits tools; Power BI's "Model view" is a full context-swap a report author avoids. Our Model lens (M2) is a *summonable left surface over the same live canvas* — the steward and the author work the same document, the rails recontextualize. Define-vs-curate without ever leaving the artifact.
- **Provenance and bilingual content are ambient shell properties, not panels you remember to open.** The top bar carries locale + last-updated/methodology status as first-class chrome (Law 9), because for an NSO artifact integrity is not an inspector tab — it is the frame.
- **No completion gates, ever.** Even the non-wizard builders (Retool, Power BI) rarely *forbid* an order; we make "no order" a **fitness function** — the shell structurally cannot gate a surface behind another's completion.

**The opinion, stated plainly:** the winning shell for us is Webflow's activity-rail IA + Builder.io's canvas-always-home + Power BI's role-rail — but with the rail's data surface being a *governed metric palette* and the role-rail being a *lens over the same canvas*. We call it the **Studio**.

---

## 2. The new authoring shell / IA — "the Studio"

### 2.1 The mental model

**One canvas. Summonable surfaces. Two roles.** The wizard's `activeStep ∈ {0,1,2}` linear model is deleted. In its place: a persistent shell where the **live canvas is always mounted** and the author *summons* concerns from a left **activity rail**. Nothing is gated; nothing has an order.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ TOP BAR  [Strata ▪ site] [page ▾] │ [ka|en] [theme] [perspective] [▭ bp] │
│          [⌘K insert] ……………………………………………… [preview ▷] [draft→publish ▮] │
├───┬───────────────┬──────────────────────────────────────┬───────────────┤
│ A │  LEFT DOCK    │            LIVE CANVAS                │  RIGHT DOCK   │
│ C │ (surface set  │      (ALWAYS mounted, ALWAYS live     │ (selection-   │
│ T │  by the rail) │       WYSIWYG — the home)             │  contextual)  │
│ I │               │                                        │               │
│ V │ ▸ Insert      │   ┌────────────────────────────────┐  │ Inspector     │
│ B │ ▸ Data ★      │   │  NodePageRenderer (real engine)│  │  · node props │
│ A │ ▸ Layers      │   │  drag-drop · select · bind      │  │  · visibility │
│ R │ ▸ Pages&Site  │   └────────────────────────────────┘  │  · page cfg   │
│   │ ▸ Style       │                                        │  · perspectives│
│   │ ▸ Model 🔒    │                                        │  · filters    │
├───┴───────────────┴──────────────────────────────────────┴───────────────┤
│ BOTTOM  [page 1] [page 2] [+]                         status · issues     │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.2 The three "steps" become ambient surfaces (the inversion)

| Old wizard step (retired) | Becomes (Studio surface) | Rail entry |
|---|---|---|
| **Data** (query/pivot/cube for everyone, gated first) | **Data surface** — the governed **Metric Palette** (M0) is the author's default affordance at the top; the raw source/spec/query editors sit below under a collapsed **"Advanced data modeling"** disclosure (M2 relocates these fully behind the Steward role). | `Data ★` |
| **Site** (identity + nav + theme, gated second) | **Pages & Site surface** — site identity, navigation, page create/reorder; **Style surface** — theme/token editing (edit-in-place, live-previewed). | `Pages&Site`, `Style` |
| **Pages** (the composition, gated last) | **The canvas itself** — always mounted, always the home. The palette/outline/inspector that lived *inside* PageStep become the `Insert`/`Layers` rail surfaces + the right dock. | `Insert`, `Layers` |

### 2.3 Roles surface without a waterfall

The vision's define-vs-curate becomes **two roles projected onto the rail**, not two apps:

- **Author (default, frequent):** sees `Insert · Data · Layers · Pages&Site · Style`. The Data surface shows the governed **Metric Palette**; the raw query editors are collapsed under "Advanced."
- **Steward (M2, gated):** additionally sees `Model 🔒` — the semantic-layer authoring surface where the query/pivot/transform editors *relocate* fully. **M1 lays the rail slot and the role seam; M2 fills Model mode.** In M1 the raw editors remain reachable in the Data surface's Advanced disclosure so **nothing is lost before M2 exists** (Strangler: capability stays online throughout).

This is the anti-cliff: a non-programmer opens the Studio, the canvas is right there, `Insert` and `Data` (metric nouns) are one click away, and the query machinery is *present but demoted* — never a gate, never the first thing they hit.

### 2.4 Progressive disclosure (the non-programmer contract)

Three tiers, all already supported by existing infra (no new machinery):

1. **Tier 0 — compose:** drop a block (`Insert`), bind a metric (`Data` → Metric Palette). This is the whole minimum flow; `ShowMe` supplies the encoding, `NodeSliceMeta.defaults` supplies sane starting props.
2. **Tier 1 — refine:** the right-dock Inspector reveals styling/visibility/filters *on selection only* (tldraw contract). `PropSchema` `showWhen`/grouping already tiers fields.
3. **Tier 2 — model (advanced/steward):** raw sources/specs/query editors, collapsed in the Data surface (M1) → relocated behind the Steward role in Model mode (M2).

The author is **never dropped off the data cliff** because the cliff (query authoring) is not on the default path — it is a disclosure the author may never open.

---

## 3. Capability migration inventory — nothing lost

Every function of the three steps, mapped to its Studio home. **Behavior-change flags** are called out explicitly.

### DataStep → Data surface

| Capability (today) | New home | Behavior change? |
|---|---|---|
| DataSource list / browse / select | `Data` surface → Sources list (Advanced group) | none |
| Add source (`SourceAuthoringPanel`) | `Data` → Advanced | none (M2: → Model/Steward) |
| Excel upload (`ExcelUpload`) | `Data` → Advanced | none |
| Delete source | `Data` → Advanced | none |
| Reorder sources (dnd-kit) | `Data` → Advanced | none |
| DataSpec list / select | `Data` → Specs (Advanced group) | none |
| `DataSpecEditor` (query/pivot/transform) | `Data` → Advanced disclosure | **demoted** from default to Advanced; identical component |
| `ShowMe` suggestions | **kept as the bind-time encoding suggester on the canvas** (already wired post-bind) + available in the `Data` surface | none |
| **Metric Palette (M0)** | `Data` surface **top / default affordance** | **promoted** to the author's primary data path |
| "Continue → Site" button | **DELETED** | **the waterfall is gone** |

### SiteStep → Pages&Site surface + Style surface + Top bar

| Capability (today) | New home | Behavior change? |
|---|---|---|
| Site name | `Pages&Site` → Identity | none |
| Default locale (`ka`/`en`) | `Pages&Site` → Identity **and** top-bar locale toggle (preview) | none (added surfacing) |
| Logo URL | `Pages&Site` → Identity | none |
| Nav items list / reorder / delete (dnd-kit) | `Pages&Site` → Navigation | none |
| "+ add page" (today a `notify('coming soon')` stub) | `Pages&Site` → Navigation, **wired to real page-create** (`createFromTemplate`/`PageBrowser`, both already exist) | **FLAG: stub becomes real** |
| Theme token viewer (**read-only** catalog chips) | `Style` surface → **writable token-preset editor** (§6) | **FLAG: read-only → writable** (M1.4) |
| Continue / back buttons | **DELETED** | waterfall gone |

### PageStep → the canvas + docks + top bar (mostly in place already)

| Capability (today) | New home | Behavior change? |
|---|---|---|
| `NodePalette` | `Insert` surface (left dock) | none |
| `MetricPalette` | `Data` surface (left dock) | none |
| `ChromePalette` | `Insert` surface (chrome section) | none |
| `OutlineTree` | `Layers` surface (left dock) | none |
| `CanvasView` (live WYSIWYG) | **the center home — always mounted** | none |
| `Inspector` / `ChromeInspectorPanel` | right dock | none |
| `VisibilitySection` | right dock | none |
| `PageInspectorPanel` | right dock | none |
| `PerspectivesPane` (+ `previewPerspectiveId`) | right dock + top-bar perspective preview | none |
| `FiltersDrawer` | right dock | none |
| `PageWorkflowBar` (draft→publish/history) | **top bar** (workflow region) | none (relocated) |
| ⌘K `CommandPalette` (slash/insert/navigate) | top-bar omnibar (⌘K) | none |
| metric bind (both gestures, M0) | unchanged (canvas + Data surface) | none |
| "← Site" button | **DELETED** | waterfall gone |

**Net behavior changes (only three, all intended):** (1) no step order / completion gating; (2) "+add page" stub becomes a real create; (3) theme viewer becomes writable. Everything else is *relocation of identical components*.

---

## 4. react-admin retirement — the clean Strangler cut

### 4.1 What react-admin actually carries today (grounded)

- **Dead `<Resource>` CRUD fork (unwired, never mounted):** `features/pages/{PageList,PageEdit,PageCreate}`, `features/sections/{SectionList,SectionEdit,SectionCreate}`, `features/datasources/Datasource{List,Edit,Create}.tsx`, `layout/{Layout,Menu,AppBar}.tsx`. `App.tsx` never renders `<Admin>`/`<Resource>` — these are pure dead weight and a **drift magnet** (first-tenant-erosion risk).
- **Live provider layer (thin):** `App.tsx` wraps the wizard in `<AdminContext dataProvider={…} i18nProvider={…}>`; `providers/dataProvider.ts` implements RA's `DataProvider` over `configApi`; `providers/i18nProvider.ts` is an **identity `translate` passthrough**.
- **The one live consumer:** `useNotify` — used in exactly **one** live component (`SiteStep.tsx`). Nothing calls `useDataProvider`/`useTranslate`/`useLogin` (the store talks to the API directly via `store/api-actions.ts` → `lib/api`, *not* through the RA provider; `LoginForm` and `inspector/controls/primitives.tsx` are already react-admin-free by design).

**Finding:** the RA `dataProvider` is consumed **only** by `AdminContext` + the dead fork; the `i18nProvider` is a dead identity function; the only live surface is one toast hook. **react-admin earns nothing here.** Retirement is genuinely clean and low-risk.

### 4.2 The replacement for the provider role: a `notify` port (and nothing else)

The provider role reduces to **one capability worth keeping — toasts.** Introduce our own **`notify` port** (`store/notify.ts` — a tiny Zustand slice: `{ notify(msg, {type}), queue }`), rendered by an existing **MUI `Snackbar`** (already in the panel — no new dependency). Swap `SiteStep`'s `useNotify()` for `useToast()`.

> **Why a port, not just "call MUI Snackbar":** it decouples toasts from *both* react-admin (now) *and* MUI (the flagged north-star exit, §5). The impl is MUI today; the seam is ours. This is the ISP-clean substitution, not a lateral lib swap.

The i18n role is already covered by the panel's own `LocaleString` + locale state; the RA `i18nProvider` identity passthrough is deleted with nothing to replace.

### 4.3 Sequenced removal (nothing breaks)

1. Add the `notify` port + MUI-Snackbar renderer; swap `SiteStep.useNotify` → `useToast`. *(SiteStep is later dissolved in M1.3; doing the swap first keeps M1.1 independent of the shell work.)*
2. Delete the dead fork dirs/files (`features/pages`, `features/sections`, `features/datasources/Datasource{List,Edit,Create}.tsx`, `layout/{Layout,Menu,AppBar}.tsx`). **Keep** the live `features/datasources` members `SourceAuthoringPanel`, `ExcelUpload`, `IngestResultPanel`, `DsdVersionPanel`, `ingestErrorMessage` (used by DataStep → Data surface).
3. Remove `<AdminContext>` from `App.tsx` (the wizard/Studio no longer needs a provider wrapper); delete `providers/dataProvider.ts` + `providers/i18nProvider.ts`.
4. Remove `react-admin` (and `ra-*` peers) from `apps/panel/package.json`.
5. Lock it: **`FF-NO-REACT-ADMIN`** — a fitness test asserting zero `from 'react-admin'` imports anywhere under `apps/panel/src` (an eslint `no-restricted-imports` entry is the enforcement home).

This is the vision's promised "clean first cut," fully reversible via git, and it can land **before any shell work** — the recommended M1.1.

---

## 5. Package / library evaluation for M1

Selection principle unchanged: adopt only if it **strengthens AND simplifies AND honors the arrow + Config = SSOT.** Where our own thing is at standard, **keep it and say so** — and, mid-migration, *resist* introducing a parallel design system (that is churn, not architecture).

| Candidate | Verdict | Replaces | Win | Cost / risk | Law 3 |
|---|---|---|---|---|---|
| **react-admin** | **RETIRE** (§4) | dead fork + provider shell | shrinks surface, kills drift magnet, one fewer framework | ~none (dead + one hook) | apps-only; arrow untouched |
| **`notify` port (Zustand + MUI Snackbar)** | **ADD (ours)** | `useNotify` | decouples toasts from ra *and* mui; zero new dep | trivial | apps-only |
| **Puck** | **REJECT (hold vision ruling)** | — | — | adopting = bend our schema to Puck `fields` → **breaks Config = SSOT + Law 7**; our canvas is already Puck/Plasmic-class | — |
| **Shell/dock lib** (`dockview`, `rc-dock`, `react-mosaic`) | **REJECT for M1** | the Studio layout | — | our docks are *fixed regions*, not user-rearrangeable floating panes; these libs are heavy and impose their own model | — |
| **cmdk** (omnibar) | **KEEP** | — | already the ⌘K palette; fit-for-purpose | — | in place |
| **@dnd-kit** (drag) | **KEEP** | — | powers palette/outline/bind drag | — | in place |
| **Zustand** (state) | **KEEP** | — | the wizard slice *shrinks* (delete `activeStep`/`completedSteps` gating; add `activeSurface`) — an architecture simplification, not a lib swap | — | in place |
| **PropSchema + generic Inspector** | **KEEP** | — | richer than JSON Forms/RJSF (carries `DataSpec`/`ChartDef`/`enum-ref`); the right dock is already schema-driven | — | in place |
| **MUI + Emotion** (panel chrome) | **KEEP for M1, flag exit** | — | building the Studio chrome on MUI keeps the migration single-front (Strangler) | MUI theme competes with our token layer; but adopting Radix/Ark *during* a shell migration = a second design system in flight = churn | apps-only |
| **Radix / Ark UI** (headless primitives) | **DEFER (flag), do NOT adopt in M1** | MUI chrome (later) | one design language for tool + product, token-native | a full design-system migration — its own initiative, not a rider on the shell reframe | — |

**M1's honest calls:**
- **Add nothing but our own `notify` port.** M1's value is *subtraction* (react-admin) + *reorganization* (the shell), not accretion.
- **Build the Studio shell ourselves** with token-driven MUI. The activity-rail + docks + top bar is *layout*, not a library problem; a dock lib would impose a model we don't want and can't token-theme cleanly.
- **The MUI→Radix exit is real but is not M1.** Introducing Radix now would fork the design system mid-shell-migration — the exact "two systems in flight" anti-pattern. Flag it as a post-M1 initiative (candidate AR card at the next Leader's Scan), and *insulate* by making all new shell chrome consume `packages/styles` token CSS vars so the eventual swap is a re-skin, not a rewrite.

---

## 6. Brand "Strata" skin — rebrand as data

Two threads: (a) give the **tool's own chrome** the Strata identity, and (b) turn the **read-only theme viewer into a real editor** — both proving the platform's promise that *rebrand is a data operation, not a code change*.

### 6.1 The shell chrome wears Strata via the token SSOT

The Studio's own chrome (top bar, activity rail, docks) must **consume `packages/styles` token CSS vars**, never hardcode brand colors. Then "make the tool look like Strata" = author a token preset, zero chrome code. This is enforced, not aspirational: **`FF-CHROME-TOKEN-DRIVEN`** scans the new shell components for hardcoded hex/brand literals. The existing dark/light switch (AR-13) already proves the multi-theme mechanism; the Studio inherits it for free.

### 6.2 The read-only theme viewer becomes a writable token-preset editor

Today `SiteStep`'s Theme tab renders `TOKENS_CATALOG` as read-only chips. The rebrand seam already exists in the data model: **`SiteDef.themeOverrides`** is the per-site token override SSOT; `packages/styles` DTCG tokens are the default. The Style surface makes it writable:

- The read-only chip viewer → a **token-preset editor** that writes `SiteDef.themeOverrides` via the **StyleField** control (AR-11 — the `enum-ref source:'tokens'` token-picker already exists), **live-previewed on the canvas** (the canvas re-renders from the store, so a token edit repaints instantly — the platform's own rebrand proof).
- **Scope for M1:** a real-but-minimal editor for the brand-defining tokens (color roles + typography scale) writing `themeOverrides` — enough to *rebrand to Strata by hand in the tool*. The exhaustive per-token / per-part editor is the **Refine lens (M3)**; M1 lays the writable seam and ships the brand subset. **FF-THEME-EDIT-DATA** asserts a theme edit produces only `themeOverrides` data (no code path, Law 2).
- **Multi-tenant/agency theming** = a second `themeOverrides` preset (AR-30 seam) — **preserved, not built** (single-tenant-first confirmed). Rebranding for a second agency later = authoring a token preset, zero engine code.

### 6.3 Name

**"Strata"** (per vision §9 — statistics + layered composition + institutional gravitas). Applying it is a token preset + the product wordmark in the top bar. **One-way-ish door — owner confirms the name before it appears in chrome/wordmark (§ executive summary).**

---

## 7. Target architecture + Strangler-Fig migration path (arrow unchanged)

M1 lives entirely in `apps/panel` (the outermost arrow layer). **No package below `apps` is touched; the dependency arrow does not move.** The strongest evidence M1 is right: it is a *reorganization of the app shell*, and the engine never notices.

```
contracts ← expr ← core ← charts ← react ← plugins ← apps/panel
                                                        │
                                              KEPT  ────┤ canvas · inspector · discovery(MetricPalette) ·
                                                        │ command(⌘K) · outline · filters · perspectives ·
                                                        │ page-config · page-workflow · visibility · templates ·
                                                        │ data-layer(editors/fieldwells/showme) ·
                                                        │ datasources(SourceAuthoringPanel/ExcelUpload/…) ·
                                                        │ store(pages/history/lifecycle/chrome) · styles tokens
                                                        │
                                           RESHAPED ────┤ ConstructorWizard → Studio shell
                                                        │ WizardStepper     → ActivityRail + TopBar + BottomTabs
                                                        │ DataStep          → DataSurface (Metric Palette default; editors → Advanced)
                                                        │ SiteStep          → PagesSiteSurface + StyleSurface (writable)
                                                        │ PageStep(canvas)  → canvas-as-home + Insert/Layers surfaces + right dock
                                                        │ store wizard slice (activeStep/completedSteps) → surface slice (activeSurface)
                                                        │
                                            RETIRED ────┤ react-admin dep · AdminContext · providers/{dataProvider,i18nProvider}
                                                        │ dead fork: features/{pages,sections} · features/datasources/Datasource{List,Edit,Create} · layout/{Layout,Menu,AppBar}
```

**Migration principle (Law 7, Strangler):** the shell is rebuilt *around* the living subsystems, not by rewriting them. Every RESHAPED item is a *relocation* of an existing component into a new container; every KEPT subsystem renders unchanged. The wizard scaffolding is dissolved behind a feature flag (`STUDIO_SHELL`) so both shells coexist until parity is proven, then the wizard is deleted. **No page of authoring capability is ever offline.**

---

## 8. Phasing within M1 — sequenced, each reversible

| Sub-M | Delivers | Reversible? | FFs that lock the seam | Depends on |
|---|---|---|---|---|
| **M1.1 — react-admin retirement** ⭐ (recommended first) | `notify` port + MUI-Snackbar; SiteStep swapped; dead fork deleted; `AdminContext`+providers removed; dep dropped | Yes (git) — and it does **not** touch the wizard | `FF-NO-REACT-ADMIN` (zero `react-admin` imports), `FF-NOTIFY-PORT` (toasts via the port) | — |
| **M1.2 — Studio shell scaffold** | `Studio.tsx` (top bar · activity rail · left-dock host · canvas host · right-dock host · bottom tabs) + surface state slice (`activeSurface`; delete `completedSteps`/`activeStep` gating). Mounts the **existing** canvas as always-home + palette/inspector into docks. Behind `STUDIO_SHELL` flag (wizard still reachable). | Yes (flag off → wizard) | `FF-CANVAS-ALWAYS-HOME` (canvas mounts for every surface), `FF-NO-WIZARD-GATING` (no surface gated behind another's completion) | M1.1 (clean base) |
| **M1.3 — re-home surfaces + delete the wizard** | DataStep→DataSurface (Metric Palette default, editors→Advanced), SiteStep→PagesSiteSurface, PageStep canvas→home; wire "+add page" to real create. Delete `ConstructorWizard`/`WizardStepper`/`steps/*`/`WIZARD_STEPS`. Flip flag default to Studio. | Yes until the delete commit (git after) | `FF-WIZARD-CAPABILITY-PARITY` (every §3 inventory item reachable in the Studio — a checklist test) | M1.2 |
| **M1.4 — Strata skin + writable theme seam** | Shell chrome consumes tokens (Strata preset); read-only theme viewer → writable brand-token editor writing `themeOverrides`, live-previewed | Yes | `FF-CHROME-TOKEN-DRIVEN` (no hardcoded brand literals in shell), `FF-THEME-EDIT-DATA` (theme edit = data only, Law 2) | M1.3 (Style surface exists) |

### First sub-milestone recommendation: **M1.1 — react-admin retirement.**

**Rationale:** (1) it is the vision's declared "clean first Strangler cut" — **low-risk** (the fork is dead, the one live hook is trivially ported); (2) it is **independently valuable** (removes a framework and a drift magnet) with *zero* dependency on the shell design; (3) it **de-risks M1.2** by removing the `AdminContext` wrapper the new `Studio.tsx` would otherwise have to reason about; (4) it produces an immediate, visible win the owner can see (a lighter, react-admin-free panel) before any UI reshaping. Sequencing the shell first would leave the dead fork tempting drift during the exact window we are reshaping neighbors.

---

## 9. Build decomposition (ordered; owner tier; deps; parallelism)

| # | Work item | Owner tier | Depends on | Parallel? |
|---|---|---|---|---|
| **1** | `notify` port: `store/notify.ts` (Zustand slice) + MUI-`Snackbar` renderer + `useToast()` | react-specialist / senior-frontend | — | ∥ start |
| **2** | Swap `SiteStep.useNotify` → `useToast`; grep-verify no other live `useNotify` | react-specialist | 1 | after 1 |
| **3** | Delete dead fork: `features/{pages,sections}`, `features/datasources/Datasource{List,Edit,Create}.tsx`, `layout/{Layout,Menu,AppBar}.tsx` (keep live datasources members) | react-specialist | — | ∥ with 1 |
| **4** | Remove `<AdminContext>` from `App.tsx`; delete `providers/{dataProvider,i18nProvider}.ts`; drop `react-admin`/`ra-*` from `package.json` | react-specialist | 2,3 | after 2,3 |
| **5** | `FF-NO-REACT-ADMIN` (eslint `no-restricted-imports` + fitness) + `FF-NOTIFY-PORT` | engine-specialist / react-specialist | 4 | after 4 |
| **6** | Surface state: replace wizard slice (`activeStep`/`completedSteps`/`goToStep`/`markStepDone`) with `activeSurface`/`setSurface`; migrate persistence | react-specialist | — | ∥ (after M1.1 merges) |
| **7** | `Studio.tsx` shell + `ActivityRail` + `TopBar` (page switcher · locale · theme · perspective · ⌘K · preview · `PageWorkflowBar`) + `BottomTabs` + dock hosts; behind `STUDIO_SHELL` flag | senior-frontend | 6 | after 6 |
| **8** | `FF-CANVAS-ALWAYS-HOME` + `FF-NO-WIZARD-GATING` | react-specialist | 7 | ∥ with 7 |
| **9** | `InsertSurface` (NodePalette + ChromePalette) + `LayersSurface` (OutlineTree) — relocate existing components into docks | react-specialist | 7 | after 7 |
| **10** | `DataSurface`: Metric Palette (default) + Advanced disclosure wrapping the existing source/spec/query editors + ShowMe | plugins-specialist / react-specialist | 7,9 | after 7 |
| **11** | `PagesSiteSurface`: identity + nav (reorder/delete) + **wire "+add page" to `createFromTemplate`** | react-specialist | 7 | ∥ with 10 |
| **12** | Right dock host: Inspector/ChromeInspector/Visibility/PageInspector/Perspectives/Filters (selection-contextual contract) | react-specialist | 7 | ∥ with 10,11 |
| **13** | `FF-WIZARD-CAPABILITY-PARITY` (checklist over §3 inventory) | react-specialist | 9–12 | after 9–12 |
| **14** | Delete `ConstructorWizard`/`WizardStepper`/`steps/*`/`WIZARD_STEPS`; flip `STUDIO_SHELL` default on | senior-frontend | 13 (parity green) | after 13 |
| **15** | `StyleSurface`: read-only viewer → writable brand-token editor (StyleField → `themeOverrides`, live preview) | senior-frontend / react-specialist | 7 | ∥ after 7 |
| **16** | Strata token preset for shell chrome + tokenize chrome; `FF-CHROME-TOKEN-DRIVEN` + `FF-THEME-EDIT-DATA` | senior-frontend | 15 | after 15 |

**Critical path:** 1→2→4→5 (M1.1) → 6→7 (shell) → 9/10/11/12 (surfaces, parallel) → 13→14 (delete wizard). **Parallel lanes:** 3 ∥ 1 (deletes vs port); 15/16 (Strata) ∥ the surface lane once 7 lands; all FFs (5, 8, 13, 16) ride alongside their item. M1.1 (1–5) is a self-contained mergeable unit; the shell lane (6–14) and the Strata lane (15–16) fork after it.

---

## 10. Rejected alternatives (ADR discipline)

- **(a) Keep the wizard, just make step 3 the landing.** Rejected: it leaves the gating model and the two dead steps in place; the root (waterfall IA + role-conflation) survives. A landing tweak is a symptom patch (Law 6).
- **(b) Adopt a dock/panel library (`dockview`/`rc-dock`) for the shell.** Rejected: our docks are fixed regions, not user-rearrangeable floating panes; these libs are heavy, impose their own model, and resist token-theming — cost without a matching win (§5).
- **(c) Migrate the panel to Radix/shadcn during M1.** Rejected as scope: a design-system swap *during* a shell reframe = two systems in flight = churn (the anti-pattern). Insulate via tokenized chrome; make it its own post-M1 initiative.
- **(d) Retire react-admin *after* building the shell.** Rejected: leaves the dead fork as a drift magnet through the exact window we reshape its neighbors, and forces `Studio.tsx` to reason about `AdminContext`. Retire first (M1.1).
- **(e) Build full Model mode (steward role gate) in M1.** Rejected as scope: Model mode is M2. M1 lays the `Model 🔒` rail slot + keeps the raw editors reachable under the Data surface's Advanced disclosure so **capability stays online** until M2 relocates them behind the role.
- **(f) Delete the query/spec editors as "not for authors."** Rejected: they are the steward's tools and the escape hatch (Superset/Metabase confirm the pattern) — demote, never delete (Law 6, capability parity).

---

## 11. Definition of done (M1)

An author opens the panel and lands **directly on the live canvas** — no wizard, no steps, no "continue" buttons. The **activity rail** offers `Insert · Data · Layers · Pages&Site · Style` (and a gated `Model 🔒` slot awaiting M2), each summoning a left surface *without leaving the canvas*; the **top bar** carries page/locale/theme/perspective/preview + the ⌘K omnibar + the draft→publish workflow; the **right dock** shows the Inspector only on selection. The author drops a block (`Insert`), binds a governed metric (`Data` → Metric Palette), and the block renders live — **with no order imposed and no data cliff**. The Style surface **writably** rebrands to "Strata" by editing `themeOverrides`, live-previewed. `react-admin` is **gone** from `apps/panel` (dep, providers, `AdminContext`, dead fork), toasts flow through the `notify` port, and every capability of the retired three-step wizard is proven reachable in the Studio by **`FF-WIZARD-CAPABILITY-PARITY`** — with the arrow unchanged and the engine untouched.

---

## Appendix — relationship to registered architectures

- **Completes (vision M1 scope):** dissolve the 3-step wizard + retire react-admin.
- **Consumes / rides:** AR-10 (Inspector ← schema SSOT), AR-11 (StyleField for the writable theme editor), AR-4 (style system), AR-13 (theme switch), AR-40/M0 (Metric Palette as the Data surface default), the DTCG token SSOT.
- **Sets up:** M2 (Model mode + Steward role — the `Model 🔒` rail slot is laid here), M3 (Refine lens — the exhaustive theme/part editor grows from M1's writable seam), M4 (governance/dissemination — the top-bar workflow region), AR-30 (MT theme presets — the `themeOverrides` seam, preserved not built).
- **Flags for a future Leader's Scan:** the **MUI→Radix/Ark design-system exit** (insulated by tokenized chrome in M1) — a candidate initiative, deliberately *not* ridden onto the shell reframe.
- **Refuses to disturb:** the dependency arrow (M1 is apps-only), Config = SSOT (no schema change), Law 5 (`fromSDMX` untouched), AR-30 (MT deferred).
