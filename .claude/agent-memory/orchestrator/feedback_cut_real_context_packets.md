---
name: cut-real-context-packets
description: Every agent brief must carry a real distilled CONTEXT PACKET (strategy/12) — never assign a whole ADR/heavy-doc as "read X"; ground once via the cheapest sufficient mind, protect the lead's long-lived context
metadata:
  type: feedback
---
Every spawned agent must receive a real **CONTEXT PACKET** (strategy/12), not a pointer-dump. **Why:** owner 2026-07-19 reminded me this pre-chew principle is standing and asked if I still honor it — I audited my P1 (ADR-049) brief and found I'd assigned the whole ADR as "READ FIRST" (the exact "read X" the doctrine forbids for >3k-token docs), skipped verbatim FACTS, and skipped the freshness stamp; the agent then burns ~5–10k on archaeology the lead should have distilled once.

**How to apply (packet shape, cut into EVERY brief):**
- FACTS verbatim + path-precise (the actual current code of the seams, signatures) — pre-verified, build-on-them; NOT "go read the file."
- DECISIONS already taken (ADR/owner) — do-not-re-litigate.
- PRIOR FINDINGS relayed from other agents' return-packets.
- COLLISIONS (what another agent edits now) + FRESHNESS STAMP (branch · wave · parallel).
- POINTERS = verify-only (the 1–3 heavy docs + the exact section), never grounding.
- Heavy doc (>3k tokens, e.g. an ADR) → EXTRACT the needed section into the packet; leave the doc as a verify-only pointer.

**The refinement I own (not blind compliance):** pre-chew ≠ paste everything into the LEAD. The lead's context is long-lived/expensive; grounding it wholesale is worse than a disposable agent re-reading. Best result = ground ONCE via the cheapest sufficient mind (surgical lead greps OR one haiku/explorer SCOUT), hand a DISTILLED packet, and run the return-packet→lead-ledger→next-packet pipeline so no agent ever re-reads what another just established. Economy comes ONLY from logistics; quality is never traded down. Can't top-up an in-flight agent (no continue tool — [[no-sendmessage-fold-scope]]) → the packet must be right at spawn. Related: [[token-logistics]], [[agent-management-discipline]], [[harness-overhaul]].
