---
name: no-sendmessage-fold-scope
description: Fold ALL scope into the INITIAL brief; a 2nd Agent() call is a FRESH agent. (2026-07-17 harness UPDATE — SendMessage continuation may exist again; VERIFY per session before relying on it.)
metadata:
  type: feedback
---
Fold EVERY requirement into the initial brief — never phrase a fresh `Agent()` spawn as an "addendum" to in-flight work; a new call is a FRESH agent (no prior context, file-collision risk).

**Why:** 2026-07-12 — a mid-flight "addendum" Agent() call launched a SECOND fresh architect converging on the SAME ADR/plan files → collision/duplication reconciled by hand.

**Harness update 2026-07-17:** the Agent tool result now documents `SendMessage with the agent's ID/name to continue a previously spawned agent with its context intact` — the capability appears RESTORED. Verify it exists in the current session's toolset before planning around it; when real, prefer it for follow-ups on a finished agent (context reuse beats a fresh spawn's 16–24k fixed cost + re-grounding — see [[token-burn-audit]]).

**How to apply:** (1) Initial brief carries all scope regardless (a continuation is a fallback, not a design). (2) Mid-flight scope extension: do it myself, or wait for completion, then SendMessage (if available) or ONE continuation agent referencing prior output. (3) Two agents on the same files → the lead reconciles. Relates to [[agent-management-discipline]].
