---
title: Working-tree loss guard (two-tier, WARN-only) + dependency-arrow ownership (eslint SSOT)
status: Accepted
date: 2026-07-08
authors: senior-backend, architect
extends: ADR-012 (platform structure), the kit hook-suite (.claude/kit/hooks)
---

# ADR-0033 — Working-tree loss guard + dependency-arrow ownership

**Status:** Accepted (implemented in the `.claude/kit/hooks/` suite).

## Context

Two independent hardening decisions for the kit hook-suite (Python tooling that runs outside the
model on every Edit / SessionStart / Stop), surfaced by a chief-engineer audit.

**(1) Working-tree loss.** A phantom worktree/checkout (a stray or mis-pointed git worktree, an
aborted checkout, an agent running in the wrong cwd) can silently delete a large swath of tracked
files from the working tree while the content is still perfectly safe in HEAD. The prior hook-suite
had no structural signal for this: a resumed session could open onto a half-emptied tree with no
warning, and the natural "recovery" reflex (commit the current state) would be the one action that
actually destroys the recoverable content. We need a loud, recovery-oriented signal — without ever
mutating the tree ourselves and without blocking a turn.

**(2) Dependency-arrow ownership.** The dependency arrow
(`contracts ← expr ← core ← charts ← react ← plugins ← apps`) is enforced authoritatively by eslint
`no-restricted-imports` (`platform/eslint.config.js`). The kit manifest also carried two regex
`law_patterns` (`Arch-engine-no-react`, `Arch-react-agnostic`) that mirror two arrow edges. Two
enforcers for one rule invites drift and false confidence: a reader can't tell which is the source
of truth, and the regex tripwires only catch fully-qualified import specifiers, not relative ones —
so they are strictly weaker than eslint and must never be mistaken for the real gate.

## Decision

### 1. Two-tier working-tree loss guard — WARN-only, read-only, recovery-first

- **Tier A (post-hoc detection, SSOT `_worktree.py`).** One shared module, `deletion_report(root, mf)`,
  imported by both `stop-check.py` (Stop → WARN loop, exit 0) and `session-start.py` (resume →
  printed immediately after RESUME STATE, before the operating contract, so a wiped tree is the
  first thing seen). It runs read-only git (`diff --name-status HEAD`, `ls-tree`) and alarms on two
  tiers: total deletions ≥ `bulk_delete_threshold` (default 25), OR any declared module root with
  ≥ `module_root_empty_ratio` (default 0.9) of its HEAD-tracked files gone. The message names the
  emptied roots, states the content is still safe in HEAD, says DO NOT commit, and gives the exact
  `git restore --source=HEAD` recovery command per root plus the `git worktree list` / `git reflog`
  investigation hint. Thresholds and module roots come from the manifest — zero domain literals.
- **Tier B (pre-command reminder, `pre-bash-guard.py`).** A `PreToolUse:Bash` hook that matches only
  *whole-tree catastrophic* forms (recursive-force `rm`, `git reset --hard`, `checkout`/`restore`/
  `clean` of `.`, `git worktree remove|prune`) against a manifest-configured (or built-in default)
  regex list, and injects a *non-blocking* `additionalContext` reminder that uncommitted work is not
  in HEAD and cannot be restored after the command runs. It never matches plain `rm <file>` or
  `git checkout <branch>`. As the sole permitted hook write, it optionally takes a side-effect-free
  `git stash create` snapshot (a dangling commit object only — no worktree/index/ref mutation),
  logs the SHA to `.claude/session/worktree-snapshots.log`, and names it in the reminder as a
  concrete recovery point. Any doubt → reminder-only.
- **Invariants:** No hook ever mutates the working tree, index, or refs (read-only git only, plus
  the one sanctioned `git stash create`). Both tiers degrade to silent on no-repo / git-absent /
  any exception — a safety net must never crash or block a turn.
- The committed-wipe case (a deletion already committed, HEAD vs HEAD~1) is intentionally **out of
  scope (YAGNI)** — this guard targets the uncommitted phantom-wipe, where HEAD still holds every
  file and `restore` fully recovers.

### 2. eslint is the single source of truth for the dependency arrow

`post-edit-laws.py`'s docstring now states it verbatim: eslint `no-restricted-imports` owns the
dependency arrow and all import-shaped boundaries (contracts purity, xlsx ACL, panel reach-in);
`post-edit-laws.py` owns only what the import graph cannot express — content/purity invariants
(privileged-dims, declarative-DataSpec, locale-agnostic literals, committed-secret shapes) — plus an
explicitly **non-authoritative fast pre-lint tripwire** on the two highest-blast arrow edges. The two
arrow `law_patterns` are **kept but re-labelled** in their `msg` as "non-authoritative fast pre-lint
tripwire; SSOT = eslint", and are deliberately **not extended** to further edges. New arrow edges are
added to eslint, never mirrored into the manifest.

## Rejected Alternatives

1. **(1a) PreToolUse:Bash as the primary loss defense.** REJECTED as *primary* — a phantom
   worktree/checkout wipe often involves **no destructive tool call at all** (it happens out-of-band,
   or via a benign-looking command), so a command-matcher would miss the incident entirely. Tier B is
   a useful *pre-emptive reminder*, but the authoritative signal must be post-hoc detection of the
   actual tree state (Tier A). Kept both, as complementary layers.
2. **(1b) Hard-block on mass deletion.** REJECTED — the content is still in HEAD; blocking the turn
   adds no recovery value, and a hard block at the session boundary trains bypass behavior and can
   strand a legitimate large refactor. WARN + exact recovery command is strictly more useful and
   never traps the operator. (Guardrail: no blocking at the session boundary; Tier B is non-blocking.)
3. **(2a) Hooks fully mirror the arrow (regex law per edge).** REJECTED — duplicating the arrow across
   eslint and manifest regex guarantees drift (a new edge added in one place, forgotten in the other)
   and false confidence (the weaker regex, which only catches fully-qualified specifiers, looks like a
   real gate). One rule, one owner.
4. **(2b) Delete the two tripwire law_patterns entirely.** VIABLE alternate, noted and not chosen —
   the two edges (core↛react, react↛app) are the highest-blast reversals, and a sub-second pre-lint
   nudge at edit time (before the eslint run) has real ergonomic value. Retained as explicitly
   non-authoritative rather than deleted; if they ever cause noise, deleting them is the fallback.

## Consequences

- **Positive:** A phantom working-tree wipe is now loud at both the Stop boundary and on resume, with
  a copy-paste recovery command and an explicit "do not commit" warning; the guard never mutates state
  and never blocks; the arrow has exactly one authoritative owner (eslint) with the manifest tripwires
  honestly labelled as non-authoritative. The loss detector is one shared module (`_worktree.py`, DRY),
  covered by a git-backed fitness test in `selftest.py` (tmp-only `git init`, never the real repo).
- **Reversibility:** Fully reversible — every piece is additive (a new module, a new non-blocking hook,
  manifest keys with safe defaults). Removing the guard degrades to the prior no-signal behavior;
  removing the tripwires degrades to eslint-only (already the SSOT).
- **Cost / accepted trade-off:** Tier A adds two read-only git calls on Stop/SessionStart (bounded by a
  10s timeout, silent on failure). Tier B adds a regex scan per Bash call and, only on a match, one
  `git stash create`. The manifest carries a small `worktree_guard` block; the two arrow regexes remain
  as a deliberate, labelled fast-path duplicate of two eslint edges — the one sanctioned exception to
  "one rule, one owner", justified by edit-time ergonomics and bounded to two edges.
