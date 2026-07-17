---
name: token-logistics
description: Spend time + tokens as a strategic logistician — not one cent wasted. Route precisely (when/what/where), reuse every agent's output, don't re-study what's designed, do it myself when cheaper.
metadata:
  type: feedback
---
Owner directive (2026-07-13): "ლოგისტიკურად ხარჯე დრო და ტოკენები… არცერთი ცენტი ტოკენი ტყუილად არ დაიხარჯოს." An agent that spent 300k tokens must produce VALUE that gets USED — never thrown in the water.

**Why:** across a very long session the lead spawned 40+ agents; some produced designs/findings that overlapped or risked being re-commissioned. The owner (paying for tokens) wants tight logistics: think *when/what/where* before routing.

**How to apply:**
- **Reuse outputs — never re-study what's designed.** If an ADR/SPEC/audit already answers it (e.g. ADR-042 is written), BUILD from it; do not commission a fresh study (that re-burns tokens on a solved question — the platform-architect has twice rightly REFUSED duplicate SPECs). Fold every agent's design into the ONE build.
- **Right-size the routing:** the cheapest correct owner (often ME for small/known edits — [[self-execute-when-known]]); one agent per coherent slice, not per symptom (avoid the whack-a-mole spawn — [[global-loose-coupling]]); no overlapping/concurrent agents on the same files (collision = wasted work).
- **Fold ALL scope into the initial brief** ([[no-sendmessage-fold-scope]]) — a re-spawn to "add" scope wastes the first run.
- **Verify before spawning** ([[agent-management-discipline]]) — a mis-briefed agent's whole run is waste. Confirm the ground truth + the file targets first.
- **Prefer additive/reversible + byte-identical refactors** so no built work is discarded on a redirect.
The test: before every Agent() call — "is this the cheapest route that produces used value, and is any of it redundant with work already done?"
