---
name: feedback-engine-react-mock-conventions
description: "Two related vitest conventions in packages/react and packages/plugins tests — register node types directly on nodeRegistry (never import registerSlice, it pulls i18next), and keep a shell's vi.mock('@statdash/react/engine') mock in sync with every new engine import the shell adds. Consolidated distillate."
metadata:
  type: feedback
---

> Consolidated 2026-07-22 from 2 sibling files (feedback-engine-react-no-registerslice-in-tests,
> feedback-plugins-shell-test-mock-new-engine-import). Both are the SAME class of mistake: a
> module boundary silently changed and the test's stub didn't follow.

**In `packages/react` tests, register node types via `nodeRegistry.register(type, variant, shell,
opts)` directly — never import `registerSlice`.** `registerSlice.ts` imports `i18next` to wire
`META.i18n`, and i18next is an app-tier dependency (installed under `apps/`, not in `packages/react`
or the workspace root). Importing `registerSlice` from a packages/react test makes Vite fail to
resolve `i18next` and the WHOLE suite errors out before any test runs (Law 3 in practice —
packages/react is app-agnostic). Register straight onto the shared `nodeRegistry` singleton (from
`./register-all`) in `beforeAll` — it's module-level, shared across the whole test process.
**Also (N44 a11y gate):** the workspace mixes node+jsdom environments, which can disable
`@testing-library` auto-cleanup. Add explicit `afterEach(()=>cleanup())` AND `cleanup()` between
iterations of any loop rendering multiple nodes — otherwise prior renders survive in
`document.body` and axe correctly trips `landmark-no-duplicate-main`. A test can pass standalone
but fail from the workspace root until cleanup is explicit.

**When a `packages/plugins` shell newly imports a symbol from `@statdash/react/engine`, every unit
test that `vi.mock`s that module must add the symbol to its mock or the shell crashes with an
opaque `undefined` component.** `vi.mock` replaces the ENTIRE module with the factory's object —
anything not listed is absent; the failure surfaces at the JSX call-site of the new symbol (easy
to misread as a logic bug, not a stale mock). **How to apply:** when a shell gains an engine
import, grep its `*.test.tsx` for `vi.mock('@statdash/react/engine'` and add the symbol, mirroring
the REAL off-canvas behaviour so DOM stays byte-identical (e.g.
`BandItemBoundary: ({children})=>children` — it's a zero-DOM passthrough Fragment with no
AuthoringAnchorContext). See [[project_panel_bounded_element_bands]].
