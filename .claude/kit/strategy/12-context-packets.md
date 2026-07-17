# 12 — Context Packets: the lead grounds ONCE, agents think, tokens serve quality

> **The problem this kills:** every spawned agent re-reads the world (registries, ADRs, specs, trees) —
> 50–90k tokens burned on archaeology before the first thought, briefs lag reality, and the same
> ground is re-earned N times per day. **The lead is the logistician: knowledge moves through
> packets, not through re-reading.** Quality is never traded for cost — a distilled packet IS
> higher quality (sharper context reasons better; lost-in-the-middle dilution reasons worse).

## The law (binding on the lead and every agent)

1. **The lead grounds once.** The lead (or ONE designated scout) reads the broad sources; every
   subsequent agent receives a **CONTEXT PACKET** — distilled, verbatim-where-it-matters, path-precise.
   An agent doing broad archaeology that the lead already did is a LEAD defect (mis-logistics),
   and the agent must say so in its Brief-quality report.
2. **No wholesale assignment of heavy documents.** A source over ~3k tokens (registries, big ADRs,
   long specs, boards) is NEVER assigned as "read X" — the lead extracts the needed sections into
   the packet with a pointer for the rare deep-dive. Pointing is for verification, not for grounding.
3. **The packet is intel, not a fence** (mission command unchanged): the agent builds ON the packet,
   verifies only what it distrusts (and says why), and roams beyond it wherever its OWN reasoning
   leads — discovery driven by thought is the job; discovery driven by an empty brief is waste.
4. **Every agent ends with a RETURN PACKET.** New ground truth flows back distilled, so the lead can
   relay it to the next agent without anyone re-reading. Knowledge compounds at the lead.
5. **Freshness stamps kill brief-lag.** Every brief carries the moment's truth: branch · wave/stage
   in flight · parallel agents + collision map · "what changed since the last brief on this topic."
   A brief without stamps is stale by construction.

## CONTEXT PACKET — the shape (the lead writes this into every brief)

```
## Context packet [stamped: <date> · branch <x> · wave <y> · parallel: <who/what or none>]
FACTS (verbatim, path-precise — pre-verified, build on them):
- <file:line or file§section> — <the fact, quoted or tightly distilled>
- ...
DECISIONS already taken (do not re-litigate): <ADR/owner/lead calls that bind this task>
PRIOR FINDINGS relayed from <agent/report>: <the distilled return-packet lines that matter here>
COLLISIONS: <files/areas another agent is editing right now — work-protection fence>
POINTERS (verify-only, not grounding): <the 1–3 heavy docs, with the section that matters>
```

**Sizing discipline:** the packet carries what THIS task needs — nothing more, nothing less.
Too thin → the agent re-derives (lead defect). Too fat → dilution (lead defect). The test:
*could the agent start thinking about the PROBLEM within its first two turns?*

## RETURN PACKET — the shape (every agent appends to its final report)

```
## Return packet (for the lead's ledger — distilled, relay-ready)
NEW FACTS: <file:line — fact> ...
STATE CHANGED: <what is now true that wasn't (built/fixed/moved/deleted)>
SURFACED (observation duty): <flaws/smells/dead-code beyond the brief — for triage>
UNVERIFIED ASSUMPTIONS I took: <list or "none">
```

## The lead's logistics duties (the packet pipeline)

- **Maintain the ground:** the lead keeps its own distillate current (memory + ledger) so packets
  are cheap to cut. Ground-once is a rolling state, not a one-time event.
- **Relay, don't re-earn:** return-packet lines from agent A appear in agent B's packet the same day —
  the test of a working pipeline is that NO agent ever re-reads what another agent just established.
- **Scout pattern:** when the lead itself lacks ground and the area is heavy, send ONE cheap scout
  (explorer/haiku-tier) to produce the distillate; then brief the expensive minds on the packet.
  Never send N expensive minds to ground in parallel on the same terrain.
- **Model × packet combination thinking:** decision-density picks the MIND; packet quality picks the
  COST. A strong mind on a sharp packet is the maximum-quality/minimum-cost point. A strong mind on
  an empty brief is the most expensive way to read files. A cheap mind on a judgment task is the
  most expensive way to be wrong. Quality is never traded down — economy comes ONLY from logistics.

## Independent thinking is preserved (the balance, explicit)

The packet removes the SEARCH tax, not the THINKING space. The agent still: interrogates the
packet's premises (wrong-premise → Blocker), forms its own design, roams beyond named files when
reasoning demands, and reports what the lead didn't ask. If following the packet ever conflicts
with what the agent's own reasoning finds true — reasoning wins, flagged loudly.
