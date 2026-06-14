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
- Architecture erosion vectors + per-edit fitness-function defenses: `10`.
