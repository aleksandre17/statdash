# /collab — task force (multi-senior collaboration on one problem)

> Invoke: "collab" · "war room" · "task force on X" · "let's solve this together". For problems that need **several lenses at once** (e.g. data + code + user judgment). Doctrine: `01` (mediation) · `09` (conflict/risk) · `11` (board).

## Seats at the table
- **The user** — the decision-maker. Every round ends at you; your words travel verbatim (`01` B).
- **The lead** — the table itself: assembles, relays, synthesizes, never silently picks.
- **2–4 agents chosen by lens**, named with the reason (e.g. database-architect = data/consistency lens · senior-backend-developer = code/runtime lens · chief-engineer = system-coherence lens when the blast radius is wide).

## The protocol
0. **Card first** (`11` rule 1) + Intake Echo. The card is the problem's identity; `links` will carry everything produced.
1. **Shared workspace** — one scratch file: `<session_dir>/collab-<card-id>.md`. Every participant **appends, never overwrites** (`05`): findings, evidence (file:line), hypotheses, proposals.
2. **Round structure** (repeat until decided):
   - **Analyze** — agents work the same problem through their lenses; parallel only if reads are independent (`09` §A), else serialized so each sees the prior findings.
   - **Synthesize** — the lead relays each agent's position **verbatim-faithful**, then marks: *agreements* · *conflicts* · *open questions*. Conflicts are presented, never resolved silently (`09` §A finding-conflict).
   - **Decide** — the user picks the direction (or asks another round). The lead records the decision in the scratch.
3. **Split & execute** — the decision becomes cards/sub-tasks per domain owner (schema → database-architect with migration discipline · code → the right senior/middle), normal gates apply (Class-M, `09` §B).
4. **Close** — decision → **ADR** (≥2 rejected alternatives) · scratch distilled into opus-brief §Current State · learning note if a concept was involved (`07`) · card → done with links. The scratch file is then disposable history, not a second truth.

## Rules that make it work
- **Seats are dynamic.** Any round may add or drop a lens — the user can request anyone ("bring in the chief"), the lead can propose ("this turned out to be a schema question — adding database-architect"), and an agent whose lens is exhausted is released (its findings stay in the scratch). A newcomer reads the scratch first and is fully current — the table's memory is the file, not the attendees.
- One scratch, one spine (brief) — no parallel truths.
- An agent who disagrees says so **in the scratch**, with evidence — disagreement is data, not friction.
- The user can inject input at any round; it enters verbatim, marked as the user's.
- If rounds exceed ~3 without convergence: stop, reframe the premise (`brief_is_hypothesis`), or escalate scope to `/architecture`.
