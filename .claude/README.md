# The System — Complete Reference (kit v1.0.8)

> Multi-agent orchestration framework for Senior-standard engineering. Onboarding: `GETTING-STARTED.md` · doctrine index: `kit/INDEX.md` · changelog: `kit/UPGRADE-NOTES.md` · project history: `HISTORY.md`.

## What this is

A lead agent (orchestrator) routes work by **decision-density** across a ranked team, under **hard enforcement hooks**, with all planning on a **work board** and all knowledge **loaded on demand**. Project specifics live in one manifest (`project.json`); the framework (`kit/`) is generic and upgrade-safe.

## The team (rank × model)

| Tier | Model | Agents |
|---|---|---|
| Lead | session model (Sonnet default; `/model opus` to upgrade — role identical) | orchestrator — routes, mediates, never codes |
| Oversight | Opus | chief-engineer — all-seeing coherence + quality command (read-only) |
| Senior | Opus | architect · database-architect · senior-backend-developer · senior-frontend-developer · project-manager · debugger · migration |
| Middle | Sonnet | backend / frontend / retrieval-service / ingestion-service specialists · markup-specialist |
| Junior | Haiku | explorer (read-only recon) · junior-executor (bulk-to-spec) |

Depth = 1: only the lead spawns. Authority ≠ orchestration: only the user commands Opus judgment; relay is verbatim.

## Daily use

`/verify` (health) → board pick → work → `/review` → `/close`. Every non-trivial request: the lead names its **journey** (`kit/strategy/12-journeys.md`) and follows the chain. Talk to one specialist directly: `@agent-<name> …` (one task, orchestrator stays) or `claude --agent <name>` (run the whole session as that agent — e.g. a DB-heavy session as `database-architect`); trade-off + continuity in `01-A`.

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
