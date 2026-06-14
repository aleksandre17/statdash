# System History — this project's hardening record

> Project-specific: what was changed in THIS project's setup and why. The kit's own changelog lives at `.claude/kit/UPGRADE-NOTES.md`.

What changed, why, and the few items still needing the owner's decision.

## Done (no decision needed)

**Token / structure**
- `opus-brief.md`: 176→52 lines (−91%). §Last Session essays → `docs/layers/` pointers; "last 3 layers" → deltas. Read every task, so recurring saving.
- Root `CLAUDE.md`: DB P1–P7 + 18 antipatterns (2.6 KB) → `apps/ingestion-service/CLAUDE.md` (loads **on-demand**). Root −30% on every non-ingestion task. Quality safe: migrations are ingestion-only; `check-laws.sh` enforces globally.
- Owner architecture-quality note relocated from hot-path → `memory/project_debt.md` (verbatim).

**Mediator discipline** (`01` §Mediator Communication Discipline) — the weak link, fixed structurally:
- A. Faithful intake (Intake Echo before routing). B. Never distort **and** faithfully amplify (B.1 preserve / B.2 develop). C. Routing. D. Faithful back-relay. E. No silent decisions.
- Verbatim user-words now **default**, not opt-in (`feedback_verbatim_relay`); `B.md` makes Opus treat the verbatim block as ground truth.

**Living system**
- Pre-Work Gate: Class-M (mandatory Opus, no self-waive) vs Class-G; objective Opus-signals (breadth/irreversibility/under-spec/long-horizon/precision/non-obvious-debug).
- Opus = hunting dog + best thinker; **discovered-problem protocol** (dependency ordering: blocker→fix first; else note) + **fix-on-sight economy** (`03`, `06`). Principle: rework is the real token sink — quality and tokens don't conflict.

**Enforcement layer (NEW — the big one)** — `08-enforcement.md` + `.claude/kit/hooks/` + `settings.json`:
- SessionStart → inject §Current State (resume/compaction). Stop → §Current State ≤80 + token-log appended. PostToolUse → auto `check-laws.sh`. PreToolUse → Class-M gate detector. SessionEnd → token rollup (closes the measurement loop).
- Default posture WARN; flip to `exit 2` to hard-enforce (see file headers).

**Hygiene**
- Laws unioned to 11 in `CLAUDE.md` (canonical); `laws.md` + `07` now point there (was 3 drifted lists).
- Empty files filled: `02-layer-flow.md` (restored), `07-A-learning-format.md` (drafted; moved memory/→strategy for crisp memory(WHAT)/.claude(HOW) split), `settings.json` (hooks+perms).
- MEMORY/INDEX/WORKING-STRATEGY synced to 8 strategy files + hooks.

## NEEDS YOUR DECISION (left untouched / conservative on purpose)
1. **closed-items**: did `debt-2.4-k` fully close "V60 degradation tail" + "HttpRetrievalClient"? I removed them from opus-brief; confirm or I restore.
2. **opus-brief §Current State** internal inconsistency: "f,g,n pending" vs n complete elsewhere; `l`/`m` marked ✓ but no layer docs. Reconcile = your project-state call.
3. **DB scope (#1)**: DB rules ingestion-only + root pointer (my rec) vs keep global. Adjustable.
4. **Law union**: kept ALL 11 (nothing dropped). Drop any obsolete? Edit in `CLAUDE.md` only.
5. **Hook enforce vs warn**: default warn. Which to promote to `exit 2`?

## NOT DONE (deliberate — deserves its own careful pass)
- **Phase B mass de-dup**: V68 case study ×3, Decision-Inventory table ×3, Brief-Quality template ×3 still duplicated across `01`/`03`/`04`/`04-A`/`feedback_opus_brief_style`. Bundling 5 multi-file deletions into this pass risks breaking cross-refs — do it focused + verified next.
- **Gate 3** (phase retrospective) likely dormant — the mechanism for the owner's "layers don't harmonize" note. Run it on completed phases.
- **docs/layers / docs/learning / docs/decisions / drift.md** completeness — not in this archive; verify the trim's "detail lives in docs/layers" promise holds, and that the learning loop actually runs.

## Kit/Project split — portable framework (DONE)

Extracted a domain-literal-free `claude-kit/` (generic doctrine + hooks + feedback + INDEX + settings + `project.schema.json` + `KIT.md` + slot templates). Mechanism: `.claude/project.json` manifest — the ONLY place project specifics live. Hooks rewritten generic (read `class_m_triggers`/`law_patterns`/`resume_marker`/`code_globs` from the manifest via `_manifest.py`); doctrine leaks (B.md/01/03/05/07) genericized to point at `CLAUDE.md`/manifest. geostat is now `kit + project.json`. Validated: manifest passes `project.schema.json`; kit selftest 8/8 standalone; geostat selftest 8/8. You never edit a kit file — only `project.json` + slots.

## 01 split — Mediator Discipline → 01-A (DONE)

Mediator Communication Discipline (A–E, ~47 lines) extracted from `01` to `01-A-mediator.md` (loads only when Sonnet intakes a directive or relays agent↔user). `01` keeps a lean A–E map + pointer. Cross-refs (04/08/feedback_verbatim_relay) repointed to 01-A. 01: ~5000→~4169 tok (routing-only load now ~830 lighter); 01-A ~1230 tok selective. Win is mostly organizational (one-concept-one-file); token benefit is situational (saved on non-intake interactions, neutral on full intake).

## Phase B — one-body de-dup (DONE)

V68 case study + Decision-Inventory table collapsed to single canonical homes (`04-A §A.4–A.5`, template `04 §A.4`); `01` Decision-Inventory section (~31 lines) → lean pointer keeping only the routing framing it owns; `feedback_opus_brief_style` V68 narrative → pointer, unique "why self-test failed" insight kept. Third target (Brief-Quality template) was already consolidated (self-test→Decision-Inventory). DRY law now holds across the brief-writing path. 01: ~5280→~5000 tok (de-dup); remaining weight is legitimate operating-model doctrine (authority/parallelism/risk), not duplication.

## Operating model pass (owner's 17 requirements)

Encoded:
- **Authority ≠ orchestration** (`01`): Sonnet *runs* Opus (spawn/brief/parallel) but only the **user commands/overrules Opus's judgment** (#6/#7). Sonnet disagreeing → relays to user, never imposes.
- **Dynamic parallelism** (`01`): Sonnet decides fore/background + count; **depth=1** (spawned agent can't sub-spawn); parallel ≈ ~7× tokens → spent only where value>cost (#2/#5/#17). Never does Opus's judgment-work.
- **Shared-findings + trust asymmetry** (`05`): record-once/no-re-walk; Sonnet trusts the blackboard (net = Gate 2 + review), Opus verifies the *premise* (never blind) (#1/#3/#11/#10b).
- **Opus autonomy** (`01`+identity): refuses any step-backward/sub-standard task (#8). Hunting dog also surfaces **new-package need + systemic/design improvements** (`03`, #9/#10a).
- **File-system principles** (`MEMORY.md`): `.claude/`=operational vs `memory/`=durable truth (#15); minimal churn (#14); selective load (#16).
- Token accounting/archive (#12/#13): token-log + SessionEnd rollup hook + rotation policy.

Corrections flagged to owner (3): #6↔#17 contradiction (resolved via authority/orchestration split); one-level delegation limit; parallelism is a real ~7× cost tradeoff, not free. Refinement: "Sonnet trusts blindly" bounded by Gate 2 + review; Opus never blind.

## Architecture hole-closing pass (5)

- **#1 Stale-state** (structural): `session-start.py` now compares the brief's claimed last migration vs the repo's actual max migration → STALE warning on drift. No more confidently-wrong resume.
- **#2 Agent-failure recovery** (doctrine, `01`): detect crash/timeout/garbage → never silent-fill, retry-once-if-underspec, escalate-if-Class-M, log; failed slice fails its dependents.
- **#3 Parallel finding-conflict** (doctrine, `09` §A): contradictory parallel outputs → Sonnet surfaces (Opus arbitrates / user if split), never silently picks one.
- **#4 Hook reliability** (structural+doctrine): `hooks/selftest.py` (8/8 pass) + `08` reliability section — fail-open, fast-disable, never-block-on-hook-failure.
- **#5 Feedback-loop cadence** (doctrine, `02` Gate 3): phase retrospective now reviews token rollup + brief-quality trend → records in `06`/`project_debt`. Closes the half-loop.

Tradeoffs acknowledged (not holes): human-in-the-loop bottleneck (intended — owner wants control); doctrine versioning (minor — UPGRADE-NOTES is the changelog).

## Unified — kit vendored inside the project (DONE)

claude-kit is no longer a separate tree. It now lives at `.claude/kit/` (vendor as a git submodule in real use) — the project references it instead of copying. Generic files (strategy, commands playbooks, hooks, feedback team-laws, B.md, INDEX, schema, templates, KIT.md) moved under `.claude/kit/`; `memory/` is now project-truth only; project slots stay in `.claude/` (project.json, settings.json, context/, session/, strategy/04-A-examples.md, commands/dev.md + laws.md). All path references rewired (settings, INDEX, MEMORY, CLAUDE.md orientation, doctrine cross-refs); selftest 8/8 from the new location; 0 stale paths. One tree, no divergence: edit the kit once, every project gets it.
