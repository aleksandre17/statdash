---
name: shell-ui-hooks-shared
description: Generic shell UI hooks (useCollapsible/useViewToggle/accentStyle/viewStateKey) live in @statdash/react engine/hooks, not in any one node slice
metadata:
  type: project
---

App-agnostic shell UI hooks live in `packages/react/src/engine/hooks/` and are
barrel-exported from BOTH `@statdash/react` and `@statdash/react/engine`:
- `useCollapsible(defaultOpen, noCollapse)` → disclosure open-state + header
  a11y/keyboard `headProps` + `canCollapse`. Zero element knowledge.
- `useViewToggle(children, keyNamespace, resolvedId, toggleOptIn)` → role-tagged
  sibling-children view switch (chart/table); persisted in GlobalState under
  `viewStateKey(namespace, id)`. Was section-bound (hardcoded `sectionViewStateKey`);
  de-section-ed by adding the `keyNamespace` param — section call-site passes `'section'`.
- `viewStateKey(namespace, id)` → `${ns}:view:${id ?? 'anon'}` GlobalState key.
- `accentStyle(color)` → `{ '--sc': color } | undefined` per-node accent override
  of the page `--sc` cascade. Lives in @statdash/react (NOT @statdash/styles)
  because it returns a React CSSProperties — @statdash/styles is deliberately
  React-free (its resolvers return plain attribute records, never CSSProperties).

**Why:** these were trapped in `plugins/nodes/section/default/` (useCollapsible.ts,
useViewToggle.ts, sectionKeys.ts) after a shell readability refactor — generic
behavior dumped in one element's folder. The genericity reflex: a reusable
behavior belongs in the shared layer (react ← plugins), never one slice.

**How to apply:** any new collapsible/role-toggle/accent shell reuses these with
zero new code. When extracting from a slice, check whether the unit carries
element knowledge; if not, it belongs in `engine/hooks/`. Section-specific
composition (SectionShell/Header/Methodology, styleKeys, section.css, SectionNode)
correctly stays local. Tests for shared hooks → `engine/hooks/shellHooks.test.tsx`.

**Sibling-scan verdicts (kept local, genuinely element-specific):**
- `chrome/inner-sidebar/default/useSidebarNav.ts` — SPA router mode-switch/
  cross-page/in-page nav intent resolution; sidebar-nav-domain. KEEP.
- `useSidebarScroll.ts` — pending-scroll queue across a mode-switch navigation;
  nav-coordination-specific. KEEP. (The bare `scrollToAnchor` free function inside
  it IS a latent generic DOM util coupled only to shared `stickyOffset`, but has a
  single consumer today — moving it is premature, YAGNI. Revisit if a 2nd consumer appears.)
- `panels/chart/default/useChartOutput.ts` — fieldConfig cascade + interpretChart;
  chart-data-shaping. KEEP.
- `useChartInteractions.ts` — EventBus row:hover/leave + DataLinks nav:drill for
  chart data points; chart-cross-node wiring. KEEP.
