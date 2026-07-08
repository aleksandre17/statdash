# .claude/ — Entry Point & Selective Loading Map

> **Read this file first. It tells you exactly what to load for your task — nothing more.**
> No agent reads everything. Every file below has a documented purpose, owner, and load condition.

---

---

## Operating model — lean core, on-demand reference, earned growth

**CORE (always active, binding — small by design).** These bind behavior without anyone reading a doc; they are the spine:
- **Hooks** (`kit/hooks/`) — hard enforcement: they fire, they block (the only layer that truly *forces*).
- **Manifest** (`project.json` `law_patterns`) — the project's laws, enforced by the hooks.
- **Agent files** (`.claude/agents/`) — each carries its **Disposition + named canon + model tier**.
- **`CLAUDE.md`** — project laws (auto-loaded).
- **SessionStart injection** — the operating contract + Disposition, every session, every agent.

**REFERENCE (on-demand — consult when the core points you here; NOT required to operate):**
- `kit/strategy/` — deep doctrine (routing, risk, learning, board…).
- `skills/architecture-standards/` — the named-principle definitions.
- `kit/feedback/` — validated lessons, loaded per-trigger.
The agent *operates from the CORE* and *reaches into REFERENCE for depth* — by the rules in the map below.

**Earned growth (governing law).** The CORE stays minimal. New doctrine enters REFERENCE; it graduates to CORE only when real use proves it changes outcomes. **Measure before you add — over-engineering is architectural erosion (YAGNI as a fitness function).** Doctrine grows from field lessons (`feedback/`), not from speculation.

## Auto-loaded (do not re-read)

| File | Why it's auto-loaded | Touch policy |
|------|---------------------|--------------|
| `CLAUDE.md` (repo root) | Binding laws, DB rules, antipatterns, services/modules, stack | Never edit unless architecture changes |
| `memory/MEMORY.md` (user) | Memory index — auto-loaded by harness | Edit only when memory architecture changes |

Everything else below is loaded **on demand**, by the rules in this file.

---

## Selective loading map — "for this task, read this"

### A. Sonnet — orchestration loop (every task)
```
ALWAYS  → .claude/context/opus-brief.md          (current sprint state)
ALWAYS  → .claude/session/context.md             (in-progress blackboard)
ON NEW  → memory/MEMORY.md                       (already auto-loaded; consult on demand)
```

### B. Sonnet — choosing who runs the task
```
Read: .claude/kit/strategy/01-team-and-decisions.md   (team + dynamic decision model)
```

### C. Sonnet — running a layer
```
Read: .claude/kit/strategy/02-layer-flow.md           (per-layer flow + gates)
Read: .claude/kit/strategy/06-token-economy.md        (only when cost decision unclear)
```

### D. Sonnet — writing an Opus brief (`--f` or `--b`)
```
Read: .claude/kit/strategy/01-team-and-decisions.md   (Decision-Density model + 5-line Pre-Work Gate + Decision Inventory)
Read: .claude/kit/strategy/03-opus-mandate.md       (Section A discipline, then Section B.1 template)
Read: .claude/kit/feedback/feedback_opus_brief_style.md         (failure modes + canonical case study)
Read: .claude/kit/strategy/05-context-protocol.md     (if brief involves shared writes)
```

### D'. Sonnet — sending an Opus review brief
```
Read: .claude/kit/strategy/01-team-and-decisions.md   (Opus-as-Reviewer mode section)
Read: .claude/kit/strategy/03-opus-mandate.md         (Opus-as-Reviewer discipline)
Read: .claude/kit/strategy/03-opus-mandate.md       (Section B.3 — Review Brief)
```

### E. Opus / Haiku — receiving a brief
```
Brief itself                    — ground truth for the task
.claude/kit/B.md                    — inline digest: Tier 1/2, Blocker protocol, one-body, sandbox, output schemas
.claude/context/opus-brief.md   — current state (≤80 lines, last 3 layers)
.claude/session/context.md      — in-progress findings

Load full strategy files ONLY when brief flags a doctrine question:
  .claude/kit/strategy/03-opus-mandate.md   — doctrine question on Tier/Blocker/Work-protection
  .claude/kit/strategy/03-opus-mandate.md — doctrine question on brief format
  .claude/kit/strategy/03-A-examples.md     — first brief of a sprint only (case studies + canonical reference)
  .claude/kit/strategy/05-context-protocol.md — when writing shared session state
```
Haiku does **not** read mandate or strategy files — templated work, no decisions.

### F. Anyone writing to shared session state
```
Read: .claude/kit/strategy/05-context-protocol.md     (thread-safe append rules)
Append:
  - .claude/session/context.md       (narrative — one unique section per run)
  - .claude/session/token-log.md     (machine-readable token + file-change ledger)
  - .claude/session/agents/<id>.md   (per-agent scratch — collision-free)
```

### G. Sonnet — closing a session
```
Read: .claude/kit/strategy/07-learning-system.md      (when learning note triggered)
Edit: .claude/context/opus-brief.md §Current State + §Last Session (overwrite)
Rotate: .claude/session/context.md + token-log.md (if stale or layer transition)
```

---

## File catalog — what lives where

### Durable state (rare changes, no cascade)

| File | Purpose | Owner | Stability |
|------|---------|-------|-----------|
| `CLAUDE.md` | Laws, DB rules, antipatterns, stack | Architectural change only | Sacred |
| `memory/project_vision.md` | Owner, quality bar, Phase 1/2 goals | Architectural change only | Sacred |
| `memory/project_roadmap.md` | 70 layers × 7 phases (structure only) | Roadmap change only | Sacred |
| `memory/user_profile.md` | owner identity, language, learning goal | Profile change only | Sacred |
| `.claude/kit/strategy/07-learning-system.md` | Writing a learning note (companion to 07) | Sonnet/Opus |
| `.claude/kit/feedback/feedback_powershell_sandbox.md` | Sandbox flag mandate | Never (binding) | Sacred |
| `.claude/kit/feedback/feedback_opus_work_protection.md` | Never silently remove Opus code | Never (binding) | Sacred |
| `memory/project_debt.md` | Known gaps backlog | When debt resolved | Slow-changing |

### Strategy (split for selective loading — change by section, no cascade)

| File | Loads when | Owner |
|------|-----------|-------|
| `.claude/kit/strategy/01-team-and-decisions.md` | Sonnet picks executor | Sonnet |
| `.claude/kit/strategy/01-team-and-decisions.md` | Intaking a user directive, or relaying an agent's output to the user | Sonnet |
| `.claude/project.json` | Hooks read it; edit when project paths/laws change | Sonnet/config |
| `.claude/kit/strategy/02-layer-flow.md` | Sonnet runs a layer | Sonnet |
| `.claude/kit/strategy/03-opus-mandate.md` | Opus brief is written / Opus executes | Opus |
| `.claude/kit/strategy/03-opus-mandate.md` | Any brief written or received | Sonnet + Opus + Haiku |
| `.claude/kit/strategy/05-context-protocol.md` | Any shared session write | Every agent |
| `.claude/kit/strategy/06-token-economy.md` | Sonnet cost decision unclear | Sonnet |
| `.claude/kit/strategy/07-learning-system.md` | Learning note triggered | Sonnet |
| `.claude/kit/strategy/08-enforcement.md` | Wiring/auditing hooks; a discipline keeps getting skipped | Sonnet |
| `.claude/kit/strategy/09-risk.md` | Before parallel spawn, or before an irreversible/high-blast task | Sonnet/Opus |
| `.claude/kit/strategy/09-risk.md` | When a change could affect structure, or hardening invariants | Sonnet/Opus |
| `.claude/kit/strategy/11-work-board.md` | Planning, picking, or closing work items (the kanban protocol) | lead/all |
| `.claude/kit/strategy/11-work-board.md` | Starting any non-trivial effort (the situation→workflow map + folder standard) | lead/all |
| `.claude/kit/INDEX.md` | Back-compat index → points to 8 files above | lead |

### Operational state (changes frequently — read every relevant task)

| File | Purpose | Owner | Lifecycle |
|------|---------|-------|-----------|
| `.claude/context/opus-brief.md` | Current sprint + last session | Sonnet (overwrite) | Per-session |
| `.claude/session/context.md` | In-progress narrative blackboard | Sonnet writes; sub-agents append | Rotate at layer end / >150 lines / session end |
| `.claude/session/token-log.md` | Append-only token + file-change ledger | Every sub-agent appends one line | Rotate with context.md |
| `.claude/session/agents/<run-id>.md` | Per-agent scratch (optional, collision-free) | One agent per file | Deleted at rotation |

---

## One-body guarantees (no duplication)

- **Team roles / decision model** → only `01-team-and-decisions.md`
- **Brief template** → only `03-opus-mandate.md`
- **Context protocol** → only `05-context-protocol.md`
- **Quality bar / vision** → only `memory/project_vision.md` (`.claude/context/vision.md` DELETED — was duplicate)
- **Token tracking** → only `.claude/session/token-log.md`

If you find duplication, file a `project_debt.md` entry — every concept lives in exactly one file.

---

## Loading minima — concrete examples

| Scenario | Files an agent reads |
|----------|---------------------|
| Sonnet starts a session | `opus-brief.md` + `context.md` |
| Sonnet decides who runs Layer N | + `01-team-and-decisions.md` |
| Sonnet writes Opus `--f` brief | + `02-layer-flow.md` + `03-opus-mandate.md` |
| Opus receives a brief | `B.md` + `opus-brief.md` + `context.md` (full 03+04 only on doctrine question) |
| Opus receives a brief (first of sprint) | + `.claude/kit/strategy/03-A-examples.md` (case studies + canonical reference) |
| Haiku receives a brief | `opus-brief.md` only |
| Opus appends to shared state | + `05-context-protocol.md` |
| Sonnet closes session | + `07-learning-system.md` (if note) |

No agent ever reads all 7 strategy files. The selective map prevents that.

---

## Architecture Governance — what is FORBIDDEN

> These rules prevent the system from drifting back into a polluted state.
> Sonnet enforces them. Opus flags violations. Every agent reads them here.

### Memory files (`memory/*.md`)

| Forbidden | Why | Instead |
|-----------|-----|---------|
| Pointer-stub file (body = "go read file X") | Pure overhead — no content | Update `MEMORY.md` directly, or update the target file |
| Strategy/process content in a memory file | Strategy lives in `.claude/kit/strategy/01–07` | Add to the correct numbered file |
| Duplicate of existing content | Causes drift — two sources of truth diverge | Grep first. Extend the existing file. |
| `MEMORY.md` growing past ~50 lines | Growth = scope creep or duplicates | Delete or merge entries before adding new ones |
| Agnostic lesson stored as project memory | Portable wisdom trapped in a project-local layer — lost to the next project | Graduate it: a lesson true on ANY codebase → `.claude/kit/feedback/` (kit travels); only THIS-repo facts stay in `agent-memory` |

**Before creating any new memory file:** grep the concept. If it already lives somewhere → update that file. If it belongs to a category (feedback/user/project/reference) but no file exists → create ONE canonical file, add one line to MEMORY.md.

### Strategy files (`.claude/kit/strategy/`)

| Forbidden | Why | Instead |
|-----------|-----|---------|
| New content added to `INDEX.md` | It is a back-compat shim — adding content defeats selective loading | Add to the relevant `01–07` file |
| New `08-…` file without a clear load condition | Every file needs a "loaded when" rule | If it doesn't have a narrow load condition, it doesn't belong as a separate file |
| Merging two existing files without updating `INDEX.md` | Breaks the selective loading map | Update INDEX.md load conditions + MEMORY.md table simultaneously |

### Session files (`.claude/session/`)

| Forbidden | Why | Instead |
|-----------|-----|---------|
| `context.md` exceeding ~150 lines without rotation | Becomes a permanent log — defeats the temp-blackboard purpose | Rotate: extract decisions → `opus-brief.md`, clear `context.md` |
| Sub-agent editing earlier `context.md` content | Breaks thread-safety — overwrites another agent's section | Append only. One section per run. Unique header. |
| Incremental writes to `token-log.md` mid-run | Partial lines are not machine-readable | One line, at run end, atomic. |
| Not appending to `token-log.md` after a sub-agent run | Breaks session cost visibility | Every sub-agent run → one line in token-log.md. No exceptions. |

### Sonnet self-check (before every file creation)

```
1. Does this concept already live somewhere? → grep it
2. Is this content strategy/process? → .claude/kit/strategy/ not memory/
3. Am I creating a pointer-stub? → don't, update the target or MEMORY.md
4. Does this new file have a narrow load condition? → if not, it doesn't belong as a separate file
5. Will this push MEMORY.md past ~50 lines? → merge or delete first
```
## Agent layer (the routing mechanism)

`.claude/agents/*.md` — subagent definitions Claude Code uses to delegate. Model topology: ONLY the invariant-tier extremes carry a `model:` pin — apex design/QC (chief-engineer, architect, platform-architect = opus floor) and junior-executor (haiku); every other agent is model-agnostic and the lead routes it per-call by decision-density (misrouting is the lead's failure mode). Frontmatter `description` drives delegation; `memory: project` persists per-agent. Talk to one directly: `@agent-<name>` (one task) or `claude --agent <name>` (run the session as that agent) — protocol + trade-off in `01`. Doctrine: `01` Agent layer. Scaffolded by `/bootstrap`.

## Kit meta

`.claude/README.md` — what the kit is, the kit/project split, the submodule/upgrade model. `.claude/kit/UPGRADE-NOTES.md` — the kit's changelog (read on `/upgrade`). `.claude/kit/VERSION` — current kit version.

## Skill (auto-loaded on demand by the architect)

`.claude/skills/architecture-standards/SKILL.md` (kit source: `.claude/kit/skills/`) — the architect's full catalog: architecture styles · design principles (SOLID/GRASP) · patterns (GoF/enterprise/distributed/resilience/concurrency + anti-patterns) · ISO 25010 quality attributes · documentation (C4/ADR) · formal standards (DDD/TOGAF/12-factor) · API/data/testing/security/delivery · **RAG/AI-system layer**. Generic; select what fits.

## Feedback distillations (load when the trigger matches)

Crystallized owner feedback — each one is a behavioral correction that must not regress.

| File | Load when |
|------|-----------|
| `.claude/kit/feedback/feedback_verbatim_relay.md` | Relaying user words to an agent, or agent output back ("relay it") |
| `.claude/kit/feedback/feedback_brief_is_hypothesis.md` | Writing or executing an Opus brief (the brief is a hypothesis, verify the premise) |
| `.claude/kit/feedback/feedback_opus_brief_style.md` | Writing a brief FOR Opus (style: dense, structured, no padding) |
| `.claude/kit/feedback/feedback_opus_identity_standard.md` | Spawning Opus (identity + Senior standard header) |
| `.claude/kit/feedback/feedback_opus_work_protection.md` | Reviewing/merging Opus output (don't silently discard senior work) |
| `.claude/kit/feedback/feedback_commit_attribution.md` | Writing a commit message (attribution rules) |
| `.claude/kit/feedback/feedback_powershell_sandbox.md` | Running shell commands on the owner's Windows machine |
| `.claude/kit/feedback/feedback_verification_doctrine.md` | Before declaring anything done/verified; when a metric disagrees with the owner; designing any validation |
| `.claude/kit/feedback/feedback_leadership_doctrine.md` | Leading a session: intake, briefing, delegation/routing, proposing initiatives |
| `.claude/kit/feedback/feedback_architecture_craft.md` | Any design/refactor/UI-elevation decision; adopting a new concept |
| `.claude/kit/feedback/feedback_windows_worktree_pitfalls.md` | Working in a git worktree / running vitest-pnpm on this Windows machine |

## Command playbooks (load only when invoked)

| Invoke | Playbook | Who leads | Output |
|--------|----------|-----------|--------|
| **"bootstrap" / "init" / "set up"** | `.claude/kit/commands/bootstrap.md` | Sonnet | ready project (one word) |
| "run an audit" / "audit X" | `.claude/kit/commands/audit.md` | Opus (may parallelize by module) | `paths.audit_dir` + project_debt |
| "current vs target" / "map architecture" | `.claude/kit/commands/architecture.md` | Opus (read-only) | `paths.architecture_dir` |
| "make/update the roadmap" | `.claude/kit/commands/roadmap.md` | Opus → Sonnet | `paths.roadmap_file` |
| "build Layer N" / "next layer" | `.claude/kit/commands/layer.md` | Sonnet; builder per density | layer-doc + brief |
| "refactor X" / "fix coupling in Y" | `.claude/kit/commands/refactor.md` | Opus (risk-gated) | diff + close debt |
| "close debt X" / "work backlog" | `.claude/kit/commands/debt.md` | Sonnet → refactor/layer | project_debt updated |
| "review this" / "Opus review diff" | `.claude/kit/commands/review.md` | Opus | verdict clean/fix/block |
| "wrap up" / "close session" | `.claude/kit/commands/close.md` | Sonnet | durable state updated |
| "update the kit" / "upgrade" | `.claude/kit/commands/upgrade.md` | Sonnet | kit advanced + compat check |
| "teach me" / "senior mode" / "why this design" | `.claude/kit/commands/senior.md` | Opus | explanation + ≥2 rejected alternatives |
| "verify" / "doctor" / "is everything wired?" | `.claude/kit/commands/verify.md` | Sonnet | health report (proves hooks fire) |
| "/board" / "pick next" / "add to board" | `.claude/kit/commands/board.md` | lead (PM for restructuring) | regenerated BOARD.md + violations |
| "collab" / "war room" / "task force" | `.claude/kit/commands/collab.md` | lead + 2–4 agents by lens + user | decision → ADR + split cards |
| "/mode" / "switch to X mode" | `.claude/kit/commands/mode.md` | lead | session posture set (persisted) |
| "/rotate" / "rotate the log" | `.claude/kit/commands/rotate.md` | Sonnet | context.md hot head + token-log period; cold → docs/layers/ + session/archive/ |
| dev build/test/run · stack/laws | `.claude/commands/dev.md` · `laws.md` | Sonnet/Haiku | — (project commands) |

Playbooks GUIDE (structure + routing + output paths from `project.json`); judgment stays with the agent (`03`).
