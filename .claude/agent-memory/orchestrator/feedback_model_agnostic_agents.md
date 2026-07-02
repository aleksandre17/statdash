---
name: model-agnostic-agents
description: Agents are model-agnostic — the lead picks the model per-call (sonnet=mechanical/cheap, opus=judgment/design/QC); same quality/standards regardless of model. SUPERSEDES the old opus-only rule.
metadata:
  type: feedback
---

**Agents carry the same role / quality / standards regardless of which model runs them. The lead chooses the model PER-CALL, dynamically, by task type.**

**Why:** the owner relaxed the prior "all agents on Opus" rule for economy (2026-07-02): running everything on Opus is expensive; a well-scoped mechanical/crystallized task does not need Opus. They directed: make agents model-agnostic — "whichever model you want it to go on, it goes on that; functionally the same qualities are assigned." The hard `model: opus` frontmatter pins were removed from all agent defs (kit + rendered) so the per-call `Agent(model:…)` override actually takes effect.

**How to apply:**
- **Sonnet (cheaper)** for mechanical, well-specified, low-judgment work (bulk edits, config sweeps, extraction, token/contrast audits, straightforward fixes).
- **Opus** for judgment/design/architecture/root-cause/QC (architect, chief-engineer no-regression gate, debugger, ambiguous or cross-cutting work).
- The agent's DoD/standards live in its definition body and bind on ANY model — a sonnet run is held to the same bar; if it hits a genuine judgment call it must FLAG for escalation to opus, not guess.
- This SUPERSEDES the old [[feedback-opus-only]] "never sonnet" rule. Default to economy; spend opus where judgment/quality genuinely needs it (toolkit, not ritual — [[lead-methodology-mastery]]).
