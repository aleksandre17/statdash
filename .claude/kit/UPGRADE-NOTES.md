# Kit Changelog

> One entry per version. Read on `/upgrade`. Newest first.

## 1.4.4 — owner's philosophy preserved (full soul integrated)

The previously-empty `user_philosophy.md` arrived with content. Transferable orientations woven in (dashboard/JSON-renderer case-specifics deliberately excluded — that is a separate Geostat product): skill §5 gains **architecture-leads-code-follows** as a governance principle (legacy code migrates to the target via Strangler-Fig; never bend the architecture to violations); §11 platform-thinking gains the **extension-point check**. The owner's standing **engineering philosophy + collaboration style** are preserved in `memory/user_profile.md` (full-standards-not-partial · high abstractions · best-solution/root-cause · benchmark-against-the-best · plan-first · why≥what). Validated again: the two projects share one soul.

## 1.4.3 — inherited engineering orientations (from a sibling project's soul)

Integrated transferable highest-standard orientations distilled from another of the owner's projects (a component-platform kit), keeping only the universal concepts (its stack-specific lessons were left out):
- Skill §11 — **standards of resolution** (the "done" bar = works + agnostic + ISP-clean + extensible + tested; **root-cause over symptom**, stated as root cause → standard → fix) and **platform-level thinking** (solve once as reusable power, balanced by YAGNI).
- Orchestrator — the **"who before how" reflex** ("I can" ≠ "I should"; judgment work routes to a senior).
These validated heavy overlap between the two systems (plan-before-implement, delegate-verbatim, read-before-edit, agnostic-core, architecture-leads were already present).

## 1.4.2 — agents hold standards, not case-state (transferable requirements)

Project agents carried transient case-specifics (version gates, named seams, debt-item codes, exact ports) that bound them to one moment and duplicated the module CLAUDE.md / project_debt. Rewrote all specialists + database-architect + senior-frontend to hold **highest standards as transferable concepts** (dependency direction, resilience, contracts-as-interfaces, pipe-and-filter, polyglot/idempotent data, i18n/runtime-config) and to **read the current specifics from the authoritative sources** (`<module>/CLAUDE.md` + `project_debt`) at runtime. The `module-specialist` template is now concept-first too, so new modules inherit the principle. Result: every agent works optimally in any situation, and there is no stale case-state in a prompt.

## 1.4.1 — full-body coherence pass (schema completeness)

Whole-system validation: 127 files cross-checked — INDEX covers every command/strategy/feedback/skill, allowlist ⊇ all agents, doctor checks the full roster, version coherent across VERSION/manifest/changelog, no dangling refs or orphans, all `NN`/`NN-A` cross-references resolve. One gap fixed: the schema now documents **every** manifest field (added `modules`, `shared_lib_root`, `$schema`) — the manifest↔schema contract is now complete.

## 1.4.0 — senior-concept deepening + craftsmanship catalog

- Skill gains **§11 Craftsmanship & refactoring**: code-smell taxonomy + Fowler refactoring catalog + clean-code rules (the code-level half of senior judgment that was missing).
- Every Opus senior now **auto-loads the standards skill** (added debugger + project-manager) and carries an explicit **highest-concept lens** naming the sections it wields (architect: full catalog; debugger: resilience/concurrency/consistency/observability; project-manager: delivery/DORA/risk-ordering).
- B.md ↔ 03 layering made **explicit** (B = compact always-on rule; 03 = full protocol; cross-referenced) — confirmed correctly layered, not merge-able; the only true format duplicate (Brief-quality) already consolidated to B.md. Feedback files deliberately NOT merged (per-trigger on-demand load = token economy).

## 1.3.1 — agent-as-lead protocol (talk to a specialist directly)

Documented the native Claude Code mechanism for running a specific agent as the lead: `@agent-<name>` (one task, orchestrator stays) and `claude --agent <name>` (the main session becomes that agent — prompt+tools+model, persists on resume). Same trade-off as the Opus-lead switch (no orchestration while a specialist leads) and same continuity rule (durable state, not the chat thread); hooks + refusal still bind. Doctrine in `01-A`; pointers in README + INDEX. Docs-only.

## 1.3.0 — /mode operating-mode switch

New `/mode` command + `.claude/session/mode` state: switch the whole team's posture in one word — **build** (default) · **plan** (design only, no edits) · **review** (scrutiny) · **strict** (max enforcement, reversible-first) · **fast** (minimal ceremony, reversible tasks). SessionStart injects the active mode every session; the orchestrator respects it. Binding invariant: a mode is a posture, never a bypass — no mode disables the hard guards (laws · Class-M · architecture · bloat · Intake Gate · refusal); `fast` cuts questions, never safety.

## 1.2.0 — canonical pass: agent-mirror drift guard + skill/DRY consolidation

- **Agent two-folder model made canonical + drift-proof.** Claude Code discovers only `.claude/agents/`, so active copies must live outside the kit; the kit holds the seeds. Role-agent project copies are now declared **verbatim mirrors**, tuned ones carry `tuned: true`, and **doctor flags any undeclared divergence** — killing the stale-agent class of bug. Rule documented in `KIT.md`.
- **DRY:** the "Brief quality" epilogue had three copies → canonical home is `B.md`; `03` and `04` now reference it.
- **Skill gaps filled from source chat:** §7 data (ACID/BASE · isolation levels · CAP/PACELC · consistency models), testing (TDD/BDD · test-doubles · the full type taxonomy · consumer-driven contracts), API (RFC 9457 Problem Details).
- **Orchestrator routing** made explicit: match every task to tier+agent via the rank matrix; ask rather than misroute.

## 1.1.0 — real slash commands (/bootstrap etc. now work)

Playbooks live in `kit/commands/` (canonical) but Claude Code only discovers slash commands in `.claude/commands/`. Added thin **shims** there for all 14 playbooks (`/bootstrap /audit /architecture /roadmap /layer /refactor /debt /review /close /board /collab /verify /upgrade /senior`) — each points to its canonical kit playbook, so `/name` works natively AND natural-language invocation still works. `/bootstrap` scaffolds the shims; doctor verifies them. Same kit/project pattern as agents and skills.

## 1.0.9 — Intake Gate v2 (clarify + propose-the-best)

The lead's gate is now six steps: Echo → **clarify-until-clear** (simple, jargon-free questions in the owner's language, as many rounds as needed — guessing forbidden) → standards pre-check with hard pause on violations → **propose the best approach/pattern for every stated intent** (architect supplies it for architectural ones) → journey naming → route. The lead never transcribes an intent into tasks without offering the best-known route first.

## 1.0.8 — journeys + repo structure standard

New `12-journeys.md`: situation→workflow map (new project · improve existing · refactor · feature · incident · DB change · architecture decision · collab · daily) with canonical output locations; the repo-root folder standard + hexagonal module layout; the guardrail stack summarized. Lead now names the journey before work and pauses on deviation. Doctor gains a repo-top structure check (`hygiene.repo_sanctioned_top`). Token rule reaffirmed: Quality → Learning → Tokens.

## 1.0.7 — /collab task-force protocol

New playbook: multi-senior collaboration on one problem (user + 2–4 agents chosen by lens). Card-anchored, one shared append-only scratch, round structure (analyze → verbatim synthesis with explicit agreements/conflicts → user decides), conflict rule from `09` §A, exit via ADR + brief distillation. Closes the gap where multi-agent collaboration had no choreography.

## 1.0.6 — skill: security + operations sections

`architecture-standards` skill gains §9 Security (OWASP/ASVS · STRIDE · OAuth2/OIDC · Zero Trust · secrets · supply chain/SBOM) and §10 Operations (observability pillars · SLI/SLO/error budgets · AKF scale cube · caching strategies · trunk-based/IaC/GitOps · FIRST tests · standards-as-code). Chief-engineer and senior-backend-developer get pointwise lens lines. Pure knowledge addition — loads on demand only.

## 1.0.5 — prevention layer (system hygiene)

New `hygiene` manifest section + four standing guards: **file-bloat hard block** (post-edit-laws blocks any edit leaving a file over limit×hard_factor — split, don't append; doctor reports soft-limit breaches) · **structure guard** (doctor checks `.claude/` against sanctioned dirs; new structural homes go through Intake Gate + architect proposal, never a silent mkdir) · **token-weight protocol** (on-demand loading discipline reaffirmed) · **Intake Gate extended to the user's structural plans** (wrong folders/architecture in the request itself → pause before work + best-quality counter-proposal). Doctrine: `10` §Prevention protocol.

## 1.0.4 — full team (rank matrix) + chief overseer

New agents: **chief-engineer** (Opus, the supreme all-seeing overseer — system-wide coherence + quality command, read-only) · **project-manager** (Opus — board/roadmap/DoD discipline) · **senior-backend-developer** + **senior-frontend-developer** (Opus — hard implementation after design, carrying the resilience/concurrency and state/a11y/CSS-architecture pattern sets pointwise from the standards skill) · **markup-specialist** (Sonnet, middle) · **junior-executor** (Haiku — bulk-to-spec, flags instead of guessing). `01` gains the Rank-matrix table (lead/oversight/senior/middle/junior as one body, depth-1 intact). Session token-log archives moved to `session/archive/`. Doctor verifies the full roster.

## 1.0.3 — work board (planning workspace) + Task Intake Gate

New: file-based kanban (`strategy/11-work-board.md` + `/board` playbook + `templates/work/`). Cards = stable files with status in frontmatter (no folder moves — git history and links survive); BOARD.md is a generated view; flow rules 1–7 binding (nothing starts off-board, planning playbooks emit cards, WIP ≤ 2, rejection needs a reason). Opt-in per project via `paths.work_dir` (drafted by default for new projects); `/bootstrap` scaffolds it, doctor verifies it.
New: **Task Intake Gate** on the lead — before executing ANY task (the user's included), a standards pre-check; a task that would violate laws/architecture or degrade a guarantee is stopped BEFORE work starts, with the violation named and a better alternative proposed; the user decides.

## 1.0.2 — model-agnostic lead (role ≠ model)

The orchestrator's frontmatter no longer pins `model:` — the lead inherits the session model. Default Sonnet (economy); `/model opus` upgrades the lead's reasoning for judgment-heavy sessions with **zero behavioral change**: routing, gates, mediation, refusal, depth-1, and Class-M→architect bind identically on either model. Doctrine updated (`01` swappable-lead rule, `01-A` Mode 2 — switching no longer trades away orchestration). Pure kit change; pull via `/upgrade`.

## 1.0.1 — Windows path-separator hardening (enforcement fix)

`pre-edit-gate.py` and `post-edit-laws.py` now normalize backslashes to forward slashes before matching path regexes/globs. Closes a Windows-only enforcement hole: a `file_path` with backslashes (e.g. `apps\…\db\migration\V95__x.sql`) previously slipped past the Class-M migration gate silently. `doctor.py`'s probe now uses a forward-slash path, so `/verify` reports the live-fire check correctly on Windows (was a false 38/39). Pure kit fix — no project changes; pull via `/upgrade`.

## 1.0.0 — initial release

Orchestration framework: decision-density routing (Sonnet/Opus/Haiku), mediator discipline, Class-M gates, enforcement hooks (session-start · pre-edit-gate · post-edit-laws · stop-check · token-log · selftest), playbooks, agent layer + per-module specialist generation, architecture-protection law patterns, architecture-standards skill, bootstrap + doctor.
