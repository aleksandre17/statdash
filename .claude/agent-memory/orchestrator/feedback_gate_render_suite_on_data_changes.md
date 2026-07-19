---
name: gate-render-suite-on-data-changes
description: An agent that changes DATA/CONFIG flowing to the UI (e.g. string→LocaleString) must self-verify against the CONSUMING APP's RENDER suite, not just its own unit tests — or a render-only regression slips through
metadata:
  type: feedback
---

When an agent changes config/data that FLOWS TO RENDERING (canonical case: bilingualizing provisioning labels, plain `"x"` → `{ka,en}` LocaleString), its green-gate MUST include the **consuming app's render/validation suite** (e.g. `apps/geostat/.../perspective-render-validation.test.tsx`), not only the unit tests of the file it edited.

**Why:** a provisioning-i18n agent (2026-06-28) converted 255 strings to `{ka,en}` and self-verified GREEN on its own provisioning vitest (60 tests) — but never ran the geostat render suite. A parallel grain agent caught the real regression: 19 render failures, *"Objects are not valid as a React child (found: object with keys {ka,en})"* — because several render/parse boundaries (`resolveTemplate`, the perspective-toggle path) don't resolve LocaleString → active-locale, so the raw object reached a React child. The data change was correct (Law 4); the render layer hadn't caught up. The gap was a too-narrow self-verify scope, not bad work.

**How to apply:**
- In any dispatch that mutates manifest/provisioning/config display values, REQUIRE the agent to run the render/validation suite of every app that consumes that config (geostat render-validation, panel preview), and name it explicitly in the green-gate instruction.
- Orchestrator's converged gate already runs `pnpm test` (full) which catches it — so NEVER commit on an agent's self-report alone; the authoritative converged gate is the control point. This is why the [[green-gate-panel-typecheck]] discipline + "orchestrator runs the full gate before commit" exists.
- Pattern lesson: string↔LocaleString (and any value↔object widening) is a render-boundary change. The permanent guard is a fitness asserting NO raw LocaleString object reaches a rendered React child / template output — sibling to labelCompleteness.

**REPEAT INCIDENT 2026-07-19 (ADR-049 P1, my slip):** I committed P1 (`00117ef`) on the build agent's self-report (it ran panel vitest 1181/1181 + core build — GREEN) WITHOUT running the full converged gate. P1 put `make()` factory functions in `SPEC_CATALOG`, and `describeApp` emits `specTypes:SPEC_CATALOG` into the JSON manifest → `@statdash/react constructor.test.ts` "round-trips through JSON without loss" went RED (a Function in a serializable manifest = Law 2 violation). The next agent (P2a) caught it because ITS gate ran `@statdash/react`. **The rule I broke is already written above (line 14): NEVER commit on an agent's self-report alone — the orchestrator runs the FULL converged `pnpm test` (all projects: contracts/core/react/plugins/panel + geostat render) before any commit.** A `packages/core` change especially must gate `@statdash/react` (manifest round-trip) + geostat render, not just the panel. Adopt it as a hard pre-commit step, not an aspiration.
