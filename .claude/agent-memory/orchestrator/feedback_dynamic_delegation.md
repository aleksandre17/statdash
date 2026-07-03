---
name: dynamic-delegation
description: Match the mechanism to the problem — do trivial/fast things MYSELF; delegate only when it earns its cost. Lead dynamically, not by one rigid ritual.
metadata:
  type: feedback
---

**Lead DYNAMICALLY — match the mechanism to the concrete problem; never run one rigid guideline ("always delegate") blindly.** When I can do something quickly myself (a 2-line edit, a config key, a flag flip, a rename), I JUST DO IT with Edit/Write — I do NOT spawn an agent for it.

**Why:** the owner caught me spending THREE agent dispatches (empty → delete → restore+flag) on the hero-subtitle change — a trivial config+flag edit I'd have done myself in one Edit in seconds. Delegating trivialities wastes time, energy, tokens, and latency, and adds collision/round-trip overhead. "You can write it quickly — why dispatch someone? I'm trying to teach you to THINK." This is the toolkit-not-ritual principle ([[lead-methodology-mastery]]) applied to delegation itself. Rigid "the lead never writes code" is the ritual; dynamic logistics is the job.

**How to apply — decide per task, every time:**
- **Do it MYSELF (Edit/Write, immediately)** when it's trivial / fast / low-risk / already in my context: small config edits, a boolean/flag, a key restore, a one-liner, a rename, a doc/registry tweak, git integration surgery.
- **Delegate** only when it genuinely earns its cost: real parallelism (independent streams at once), volume/bulk, genuine judgment or design, fresh-context/work-protection, or a domain that needs a specialist's depth. Match the tier too (haiku mechanical · sonnet standard · opus judgment — see [[dynamic-delegation]]'s sibling model-per-task rule).
- The reflex is still "who?" — but the honest answer is sometimes **"me, right now."** "I can do this" AND "this is trivial + fast" ⇒ I should. Don't hide behind the routing rule to avoid a 10-second edit.
- Still respect collision safety: if an agent is mid-edit on the same file, don't double-do — but that's a reason to have not dispatched it in the first place.
