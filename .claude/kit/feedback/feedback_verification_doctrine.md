---
name: verification-doctrine
description: "Ground truth over proxies: how anything gets verified — purpose not proxy, measure the reported axis, real-browser/real-stack, empirical board"
metadata: 
  node_type: memory
  type: feedback
---

# How This Team Verifies: Ground Truth Over Proxies

"Done" is proven against the real end-state and the real mechanism — never against a measurement that merely correlates with it.

> **Companion — which instrument to reach for:** `feedback_instrument_selection.md` (verification-strategy fit + tool/MCP/plugin adoption, optimized across quality·result·time·tokens). This file says *never trust a proxy for the ground truth*; that file says *pick the right ground-truth instrument for the situation*.

## Verify the purpose, not the proxy

**Rule:** Never declare "done" on a proxy (green tests, parity Δ0.000, an agent's "✓" report). Verify the REAL end-state — the live experience, exercised the way the user actually uses it.

**Why:** a lead kept verifying measurable proxies instead of the real purpose. A data-parity harness used an in-memory store (client-side comma-split) that masked a live wire-store bug (`geo:"R2,R3"` failed to split → 0 rows). "Parity green" but the live site broke the moment a user selected regions. The purpose isn't "each value is correct," it's the live, logical, linked experience — behavior, not just numbers.

**How to apply, before saying done:** ask "what is this FOR, what would the user actually DO with it, have I verified THAT live, end-to-end?" — not "are the tests green." Verify against the actual store/wire path the user hits (not an in-memory/jsdom proxy) and the actual gesture. A harness using a DIFFERENT mechanism than production can mask real bugs — test the production path. See behavior and linkage, not just the current value.

## Measure the reported axis, not your assumption of it

**Rule:** When a user insists a visual defect persists but your measurement says "fine," you are almost certainly measuring the wrong quantity. Broaden it — the OTHER axis, actual rendered pixels, and the exact word the user used — instead of re-running the same check.

**Why (incident, ~5 wasted deploys):** user reported a slide's "სიგრძე" (length/width) shrinking; the agent read it as HEIGHT and spent 4 deploys proving height was uniform (true, irrelevant) — the user meant WIDTH. `margin:0 auto` inside a flex column had shrink-wrapped it to content width instead of filling; `width:100%` fixed it. Only measuring rendered PNG width (not `getBoundingClientRect().height`) exposed it.

**How to apply:** user insists + your metric says fine ⇒ the metric is wrong, not the user — never repeat "it's uniform for me." Measure BOTH axes, prefer actual rendered pixels (`element.screenshot()` PNG dims) over `getBoundingClientRect`. Re-read the user's exact term in their language before deep-diving; when ambiguous, ask which axis they mean up front. Get the user's screenshot early rather than burning cycles on theories. Flex gotcha: `margin:0 auto` on a flex item shrink-wraps to content — use `width:100%` to force fill.

## Verify render with a real browser, peel one layer at a time

**Rule:** "Renders no data" is usually a STACK of independent root causes, not one. Diagnose empirically with a real headless browser against the LIVE deploy — never by theorizing from code alone.

**Why:** one "no data" report was SIX distinct layered bugs (empty config source → store-registration regression → async sync-render gap → year-default resolving to 0 → KPI warm gap → CSP image block), each invisible until the layer above it was fixed. Reading code alone produced a wrong root cause twice; a browser probe proved the real chain.

**How to apply:** run a real probe capturing every API request (status+body), console/page errors, and a DOM summary. Peel ONE layer per cycle: probe → read the exact error → fix that root → rebuild → re-probe (the error moving to the next layer is progress). Two recurring traps: (a) an async store rendered through a sync path throws cold — it must warm via an async query first, never hardcode sync; (b) a filter default depending on async-loaded data must source it at store-build time (awaited), never gate on a classifier that's never populated. An agent that REFUSES a prescribed fix because it would degrade something is right to escalate rather than force it.

## Visual parity: read the screenshot, don't trust the green metric

**Rule:** "Renders + 0 console errors + 0 empty API calls" is NOT proof of correctness. Visually READ screenshots and check actual VALUES and completeness, against a known-good reference when one exists.

**Why:** probes reported all-clear while the live page showed collapsed KPIs, empty axes, "No data" states, and a blank map — none of which is an error, so the probe passed. Only reading screenshots side by side with the old reference surfaced the real defects.

**How to apply:** (1) when an OLD version "worked," treat it as the spec — capture and read old+new screenshots side by side, every mode. (2) Encode value-correctness as fitness functions (a KPI resolves the actual pinned value, not `rows[0]`; excludes rollup totals) — not just "non-empty." (3) Iterate any fix→deploy→screenshot loop to visually-correct, not just green. (4) Independently read a couple of key screenshots yourself before accepting an agent's "verified" — agents and probes over-trust metrics.

## Verify status docs and boards empirically before trusting them

**Rule:** Before trusting a status claim in a handoff doc/board, verify it against actual code/build/test state — these docs go stale faster than they're updated.

**Why:** in one session a board misled three times: "build red" when the full suite was actually green (a parallel lane fixed it without updating the note); a seam marked 88% that was actually 100%, with the real gap in an untested adjacent layer; features marked "deferred" that were already built with live-DB tests.

**How to apply:** when a board line drives a decision, run the cheap empirical check first (build, typecheck, test, `git log`, grep for the artifact) — then correct the board in the same pass. Treat the board as a lead, not truth.

## In parallel runs, treat cross-agent flags as likely mid-edit transients

**Rule:** When one of several parallel agents reports an error in ANOTHER agent's file, treat it as a likely mid-edit transient, not a real defect.

**Why:** recurred repeatedly — an error flagged in a still-mid-edit file turned out clean at final typecheck; two independent agents once agreed on the same flag in a third agent's file that was still being edited, and the converged tree was clean (0 errors). A concurrent agent sees an unfinished snapshot; agreement between two agents can still just be a shared view of the same mid-edit file.

**How to apply:** don't reflexively dispatch a "fix" agent on a cross-agent flag. Let all parallel agents finish, run the full green-gate on the CONVERGED tree, and act only on what's actually red there. Never start the next wave's edits while a verification run is in flight.

## Anticipate and trust your own engineering — live-display is selective, not ritual

**Rule:** Reason with logic and trust real-mechanism engineering; predict outcomes from fitness gates already built instead of reflexively re-verifying by screenshot every time. "Always verify by screenshot" is a rigid ritual to drop — this sharpens WHEN the two sections above apply, it doesn't weaken them.

**Why:** a lead was caught framing every deploy as "then I read screenshots, only then done" — a ritual substituting for thinking, the same failure mode as over-delegating a task that could just be done directly.

**Key distinction:** a proxy using a DIFFERENT mechanism than production (an in-memory store vs the live wire store; jsdom vs a real chart engine) genuinely diverges — live-display verification IS still needed there (exactly the case the two sections above cover). A fitness test exercising the REAL mechanism (mounts hidden and asserts no NaN; measures the real DOM; asserts the exact rendered option tree) is evidence, not a proxy — reason FROM it, trust it, predict the live result.

**How to apply:** before deploying, write the reasoned prediction — what mechanism-level evidence already proves it, therefore what the live result will be. Reserve live-display for the residual that genuinely can't be proven otherwise (real-wire data correctness, a brand-new visual with no option-tree proof). Trust the gates you built.

## Pre-action grounding gate — ground before you act

**Rule:** The recurring root failure is acting BEFORE grounding in the reference, the live truth, the whole target, and already-built capabilities. Fix: a mandatory, VISIBLE pre-action gate run before any non-trivial build/fix, so the doctrine is EXECUTED, not passively recalled.

**Why:** despite holding this doctrine in memory, a lead kept working FORWARD from the immediate task instead of anchoring to ground truth first — declaring a defect "stale bundle" by theorizing instead of verifying live; placing a restored UI element solo when the reference showed it paired; about to hardcode a downstream case instead of using a capability just built. Holding doctrine passively is not the same as executing it as a pre-condition.

**The 5-point gate, run and shown FIRST:**
1. Ground in the reference + live truth — look at the actual visual reference and current state, never reason from code alone.
2. State the WHOLE correct target — all states/modes of the end-state, not just the immediate slice.
3. Use what's already built — adopt existing capabilities/registries fully; never hardcode a one-off where an existing mechanism fits.
4. Who + how — route judgment to the right agent; pick the method that fits the problem shape.
5. Verify against the reference, not a proxy — done = the live experience matches the reference, read with your own eyes.

## Validate on the real stack, not mocks

**Rule:** "Can't run locally" does not mean "can't be validated" — use real infrastructure (a real server/DB/Docker environment) for real validation rather than assuming the gap is unbridgeable.

**Why:** running a full stack for real (instead of assuming it couldn't be exercised) caught bugs mocks/unit tests never would have — generated-column-as-partition interactions, multi-event trigger bugs, a migration placeholder collision, cross-dimension seed issues, a real numeric-precision bug, and a false-green parity guard. A platform can be beautifully unit-tested and still have never actually *run* end-to-end.

**How to apply:** for infra/DB/Docker-shaped validation, isolate the work in its own network/container namespace so any existing running environment is untouched, build and run there, hit real health/bootstrap endpoints, and run the real verification suite through a tunnel if needed. Keep secrets (SSH keys, credentials, env files) gitignored/local-only — never commit them. Pairs with "Verify status docs and boards empirically" above.
