---
name: panel-studio-m2-role-lens
description: AR-49 M2.0+M2.1 — Steward role LENS (useRole seam, rail stewardOnly, TopBar toggle, FF-ROLE-IS-LENS) + M2.1 modeler relocated into ModelSurface, FF-AUTHOR-NO-QUERY. NOT a security boundary.
metadata:
  type: project
---

**M2.1 — relocate the modeler (DONE 2026-07-09, same branch).** ModelSurface is now REAL:
`surfaces/ModelSurface.tsx` lazy-mounts the SHARED `features/data-layer` `DataModelingPanel`
(no fork — Strangler host-swap) under a synchronous bilingual Steward caption ("Define the
governed data model…"). `DataSurface.tsx` STRIPPED of the "Advanced" Accordion/lazy/Suspense →
now MetricPalette only (author lens = governed nouns, no query cliff). Author who needs to model
flips the M2.0 lens → Model surface (same live canvas). Metric Editor is still M2.2 (NOT built).
New FF: `studio/authorNoQuery.fitness.test.ts` (FF-AUTHOR-NO-QUERY) — raw-globs `./surfaces/*.tsx`,
strips comments FIRST (DataSurface prose now names DataModelingPanel), asserts no author surface
references DataModelingPanel/DataSpecEditor/Query|Pivot|Transform|GrowthEditor/`features/data-layer`;
excludes the single `stewardOnly` surface (ModelSurface), anchored to RAIL_ENTRIES. Tests: rewrote
DataSurface.test (palette present + modeling machinery ABSENT), new ModelSurface.test (caption sync +
lazy DataModelingPanel mounts + reads store), updated StudioShell.test Model-caption assertion.
GATE: eslint 0 err, tsc -b apps/panel 0, studio+data-layer 21 files/104 PASS, boot smoke/composition/
i18n/App.boot 6 PASS, **Playwright e2e boot.e2e.ts 2/2 PASS** (offline bridge — author boot still
renders populated MetricPalette + binds a metric, no crash). e2e bridge gotcha: shim `@playwright/test`
→ cache `705bc6…`, but `node_modules/playwright` junction → cache `361ceb…` (TWO 1.61.1 copies →
"two versions" error); run CLI from the SHIM's cache: `node <705bc6…>/playwright/cli.js test boot.e2e.ts`.

---

AR-49 **M2.0 — the Steward role LENS** DONE (2026-07-09, branch
feat/ar49-m0-metric-first-authoring; additive, reversible, zero regression). Spec:
`docs/architecture/proposals/SPEC-authoring-reconception-M2.md` §2/§9. **M2.0 ONLY** —
modeler relocation = M2.1, Metric Editor = M2.2 (NOT built here). All work in
`apps/panel/src/studio` (arrow held, packages/ untouched). Builds on [[project_panel_studio_shell_m12]].

**`studio/useRole.ts` — THE swappable seam (the load-bearing decision).** `type
Role='author'|'steward'`. Source = tiny zustand `persist` store, localStorage key
`statdash.role`, default `author`; exported as `useRoleStore` FOR TESTS ONLY (UI must not
touch it). `useRole()` = the SINGLE reader; `useToggleRole()`/`useSetRole()` for mutation.
Heavy doc comment: NOT a security/enforcement boundary — a user CAN flip the toggle;
`role==='steward'` is NOT proof of authorization. Rebind the `useRole()` BODY to a JWT/auth
claim later (AR-30) without touching a single consumer — that's the preserved-not-built seam.

**Rail unlock = role-gated visibility, not the old `locked` flag.** `rail.ts`: removed
`locked?: boolean`, added `stewardOnly?: boolean` on the `model` entry + pure
`visibleRailEntries(role)` filter (OCP predicate over the data table). `ActivityRail` now
takes a `role` prop and renders `visibleRailEntries(role)`; ALL lock/badge/disabled UI
deleted. Author lens ⇒ Model ABSENT; steward lens ⇒ Model is an ordinary enabled entry.

**StudioShell = the ONE `useRole()` call site.** Threads `role` → ActivityRail + StudioTopBar
(one reader, many consumers). Added `effectiveSurface` guard:
`activeSurface==='model' && role!=='steward' → DEFAULT_STUDIO_SURFACE` — leaving the steward
lens while on Model falls back to Insert (no stranded dock; the role store stays DECOUPLED
from the surface store — projection happens in the shell, not by cross-store coupling).
`renderSurface` `case 'model'` → `<ModelSurface>`.

**`surfaces/ModelSurface.tsx`** — minimal bilingual placeholder ("Define the governed
semantic layer — metric authoring arrives in M2.1"). Summonable left surface over the SAME
always-mounted live canvas (never a route).

**Toggle affordance = StudioTopBar** (new props `role`/`onToggleRole`): `<Button>` with
`aria-pressed={role==='steward'}`, bilingual label Model/მოდელი + tooltip Enter Model mode /
Return to Compose, native keyboard-reachable. **⌘K command DEFERRED** — `useCommandRunner`
early-returns without an active page (`if(!page||!pageId)return`), so it isn't shaped for a
global page-independent action; forcing role-toggle in would be a symptom patch. Flagged as a
clean follow-up needing the runner to gain a global-action path.

**FF-ROLE-IS-LENS** = `studio/roleIsLens.fitness.test.ts` (raw-glob via `import.meta.glob('?raw')`
like chromeTokenDriven; comments stripped first — panel has no @types/node, never node:fs):
(1) no consumer reaches past the seam to `useRoleStore`/`statdash.role`; (2) no consumer gates
UI on an auth/tenant/user primitive (getToken/isAuthenticated/jwt/claim/tenant) — the `logout`
import in StudioTopBar is a session action, allowed (regex targets read-side authz primitives);
(3) exactly one `stewardOnly` rail entry (model); + a planted-source bite-check.

**Tests:** `useRole.test.ts` (default author, toggle flips, setRole, persists to statdash.role);
StudioShell.test REWROTE the old "Model slot LOCKED" block → author-lens-absent /
steward-enabled+selectable / lens-exit-fallback (reset `useRoleStore.setState({role:'author'})`
in beforeEach); StudioTopBar.test added toggle a11y (aria-pressed author→false steward→true,
native button). GATE: tsc -b apps/panel=0, eslint studio=0, vitest panel 74 files/468 PASS
(+2 files). DataSurface "Advanced" disclosure UNTOUCHED (its removal is M2.1).
