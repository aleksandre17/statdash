---
name: framework-verdict
description: "The framework-grade question, consolidated (07-15→07-19 arc): bones EXIST (never teardown-panic), verdict = PARTIAL/converging not circling; residual = adoption/projection + CI-off. Superseded in part by 0102's 'engine canonical, projection missing'. Merges: framework-grade-verdict + framework-platform-verdict + framework-bones-exist."
metadata:
  type: project
---
The owner's recurring fear — "are we circling? is any of this framework-grade?" — was answered three times (07-15, 07-16, 07-19), each time converging on the SAME diagnosis. This is the consolidated arc; the 0102 study (ADR-050) is its current authoritative form.

**The diagnosis (stable across all three reviews):**
1. **The bones EXIST — never teardown-panic.** DI/IoC real (`packages/react/src/engine/di/Container.ts` + `useInject` + `ExtensionPoint`), plugin registry + pages real, dependency arrow machine-enforced, engine agnostic. The disease is ADOPTION/legibility (DI touches ~4 components; the framework story is invisible), never absence. When the owner despairs toward teardown, the cure is EVIDENCE the substrate is sound — route to surfacing/canonicalizing what exists; benchmark before adding machinery (no cargo-cult Spring-in-React).
2. **Verdict: PARTIAL, converging — NOT circling** (two independent lenses, 07-15, `SYNTHESIS-2026-07-15-framework-platform-verdict.md`). The object-model loop (ADR-041/042) ENDED — protect it from re-opening. The felt "circling" had concrete mechanical causes, not conceptual ones.
3. **The residuals, named:** (a) **the proving machine is OFF** — CI never executed (`ci.yml` dead filters; DB suites + e2e never ran) → "journey = unit of done" unenforceable; one owner key-turn, not a big work item — keep reframing it that way; (b) meta-laws forked above the last unification (Projector Law, Publishable Identity) — being named as ADRs; (c) 07-16 root inversion: *we build a dashboard that wants to be a framework instead of a framework whose first instance is this dashboard* — every wave improved the product, not the framework-as-first-class-thing.
4. **0102 (07-19) sharpened it definitively:** architecture is CANONICAL; the disease is MISSING PROJECTION at every level ("engine canonical, projection missing") — page-skeleton built+registered but not projected, starters as fixtures, chrome engine-grade but raw-controlled. Remedy = R1→R6 (ADR-050), not rebuild.

**How to apply:** never respond to "still not framework-grade" with another leaf-wave — the answer is projection/adoption work (R1→R6), CI resurrection (owner door), and framework-first framing. Protect settled ground: ADR-041/042 and the object model are closed questions. See [[canonical-panel-ia]], [[circle-break-root-study]], [[trunk-over-leaves]], [[authoring-canon-program]].
