# 05 — Shared Context Protocol (thread-safe)

> Loaded by every agent that writes shared session state. ~80 lines.
> Files governed: `.claude/session/context.md`, `.claude/session/token-log.md`, `.claude/session/agents/` (scratch + `<run-id>.inbox.md` mailboxes).

---

## Purpose

Shared blackboard. One writes, all use. No agent repeats work another already did.

---

## Shared-findings rules — no re-walk, and the trust asymmetry

The blackboard exists so a path is walked **once**. "I saw it, I walked it — here it is, so you don't walk it again" is the core economy (especially Sonnet ↔ Opus). Re-walking a path another agent already covered is pure wasted tokens (`06`).

- **Record once, consume — don't re-derive.** A finding written to `context.md` / `opus-brief.md` is taken as given by the next agent; it does not re-run the same exploration.
- **Trust asymmetry (binding):**
  - **Sonnet trusts the recorded findings** — it consumes the blackboard without re-deriving (that is the token win). The safety net for this trust is **Gate 2 (tests) + Opus-review**, not re-walking.
  - **Opus does NOT trust blindly.** Opus's value is judgment, so it treats the *premise* it builds on as a hypothesis and verifies it against the real code (`feedback_brief_is_hypothesis`). It still does not re-walk *exploration* already recorded — it verifies the *premise*, which is cheaper and is its actual job.
- **Parallel sync (#1):** parallel agents each write their own `agents/<run-id>.md`; Sonnet merges into `context.md`. Synchronisation is *through Sonnet* (the single writer) — never two agents writing shared state at once. This is also the harness reality: sub-agents cannot write `.claude/session/` directly (see token-log note below).

---

## Pause, resume & messaging (no re-walk across interruptions)

A sub-agent has **no persistent memory between invocations** — re-spawn it naively and it re-walks everything (double tokens). These rules close that.

### Checkpoint on pause → resume from checkpoint *(scenario: agent leaves background to ask something)*
- An agent that must pause (a question, missing input, leaving the background) **emits a checkpoint** in its return: `files read (+ what each yielded) · findings so far · current position / next step · the open question`.
- Sonnet (single writer) records it to `agents/<run-id>.md` — the harness blocks the agent from writing `.claude/session/` itself.
- On resume, Sonnet's new brief **re-feeds the checkpoint** ("you already read X, Y → Z found; continue from step N"). The agent **continues, never restarts**. No-re-walk (`06`) holds across the pause — foreground or background. A pause-to-ask is a normal event, **not** an agent failure (`01`).

### Record the exploration, not just the conclusion *(scenario: Sonnet reuses Opus's path)*
- The run-id record captures the **path**: files Opus read + what each yielded + the reasoning trail — not only the final decision.
- So Sonnet **and peers reuse Opus's exploration** — the files-read list and findings are consumed, never re-opened or re-derived. (Trust asymmetry above: Sonnet consumes the recorded exploration on trust; Opus re-verifies only the *premise* it builds on, not the logged exploration.)

### SendMessage — supplementary info between agents, routed by Sonnet
- **Sonnet is the message bus.** Any agent passes extra info by emitting a block: `SendMessage{ to: <run-id|sonnet|user>, re: <topic>, body: <…> }`.
- Sonnet routes it to the recipient's inbox `agents/<run-id>.inbox.md` and **delivers it in the recipient's next brief / turn**.
- Use it for: "I read X — you'll need it" (cross-agent no-re-walk), "the premise just changed", "here's the value you asked for".
- **Honest harness constraint:** this is **not** a live interrupt of a running sub-agent — the harness has no peer-to-peer live channel, and a mid-flight agent cannot be paused from outside. Messages land at **turn/brief boundaries**; a backgrounded agent picks up its inbox when it next checkpoints, pauses, or is re-briefed. Routing through Sonnet (single writer) keeps it race-free. If you need true real-time hand-off, that is a serialize/partition decision (`09` §A), not a message.

---

## Three files, three roles

| File | Format | Writers | Concurrency model |
|------|--------|---------|-------------------|
| `.claude/session/context.md` | Narrative (markdown sections) | Sonnet owns header; sub-agents **append** one section at end of run | One write per sub-agent run; unique section header prevents collision |
| `.claude/session/token-log.md` | Append-only ledger (one line per run) | Every sub-agent appends ONE line at run end | Append-only = collision-safe by construction |
| `.claude/session/agents/<run-id>.md` | Per-agent scratch (optional) | One agent per file, no shared writes | Zero collision — file per agent |
| `.claude/session/agents/<run-id>.inbox.md` | SendMessage inbox (delivered at next brief) | Sonnet writes (the bus); agent reads | Sonnet single writer — race-free |

---

## Thread-safe rules — `context.md`

| Rule | Detail |
|------|--------|
| **Sonnet owns the file** | Sonnet creates, updates header, rotates, cleans. |
| **Sub-agents append only** | Opus / Haiku write ONE section at end of run. Never edit earlier content. |
| **One write per run** | Sub-agents write ONCE at run end — not incrementally. |
| **Read at run start** | Every agent reads `context.md` at start. Sonnet polls between steps. |
| **Unique section headers** | `## [Agent]-[task-id]-[HH:MM]` — unique per run, prevents collision. |
| **Parallel rule** | Parallel agents → different files (use `agents/<run-id>.md`) OR Sonnet serializes spawning. NEVER two agents writing context.md simultaneously. |

### Sub-agent section format (append at end of context.md)

```markdown
## [Opus|Haiku]-[task-id]-[HH:MM]
### Modified
- /absolute/path/file.java:42
### Added
- /absolute/path/NewFile.java
### Key findings / decisions
- [what was found / decided]
### Open questions for Sonnet
- [if any]
Tokens used: ~N,NNN
```

---

## Thread-safe rules — `token-log.md`

> **KNOWN HARNESS RESTRICTION:** Sub-agents (spawned via `Agent` tool) cannot write to `.claude/session/` — the harness protects its own session state from sub-agent writes. This is NOT configurable via settings.json (both project and global already have `Write(**)`). **Workaround:** sub-agent surfaces the intended log line in its final message; Sonnet appends it. This is the correct, permanent pattern.

Append-only single-line ledger. Each line:
```
[HH:MM] <agent> <task-id> tokens=~N,NNN files=<N> → /abs/path:line, /abs/path:line, ...
```

Example:
```
[14:32] opus L1.5-feature tokens=~18,400 files=3 → <touched files: service impl, config, the relevant port>
[14:47] haiku L1.5-tests     tokens=~3,100  files=2 → /apps/.../EnrichmentChainTest.java, /apps/.../FixtureLoader.java:12
```

**Why this design:**
- One append = atomic from the editor's perspective. No mid-write collision.
- Sonnet reads the tail to summarize the session — no scanning of full transcripts.
- Machine-readable: easy to sum tokens, count files, group by task.

---

## Thread-safe rules — `agents/<run-id>.md`

When Sonnet spawns parallel agents, each gets its own file:
```
.claude/session/agents/opus-L1.5-1432.md
.claude/session/agents/opus-L1.6-1432.md
.claude/session/agents/haiku-tests-1433.md
```
No two agents touch the same file → zero collision risk by construction.
After parallel run completes, Sonnet merges relevant findings into `context.md` and deletes the scratch files.

---

## Rotation policy (Sonnet executes)

Rotate (clear + extract decisions → `opus-brief.md §Current State`) when:
- Layer transition complete
- `context.md` exceeds ~150 lines
- All referenced work is committed or stale
- Session ends

Rotation steps:
1. Extract durable decisions → `opus-brief.md §Current State`
2. Append session summary → `opus-brief.md §Last Session` (overwrite previous)
3. Move `token-log.md` to `token-log.archive-YYYY-MM-DD.md` (optional)
4. Clear `context.md` to a fresh header
5. Empty `agents/` directory

---

## What lives where — quick reference

| Content | Location |
|---------|----------|
| Sprint state, active gates, next steps | `opus-brief.md §Current State` (durable) |
| What happened this session | `opus-brief.md §Last Session` (durable, overwritten each session) |
| In-progress work log, agent findings | `context.md` (temp — rotated) |
| Token + file-change ledger | `token-log.md` (temp — rotated) |
| Parallel-agent scratch | `agents/<run-id>.md` (deleted at rotation) |
| Permanent decisions, architectural choices | Memory files (durable across sessions) |
| Per-layer documentation | `docs/layers/LAYER-X.Y.md` |
---

## Repo memory vs harness auto-memory (one source of truth)

Two memory systems can coexist; **only one is authoritative.**
- **Repo `memory/*.md`** (vision · roadmap · debt · profile · MEMORY) — versioned, reviewable, travels with the repo across machines and agents. This is the **source of truth** the system reads (SessionStart injects it; `/close` updates it; `agent memory: project` is per-agent scratch, not project truth).
- **Harness auto-memory** (Claude Code's native memory dir) — convenient, but machine-local, opaque, and **not in git**. Treat it as ephemeral scratch.

**Rule:** durable truth (decisions, vision, debt) lives in repo `memory/` and is committed. Anything valuable that accumulates in harness auto-memory gets **distilled into the repo files at `/close`** — don't split-brain. The repo files starting as templates is a *content* gap (fill them), not a wiring gap; never rely on auto-memory for truth that must survive a machine change or a teammate clone.
