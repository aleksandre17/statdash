---
id: "0105"
title: "Agnostic-graduation sweep — apply the owner's kit-is-the-agnostic-space rule across all 13 agent-memory dirs"
status: backlog
class: G
priority: P3
owner: —
links:
  - .claude/agent-memory/orchestrator/feedback_agnostic_to_kit.md
  - .claude/kit/INDEX.md   # governance rule (owner-blessed 2026-07-22)
---
**Goal** — Owner rule (2026-07-22): everything agnostic (true on ANY codebase) lives in `.claude/kit/`; only THIS-repo facts stay in agent-memory. Sweep all 13 agent-memory dirs (~500 files): per file, judge agnostic-vs-project; graduate agnostic lessons to `kit/feedback/` (or extend the existing kit file — anti-duplication guard), keep project anchors local, update both indexes.

**DoD** — every agent-memory file classified; agnostic cores live in exactly ONE kit file each (no twins with kit doctrine — grep before moving); kit INDEX.md carries a load-condition row per new file; no dead links in any MEMORY.md; file counts stay under ceilings.

**Notes** — First execution already done (2026-07-22): `feedback_worktree_isolation` graduated from orchestrator memory. Fold the graduation check into every future curation brief (it is now part of the standing curation protocol per the INDEX governance rule). One agent per dir-batch, serialized; the lead reconciles indexes. Biggest overlap risk: leadership/verification doctrine + strategy/12 already cover much of what agent memories restate — EXTEND, don't twin.
