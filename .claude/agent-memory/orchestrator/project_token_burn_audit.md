---
name: token-burn-audit
description: Measured anatomy of agent token burn (2026-07-17 owner escalation) — spawn is cheap (16-24k), the burn is in-run (peaks 60-213k, 125-246 calls); fixes shipped
metadata:
  type: project
---

Owner escalation 2026-07-17: "an agent jumps to 70-90k immediately, averages 150-200k; the lead would spend half." Measured from real transcripts (`~/.claude/projects/<slug>/*/subagents/agent-*.jsonl`, `message.usage` records):

- **Spawn fixed cost = 16–24k input** (harness+tools ~12-15k, def ~1k, memory boilerplate ~2k, MEMORY.md ≤4k, CLAUDE.md ~1.2k, packet). NOT the problem.
- **The burn is IN-RUN:** peak-ctx 60k→213k; **turn-churn is the multiplier** — 125–246 API calls per run, each re-sends the whole context (cache discounts price, not context size).
- Heavy-file gulps: 57KB sfd memory map ≈15k tok; kit strategy/01 32KB ≈9k; DEEP audits. B.md context-economy rules existed but had NO measurement loop.

**Why:** the ledger recorded out-tokens only — input/context burn was INVISIBLE, so the packet doctrine (strategy/12) had no enforcement signal.

**Fixes shipped (2026-07-17):** `subagent-ledger.py` RUN lines now carry `calls= first-in= peak-ctx=` + `⚠ CTX-BURN` alarm >120k; in-flight transcripts excluded (60s settle window). `strategy/06-token-economy.md` §Measured burn anatomy: peak norm ~80k, routing threshold (lead keeps work ≲15 tool calls on held knowledge), turn budget (>60 calls without proportional deliverable = churn).

**How to apply:** every brief carries a token-discipline block (packet-grounded, batch reads, peak budget, exit-fast); after each run READ the RUN line — CTX-BURN → audit brief/packet/agent discipline and fix the source. Remaining debt: sfd memory dir 556KB/86 files + 57KB map needs distillation (deferred while its agent was in flight); engine-specialist 60 files curation due.
