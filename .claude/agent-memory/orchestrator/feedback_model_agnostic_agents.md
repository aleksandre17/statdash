---
name: model-agnostic-agents
description: Agents are model-agnostic; lead sets model per-call. DEFAULT to OPUS for substantive work (owner override 2026-07-04); sonnet/haiku ONLY for genuinely trivial mechanical, and when unsure → opus.
metadata:
  type: feedback
---

**★ OWNER OVERRIDE 2026-07-04 — DEFAULT to OPUS for all substantive agent work.** The owner directed "run all on opus" after I under-tiered two REAL engineering tasks (an ApexCharts race-condition fix + an ingest idempotency fix) to sonnet. Their standard: a race-condition / idempotency / any real engineering or judgment task is NOT sonnet-tier — it gets opus. **Reserve sonnet/haiku ONLY for genuinely trivial, mechanical, low-judgment work (bulk find-replace, config sweeps, pure extraction); when in doubt, opus.** This does NOT revive the "literally everything opus incl. trivial" rule — it raises the bar for what counts as "mechanical." Bias strongly toward opus; economy is secondary to quality for this owner. (I relaunched the two mis-tiered agents on opus, superseding the sonnet runs.)

**Model routing itself WORKS:** the lead passes an explicit `model` on every `Agent()` call, so "sonnet" genuinely launches sonnet and "opus" launches opus — the old inherited-session-model bug (mechanical tasks silently running opus, or vice-versa) is fixed by always passing model explicitly. The failure mode the owner reacted to was my TIERING judgment (calling real work "sonnet-tier"), not the routing.

**Agents carry the same role / quality / standards regardless of which model runs them. The lead chooses the model PER-CALL, dynamically, by task type.**

**Why:** the owner relaxed the prior "all agents on Opus" rule for economy (2026-07-02): running everything on Opus is expensive; a well-scoped mechanical/crystallized task does not need Opus. They directed: make agents model-agnostic — "whichever model you want it to go on, it goes on that; functionally the same qualities are assigned."

**★ DEF STRUCTURE — apex-only pins (owner 2026-07-08).** Agent defs stay **model-agnostic (no pin)** EXCEPT the two invariant-tier extremes: the **apex design/QC agents** (`chief-engineer`, `architect`, `platform-architect`) pin `model: opus` as a quality FLOOR (their work is never "middle-tier"), and `junior-executor` pins `haiku` (the fixed cheap tier). **Everything in between carries NO pin** — the orchestrator routes it per-call by decision-density and **must never mis-route** (that reliability, not a def-pin, is the safeguard for middle tiers). Floors are overridable per call. (Reverted an over-broad F6 that had pinned debugger/database-architect/explorer — those are middle-tier, orchestrator's call.)

**How to apply:**
- **Sonnet (cheaper)** for mechanical, well-specified, low-judgment work (bulk edits, config sweeps, extraction, token/contrast audits, straightforward fixes).
- **Opus** for judgment/design/architecture/root-cause/QC (architect, chief-engineer no-regression gate, debugger, ambiguous or cross-cutting work).
- The agent's DoD/standards live in its definition body and bind on ANY model — a sonnet run is held to the same bar; if it hits a genuine judgment call it must FLAG for escalation to opus, not guess.
- This SUPERSEDES the old [[feedback-opus-only]] "never sonnet" rule. Default to economy; spend opus where judgment/quality genuinely needs it (toolkit, not ritual — [[lead-methodology-mastery]]).
