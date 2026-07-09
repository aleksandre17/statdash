---
name: panel-studio-shell-m12
description: AR-49 M1.2 Studio shell scaffold — flag mechanism, IA, useCanvasController reuse seam, token-CSS import, and the M1.3/M1.4 hand-off points
metadata:
  type: project
---

AR-49 M1.2 (branch feat/ar49-m0-metric-first-authoring) built the **Studio authoring
shell** as an ADDITIVE, flag-gated alternative to the 3-step wizard. Spec:
`docs/architecture/proposals/SPEC-authoring-reconception-M1.md` (§8 phasing). Wizard is
UNTOUCHED and remains the default (Strangler). All new code is `apps/panel/src` only —
arrow untouched (Law 3).

**Feature flag** (`src/config/flags.ts`): `studioShellEnabled()` — localStorage override
`statdash.studioShell` (on/true/1 vs off/false/0) WINS over env `VITE_STUDIO_SHELL`. Off
by default on both. Preview live without rebuild:
`localStorage.setItem('statdash.studioShell','on'); location.reload()`. App.tsx routes
`studioShellEnabled() ? <StudioShell/> (lazy) : <ConstructorWizard/>`.

**Shell structure** (`src/studio/`): CSS-grid `StudioShell.tsx` with 5 landmark regions —
`StudioTopBar` (header/banner: wordmark "Strata", page switcher, ⌘K, relocated
`PageWorkflowBar`, logout), `ActivityRail` (nav: icon buttons from `rail.ts` RAIL_ENTRIES),
left dock (aside: the summoned surface), canvas (main: the REAL lazy `CanvasView`,
always-mounted home), `RightDock` (aside: selection-contextual Inspector), bottom
(contentinfo: page tabs). Rail→surface map: Insert=NodePalette+ChromePalette,
Data=MetricPalette(primary)+Advanced disclosure(ShowMe), Layers=OutlineTree,
Pages&Site=identity+nav (thin), Style=read-only token viewer, **Model=LOCKED disabled slot
(M2)**. Store: added `activeSurface`/`setSurface` + `useActiveSurface` selector +
`StudioSurface`/`DEFAULT_STUDIO_SURFACE` type — ADDITIVE to the wizard slice (activeStep/
completedSteps stay until M1.3 deletes them); preserved across undo/redo.

**Key reuse seam — `src/studio/useCanvasController.ts`:** the canvas↔store glue
(bindMetric/handleDrop/patchProp/setVisibleWhen/deleteSelected + dragging &
previewPerspectiveId view-state) EXTRACTED from PageStep's inline closures, built from the
SAME shared primitives (nodeSchemaSource/metricBinding/setAtPath/makeNode + store actions).
Byte-identical writes. PageStep keeps its inline copy (frozen) until M1.3 deletes the
wizard and points the surviving canvas here. This is the DRY seam — don't re-fork it.

**Token-driven chrome:** `StudioShell.tsx` imports `@statdash/styles/css/index.css` (the
FIRST time the panel loads the DTCG token layer — the wizard never did). Resolves via the
`@statdash/styles`→packages/styles/src alias in BOTH vite.config + vitest.config. Kept in
the StudioShell lazy chunk (not main.tsx) so the wizard path never pulls it. `studio.css`
reads only `var(--color-*/--spacing-*/--font-*)` — NO hardcoded brand literals (sets up
M1.4 FF-CHROME-TOKEN-DRIVEN + the Strata preset).

**Thin adapters flagged for M1.3** (scaffold, not forks): DataSurface Advanced = ShowMe
only (full source/spec/DataSpecEditor/Excel relocation is M1.3); PagesSiteSurface nav
reorder + real "+add page" (still the `notify('coming')` stub) are M1.3; StyleSurface
writable themeOverrides editor is M1.4.

**M1.3a DONE (2026-07-09, ADDITIVE — wizard NOT deleted, flag NOT flipped; M1.3b awaits
owner):** relocated the last wizard-only capability via EXTRACT-AND-DELEGATE (not fork —
the DRY seam the brief mandates). New shared components consumed by BOTH the wizard step
and the Studio surface: `features/data-layer/DataModelingPanel.tsx` (the full source/spec
browser+editor lifted from DataStep; container-query responsive via
`data-modeling-panel.css` — 2-col in the wide step, stacked in the 300px dock) and
`features/site/{SiteIdentityEditor,NavEditor}.tsx` (lifted from SiteStep; NavEditor takes
`onAddPage` so the wizard keeps its stub while Studio wires real create). DataStep/SiteStep
are now THIN frames (header+waterfall-gate) around the shared bodies — behavior
byte-identical. `DataSurface` mounts DataModelingPanel LAZY under the Advanced accordion
(only on expand — keeps the 60kB data-layer chunk out of the eager 12.7kB StudioShell
chunk). `PagesSiteSurface` = SiteIdentityEditor + NavEditor + lazy `PageBrowser` for real
"+add page" (done⁺, exceeds wizard stub). StyleSurface stays read-only (parity; writable =
M1.4). RightDock/TopBar/Insert/Layers already fully covered PageStep in M1.2 — no work
needed. Parity checklist: `docs/architecture/proposals/M1.3-parity.md` (no
wizard-deletion boundary hit). GATE: tsc 0, eslint 0, panel vitest 65 files/421 tests PASS
(added DataModelingPanel/DataSurface/PagesSiteSurface tests = +3 files/+11), vite build OK.

**Test gotchas:** (1) App defaults to `ka` locale (site.activeLocales empty → falls back to
ka) so rail aria-labels are Georgian in App-level tests; seed `updateSite({defaultLocale:
'en',activeLocales:['en']})` for English assertions (StudioShell.test does this). (2) A
test that lazy-loads StudioShell via `<App/>` needs a generous `findBy` timeout (~20s) —
vitest transforms the whole subsystem graph on first dynamic import. (3) Render StudioShell
with NO active page (default store) to keep the always-mounted canvas in its no-page state
and avoid the heavy lazy CanvasView mount. (4) MetricPalette search box: query
`getByPlaceholderText('ძებნა…')` (no `searchbox` role). See
[[project_panel_m0_boot_gaps]], [[project_panel_live_canvas]], [[project_semantic_token_spine]].

**GATE (2026-07-09):** tsc -b apps/panel = 0; eslint = 0 errors (2 pre-existing accepted
warnings); vitest panel = 62 files / 410 tests PASS (incl. boot smoke + boot-parity +
mainI18nInit); vite build OK (StudioShell 14.6 kB lazy chunk). Provable only live: the
flag-on shell against a running api+db (MetricPalette population).
