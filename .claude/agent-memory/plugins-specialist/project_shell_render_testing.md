---
name: project-shell-render-testing
description: How to jsdom-render-test a plugin shell inside the plugins vitest package
metadata:
  type: project
---

Plugin shells (e.g. nodes/section/default/SectionShell) CAN be jsdom render-tested
inside the plugins package despite the older MapShell.test.tsx note that says
"@statdash/react/engine is not resolvable in node env".

**Why:** that limitation is the *node* vitest environment. The plugins vitest.config
aliases `@statdash/react` → `react/src` with `conditions: ['source', ...]`, and the
`./engine` subpath has a `source` export. Under `// @vitest-environment jsdom` the
alias resolves fine.

**How to apply:**
- Add `// @vitest-environment jsdom` docblock at top of the .test.tsx.
- `@testing-library/react` is a root devDep (hoisted) — `render`, `renderHook`, `act`,
  `fireEvent`, `cleanup` all available.
- A shell created by `defineShell` is callable as `Shell(def, ctx, children) => ReactNode`.
  `defineShell`'s ShellWrapper uses `useLayoutItem()`/`useWrapStyle()` which default to
  null (no provider needed).
- Wrap in real `GlobalStateProvider` (from `@statdash/react/engine`) to exercise
  view-toggle persistence for real.
- `useT`/`useExtensions`/icons depend on SiteProvider+i18next — mock `@statdash/react`
  (vi.mock) with identity translator + empty extensions + icon stubs rather than standing
  up the full provider tree. They are the SUT's collaborators, not the unit under test.
- Build a minimal RenderContext touching only what the shell reads (sectionCtx,
  filterParams, vars, extensions).
