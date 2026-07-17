---
name: panel-per-page-type
description: AR-49 foundation — CanvasPage carries its OWN page-root type end-to-end (killed the privileged inner-page hardcode + round-trip data-loss)
metadata:
  type: project
---

The Constructor page model now carries each page's page-root KIND first-class and
losslessly. Fixes the old defect where `canvasPageAdapter.toNodePageConfig`
hardcoded `type:'inner-page'` on EVERY page (Law 1 + forced every page to render
the inner-page shell) and `PAGE_STRUCTURAL_KEYS` peeled `type` off on load and
DISCARDED it (silent round-trip data loss for landing/tab/container pages).

**The shape (verify before relying):**
- `CanvasPage.type: string` is a REQUIRED first-class column (apps/panel/src/types/
  constructor.ts), node-structural like the engine root node's own `type`.
- `canvasPageAdapter.ts` — `toNodePageConfig` stamps `page.type || DEFAULT_PAGE_TYPE`;
  `fromNodePageConfig` reads `root.type` into the column (backstops to
  `DEFAULT_PAGE_TYPE`). `DEFAULT_PAGE_TYPE = 'inner-page'` is exported from the
  adapter as the ONE SSOT fallback for a genuinely kind-less inbound config.
- `PageMeta = Omit<PageConfigBase,'id'|'path'>` still does NOT include `type` (type
  comes from the page-node union, not `PageConfigBase`), and `type` stays in
  `PAGE_STRUCTURAL_KEYS` — so `type` is read into the column, never double-sourced
  into `meta`. Round-trip stays symmetric.

**Why REQUIRED (not optional):** the trap the task flagged — a type-less store page
→ serialize stamps the default → reload sets the default ≠ original `undefined`,
breaking symmetry. Required makes `undefined` unrepresentable (compile forces every
creator to declare a kind). ALSO correctness: `resolveInsertPlan` reads `page.type`
into `nestAccepts`; an undefined type would hit `nestAccepts(undefined,…)===true`
(page accepts ANYTHING) and silently break the M4.1 auto-wrap contract.

**Creation paths that set type:** `fromNodePageConfig` (covers API load via
`lib/api.ts fromApiPage`, and templates via `loadTemplate.hydrateTemplate` — all
starter/generated configs already have `type:'inner-page'` roots); `mock-data.ts
MOCK_PAGE`; PageBrowser blank "New page" (`createPage({type: DEFAULT_PAGE_TYPE,…})`).
Type survives the API round-trip inside the `config` NodePageConfig tree (no lib/api
change needed).

**Insert per-page accepts (DONE, full — not deferred):** `PAGE_ROOT_TYPE = 'inner-page'`
was REMOVED from `insertNode.ts`; `resolveInsertPlan(page,…)` now uses `page.type`
for the page-root accepts + auto-wrap gate. Safe because all three registered page
roots (inner-page/tab-page/container-page, `packages/plugins/pages/*/default/meta.ts`)
declare `canHaveChildren:true` + slots (the `landing` variant is `type:'container-page'`).
FF-INSERT-NEVER-CLIFF + V6 byte-identity preserved.

**New guard FF-NO-PRIVILEGED-PAGE-TYPE** (canvasPageAdapter.test.ts): a non-inner-page
fixture (`type:'landing'`) must round-trip its kind verbatim + `cfg.type !==
DEFAULT_PAGE_TYPE` — locks Law 1 for the page root so the hardcode can't regress.

**Render (item 6):** per-page type flows into the canvas config but every live page is
still `inner-page` today, so no render regression (authorRender.e2e green). Chrome DATA
threading into the canvas SiteProvider is a SEPARATE queued fix — NOT done here.

**Gate (2026-07-10):** root `tsc -b --force`=0; panel 609 pass; core+plugins+geostat
1389 pass; react 500 pass (exportMenu.fitness excluded — known baseline hang, react
untouched, see [[project_react_exportmenu_fitness_hangs_gate]]); lint 0 errors.
See [[project_constructor_state]], [[project_panel_insert_accept_graph_gap]].
