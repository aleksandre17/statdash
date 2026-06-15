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
6. **`/close` settles the board.** Finished card → `done` + links to artifacts (layer doc, ADR, commit). Abandoned → `rejected` **with the reason in Notes** (a rejection without a reason is a silent decision — forbidden, `01` E).
7. **BOARD.md is regenerated, never hand-curated** — `/board` rebuilds it from the cards. If BOARD.md and a card disagree, the card wins.

## Template system (protocol survives across projects)

The kit ships `templates/work/` (PROCESS + BOARD + item). `/bootstrap` scaffolds `<work_dir>/` into any project — new or existing — so the protocol is identical everywhere; `project.json` `paths.work_dir` is the only per-project choice. A project may *extend* PROCESS.md (extra statuses, stricter WIP); it may not weaken rules 1–7.

---

## Journeys (absorbed from 12)

> Loaded when starting any non-trivial effort. The lead names the journey out loud before work begins; deviation from a journey mid-flight → pause + propose (Intake Gate). ~55 lines.

## Situation → canonical chain

| Situation | Journey (playbook chain) | Outputs land in |
|---|---|---|
| **New project** | `/bootstrap` → fill memory slots → `/verify` → `/architecture` (target) → `/roadmap` → cards on board | `.claude/` + `memory/` + `<work_dir>/` |
| **Improving an existing system** | `/verify` → `/architecture` (current vs target) → `/audit` → `/roadmap` → board → layer loop | `architecture_dir` · `audit_dir` · cards |
| **Refactoring** | `/audit` (name the smell + attribute) → cards (Strangler-Fig steps — incremental, each shippable) → `/refactor` per card → `/review` | cards · `decisions_file` (ADR) |
| **New feature / layer** | card `ready` → `/layer` (spec → plan approval → build → continuous audit) → `/review` → `/close` | `layers_dir` · learning note |
| **Bug / incident** | debugger (root cause BEFORE fix) → if multi-lens → `/collab` → fix card → regression test | scratch · card · test |
| **DB / schema change** | database-architect → `09` §B risk → migration agent (Class-M) → ADR → shadow/expand-contract | migration + ADR |
| **New architecture decision** | architect proposes ≥2 options + trade-offs (SKILL) → user decides → **ADR** → fitness function (`09`) | `decisions_file` + `law_patterns` |
| **Hard cross-domain problem** | `/collab` (task force, rounds, user decides) | scratch → ADR → cards |
| **Daily work** | resume (SessionStart injects state) → board pick → execute → `/review` → `/close` | board + brief |

**The rule:** every non-trivial request gets its journey named *first* ("this is an improving-existing journey — chain is…"). No journey fits → that itself is an architect question, not a reason to improvise.

## Canonical structure (the folder standard)

**Repo root — sanctioned top-level only** (`hygiene.repo_sanctioned_top`, doctor-checked):
```
apps/        ← deployable services (one dir = one service)
libs/        ← shared, project-agnostic libraries (never import apps)
docs/        ← documentation only: architecture/ audit/ layers/ learning/ api/ guides/ archive/
ops/         ← ci/ cli/ compose/ config/ — operational tooling
work/        ← the board (operational planning state — not docs)
memory/      ← project truth slots
.claude/     ← the system (agents · skills · kit · manifest)
```
A new top-level home = **structure decision** → Intake Gate + architect proposal + this list updated deliberately. Never a silent mkdir.

**Inside a service module** (hexagonal standard — the arch law_patterns assume it):
```
apps/<service>/src/main/java/<base>/
  api/             ← inbound adapters (REST/SSE controllers, DTOs)
  application/     ← use-cases, orchestration — depends on domain ports ONLY
  domain/          ← model + ports (interfaces); zero framework imports
  infrastructure/  ← outbound adapters (DB, vector store, LLM, MQ)
db/migration/      ← versioned migrations (Class-M territory)
```
**Inside a lib:** flat by capability, zero app imports (`Arch-lib-no-app-import` blocks it).

## The guardrail stack (what keeps every journey on the path)

Per-edit **hard**: law_patterns (arch direction · boundaries · domain literals) + Class-M gate + bloat block. Per-layer: continuous audit + review. Per-decision: ADR + `09` §B. Per-phase: Gate 3 + `/architecture` re-baseline. Always-on: Intake Gate (wrong plans pause BEFORE work) + doctor (structure + health) + chief-engineer (system coherence). Token rule stays `06`: **Quality → Learning → Tokens — savings never at the expense of productive, quality work.**
