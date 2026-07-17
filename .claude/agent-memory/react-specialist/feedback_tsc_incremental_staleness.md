---
name: tsc-incremental-staleness
description: Root `tsc -b` is incremental and can emit phantom stale errors; force `tsc -b --clean` before trusting the whole-graph typecheck DoD gate
metadata:
  type: feedback
---

When the DoD requires an independent whole-graph typecheck (`tsc -b` at platform root), the FIRST run can report errors in files you never touched (observed: 3 phantom `TS18048` in `apps/panel/.../nestedItemControl.escalation.fitness.test.tsx` while implementing an unrelated `packages/charts` feature). These come from stale `.tsbuildinfo` incremental state, NOT your change.

**Why:** `tsc -b` is a project-references *build* — it trusts cached buildinfo and can surface (or hide) errors that a clean recompile does not. A false-red here wastes time chasing a non-bug; a false-green is the repo's #1 recurring slip.

**How to apply:** before pasting the real `tsc -b` result for a DoD gate, run `npx tsc -b --clean` then `npx tsc -b` and trust the clean run's exit code. Cross-check by grepping the error list for your own package path — if your package is absent from the errors, the phantoms are pre-existing/stale, not yours. Confirm with `git stash -u` + rebuild only if still unsure (but note stash+incremental can itself mislead — the clean rebuild is the authoritative check).
