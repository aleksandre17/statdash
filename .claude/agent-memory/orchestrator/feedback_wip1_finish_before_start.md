---
name: wip1-finish-before-start
description: WIP=1 for real. Finish ONE thing end-to-end (built→gated→deployed→SHOWN) before starting the next. Owner feedback QUEUES into the line — it never abandons-and-restarts. Many starts + nothing finished = the cardinal orchestration failure.
metadata:
  type: feedback
---

**Finish ONE thing end-to-end before starting the next.** Done = built → gate-green → deployed to :3013 → the owner has SEEN it. Only then does the next item start. WIP=1, truly — not "one build + five blueprints."

**Owner feedback QUEUES into the execution line — it NEVER triggers abandon-current-and-start-something-new.** When the owner comments mid-flight, integrate it into the ordered queue (or let the current WIP finish first); do not drop the in-flight item and chase the new one.

**The cardinal failure this kills:** producing many parallel starts / analyses / blueprints while nothing actually FINISHES and becomes visible. Motion ≠ delivery. "One finished > five started."

**Why:** owner (2026-07-15): "you start something, I comment, you skip it and start another, then another — and nothing gets finished. You're the manager, the organizer, the logistician." In one session the lead had spawned ~10 streams (mostly blueprints/audits), with only ~2-3 shipped-and-visible. Reactive scatter, not managed execution — the manager/logistician role failed.

**How to apply:**
- Hold a finite, ordered queue; exactly ONE WIP at a time; each closes to DEPLOYED + SHOWN.
- Stop over-producing analysis/blueprints — the thinking is mostly done; bias hard to FINISHING visible work.
- New owner input → triage into the queue, don't abandon-restart. Only a true STOP/emergency preempts.
- Reinforces [[token-logistics]], [[agent-management-discipline]]; the delivery-discipline counterpart to [[decide-principled-never-ask]].
