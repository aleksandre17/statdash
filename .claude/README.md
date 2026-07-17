# The System — Complete Reference (kit v1.9.0)

> Multi-agent orchestration framework for Senior-standard engineering. Onboarding: `GETTING-STARTED.md` · doctrine index: `kit/INDEX.md` · changelog: `kit/UPGRADE-NOTES.md` · project history: `UPGRADE-NOTES.md`.

## What this is

A lead agent (orchestrator) routes work by **decision-density** across a ranked team, under **hard enforcement hooks**, with all planning on a **work board** and all knowledge **loaded on demand**. Project specifics live in one manifest (`project.json`); the framework (`kit/`) is generic and upgrade-safe.

## The team (rank × model)

| Tier | Model | Agents |
|---|---|---|
| Lead | session model (Sonnet default; `/model opus` to upgrade — role identical) | orchestrator — routes, mediates, never codes |
| Oversight | Opus | chief-engineer — all-seeing coherence + quality command (read-only) |
| Senior | Opus | architect · database-architect (+migrations) · senior-backend-developer · senior-frontend-developer (+markup) · project-manager · debugger |
| Middle | Sonnet | module-specialist (one per project module, reads its CLAUDE.md) |
| Junior | Haiku | explorer (read-only recon) · junior-executor (bulk-to-spec) |

Depth = 1: only the lead spawns. Authority ≠ orchestration: only the user commands Opus judgment; relay is verbatim.

## Daily use

`/verify` (health) → board pick → work → `/review` → `/close`. Every non-trivial request: the lead names its **journey** (`kit/strategy/11-work-board.md`) and follows the chain. Talk to one specialist directly: `@agent-<name> …` (one task, orchestrator stays) or `claude --agent <name>` (run the whole session as that agent — e.g. a DB-heavy session as `database-architect`); trade-off + continuity in `01`.

Commands: `/bootstrap /verify /architecture /audit /roadmap /layer /refactor /debt /review /close /board /collab /upgrade /senior` — invocation map in `kit/INDEX.md`.

## The guardrails (what protects the path)

**Hard (hooks — model-independent):**
- `pre-edit-gate` — Class-M paths (migrations, contracts, cross-module) inject Mandatory-Opus + risk protocol *before* the edit; both `/` and `\` separators.
- `post-edit-laws` — **blocks (exit 2)**: law violations (e.g. domain hardcodes like `.contains("ka")`) · architecture violations (application→infrastructure import, lib→app import — path-scoped) · **file bloat** (over `hygiene.bloat_limits` × hard_factor: split, don't append).
- `session-start` — injects resume state + operating contract every session. `stop-check`, `session-end-tokenlog` — session discipline.

**Structural (doctor, `/verify`):** 54 checks incl. live hook-firing proof, `.claude/` and repo-top **sanctioned-dirs** guards, board scaffolding, agent/INDEX/manifest integrity.

**Protocol (binding doctrine):** Task Intake Gate — a request that violates standards (the user's own included, incl. wrong folders/architecture) is **paused before work** with a named violation + better alternative · new architecture = proposal + ADR first · board rules 1–7 · conflict rule (`09 §A`) · principled refusal (every agent).

**Token rule (`06`):** Quality → Learning → Tokens. On-demand loading kills waste; quality work is never starved.

## Configuration (one place: `project.json`)

`law_patterns` (regex laws + arch rules; each can carry `sample_violation` for doctor live-fire) · `class_m_triggers` · `module_law_docs` · `paths` (audit/architecture/roadmap/layers/learning/decisions/**work_dir**) · `hygiene` (bloat_limits · hard_factor · claude_sanctioned_dirs · repo_sanctioned_top) · `modules` · `kit_version`. Schema-validated (`kit/project.schema.json`).

## Upgrade & portability

Kit is vendored at `.claude/kit/` (submodule model). Update: replace kit (or `git submodule update --remote`) → `bootstrap --check` → `/verify`. Kit bugs are fixed **upstream** (never patch the vendored copy); every release is one `UPGRADE-NOTES.md` entry. Project files are never touched by upgrades.

## Testing (what "working" means here)

`/verify` = doctor live-fires the gates against THIS project's config — 54/54 expected. `selftest` = hook self-checks (8/8). The full proof run (all hooks driven with real probes, guards catching planted violations) is reproducible; the system is considered healthy only when every blocker demonstrably fires.

---


A generic **Sonnet (mediator/orchestrator) · Opus (architect) · Haiku (executor)** operating system: decision-density routing, faithful mediation, pre-work gates, risk assessment, token economy, learning loop, and hook-based enforcement.

**One rule above all: you never edit a kit file.** Everything project-specific goes in **`project.json`**. The kit reads it; the kit itself contains zero domain literals.

---

## What's in the kit (all generic)

| Path | Role |
|------|------|
| `B.md` | the Opus digest (loaded into every Opus brief) |
| `hooks/*.py` | structural enforcement (run outside the model). All read `project.json` |
| `feedback/feedback_*.md` | binding team-collaboration laws (generic principles) |
| `commands/` | command playbooks — `/audit` `/architecture` `/roadmap` `/layer` `/refactor` `/debt` `/review` `/close` `/senior` (structure + routing + output paths, judgment left to the agent) |
| `INDEX.md` | selective-load map (read only what the task needs) |
| `settings.json` | Claude Code hook + permission wiring |
| `project.schema.json` | the contract `project.json` must satisfy |
| `templates/` | skeletons for every project slot you fill |

## What's project-specific (the slots YOU fill — never in the kit)

`project.json` (the manifest) · `CLAUDE.md` (+ per-module `CLAUDE.md`) · `memory/project_*` + `user_profile` · `.claude/context/opus-brief.md` (runtime) · `.claude/session/*` (runtime) · `.claude/commands/dev.md` (your build/test/run, from `dev.md.template`) · `commands/laws.md` (your stack/clean-arch, from `laws.md.template`) · `.claude/strategy/03-A-examples.md` (your worked examples).

---

## Install into a new project

1. **Copy** the kit into the project: `claude-kit/*` → `<project>/.claude/` (strategy, B.md, hooks, feedback, INDEX.md, settings.json, project.schema.json all land under `.claude/`).
2. **Fill `project.json`** from `templates/project.json.template` (see `project.json.example` for a real one). Put it at `<project>/.claude/project.json`.
3. **Validate** it: `python -c "import json,jsonschema; jsonschema.validate(json.load(open('.claude/project.json')), json.load(open('.claude/kit/project.schema.json')))"`.
4. **Fill the slots** from `templates/`: `CLAUDE.md` (root + per module), `memory/project_*` + `user_profile`, `.claude/context/opus-brief.md`, `.claude/strategy/03-A-examples.md`, `.claude/commands/dev.md`.
5. **Self-test the hooks**: `python .claude/kit/hooks/selftest.py` → expect `8/8 passed`.
6. Hooks call `python`; on hosts where only `python3` exists, change the command prefix in `settings.json`.

That's it. The doctrine works unchanged; only `project.json` + the slots differ between projects.

### First session flow
1. `selftest.py` → 8/8. 2. Read `opus-brief §Current State` (SessionStart injects it); heed any STALE warning. 3. Assess: **`/architecture`** (CURRENT→TARGET→GAP→PATH, read-only). 4. Plan: **`/roadmap`**. 5. Execute: **`/layer`** / **`/refactor`** (reversible-first, `09` §B). 6. **`/close`** every session. (A project-tailored version ships as `GETTING-STARTED.md`.)

---

## How `project.json` drives the generic hooks

| Hook | Reads from `project.json` | Effect |
|------|---------------------------|--------|
| `pre-edit-gate.py` | `class_m_triggers` | path matches → Mandatory-Opus + risk reminder |
| `post-edit-laws.py` | `law_patterns` | changed file matches `glob` + `forbid` regex → exit 2 (corrective) |
| `session-start.py` | `resume_marker` | brief's claimed version vs repo's actual → STALE warning |
| `stop-check.py` | `learning_dir`, `code_globs` | code changed but no learning note → reminder |

No paths, antipatterns, or language codes live in the hooks. Change the project → change `project.json` only.

---

## Command playbooks

Invoke a recurring operation and the agents follow a defined playbook — folder structure, who-runs, foreground/background, where output lands, what gets recorded. All output paths come from `project.json` `paths`, so the playbooks are generic:

- **/audit** — Opus audits (optionally parallel by module, risk-checked); findings → `paths.audit_dir` + `project_debt`.
- **/architecture** — Opus maps CURRENT → TARGET → GAP → ordered migration PATH (read-only); → `paths.architecture_dir`. (This is the Gate-3 deliverable.)
- **/roadmap** — turns the path into phases/layers with goal · who · risk · DoD; → `paths.roadmap_file`.

Full set covers the loop: **assess** (`/audit` `/architecture`) → **plan** (`/roadmap`) → **execute** (`/layer` `/refactor` `/debt`) → **verify** (`/review`) → **wrap** (`/close`). A playbook **guides**; it never replaces the agent's judgment (`03`). Add your own under `commands/` following the same header (Who · Reads · Output · Records · Done-when · Procedure).

## Updating the kit (bug-fixes & improvements)

The kit evolves. Because it's a submodule and every project specific lives OUTSIDE `.claude/kit/`, a fix reaches you in one step and your project is untouched:

1. `git submodule update --remote .claude/kit` (commit the new pointer).
2. `python .claude/kit/tools/bootstrap.py --check` → `COMPATIBLE ✓` means done. If a kit update added a required manifest field, the check names it; add it to `project.json` and re-check.

Pure bug-fixes (hook/doctrine) propagate transparently. Contract changes can't silently break you — `--check` validates `project.json` against the new schema. Kit version: `.claude/kit/VERSION`. Full flow: `/upgrade`. **Found a kit bug? Fix it upstream in the kit, bump VERSION — never patch the vendored copy (that diverges).**

## Guarantees

- **Domain-literal-free kit:** grep the kit for your domain terms — there are none. (The one labelled exception is `.claude/strategy/03-A-examples.md`, which is a *project slot*, not kit.)
- **Hooks fail open:** a broken hook degrades to no-enforcement (warn), never block-all. `selftest.py` catches breakage; `settings.json` disables instantly.
- **One-body across the boundary:** the kit references the project's laws (`CLAUDE.md`) and module laws (`project.json` `module_law_docs`) — it never restates them, so there is no drift between kit and instance.
- **Upstream cleanly:** improve the kit once, re-copy into every project; each keeps its own `project.json` + slots.

> Changelog: `.claude/kit/UPGRADE-NOTES.md` (one entry per version; read it on `/upgrade`).

## Why two agent folders (and why it's correct, not duplication)

Claude Code discovers agents, skills, and slash-commands **only** under `.claude/agents/`, `.claude/skills/`, `.claude/commands/` — never inside `.claude/kit/`. So the active copies must live outside the kit. The kit holds the **seeds/templates** (the upgrade source); `/bootstrap` scaffolds the active copies from them, and `/upgrade` refreshes them.
- **Role agents** (architect, chief-engineer, …): kit copy = canonical seed; project copy = **verbatim mirror**. They must stay byte-identical.
- **Tuned agents** (orchestrator allowlist, project-stack specialists): project copy deliberately diverges → declares `tuned: true` in frontmatter.
- **Module specialists**: generated into the project from `module-specialist.md.template`; no kit copy.
The duplication is therefore a **managed mirror**, not a smell — and `doctor` enforces it: any role-agent project copy that diverges from its kit seed **without** `tuned: true` is flagged as drift. This is what prevents the stale-agent bug (an old project copy silently lagging the kit).

## Operating model

The system runs on a **lean binding core** (hooks + manifest + agent files + `CLAUDE.md` + the SessionStart injection) and an **on-demand reference library** (strategy / skill / feedback). The core stays minimal; doctrine grows only when real use proves a gap — **measure before you add**. Full model + load rules: `.claude/kit/INDEX.md`.
