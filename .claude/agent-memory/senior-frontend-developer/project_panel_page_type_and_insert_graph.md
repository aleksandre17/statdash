---
name: panel-page-type-and-insert-graph
description: "AR-49 foundation — CanvasPage carries its OWN page-root type end-to-end (killed the privileged inner-page hardcode) — plus the node accept-graph gap it exposed (many content blocks have no page-level auto-wrap home). Consolidated distillate."
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

See [[project_constructor_state]], [[project_test_harness_gotchas]] (the react
exportMenu.fitness whole-suite hang this work's gate ran into and excluded).

## The insert accept-graph gap (M4.1 auto-wrap)
The M4.1 auto-wrap insert (`resolveInsertPlan`/`planInserts` in `canvas/insertNode.ts`) resolves a
page-level insert to `page → section → type` when the frame can't hold the type directly — the
canonical wrapper is `section`. This exposed a structural gap in the node accept-graph.

**The accept-graph (verify before relying):** `section` accepts `[chart,table,kpi-strip,columns,
grid,wrap,geograph]`. `grid/columns/card/wrap/stack` are open containers (no `accepts` ⇒ accept
ANY). `geograph` accepts `[table]`; `repeat` accepts `[]` (⇒ any). Page-root accepts now derive
from `page.type` (above), not a hardcoded constant.

**The gap:** content blocks `hero, text, links, card, divider, spacer, stack, stats-carousel,
featured-slider` are accepted by NEITHER the frame NOR a `section`. A page-level insert of any of
them resolves to `blocked` → a localized guided hint, never a placement — they ARE placeable
manually (open containers accept any), just not via one-step page-level auto-wrap. Per-design
(M4.1 chose hint-over-ambiguous-2-level-wrap), but the large blocked set is a smell: `section`'s
`accepts` is data-panel-centric and the taxonomy has no generic page-level CONTENT container.

**How to apply:** widening page-level placement of content blocks (if ever wanted) = widen
`section`'s `accepts` to include content blocks, OR introduce a generic content container the
frame accepts, OR let auto-wrap build a 2-level structure with a chosen default
(`page→section→grid→block`). Do NOT special-case types in `insertNode` — the plan stays
registry-derived (`nestAccepts`); change the META `accepts`/add a container slice instead (OCP).
`FF-INSERT-NEVER-CLIFF` already treats `blocked` as a legal terminal state, so widening accepts
won't break the guard. See [[project_panel_authoring_features_misc]] (section-authoring-uniformity
section) for the section-composition model this interacts with.
