---
name: Opus work protection — never remove silently
description: Before removing or changing anything Opus built, consult Opus. Suspicion = question first.
type: feedback
originSessionId: 361aba64-8cfb-4b76-8c1b-f762a36722bf
---
If something Opus built looks wrong or suspicious — **stop and ask Opus**, never remove/change unilaterally.

**Why:** Opus sees the full picture when it builds something. What looks like a mistake to Sonnet may be intentional (future gate, forward constraint, deliberate design). Silent removal destroys that reasoning without a trace.

**How to apply:**
- Gate failures in Opus-built code → diagnose first, ask Opus before changing
- "This looks unnecessary" → verify with Opus before deleting
- Tests that fail against Opus code → check if the test is wrong, not the production code
- Exception: obvious compilation errors or typos — fix directly
