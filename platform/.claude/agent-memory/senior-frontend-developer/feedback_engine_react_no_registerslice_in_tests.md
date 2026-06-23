---
name: feedback-engine-react-no-registerslice-in-tests
description: In engine/react tests, register node types via nodeRegistry.register directly — never import registerSlice (it pulls in i18next, an app-tier dep not resolvable here)
metadata:
  type: feedback
---

When a test in `engine/react` needs to register a node type, call `nodeRegistry.register(type, variant, shell, opts)` directly — do NOT import `registerSlice`.

**Why:** `registerSlice.ts` imports `i18next` to wire `META.i18n` translations. `i18next` is an app-tier dependency (installed under `apps/`, not in `engine/react` or the workspace root). Importing `registerSlice` from an `engine/react` test makes Vite fail to resolve `i18next` and the whole suite errors out before any test runs. This is the Clean Architecture arrow in practice (Law 3): engine/react is app-agnostic.

**How to apply:** Test slices register shells straight onto the shared `nodeRegistry` singleton (from `./register-all`). `nodeRegistry` is module-level and shared across the whole test process, so register in `beforeAll`.

**Also (N44 a11y gate):** the workspace mixes node + jsdom environments, which can disable @testing-library auto-cleanup. Add explicit `afterEach(() => cleanup())` AND `cleanup()` between iterations of any loop that renders multiple nodes — otherwise prior renders survive in `document.body` and axe correctly trips `landmark-no-duplicate-main` (two `<main>` elements). The test passed standalone but failed from the workspace root until cleanup was made explicit. See [[project-theming-seam]].
