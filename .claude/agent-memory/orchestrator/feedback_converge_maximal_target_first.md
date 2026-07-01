---
name: converge-maximal-target-first
description: Anti-rework methodology — the lead must converge the COMPLETE maximal best-concept TARGET (one coherent, research-grounded spec, owned by one senior architect, signed off by the owner) BEFORE building; never brief agents for the immediate/partial fix, which causes the owner to reveal the next-deeper requirement and forces rework
metadata:
  type: feedback
---

**The owner's pain (2026-07-01):** "We keep doing REWORK — it works, then it becomes second-work again. We lost the best managerial/methodological/team/result-oriented structure. Where's the communication breakdown?" The pattern: panel-sizing fixed → not context-proportional → rework; sections normalized → used weak `wrap`/`columns count:1` not `grid` → rework; layout adopted at shell level → per-section configs not normalized → rework. Each fix was minimal-but-working; the owner then revealed the deeper MAXIMAL requirement.

**Root cause (the lead's failure, NOT the agents'):** the lead briefed agents for the **immediate visible fix**, not the **maximal best-concept END-STATE**. The owner's full vision came out layer-by-layer, and the lead built to each partial layer instead of first EXTRACTING + CONVERGING the complete maximal target. So we build to a partial understanding → owner corrects → rework.

**The methodology (binding — kills rework):**
1. **Converge the COMPLETE maximal target FIRST.** Before building a system-level thing, commission ONE exhaustive, research-grounded, best-concept spec of the WHOLE target (every layer, framework-grade, MAXIMUM not minimum) — the agents as hunting dogs studying the best frameworks/patterns. Not piecemeal fixes.
2. **One owning senior architect drives it end-to-end** — design → converge with the owner → coherent build. NOT fragmented independent fix-lanes that each see only their slice (that fragmentation IS the lost "structure" the owner named).
3. **Owner signs off on the COMPLETE target** before building — all requirements on the table at once, no mid-build discovery.
4. **Build to the signed target ONCE, maximally.** Definition of done = matches the maximal target + verified — never merely "works."
5. **Extract the owner's FULL vision upfront** — proactively ask for the complete end-state (all requirements) rather than discovering them reactively one message at a time.

**RISK BALANCE (owner corrected 2026-07-01 — do NOT go waterfall):** "converge the complete target" does NOT mean a big-bang build to a huge upfront spec — that carries the opposite risk (wrong target → redo the WHOLE path → even more time/tokens). The synthesis:
- The target agreement is **LIGHTWEIGHT** — the agreed DIRECTION + key decisions + principles (a light vision the owner signs), NOT an exhaustive 50-page spec. Cheap to produce, cheap to correct.
- Then build in **SMALL, VERIFIED, REVERSIBLE increments toward that target** (fitness functions, reversible commits, backups — already in the project). Small blast radius if wrong; a wrong step loses ONE increment, never the whole path.
- **The rework was NOT caused by being too incremental — it was caused by incrementing WITHOUT an agreed target** (each fix aimed at the immediate symptom). Fix = AIM RIGHT (cheap target agreement) + STEP SAFELY (small, verified, reversible). Neither big-bang nor blind-increment.

This sharpens [[orchestrator-briefing-doctrine]] (brief for ends+maximal, not patches), [[elevate-dont-patch-proactive-design]], and [[never-lose-architecture-visions]]. Companion: the `ARCHITECTURE-REGISTRY.md` holds the target; this ensures the target is COMPLETE + signed before building.
