---
name: plugins-shell-test-mock-new-engine-import
description: When a plugins shell newly imports a symbol from @statdash/react/engine, its unit tests that vi.mock that module must add the symbol to the mock or the shell crashes (undefined component)
metadata:
  type: feedback
---

A `packages/plugins` shell unit test typically `vi.mock('@statdash/react/engine', () => ({...}))`
with ONLY the surface it exercises (e.g. `useFiltersContext`, `filterControlRegistry`). When you
add a NEW engine import to the shell (e.g. `BandItemBoundary` in `FilterBarShell`), the mock does
NOT auto-provide it → the symbol is `undefined` → rendering `<undefined>` throws for the whole
suite (`Tests N failed`, not a clear message).

**Why:** vi.mock replaces the ENTIRE module with the factory's object; anything not listed is
absent. The failure surfaces at the JSX call-site of the new symbol, easy to misread as a logic bug.

**How to apply:** when a shell gains an engine import, grep its `*.test.tsx` for
`vi.mock('@statdash/react/engine'` and add the symbol to the mock. Mirror the REAL off-canvas
behaviour so DOM stays byte-identical — e.g. `BandItemBoundary: ({ children }) => children` (it is a
zero-DOM passthrough Fragment when no AuthoringAnchorContext). Related: [[panel-bounded-element-bands]].
