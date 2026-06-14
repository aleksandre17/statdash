# 12 — Journeys (the right workflow for every situation)

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
| **New architecture decision** | architect proposes ≥2 options + trade-offs (SKILL) → user decides → **ADR** → fitness function (`10`) | `decisions_file` + `law_patterns` |
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
