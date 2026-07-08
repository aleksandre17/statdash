---
name: model-launch-ledger
description: Owner watches model-per-call closely; requested model is unverifiable post-hoc (no model field in transcripts/token-log) — keep a launch ledger + close the observability gap
metadata:
  type: feedback
---

**Owner flagged (2026-07-08):** he observed what looked like sonnet-designated sub-agents running on Opus ("or it doesn't obey you"). Empirical check found **no instrument to verify**: subagent transcripts contain no model field, token-log records only session rollups. The lead's `model:` argument is a *request* whose honoring cannot currently be proven from our side.

**Why:** model routing is an economy AND trust commitment to the owner — an unverifiable commitment reads as disobedience when his console shows Opus traffic (which also legitimately exists: apex def-pins + deliberate opus calls).

**How to apply:**
1. **Launch ledger — every `Agent()` call:** append one line to `.claude/session/token-log.md` at launch: `[date] LAUNCH agent=<type> model-requested=<m> task=<5 words>`. The audit trail of requests must always exist even if actuals are invisible.
2. When announcing routing to the owner, distinguish **requested vs verified** model — never claim "runs on sonnet" as fact.
3. The owner's console is the only current ground truth for actual model — ask him when it matters.
4. Standing gap to close if the platform ever exposes it: per-run actual-model surfacing.
5. **Verified empirically 2026-07-08:** a probe sub-agent launched with `model: sonnet` self-reported `MODEL: claude-sonnet-5` — the per-call override IS honored by the harness. The probe pattern (tiny agent, "report your model line, no tools", ~17K tokens) is the cheap ground-truth instrument; re-run it whenever obedience is doubted. What looked like disobedience was the day's legitimate opus-by-design traffic (apex pins + deliberate judgment-tier calls).
