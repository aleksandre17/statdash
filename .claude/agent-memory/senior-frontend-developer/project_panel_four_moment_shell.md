---
name: panel-four-moment-shell
description: "AR-52 relay Step 1 — the four-moment shell: Data-first 5-mode rail, top bar stripped to context + Publish terminal, one home per capability. Supersedes SPEC-S5 rail/top-bar arrangement."
metadata:
  type: project
---

**AR-52 relay Step 1 — the Four-Moment Shell (DONE 2026-07-15, branch
feat/ar49-m0-metric-first-authoring, commit 9e71b40; apps/panel only, arrow held,
ZERO object-model change).** Spec: `docs/architecture/proposals/BLUEPRINT-panel-canonical-relay.md`
(§1 IA map + §3 Step 1). Pure re-homing — the whole panel now reads as the four moments
DATA → COMPOSE (Add/Layers) → REFINE (Inspector) → PUBLISH. Builds on / SUPERSEDES the
SPEC-S5 arrangement in [[project_panel_studio_map]] ("panel studio ia s5").

**What moved (before → after):**
- **RAIL** (`studio/rail.ts` RAIL_ENTRIES) — was TWO modes `[insert(Add), layers(Layers)]`;
  now FIVE ordered modes **`model(Data) · insert(Add) · layers(Layers) · pages-site(Site) · style(Style)`** — Data FIRST (the front door). Icons re-used from the old top bar (Schema/Web/Palette). `SURFACE_HEADINGS` shortened to Add/Layers/Site/Style (was 'Pages & Site'/'Brand & theme').
- **TOP BAR** (`studio/StudioTopBar.tsx`) — STRIPPED to global context + the PUBLISH terminal.
  REMOVED: the page `Select`, the Compose⇄Data-model `ToggleButtonGroup` switch, the "Site & chrome" Button, the "Brand & theme" IconButton. KEPT: wordmark, locale preview, ⌘K, logout. ADDED: a read-only `Strata ▸ {pageTitle}` breadcrumb (NON-interactive context, not a page-nav door — bottom tabs own page-nav). `PageWorkflowBar` re-seated as the terminal top-right ("ship it" corner). Props shrank to `{locale, locales, onLocaleChange, onOpenCommand}` (dropped dataModelActive/onOpenDataModel/onExitDataModel/onOpenStyle/onOpenSite).
- **SHELL** (`studio/StudioShell.tsx`) — only the TopBar prop wiring + dropped the now-dead `enterDataModel`/`openSite` handlers. Site/Style already rendered in the left dock via `renderSurface`; adding them to RAIL_ENTRIES + removing the top-bar buttons re-homes them with ZERO shell-dispatch change. `exitWorkspace` (FocusView back) kept.

**KEY DECISION — Data stays a full-screen FocusView, re-homed to the rail (NOT moved into the
left panel).** The blueprint IA table aspires to Data's DICTIONARY in the left panel with a
drill-to-modeler FocusView, but that is a DataModelBody restructure that conflicts with the
owner-blessed §3.4 "Data model is a separate screen you navigate OUT to" + FF-MODEL-IS-FOCUSVIEW.
So Step 1 re-homes the ENTRY only: clicking rail **Data** → `setSurface('model')` → the EXISTING
`WORKSPACE_SURFACES.model='data-model'` → full-screen `<FocusView>` (unchanged). The
"dictionary-in-panel, drill-to-define" split is deferred (flagged to lead for a later step —
it's really the PLANE/dictionary work). `model` is FIRST in rail ORDER but `DEFAULT_STUDIO_SURFACE`
stays `insert` (boot lands on compose+canvas, not a full-screen takeover).

**Non-obvious couplings hit (all resolved):**
- The panel HAS shell-level routing now (`studio/StudioRoutes.tsx`, `/studio/:surface`, `renderStudio`
  drives it via MemoryRouter). NOTE: `studio/FocusView.tsx`'s header comment still claims "the panel
  has no URL router at the shell level" — STALE since M0 real routing; reconcile on next touch.
- Fitness/e2e re-pointed from the top-bar to the rail: `dataModelReachable.fitness` + `StudioShell.test`
  (banner 'Data model' button → rail 'Data'; the 2-pane block → 5-mode block; the Theme/Site top-bar block
  → rail Site/Style modes), `StudioTopBar.test` (fully rewritten — the switch/Site/Style tests are gone,
  replaced by a LAW-C "doors retired" assertion), `roleIsLens.fitness` (comment only — assertion held).
  e2e: `studioRouting`/`steward`/`dataFlowVisible`/`dataModelReachable`/`chromeNavAuthoring` reach the rail
  now (+ studioRouting heading 'Brand & theme'→'Style', 'Pages & Site'→'Site'). `focusView.fitness` UNCHANGED
  (it deep-links `/studio/model`, not the entry — the FocusView-is-a-separate-screen invariant is preserved).

**GATE:** lint 0 errors (58 react-refresh warns baseline); `tsc -b apps/panel` 0; panel vitest
**127 files / 914 PASS / 0 fail**. e2e updated to the new IA but NOT run (offline bridge — see
[[project_panel_playwright_e2e]]); lead owns the :3013 deploy + owner screenshots.
