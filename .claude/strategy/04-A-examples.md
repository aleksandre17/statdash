# 04-A — Section A Examples & Case Studies

> Load only on FIRST brief of a sprint, or when Section A discipline needs calibration.
> On subsequent briefs in the same session: skip this file. The rules live in `04-brief-template.md`.

---

## A.2 — Verb test examples

- ❌ "Remove field centroidEmbedding at line 46."
- ✅ "TopicClusterEntity.centroidEmbedding duplicates centroid storage now owned by Qdrant."

## A.3 — Goal-statement examples

- ❌ "After this task: centroidEmbedding field and getter/setter are removed."
- ✅ "After this task: the Java domain has no reference to centroid vector storage; Gate 2 green."

## A.4 — Decision Inventory: counts vs does NOT count

| Item type | Counts? |
|-----------|---------|
| "Should this be one class or two?" | YES |
| "Is there a DRY violation between X and Y?" | YES |
| "Does this belong in platform-* or in the service?" | YES |
| "What is the right boundary between A and B?" | YES |
| "Are there smells I haven't seen?" | YES (always) |
| "Which file should I edit?" | NO — execution mechanic |
| "How do I write the test?" | NO — execution mechanic |
| "Which Qdrant API call to use?" | NO — API mechanics |

## A.5 — V68 case study (binding reference — confidence-laundering)

**What happened:** `opus-brief.md` already enumerated every decision:
- "Remove centroidEmbedding field + getter/setter"
- "Replace in-memory cosine with Qdrant ANN"
- "Add topicAssignmentMinScore threshold"

Decision Inventory: D1 = "which file?" (mechanic), D2 = "how to call Qdrant?" (mechanic), D3 = "where does threshold live?" (mechanic — implied by existing `EnrichmentProperties`). Zero genuine decisions.

**Right routing:** Sonnet builds → Opus review (~4k). Same code. Same smell-check. ~11k tokens saved.

**Wrong routing (what happened):** Opus `--b` at ~15k. `Where I exercised judgment` would have been near-empty.

**Rule:** if you can list every architectural call in your head right now = NOT an Opus `--b` task.
