---
name: verification-fit-per-situation
description: Choosing the KIND of verification is a logistical judgment — match the proof to the claim (live-UX → Playwright/look at :3013; logic → unit/fitness; invariant → FF; data → parity). A wrong or worthless test type is noise; sometimes SKIP the test and just LOOK.
metadata:
  type: feedback
---
**Rule:** picking the **kind of verification** is itself a per-situation logistical decision — never rote. The DoD's proof must be the one that actually convinces a skeptic the thing works **for the owner**, at the right cost. Ask "what evidence would prove this?" — not "did I write a test?". Sometimes a specific test type adds NO value (skip it); sometimes it's better to **skip writing a test and go live — Playwright / open :3013 / actually LOOK** — than to author a green test that proves nothing.

**Why (2026-07-11):** the owner: *"as a logistician you must also decide which kind of test fits which situation — a specific test type may add nothing, or it may be better to go into Playwright and actually look. Always decide the best per the concrete situation. You must THINK, be a person [have judgment]."* This names the root of my recurring failure: I reported unit/`tsc`-green as if it were "works," when the LIVE panel showed nothing ([[panel-live-boot-verification]], [[trunk-over-leaves]]). A test of the wrong type is false confidence — worse than none.

**The decision framework (my improvement — match proof to claim):**
| The claim is about… | The RIGHT verification | Wrong/weak proof (don't rely on) |
|---|---|---|
| **Behaviour visible in the live tool** (selection, rendering, routing, "click X → see Y", fit) | **Playwright on the REAL boot path + a live look at :3013** (screenshot/manual) | jsdom/unit test — passes while the live tool is broken (e.g. [[localestring-leak-apex-blindspot]]: jsdom can't render chart shells) |
| **Pure logic / transform / mapping** | fast **unit test** (deterministic, cheapest) | a heavy e2e (overkill) |
| **Architectural invariant** (no-special-case, schema-complete, arrow) | a **fitness function** | a one-off example test |
| **Data correctness** (values "as they were") | **render-parity vs golden, THROUGH the pipeline** | asserting against a hardcoded constant |

**How to apply:** (1) For every deliverable, CHOOSE the verification that reaches the actual assertion for the actual claim — state it in the DoD (I already brief live-UX cards as "Playwright real-boot + :3013 look", not tsc-green). (2) Refuse worthless tests: if a test type can't observe what would break (jsdom on pixels, a mock that stubs the failing seam), DON'T write it to pad "coverage" — a green test that can't fail on the real bug is a false-green. (3) When "just LOOK" (deploy + open :3013 / a Playwright screenshot) is the cheapest honest proof, do THAT instead of a synthetic test. (4) Cost-fit both ways: no heavy e2e for a trivial pure function; no cheap unit test standing in for a live-UX claim. (5) A green gate I have NOT seen reach its assertion is not evidence — false-green is worse than no gate. Related: [[panel-live-boot-verification]] · [[green-gate-panel-typecheck]] · [[gate-render-suite-on-data-changes]] · [[canon-dod-incidents]].
