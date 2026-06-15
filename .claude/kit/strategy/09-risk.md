# 09 — Risk Assessment (parallel work · architecture/task degradation)

> Loaded by Sonnet **before spawning parallel agents** (§A), and by any agent **before an irreversible or high-blast-radius task** (§B).
> The system already *mitigates* risk (No-degradation law · Tier 2 · `feedback_brief_is_hypothesis` · Opus refusal · `05` thread-safe). This file makes the *assessment* explicit and **proactive** — a Senior assesses before acting, not after the damage.

---

## When this fires

- About to spawn **≥2 parallel agents** → run **§A** first.
- About to touch an **irreversible / high-blast surface** — migration, public contract/API, shared lib, data delete, pipeline stage. The Class-M Pre-Work Gate (`01`) + the PreToolUse hook (`08`) already *flag* these → run **§B**.

---

## §A — Parallel-spawn risk (Sonnet, before launching N agents)

Five observable checks. **Any one present → do NOT parallelize that slice — serialize or partition.**

| Risk | Check | If present |
|------|-------|-----------|
| **File overlap** | do the tasks touch the same file/module? | partition by file, or serialize. **Never two agents on one file.** |
| **Dependency** | does B need A's output? | sequence — not parallel. |
| **Shared-state write** | do both write `context.md` / `opus-brief` / a migration / a shared lib? | only Sonnet writes shared; agents → `agents/<run-id>.md`; serialize shared writes (`05`). |
| **Schema/contract race** | ≥2 parallel migrations or port changes? | **forbidden** — serialize (each is Class-M anyway). |
| **Merge cost** | how hard to merge the parallel diffs? | high → fewer parallel, more sequential. |

→ **Decision: GO (partitioned) / SERIALIZE.** Then the cost gate (`01`, `06`): parallelize only if **value > cost (~7×) AND risk = low**. Sonnet owns this call.

**Finding-conflict on merge (collision avoided ≠ agreement).** Partitioning stops two agents touching one file — it does NOT stop two agents reaching **contradictory conclusions** about the same concept (e.g. agent-1 "extract to platform-X", agent-2 designs around keeping it local). When merging `agents/<run-id>.md`, if outputs conflict, Sonnet **must NOT silently pick one**: it surfaces the conflict — to Opus if it's an architectural-judgment call (arbitration is Opus's job, not Sonnet's), or to the user if Opus is split or it's plan-level. Silent resolution by the orchestrator violates the Authority model (`01`).

---

## §B — Task-degradation risk (before an irreversible / high-blast task)

The Senior reflex — five questions, assessed out loud before touching:

1. **Reversibility** — one-way or two-way door? (migration applied · contract shipped · data deleted · column dropped = **one-way** → highest scrutiny.)
2. **Blast radius** — what beyond the stated scope does this touch? (downstream consumers, other modules, the pipeline, persisted data.)
3. **Degradation** — does it lower ANY existing guarantee: architecture, port contract, pipeline, performance, or quality? (**No-degradation law.**)
4. **Premise** — is the task's premise actually correct, verified in the real code? (`feedback_brief_is_hypothesis`.)
5. **Rollback** — if it goes wrong, how do we undo? (shadow column · feature flag · revert · backup.) **No rollback path = treat as one-way.**

→ **Decision:**
- low reversibility-risk + no degradation → **PROCEED.**
- reversible but non-trivial blast → **PROCEED WITH MITIGATION** — name the shadow/flag/backup *first*.
- **irreversible AND (high blast OR any degradation)** → **BLOCK + escalate to the USER.** Only the user authorizes an architecture-degrading or irreversible-risky move (Authority model, `01`). **Opus refuses outright** (#8). Sonnet never proceeds on its own judgment here.

---

## One-body tie-ins (this file OWNS "risk assessment"; others point here)

- Parallelism: `01` §Dynamic parallelism → run **§A** before spawn.
- Class-M / irreversible surface: `01` Pre-Work Gate + `08` PreToolUse hook flag → run **§B**.
- Opus refusing regressive/sub-standard work (`03`, `feedback_opus_identity_standard`) = **§B firing inside Opus**.
- **Principled refusal binds every agent** (Sonnet as builder *and* mediator, Opus, Haiku-flags) — refuse a degrading/non-improving task by default, with argument + alternative + escalate to user: `01` Principled refusal.
- Thread-safe execution mechanics (how, not whether): `05`.
- Architecture erosion vectors + per-edit fitness-function defenses: `09`.

---

## Architecture protection (absorbed from 10)

> Loaded when a change could affect structure, or when hardening the project's invariants. ~45 lines.
> Sibling files: `02` (per-layer flow + continuous audit), `08` (hooks = fitness functions), `09` (degradation risk), `03` (hunting-dog).

---

## Why architecture erodes "along the way"

No single edit breaks the architecture. Erosion is **cumulative**: each "small, reasonable" decision slightly bends a boundary, and over many layers the design rots. The owner's own standing concern names the end-state — *"layers don't understand each other, too much static and poorly-coupled code, not one coherent structure."* Protection therefore cannot be a one-time review; it must run **on every edit, every layer, every phase**.

## The erosion vectors → the defense for each

| Vector (how it creeps in) | Defense | When it fires |
|---|---|---|
| **Dependency-direction violation** (application imports infrastructure concrete) | `law_patterns` arch rule → `post-edit-laws` **BLOCKS** | per edit (hard) |
| **Layering / boundary leak** (a lib imports an app package; a module reaches into another's internals) | `law_patterns` arch rule (path-scoped glob) → **BLOCK** | per edit (hard) |
| **Coupling creep / God object / SRP drift** | continuous audit (`02`) + Opus hunting-dog (`03`) | per layer |
| **Duplication drift (DRY) / one-body violation** | one-body law + continuous audit; promote to shared lib | per layer |
| **Silent decision reversal** (a later layer quietly undoes an earlier architectural call) | **ADR** in `paths.decisions_file` + Opus refusal of regressive work (`09` §B) | per decision |
| **No-degradation breach** (lowers any existing guarantee) | Task-degradation risk check, `09` §B — BLOCK + escalate | before irreversible/high-blast |
| **Cumulative drift across many layers** | **Gate 3** phase retrospective (`02`) + `/architecture` re-baseline (current vs target) | per phase / on demand |

## The principle: every architectural invariant is a fitness function

The strongest protection is the one that does not depend on anyone remembering. **Turn each invariant into an automated check:**
- **Regex-expressible rules** (dependency direction, forbidden imports, layering, domain-literal bans) → a `law_patterns` entry. `post-edit-laws` matches the rule's `glob` against the file's **path** (path-scoped, e.g. `*/application/*.java`) and **blocks (exit 2)** the edit on violation. This is per-edit, hard, agent-independent.
- **Structural rules regex cannot express** (cycle detection, transitive dependency, "only these modules may depend on X") → an **ArchUnit / dependency-check test** wired as a CI gate (`ops/scripts/check-laws.sh`). Reference it from the manifest; run it in `/review` and at Gate 3.

A rule enforced only by prose erodes. A rule enforced by a fitness function holds **by default**, no matter who edits or how tired they are.

## Working rules (every agent)

- **No broken windows.** A layer never closes with a known architectural violation (`02` Continuous Audit). Fix-on-sight — the economic case is in `06` (leaving it = re-walk later = double tokens; here it also = erosion).
- **Touching a boundary is a Class-M signal.** Public API · contract · port · cross-module dependency → Mandatory-Opus + `09` §B before the edit.
- **Record the decision (ADR), not just the change.** So a future layer cannot silently reverse it without the reversal being visible.
- **Harden, don't just warn.** When `/audit` or `/architecture` finds an invariant protected only by prose, the fix is to **add the fitness function** (a `law_patterns` arch rule, or an ArchUnit test), not another reminder.
- **`/verify`** (`doctor.py`) proves the protection actually fires on this project's config — run it after `/bootstrap` and `/upgrade`.

## Prevention protocol (system hygiene — the four standing guards)

| Threat | Guard | Hardness |
|---|---|---|
| **File bloat** (huge files) | `hygiene.bloat_limits` — `post-edit-laws` **BLOCKS** any edit leaving a file over limit×hard_factor ("split, don't append"); doctor reports anything over the soft limit | hard + report |
| **Structure drift** (stray folders, wrong placement) | doctor checks `.claude/` against `hygiene.claude_sanctioned_dirs`; a new top-level home for anything is a **structure decision → Intake Gate + architect proposal**, never a silent mkdir | report + protocol |
| **Token weight** (system itself getting heavy) | on-demand loading (INDEX discipline, `06`): always-loaded surface stays minimal; new doctrine goes into load-on-trigger files, never the hot path | protocol |
| **Wrong plan from the user** (wrong folders/architecture in the request itself) | **Task Intake Gate** (orchestrator): standards pre-check covers structural plans — the lead pauses BEFORE work, names the violation, proposes the best-quality alternative; the user decides | protocol (binding) |

New architecture is always a **proposal first**: architect (Opus) presents options + trade-offs (SKILL catalog) → ADR → only then build. Nothing structural happens as a side effect of a task.

**Over-engineering is erosion too.** Unproven machinery is debt, not safety. Lean core, earned growth: a new doctrine/agent/file must prove it changes outcomes in real use before it stays. Measure before you add (YAGNI as a fitness function). The kit grows from `feedback/` lessons, not speculation.
