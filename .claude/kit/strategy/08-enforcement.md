# 08 — Enforcement Architecture (which disciplines are structural, which are judgment)

> The system's creed is `04` §C: "Rules cannot override reflex. Structure can." This file makes that literal.
> It names, for every discipline, **where** it is enforced — so we stop confusing a documented rule with a guaranteed one.
> Loaded by Sonnet when wiring/auditing hooks, or when a discipline keeps getting skipped.

---

## The three enforcement tiers

| Tier | Mechanism | Property |
|------|-----------|----------|
| **Structural** | Claude Code **hooks** (`.claude/kit/hooks/` + `settings.json`), `check-laws.py`, Gate 2 tests, ArchUnit | Runs outside the model, every time. Cannot be skipped or forgotten. |
| **Judgment** | Prompt-layer doctrine (`01`–`07`, `B.md`) | Requires the agent to *decide*. Cannot be automated — and should not be faked into a hook. |
| **Hybrid** | Hook surfaces a reminder; agent still judges | The hook guarantees the *prompt* fires; the decision stays human/Opus. |

The design rule: **every mechanically-checkable discipline belongs in the Structural tier. Only genuine judgment stays in the Prompt tier.** A skipped rotation is not a judgment failure — it is a missing hook.

---

## Discipline → enforcement map

| Discipline (was "please remember") | Hook / mechanism | Event | Posture |
|---|---|---|---|
| Resume from durable state (cold/compacted session) | `session-start.py` injects opus-brief §Current State | SessionStart | inject |
| §Current State ≤ 80 lines (rotation) | `stop-check.py` | Stop | warn → flip to `exit 2` to enforce |
| token-log appended this session | `stop-check.py` | Stop | warn → enforce |
| Forbidden DB/Law antipatterns | `post-edit-laws.py` → `ops/scripts/check-laws.py` | PostToolUse (Write/Edit) | feed-back (`exit 2`) |
| Pre-Work Gate fires on Class-M triggers (new migration/module/port) | `pre-edit-gate.py` (path-pattern detector) | PreToolUse (Write/Edit) | inject reminder (non-blocking) |
| Irreversible/high-blast surface → run Task-degradation risk (`09` §B) | `pre-edit-gate.py` flags migration/contract as IRREVERSIBLE | PreToolUse | inject reminder |
| Learning note due (code changed, no `docs/learning/` note) | `stop-check.py` (git-diff, balanced) | Stop | warn (judgment — not every change qualifies) |
| Token-economy is measured, not estimated | `session-end-tokenlog.py` rollup | SessionEnd | record |
| State survives compaction | `session-start.py` re-injects on `compact` source; (optional `PreCompact` snapshot) | SessionStart/PreCompact | inject |

## Stays JUDGMENT (do not automate — these are the real work)
- Decision Inventory genuineness (`01` Objective Opus-signals) — a hook can force the *prompt*, not the *answer*.
- Intake Echo faithfulness + faithful amplification (`01-A-mediator.md` §A/B).
- Tier 1 vs Tier 2, blocker-vs-proceed (`03`).
- Discovered-problem dependency ordering (`03` Observation Duty).
- Brief quality / "Steps-disguised-as-problem" grading (`03`).

## Posture policy
Default **warn** (exit 0 + stderr) so the system never traps the operator. Promote a check to **enforce** (`exit 2`) only after it has proven stable and the discipline still gets skipped. `post-edit-laws.py` ships enforcing because law violations are unambiguous and cheap to fix.

## Hook reliability (load-bearing hooks are a single point of failure)

Hooks run outside the model, so a broken one fails silently or blocks everything. Guards:

- **Self-test before relying:** `python .claude/kit/hooks/selftest.py` runs every hook against synthetic inputs (touches no real state) and reports PASS/FAIL. Run it after editing any hook or on a new machine.
- **Fail open, not closed:** every hook catches its own errors and exits 0 (warn), so a bug degrades to *no enforcement*, never to *block-all*. Only `post-edit-laws.py` exits 2 — and only on an unambiguous matched pattern. **A hook failing is a WARN, never a block.**
- **Fast-disable:** comment out the offending block in `settings.json` (or all of `hooks`) to drop to model-only behavior instantly. The doctrine still holds without hooks — they are a safety net, not the source of the rules.
- **No `python` on PATH** = hooks silently no-op. `selftest.py` surfaces this; on Linux/mac without `python`, switch the command prefix to `python3`.

## Cross-platform note
Hooks run on the host shell. The `.py` scripts assume POSIX (Git Bash / WSL / Linux). On pure PowerShell, mirror each as a `.ps1` and update the `command` strings in `settings.json`.

---

## These hooks are fitness functions

In architecture-governance terms (Evolutionary Architecture), this enforcement layer *is* a set of **fitness functions** — automated checks that assert architectural characteristics hold over time (dependency direction, layering, forbidden patterns, schema rules). `law_patterns` + the hooks are how a rule holds **by default** instead of by policing. When `/audit` or `/architecture` finds a rule enforced only by prose, the fix is to add a fitness function (a `law_patterns` entry), not another reminder. Architecture-protection vectors → defenses: `10-architecture-protection.md`.

---

## How compliance is actually forced (honest: hard vs soft)

You cannot make an LLM follow markdown with certainty. So the system splits enforcement into what is **deterministic** (the model cannot bypass) and what is **biased** (strong, not guaranteed):

**Hard — runs outside the model, every time:**
- **Hooks** — `post-edit-laws.py` exits 2 → the edit is *blocked*; `pre-edit-gate.py` injects a Class-M reminder; `stop-check.py` can block a stop with open violations; `session-start.py` injects the operating contract + resume state. These are shell commands the harness runs regardless of the model's intent.
- **Agent frontmatter** — `model:` *forces* which model runs an agent; `tools:` (incl. the `Agent()` allowlist) *forces* what it can call. The model literally cannot use a tool outside its allowlist.
- **settings.json** — default `agent`, permissions.

**Soft — biased toward compliance, not guaranteed:**
- `CLAUDE.md` (always loaded) + the SessionStart operating-contract injection keep the core rules in context every turn.
- Strategy docs (on-demand via INDEX), brief/mediator/refusal discipline — followed when read; high adherence because they're short, named, and reinforced, but ultimately instructional.

**To move a rule from soft → hard: encode it as a hook (a fitness function).** Anything checkable by a pattern or command (`law_patterns`, path triggers, required output blocks) should become a hook so it holds by default. `/verify` (`doctor.py`) proves the hard layer actually fires on your config — run it after `/bootstrap` and `/upgrade`.
