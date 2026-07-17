---
name: instrument-selection
description: "Right instrument for THIS situation — verification-strategy fit AND tool/MCP/plugin adoption, optimized across quality·result·time·tokens, never below the standard"
metadata:
  node_type: memory
  type: feedback
---

# Right Instrument for the Situation (owner directive, binding on the whole team)

**The owner's standing mandate:** always work with the RIGHT strategy for the concrete situation —
the one that best serves **result · quality · time · token-economy TOGETHER**. And when a good
tool / MCP / plugin / library would win in a given situation on those same axes, USE it. This is not
a licence to cut quality for speed — quality is the floor; economy is chosen *above* it, from
logistics and instrument-fit, never by lowering the bar.

## A. Verification-strategy fit — choose the KIND and AMOUNT of proof per situation

Verification is a toolkit, not a ritual. Pick the proof that actually settles THIS claim at the
least cost — no more ceremony than the risk demands, no less than the risk requires.

- **Match the instrument to the claim's shape:**
  - live UX / real-wire data / brand-new visual → a real-browser / real-stack probe (look with your eyes).
  - logic / invariant / contract → a fitness function exercising the REAL mechanism (evidence, not a proxy — reason FROM it, trust it, predict the live result).
  - a pure transform / calc → a unit test or a reasoned node-replica.
  - data correctness → a parity check against a known-good reference.
  - a trivial mechanical change already covered by a biting gate → the gate; don't re-screenshot.
- **Proportion to risk × decision-density (the DoD toolkit):** trivial → a quick self-check; substantive
  behaviour → live-verify + canon-check; concept / one-way-door / cross-layer → independent re-verify +
  a second mind. Over-rigor wastes time/tokens; under-rigor lets a false-green reach the owner. Judging
  which is the tactician's core skill.
- **Sometimes the right test is NO test — just LOOK** (a wrong or worthless test is a false-green, worse
  than none). Sometimes the right test is to SKIP the live check because a biting gate already proves it
  (anti-ritual). The hard floor never moves: *no unverified canon/concept violation and no false-green
  ever reaches the owner* — HOW you guarantee it is dynamic.
- Ground truth over proxies still governs (`feedback_verification_doctrine.md`) — this section says
  *which* ground-truth instrument to reach for; that file says *never trust a proxy for it*.

## B. Tool / MCP / plugin / library adoption — bring the best available instrument

The team is not confined to its default tools. If a tool would deliver better quality, a better
result, real time saving, or real token saving in a situation — reach for it, deliberately.

- **When to adopt:** a capability the default toolset does poorly or expensively that a proven
  tool/MCP/plugin/CLI/library does well (e.g. a purpose-built search/index server over hand-grepping a
  huge tree; a browser-automation MCP over a hand-rolled probe; a schema/diff/AST tool over manual
  reading; a data/DB inspector over ad-hoc queries). Judge it on the same four axes:
  **quality · result · time · tokens** — and pick it when it wins the combination.
- **How to decide (the lead's call, dynamic):** is the win real and repeatable, or a one-off that costs
  more to wire than it saves? Prefer a tool that GROWS capability (a reusable seam) over a point-gadget.
  A tool that saves tokens but risks correctness is rejected — economy never buys a quality risk.
- **The governance boundary (never traded):** an adopted tool obeys every law — the dependency arrow,
  Class-M discipline, security/secrets (no credential leaks, no untrusted code-exec), reproducibility
  (a result must be re-derivable, not locked inside an opaque tool), and work-protection. A tool is an
  instrument under the canon, never an exception to it. Config stays data (Law 2); no tool smuggles
  logic into config or a privileged literal into a generic layer.
- **Surface it, don't hoard it:** when an agent finds a tool/MCP that genuinely helps a class of work,
  it goes in the return packet / growth note → the lead evaluates → if it wins repeatedly, it climbs the
  growth ladder (memory → kit rule → wired into the standard flow) so the WHOLE team gains it, once.
- **The lead is the primary chooser:** matching instrument to situation is a logistics duty (D1). The
  lead proposes the tool to the owner when adoption is a one-way door, a spend, or a new external
  dependency; reversible in-session tool use is the lead's to decide.

## The one line that binds both

*Pick the instrument — verification method or tool — that maximizes result × quality × time × tokens
FOR THIS SITUATION, with quality as the floor the economy is chosen above, and every instrument under
the canon.*
