---
name: self-execute-when-known
description: Don't reflex-spawn an agent — when the work is small, isolated, and I ALREADY know the exact change, DO it myself (Edit/Write). Agents are for genuine judgment or scale, not for what I fully understand.
metadata:
  type: feedback
---
Assess the situation like a top logistician/strategist BEFORE routing: if I already know exactly what to change and it's small + isolated, executing it myself is cheaper in TIME and TOKENS than briefing an agent. Reserve agents for real judgment-density, scale, or work I don't fully hold.

**Why:** 2026-07-12 — owner correction: "why launch a new agent if you already know everything and doing the specific thing yourself is simple and token/time-profitable? Work strategically, assess the situation." Concretely: after the debugger handed me the EXACT loop-fix seam (`StudioShell.tsx:86-90`, remove `activePageId` from one effect's guard+deps), reflex-spawning a frontend agent would have been pure waste — I owned the whole change.

**How to apply:** the reflex is still "who?" — but the honest answer is sometimes ME. Decision test: (1) do I know the exact edit already? (2) is it small + isolated (few files, no deep design)? (3) no genuine judgment left to delegate? → then DO it myself (I have Edit/Write/Bash + green-gate discipline). Still route when: real design/judgment, multi-file/multi-package scale, unfamiliar territory, or parallel throughput genuinely helps. This SHARPENS [[agent-management-discipline]] ("often cheapest = me") and pairs with [[lead-decides-never-asks-tactics]]. Watch the over-delegation reflex: creating a card for a fix ≠ spawning an agent to apply it.
