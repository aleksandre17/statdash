---
name: project-no-privileged-node-nav
description: No-Privileged-Node ADR landed — nav-contributor/nav-transparent caps + NavContribution descriptor de-privilege navUtils; section-card.css → @statdash/styles/card.css; renames (AnchorNavContext, DefaultPassthroughShell)
metadata:
  type: project
---

The No-Privileged-Node fix landed (mirrors the presentation-projector registry [[project-presentation-registry]]). `navUtils.ts` is now a GENERIC registry visitor — ZERO `type === 'section'/'georgraph'/'row'` literals.

**The seam (engine, packages/react/src/engine):**
- Two caps on `NodeCap`/`CAPS` in `slice-meta.ts`: `nav-contributor` (node emits a nav section) + `nav-transparent` (real-DOM container the nav extractor descends through — DISTINCT from render `transparent`/wrap flatten; row is real DOM).
- `NavContribution` descriptor lives in its OWN file `engine/nav-contribution.ts` (slice-meta hit the 400-line bloat ceiling — extracted, re-exported from slice-meta). Fields: `idFields` (default `['anchor','id']`), `titleField` (`'title'`), `modeField` (`'view.visibleWhen'`). `DEFAULT_NAV_CONTRIBUTION` encodes the legacy hardcoded reader so output is byte-identical.
- `NodeRegistry.getNavContribution(type,variant)` returns `{...DEFAULT, ...meta.navContribution}` ONLY when the type declares `nav-contributor`, else `undefined`. `registerSlice` now forwards `navContribution` from META.
- `navUtils._extract` consults `nodeRegistry.getCaps(type)`: `nav-transparent` → `collectChildNodes` (nodeWalk.ts) descent w/ inherited row navMode; else `getNavContribution` → emit. Imports `nodeRegistry` from `register-all` (no cycle).

**Plugin META declarations (one line each):** section + georgraph `caps:[…,'nav-contributor']`; row `caps:['nav-transparent']`. They use the default descriptor (no explicit `navContribution`).

**Renames:** `context/SectionNavContext.tsx`→`AnchorNavContext.tsx` (`AnchorNavProvider`/`useAnchorNav`); consumers InnerPageShell + InnerSidebarShell import `@statdash/react/context/AnchorNavContext` (deep import via tsconfig `@statdash/react/*`→src wildcard; no package.json export entry). `theme/defaults/DefaultSectionShell.tsx`→`DefaultPassthroughShell.tsx` (was a misnamed `<>{children}</>` fallback, NOT section code; barrel `theme/defaults/index.ts` is unused/leftover).

**P4 verdict:** `react/src/styles/section-card.css` was NOT section-node-specific — `.sc` is dead legacy (SectionShell uses `.section` from its own section.css), `.panel` is the LIVE half consumed by react's own `PanelLayout.tsx`. It is a generic token-dependent card primitive → moved to `packages/styles/src/css/card.css`, wired into `@statdash/styles/css/index.css` (after node-styles, before animations). react styles index drops the local import (already pulls `@statdash/styles/css/index.css`).

**FF-NO-PRIVILEGED-NODE** (`engine/no-privileged-node.fitness.test.ts`): scans engine+core for the COMPARISON form (`<type-operand> ===/!== '<plugin-literal>'`), NOT bare strings — so view-mode enums (`'chart'|'table'`), cap tokens, comments, and the core validation corpus are NOT false-flagged. Allowlist = ONLY page-roots (inner-page/tab-page/container-page/page). Asserts navUtils references getCaps/getNavContribution + names none of section/row/georgraph. (c) registers a throwaway `nav-contributor` node and asserts `extractNavSectionsFromChildren` picks it up with zero navUtils edit (OCP proof).

**Green:** build engine+geostat+panel, typecheck, lint (0 err / 38 pre-existing warns), test 1083 passed / 35 skipped / 0 fail. See [[registry-over-special-case]].
