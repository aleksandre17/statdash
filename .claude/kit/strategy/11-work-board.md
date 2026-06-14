# 11 — Work Board (the planning workspace)

> Loaded when planning, picking, or closing work items. ~50 lines. Operations playbook: `commands/board.md`.

## What it is

A file-based Jira/Trello: **everything planned lands on the board, everything executed is picked from it.** One canonical workspace (`paths.work_dir`, default `work/`) so planning is never scattered across chats, briefs, and heads.

```
<work_dir>/
  PROCESS.md     ← the protocol (from kit template; project may extend, never weaken)
  BOARD.md       ← generated VIEW (kanban columns) — never the source of truth
  items/         ← the truth: one file per work item, stable forever
    0042-split-parse-package.md
```

## The card (one file per item, stable path)

```markdown
---
id: 0042
title: Split parse/ package by concern
status: backlog            # backlog → ready → in-progress → review → done | rejected
class: G                   # M = Class-M (architect/migration mandatory) | G = general
priority: P2               # P1 urgent · P2 normal · P3 nice-to-have
owner: —                   # filled when picked: which agent leads it
links: []                  # ADRs, layer docs, debt entries, PRs
---
**Goal** — one paragraph: what + why.
**DoD** — checkable definition of done.
**Notes** — context, risks, rejected alternatives.
```

## Why status-in-frontmatter, not folder-per-status (the architecture decision)

Folder-per-status (`00-backlog/ → 40-done/`) **moves files**: git history fragments, inbound links (ADR → card) break, the workflow is hardcoded into the filesystem, and two statuses can't be queried without walking directories. Status in frontmatter = **stable paths** (links never rot), one-line transitions (clean diffs), board as a *generated view* (one-body: cards are the only truth), and the workflow extends by editing PROCESS.md, not by restructuring directories.

## Flow rules (the protocol — binding on every agent)

1. **Nothing starts off-board.** A task is executed only if a card exists and is `ready`. A user request with no card → the lead creates the card first (10 seconds), then routes.
2. **Planning emits cards.** `/roadmap`, `/audit`, `/debt`, `/architecture` write their actionable outputs as cards in `backlog` — not only as prose reports.
3. **`backlog → ready` is the user's call** (prioritization = plan-level authority, `01`). The lead proposes; the user approves.
4. **WIP limit: `in-progress` ≤ 2.** Picking a third requires finishing or parking one — limits half-done drift.
5. **Class-M cards** route per the Pre-Work Gate (architect/migration mandatory, `09` §B before irreversible).
6. **`/close` settles the board.** Finished card → `done` + links to artifacts (layer doc, ADR, commit). Abandoned → `rejected` **with the reason in Notes** (a rejection without a reason is a silent decision — forbidden, `01-A` E).
7. **BOARD.md is regenerated, never hand-curated** — `/board` rebuilds it from the cards. If BOARD.md and a card disagree, the card wins.

## Template system (protocol survives across projects)

The kit ships `templates/work/` (PROCESS + BOARD + item). `/bootstrap` scaffolds `<work_dir>/` into any project — new or existing — so the protocol is identical everywhere; `project.json` `paths.work_dir` is the only per-project choice. A project may *extend* PROCESS.md (extra statuses, stricter WIP); it may not weaken rules 1–7.
