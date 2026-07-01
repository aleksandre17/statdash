---
name: verify-board-empirically
description: BOARD.md / status docs go stale; verify build/test/feature state empirically before trusting or routing on a claim
metadata:
  type: feedback
---

Before trusting any status claim in `work/BOARD.md` (or similar handoff docs), verify it against the actual code/build/test state — these docs go stale faster than they get updated.

**Why:** In the 2026-06-23 overnight session the board misled three times in one sitting:
- "⏳ Build red (react-dom peer)" — but `build:engine` + `typecheck` + `build:geostat` + full test suite were all GREEN (Lane A had fixed it without updating the note).
- "PropSchema inspector seam 88% (15/17)" — page-canvas was actually 100%; the real gap was the *untested chrome layer*.
- "SDMX-P1 … Deferred 📋 NOTED" — V27 ConceptScheme, V28 dataset-lifecycle, V29 CategoryScheme were already built with live-DB fitness tests.

**How to apply:** When a board line drives a routing or "what's next" decision, run the cheap empirical check first (`pnpm build:engine && pnpm typecheck && pnpm test`; `git log`; grep for the artifact; `find` for the migration/test files). Then *correct the board in the same pass* so the next session isn't misled. Treat the board as a lead, not as truth. Pairs with [[overnight-validation-on-server]].
