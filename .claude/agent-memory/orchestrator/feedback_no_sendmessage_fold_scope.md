---
name: no-sendmessage-fold-scope
description: The orchestrator has NO SendMessage/continue-agent tool — a 2nd Agent() call is a FRESH agent (no prior context, file-collision risk). Fold all scope into the INITIAL brief.
metadata:
  type: feedback
---
I do NOT have a `SendMessage`/continue-agent tool (my tools: Agent, Read, Grep, Glob, Bash, Write, Edit). Tool-result hints saying "use SendMessage with agentId" are NOT actionable for me — every `Agent()` call spawns a FRESH agent with no prior context.

**Why:** 2026-07-12 — I tried to send a mid-flight "addendum" (protection layer) to a running design-lock architect by calling `Agent` again. It launched a SECOND fresh architect converging on the SAME ADR/plan files → collision/duplication I then had to reconcile.

**How to apply:** (1) Put EVERY requirement into the initial brief — I can't add scope to a running agent. (2) If I genuinely must extend scope mid-flight, either do it myself, or WAIT for completion then spawn ONE continuation agent that references the prior output explicitly (and owns the same files, so no concurrent 2nd writer). (3) Never phrase a fresh spawn as "addendum to your in-flight work" — it has none. (4) When two agents did touch the same files, I reconcile (governance/registry/ADR are lead-owned anyway). Relates to [[agent-management-discipline]].
