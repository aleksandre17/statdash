---
name: capability-parity-gate
description: HARD RULE — before ANY retirement/merge/consolidation, prove the surviving surface is a SUPERSET of what's removed (capability parity); a silent capability regression cost owner trust
metadata:
  type: feedback
---
Before retiring, merging, or consolidating ANY surface/editor/control, a **capability-parity audit is a mandatory pre-gate**: prove the surviving surface does EVERYTHING the removed one did (survivor ⊇ removed). Enumerate the removed surface's capabilities FIRST, then confirm each survives — BEFORE shipping, not after a complaint.

**Why:** 2026-07-20 — ADR-051 DU3 retired the "advanced raw data editor" (`DataSpecEditor`/`SpecBody`) by folding it into the workbench **fallback lane**, which only shows for NON-pipeline kinds. Nobody audited parity for PIPELINE specs, so they silently LOST the advanced/raw editing power (only the simple verb palette remained). The gates I set (FF-ONE-SPEC-EDITOR = "no duplicate", live walk = "kinds still editable") checked *reachability* and *no-duplicate* — necessary but NOT sufficient; they never asked "is the survivor a superset?" The owner hit the regression himself, and said: "why did you allow the regression? you're supposed to look 100 heads ahead, see the full picture — you lost trust." A consolidation was treated as pure win without verifying the "one" was a superset of the "two."

**How to apply:**
- DoD for ANY merge/retirement is **"no capability lost"**, never just "no duplicate / still reachable". Consolidation ≠ automatic win.
- The verification brief must include an explicit capability-parity check (enumerate removed → confirm each in survivor). Bake it into the gate, not a post-hoc recon.
- Where a delta is genuinely unavoidable, **surface it to the owner for an explicit accept — never silently drop it** (principled refusal / no silent decision).
- "Look 100 ahead / see the full picture" = the superset/full-consequence check is MY job as lead, before routing the build. This is the inverse of [[built-but-buried-audit]] (built-but-unreachable) — here it's existing-power-lost-in-a-merge. Reinforces [[craft-completeness-bar]] and [[full-ownership-reference-grade]].
- Trust is earned back by discipline, not promises: on any structural change, proactively sweep the WHOLE program for silent regressions, don't wait to be caught.
