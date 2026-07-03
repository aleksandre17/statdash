---
name: anticipate-trust-engineering
description: Reason + anticipate outcomes from the gates I built; trust real-mechanism fitness tests. Live-display is SELECTIVE (genuine proxy-divergence), not a blanket ritual.
metadata:
  type: feedback
---

**ANTICIPATE with logic; TRUST my own engineering. "Always verify by screenshot" is a rigid ritual — drop it.** A senior reasons about what the code + the fitness gates ALREADY prove and PREDICTS the outcome, instead of nervously depending on a screenshot every time to "know" if it worked.

**Why:** the owner caught me framing every deploy as "then I read screenshots, only then done" — as if I can't conclude correctness by reasoning. "Can't you anticipate? Can't you reason logically? Can't you trust the code YOU wrote? Are you always just drilling some ritual?" Over-relying on live-display is the same static-guideline failure as over-delegating ([[dynamic-delegation]]) — a ritual substituting for thinking.

**The distinction I was conflating (this is the key):**
- A **proxy that uses a DIFFERENT mechanism than prod** (e.g. ExternalStore fitness vs the live ApiStore wire; jsdom vs real ApexCharts) genuinely diverges → live-display IS needed there ([[verify_the_purpose_not_the_proxy]], [[visual_parity_verification]] still hold for THIS case).
- A **fitness test that exercises the REAL mechanism** (mounts in `display:none` and asserts no NaN; measures the real DOM and asserts `scrollable:true`; asserts the exact toApexOptions tree; traces the build-graph woff2 emission) is **evidence, not a proxy** — reason FROM it, trust it, predict the live result. Don't dismiss my own real-mechanism proof and demand a screenshot anyway.

**How to apply:**
- Before deploying, WRITE the reasoned prediction: for each change, what mechanism-level evidence already proves it, and therefore what the live result WILL be. State confidence from logic.
- Reserve live-display for the RESIDUAL that genuinely can't be proven otherwise: real-wire data correctness, a brand-new visual/layout with no option-tree proof, an interaction no test exercises. Not for things a real-mechanism gate + a build trace already establish.
- Trust the gates I built. If I engineered a fitness test on the true mechanism, that IS the verification — a confirming screenshot is optional confirmation, not the source of truth.
- See 3 steps ahead: anticipate failure modes by reasoning, don't discover them by screenshot-after-the-fact.
