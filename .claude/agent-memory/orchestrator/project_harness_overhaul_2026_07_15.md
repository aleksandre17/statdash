---
name: harness-overhaul-2026-07-15
description: "The .claude harness overhaul (owner-ordered, lead-personal): context-packet doctrine, governor charter, duty orders, kit purity, memory consolidation — what changed and what remains"
metadata:
  type: project
---

Owner directive 2026-07-15 ("only YOU work on this"): heal `.claude`. Done personally, no delegation.

**Root diagnosis of the 70–90k agent load-burn:** NOT static injection (defs 1–5KB, MEMORY.md ≤12KB) — it is GROUNDING READS (each agent re-reading registry 34KB/ADRs/specs). Cure = the packet pipeline, not def-trimming.

**What changed:**
1. **`kit/strategy/12-context-packets.md` (NEW, agnostic)** — the lead grounds ONCE; agents get stamped CONTEXT PACKETS (facts verbatim+path-precise · decisions · prior findings · collisions · verify-only pointers); agents end with RETURN PACKETS; no heavy doc assigned wholesale; scout pattern; economy ONLY from logistics, never from quality. Wired into `kit/B.md` (§Context-packet contract) + INDEX.md row.
2. **`agents/orchestrator.md` REWRITTEN** — governor charter: duty stack D0–D6 (honesty/protection → routing&logistics → verification → portfolio/WIP → ledger → instrument currency → ideology), operating loop, economy law (max quality · min cost, in that order).
3. **All 13 defs gained a per-role `DUTY ORDER (when duties compete)`** — e.g. chief-engineer: stop-the-line first; debugger: reproduce before cause before fix; junior: spec-fidelity + stop-and-flag (initiative is NOT its duty).
4. **Kit purity:** `feedback_windows_worktree_pitfalls.md` genericized; project facts → **`.claude/context/worktree-gates-playbook.md`** (NEW). Kit now has zero project refs.
5. **`.claude/context/opus-brief.md` REWRITTEN to current truth** (was frozen at 2026-07-08 — the harness-level "briefs lag" root). Keep it current — it is a SessionStart injection (D5 duty).
6. **Memory healing:** 10 `.relocated.md` twins reconciled+deleted (unique content merged: engine ar50 one-way door · sfd constructor root-type invariant · pa m4 seam rules · sfd chromeconfig root cause); sfd studio 10 files → `project_panel_studio_map.md`, i18n 3→1, engine ar36 2→1; MEMORY.md indexes updated. sfd 86→72 files.
7. **memory-home-guard HARDENED:** ROOT now derives from `__file__`, never bare cwd — a manual run from `.claude/` had relocated the ENTIRE memory tree into a phantom `.claude/.claude/` (fully restored same session). selftest 32/32.
8. README kit-version header + project.json `kit_version` → 1.9.0.

**Remains (owned, not lost):** `project_panel_studio_map.md` is 57KB > 12KB block ceiling — flagged exception; the senior-frontend-developer distills it in place on first touch (craft owner cuts informed, the lead does not cut blind). engine-specialist (59>55) + sfd (72>55, 303KB>250KB) trim event-driven the same way.

9. **`kit/strategy/13-agent-growth.md` (NEW)** — the growth ladder (experience → memory → def-delta/kit-rule → machine gate); GROWTH NOTE in return packets (B.md); def evolution = propose-then-LEAD-ratifies (agents never edit their own identity; git versions it); research harvested, never left in transcripts; lead's D5 duty: graduate twice-seen lessons, prune stale canon.
10. **`docs/architecture/GUARDRAILS.md` (NEW)** — the insurance architecture: 4 rings (prevention/detection/containment/recovery); maintenance law = every incident leaves a new guard; keystone gap = Stage-0 CI. **`work/BOARD.md` REWRITTEN** as a thin projection (register rule: truth lives ONLY in ROADMAP+REGISTRY+cards; git = shipped log). `docs/architecture/README.md` authority chain fixed; docs-taxonomy residue carded (0076).

**How to apply:** every brief from now on carries a Context Packet (strategy/12 shape); keep opus-brief.md current at every stage close; never let an agent re-read what a return packet already established.
