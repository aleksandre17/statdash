---
name: feedback-opus-brief-style
description: Two Opus brief failure modes and their structural barriers — prescriptive language (verb allowlist) and confidence-laundering (Decision Inventory + A.5 check). the canonical case study (04-A) as binding reference.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4dfa07b2-d254-4108-9fe8-4bcfaddeac3c
---

Two failure modes. Two different structural barriers.

---

## Failure mode 1 — Prescriptive language

**What it looks like:** Brief says "remove line 46, replace loop on line 88" — implementation steps are in the problem statement.

**Structural barrier:** A.2 verb allowlist.
- Allowed: `is` · `has` · `lacks` · `violates` · `duplicates` · `depends-on`
- Banned: `remove` · `delete` · `extract` · `rename` · `move` · `add` · `replace` · `change` · `update` · `fix` · `refactor` · `migrate`

Banned verb in sentence = you wrote a solution, not a problem. Visible as typed.

---

## Failure mode 2 — Confidence-laundering

**What it looks like:** Brief language is clean (passes verb test), but Sonnet has already crystallized every decision. Opus is being asked to *confirm execution*, not to *decide design*.

**Why the verb allowlist misses it:** "<Entity>.<field> duplicates state now owned by the data store" passes A.2. But if Sonnet already knows the solution (remove the field, rewire the loop), no genuine design room remains.

**Structural barriers:**
- **A.4 Decision Inventory:** before sending Opus `--b`, name every unmade decision. If the list contains only execution mechanics (which file, which API, which line) — Decision Inventory is empty → re-triage to Sonnet build + optional Opus review.
- **A.5 Confidence-check:** "Am I sending this because Opus's judgment is needed, or because I want a safety net for my own execution?" Safety net = Sonnet builds + Opus review (~3-5k), not Opus `--b` (~15k).

---

## The canonical case study (binding reference)

> Full narrative (what happened · right vs wrong routing · ~11k tokens saved) → `.claude/strategy/04-A-examples.md §A.5` (one-body). The insight unique to *this* file:

**Why the old A.4 self-test missed it:** "Could a Senior Architect find a different solution?" answers YES too easily in principle. The Decision Inventory replaced it because it forces naming *specific* unmade decisions — theirs were all execution mechanics ("which file, how to call the data store, where the threshold lives") → re-triage. This is *why* the barrier is a Decision Inventory, not a yes/no self-test.

---

## Token Hygiene (binding — no quality cost)

These rules save ~13% of session tokens without touching routing, judgment, or Opus's mandate.

- **opus-brief.md §Current State ≤ 80 lines, last 3 layer blocks max.** Older layers → `docs/layers/LAYER-X.Y.md` citation only. Rotation is mandatory before writing a new block when count > 3.
- **Opus reads `.claude/kit/B.md` instead of full strategy/03 + strategy/04 per brief.** Full files only on doctrine question (blocker protocol doubt, tier ambiguity, output format question).
- **token-log.md rotates at 40 lines OR every 5 layers.** Archive to `token-log.archive-YYYY-MM-DD.md`. Keep last 5 lines.
- **§Current State is a delta-append (≤6 lines per layer), not a full rewrite.** Sonnet appends one block, archives oldest if count > 3.
- **context.md "Active layer" header is updated atomically at every layer start**, not just at session close.
- **Token Log Append subsumes Changed Files.** No separate `## Changed Files` block. Paths go in the token-log line with `(new)`, `:line`, `(deleted)` suffixes.
- **04-A-examples.md loaded only on first brief of a sprint.** Case studies + the canonical reference do NOT ship in every brief.

**Why:** harness total_tokens show ~62% of session spend is overhead re-reads. These rules eliminate ~241k tokens (~13%) per session of 12 layers at zero quality cost.

---

## Trend tracking

Review Opus `Brief type received` field across runs:
- 3 consecutive `Steps-disguised-as-problem` → Pre-Brief Gate is being skipped. Escalate to user.
- `Where I exercised judgment` empty on a `--b` run → Decision Inventory was rubber-stamped. Log here.
- `Where I exercised judgment` rich on review mode → review mode is working as designed.

---

## Asymmetric-cost reminder

- Routing Haiku/Sonnet task to Opus → ~15k tokens wasted, no findings (none existed)
- Routing Opus task to Sonnet → smell may slip → tech debt months later

**Default for ambiguous decision-density:** Sonnet build + Opus review. Never "Opus `--b` just to be safe."

**Related:** [[feedback-opus-work-protection]] — Opus's judgment is why we protect its code silently.
