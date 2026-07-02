---
name: verify-the-purpose-not-the-proxy
description: "Done" = the LIVE experience works as the user would actually use it — never a proxy (tests/golden/agent-green). See the essence (what it's FOR) + the behavior/interaction, not just the immediate values.
metadata:
  type: feedback
---

**Never declare "done" on a proxy. Verify the real end-state — the LIVE experience, exercised the way the user actually uses it.**

**Why:** the owner was forced, repeatedly, to catch things the lead should have foreseen — and named the root cause exactly (2026-07-02): the lead kept verifying MEASURABLE PROXIES (parity Δ0.000, 2250 green tests, a sub-agent's "all ✓" Playwright report) instead of the REAL PURPOSE. Concretely, the data-parity harness used an in-memory `ExternalStore` (client-side comma-split) → it MASKED a live `ApiStore` wire bug (`buildObsFilterParam` didn't split `geo:"R2,R3"` → 0 rows), so "parity green" but the live site was broken when the user selected regions. The lead optimized the measurable, not the meaningful, and declared success without asking what the thing is FOR.

**The essence that was missed:** the product's purpose is not "each value is correct" — it is the **live, logical, linked experience** (cross-filter: select regions/sector → every chart/table/KPI responds logically). "Data as it was" meant the BEHAVIOR, not just the numbers. A senior sees the PURPOSE first, then verifies against it.

**How to apply (every task, before saying done):**
- Ask: **"What is this FOR? What would the user actually DO with it? Have I verified THAT — live, end-to-end, the real path?"** Not "are the tests green."
- Verify against the **real end-state**: the live deploy, the actual store/wire path the user hits (not an in-memory/jsdom proxy), the actual gesture (click, select, filter) — see [[verify-render-with-real-browser]], [[visual-parity-verification]].
- If a test/harness uses a DIFFERENT mechanism than production (e.g. ExternalStore vs live ApiStore), it can MASK real bugs — test the production path, or the deterministic test is not sufficient proof.
- See the **behavior and the future**, not just the current value: interactivity, linkage, what happens on the next click. Foresee it ([[proactive-innovation-mandate]], [[converge-maximal-target-first]]).
- "Done" = the live thing works as the owner would use it. Until then it is not done, no matter how green the proxy.
