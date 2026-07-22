---
name: brief-token-logistics
description: "Token economy is LOGISTICS, never quality-cuts: real context packets (no fat-file dumps), reuse every output, fold ALL scope into the initial brief, code-verified intel. Merges: token-logistics + cut-real-context-packets + briefing-economy-and-fresh-intel + no-sendmessage-fold-scope."
metadata:
  type: feedback
---
Owner directive (2026-07-13): "ლოგისტიკურად ხარჯე დრო და ტოკენები… არცერთი ცენტი ტოკენი ტყუილად არ დაიხარჯოს." Economy comes ONLY from logistics; quality is never traded down.

**The four disciplines (each anchored in a real incident):**

1. **Real CONTEXT PACKETS, never pointer-dumps (strategy/12).** Every brief carries: verbatim path-precise FACTS (the actual seam code/signatures, pre-verified) · DECISIONS-already-taken (do-not-re-litigate) · PRIOR FINDINGS from other agents' return-packets · COLLISIONS + freshness stamp (branch · wave · parallel) · POINTERS as verify-only. A >3k-token doc is NEVER assigned as "read X" — extract the needed section. *Incident 2026-07-19:* my ADR-049 brief said "READ the whole ADR first" → the agent burned ~5-10k on archaeology the lead should have distilled once. *Incident 2026-07-08:* a brief said "read ARCHITECTURE-REGISTRY.md" (12.6k tokens) when the agent needed one ~800-token AR entry — input compounds: loaded context is re-sent every turn. Refinement I own: pre-chew ≠ paste everything into the LEAD (my context is long-lived/expensive) — ground ONCE via the cheapest sufficient mind (surgical greps or one scout), then packet.

2. **Intel must be CODE-verified, not doc-derived.** The AR-48 brief claimed "export is a STUB" from the benchmark; the architect found it ~80% built — the agent's budget went to disproving our own stale note. Benchmark/registry "We-today" cells are claims with an expiry; re-ground the relevant cell against code before briefing on it. A benchmark that mis-scores a built capability sends expensive minds at phantom work.

3. **Fold ALL scope into the INITIAL brief.** A 2nd `Agent()` call is a FRESH agent (no prior context, collision risk). *Incident 2026-07-12:* a mid-flight "addendum" spawn launched a SECOND architect converging on the SAME ADR files — hand-reconciled duplication. Harness truth (2026-07-17, re-verify per session — the harness moves): the agent→lead channel exists, but the lead could not SendMessage into a running agent; brief decision RULES up front ("if blocked, ship the best stable route and SURFACE the residual"). 2026-07-22: SendMessage to a COMPLETED agent's ID resumes it with context — usable for follow-ups, still not for mid-run top-ups.

4. **Reuse outputs — never re-study what's designed.** If an ADR/SPEC/audit answers it, BUILD from it (the platform-architect has twice rightly REFUSED duplicate SPEC commissions). One agent per coherent slice, not per symptom; no concurrent agents on the same files; prefer additive/reversible + byte-identical refactors so no built work is discarded on a redirect.

**The test before every Agent() call:** "is this the cheapest route that produces USED value, and is any of it redundant with work already done?" Standing structural fix (queued): split the 50KB ARCHITECTURE-REGISTRY god-file into index + per-AR details; until then grep the one entry, never read the whole.

Related: [[agent-management-discipline]], [[token-burn-audit]], [[harness-overhaul]], [[global-loose-coupling]].
